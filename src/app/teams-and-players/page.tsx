import { prisma } from '@/lib/prisma';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import { resolveCurrentEdition } from '@/lib/current-edition';
import { filterMainTeams, filterSpocTeams, isSpocExhibitionTeam } from '@/lib/spoc-teams';
import { resolveTeamFace } from '@/lib/team-identity';
import { safePublicImageUrl } from '@/lib/safe-image-url';
import { DELETED_USERNAMES } from '@/lib/mock-data';
import { gradingSettingKey, parseGradingGrid, resolveTargetForCell } from '@/lib/grading';
import TeamsAndPlayersClient, { type RosterTeam } from './TeamsAndPlayersClient';

export const dynamic = 'force-dynamic';

const DUMMY_USERNAMES = new Set(['rajesh_cbot', 'queen_ananya', 'striker_vikram']);

function isVisibleUser(user: { id?: string | null; username?: string | null } | null | undefined) {
  if (!user?.id) return false;
  const uname = user.username?.toLowerCase() || '';
  if (uname && DUMMY_USERNAMES.has(uname)) return false;
  if (uname && DELETED_USERNAMES.has(uname)) return false;
  if (DELETED_USERNAMES.has(user.id.toLowerCase())) return false;
  return true;
}

function parseGradeRank(grade?: string | null): number {
  if (!grade) return 999999;
  const match = grade.match(/\d+/);
  if (match) return parseInt(match[0], 10);
  return 999999;
}

function toMember(
  user: { id: string; name?: string | null; username?: string | null; image?: string | null; target?: number | null },
  isCaptain: boolean,
  gradeInfo?: { grade?: string | null; target?: number | null } | null,
  fallbackTarget?: number | null,
) {
  const grade = gradeInfo?.grade || null;
  const target =
    gradeInfo?.target !== undefined && gradeInfo?.target !== null && Number(gradeInfo.target) >= 0
      ? Number(gradeInfo.target)
      : fallbackTarget !== undefined && fallbackTarget !== null && Number(fallbackTarget) >= 0
        ? Number(fallbackTarget)
        : null;

  return {
    id: user.id,
    name: user.name || user.username || 'Player',
    username: user.username || '',
    image: safePublicImageUrl(user.image) || undefined,
    isCaptain,
    grade,
    target,
  };
}

export default async function TeamsAndPlayersPage() {
  const cms = await getWebsiteCmsContent();

  const edition = await resolveCurrentEdition();

  const [teams, gradingSetting, editionParticipants, targetLogs] = edition
    ? await Promise.all([
        prisma.team.findMany({
          where: { editionId: edition.id },
          include: {
            captain: { select: { id: true, name: true, username: true, image: true, target: true } },
            members: {
              include: { user: { select: { id: true, name: true, username: true, image: true, target: true } } },
            },
            spocMembers: {
              include: { user: { select: { id: true, name: true, username: true, image: true, target: true } } },
            },
          },
          orderBy: { name: 'asc' },
        }),
        prisma.systemSetting.findUnique({
          where: { key: gradingSettingKey(edition.id) },
        }),
        prisma.editionParticipant.findMany({
          where: { editionId: edition.id },
          select: { userId: true, category: true },
        }),
        prisma.playerTargetLog.findMany({
          where: { editionId: edition.id },
          orderBy: { effectiveFrom: 'desc' },
          select: { userId: true, target: true },
        }),
      ])
    : [[], null, [], []];

  const latestTargetByUserId = new Map<string, number>();
  for (const log of targetLogs) {
    if (!latestTargetByUserId.has(log.userId) && log.target !== undefined && log.target !== null && Number(log.target) >= 0) {
      latestTargetByUserId.set(log.userId, Number(log.target));
    }
  }

  const gradingGrid = gradingSetting?.value ? parseGradingGrid(gradingSetting.value) : null;
  const userGradeTargetMap = new Map<string, { grade: string | null; target: number | null }>();

  if (gradingGrid && Object.keys(gradingGrid.cells).length > 0) {
    const colById = new Map(gradingGrid.columns.map((c) => [c.id, c]));
    Object.entries(gradingGrid.cells).forEach(([key, userId]) => {
      const [colId, rowStr] = key.split(':');
      const col = colById.get(colId);
      const rowIndex = parseInt(rowStr, 10);
      const grade = col?.label || null;
      let target = col ? resolveTargetForCell(col, rowIndex) : null;
      if ((target === null || target === undefined || target < 0) && latestTargetByUserId.has(userId)) {
        target = latestTargetByUserId.get(userId) ?? null;
      }
      userGradeTargetMap.set(userId, { grade, target });
    });
  }

  // Also check edition participant records for saved category / grade
  if (editionParticipants.length > 0) {
    for (const p of editionParticipants) {
      if (!p.category) continue;
      const existing = userGradeTargetMap.get(p.userId);
      const target = existing?.target || latestTargetByUserId.get(p.userId) || null;
      if (!existing) {
        userGradeTargetMap.set(p.userId, { grade: p.category, target });
      } else if (!existing.grade) {
        existing.grade = p.category;
      }
    }
  }

  const toRoster = (team: (typeof teams)[number]): RosterTeam => {
    const face = resolveTeamFace({ id: team.id, name: team.name, tag: team.tag, logo: team.logo });
    const captain = team.captain && isVisibleUser(team.captain) ? team.captain : null;
    const fromParticipants = isSpocExhibitionTeam(team)
      ? (team.spocMembers || []).map((m) => m.user)
      : (team.members || []).map((m) => m.user);

    const byId = new Map<string, ReturnType<typeof toMember>>();
    if (captain) {
      byId.set(
        captain.id,
        toMember(captain, true, userGradeTargetMap.get(captain.id), latestTargetByUserId.get(captain.id)),
      );
    }
    for (const user of fromParticipants) {
      if (!isVisibleUser(user)) continue;
      if (byId.has(user.id)) continue;
      byId.set(
        user.id,
        toMember(user, captain?.id === user.id, userGradeTargetMap.get(user.id), latestTargetByUserId.get(user.id)),
      );
    }

    const members = Array.from(byId.values()).sort((a, b) => {
      const aGradeRank = parseGradeRank(a.grade);
      const bGradeRank = parseGradeRank(b.grade);
      if (aGradeRank !== bGradeRank) return aGradeRank - bGradeRank;
      if (a.isCaptain !== b.isCaptain) return a.isCaptain ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return {
      id: team.id,
      name: face.name,
      tag: face.tag,
      logo: safePublicImageUrl(face.logo) || '/logo.png',
      description: team.description || '',
      isSpoc: isSpocExhibitionTeam(team),
      captainName: captain?.name || captain?.username || null,
      members,
    };
  };

  const main = filterMainTeams(teams).map(toRoster);
  const spoc = filterSpocTeams(teams).map(toRoster);

  return (
    <TeamsAndPlayersClient
      pageCms={cms.pages.teamsPlayers}
      editionTitle={edition?.title || cms.site.editionLabel}
      mainTeams={main}
      spocTeams={spoc}
    />
  );
}
