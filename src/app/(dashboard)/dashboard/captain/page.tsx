import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import CaptainClient from './CaptainClient';
import { stageConfigKey } from '@/lib/tournament-stages';
import {
  isSpocExhibitionTeam,
  spocEventFormatsFromStage,
  spocExhibitionStage,
  spocMatchDaysForTeam,
  spocTeamMembersFromTeam,
  TEAM_TYPE_SPOC,
} from '@/lib/spoc-teams';
import { listCaptainDesks } from '@/lib/mobile-team';
import { ensureOfficialDayDates } from '@/lib/edition-day-dates';

export const revalidate = 0;

export default async function CaptainPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login?callbackUrl=/dashboard/captain');
  }

  const sessionUser = session.user as any;
  const role = sessionUser.role;
  const allowedByRole = role === 'CAPTAIN' || role === 'ORGANIZER' || role === 'SUPER_ADMIN';
  if (!allowedByRole && !sessionUser.hasCaptainDesk) {
    const desks = await listCaptainDesks(sessionUser.id);
    if (!desks.length) {
      redirect('/dashboard/player');
    }
  }

  const userId = sessionUser.id;
  const username = sessionUser.username;

  // Parallelize independent initial queries to eliminate network waterfalls
  const [captainUser, activeEdition, allUsers] = await Promise.all([
    prisma.user.findFirst({
      where: {
        OR: [
          { id: userId },
          { username: username?.toLowerCase() }
        ]
      }
    }),
    prisma.edition.findFirst({
      orderBy: { number: 'desc' },
      include: {
        patterns: {
          orderBy: { sequence: 'asc' },
          include: { pattern: true },
        },
      },
    }),
    prisma.user.findMany({ 
      select: { id: true, name: true, username: true, role: true, rating: true, average: true, target: true },
      orderBy: { name: 'asc' } 
    }),
  ]);

  await ensureOfficialDayDates(activeEdition);

  // Build ordered round format list
  const savedRoundFormats: string[] = (activeEdition as any)?.patterns?.map(
    (bp: any) => bp.matchFormat || 'SINGLES'
  ) ?? [];

  const roundsPerDay = savedRoundFormats.length > 0 ? savedRoundFormats.length : 5;

  // Main captain desk first; Spoc desk is extra when they also captain a Spoc team
  const [spocCaptainTeam, mainCaptainTeam, mainMemberTeam, allTeams, stageSetting] = await Promise.all([
    captainUser && activeEdition
      ? prisma.team.findFirst({
          where: {
            captainId: captainUser.id,
            editionId: activeEdition.id,
            teamType: TEAM_TYPE_SPOC,
          },
          include: {
            captain: true,
            members: { include: { user: true } },
            spocMembers: { include: { user: true } },
          },
        })
      : Promise.resolve(null),
    captainUser
      ? prisma.team.findFirst({
          where: {
            captainId: captainUser.id,
            ...(activeEdition ? { editionId: activeEdition.id } : {}),
            NOT: { teamType: TEAM_TYPE_SPOC },
          },
          include: {
            captain: true,
            members: { include: { user: true } },
            spocMembers: { include: { user: true } },
          },
        })
      : Promise.resolve(null),
    captainUser
      ? prisma.team.findFirst({
          where: {
            members: {
              some: {
                userId: captainUser.id,
                editionId: activeEdition?.id ?? undefined,
              },
            },
            ...(activeEdition ? { editionId: activeEdition.id } : {}),
            NOT: { teamType: TEAM_TYPE_SPOC },
          },
          include: {
            captain: true,
            members: { include: { user: true } },
            spocMembers: { include: { user: true } },
          },
        })
      : Promise.resolve(null),
    prisma.team.findMany({
      where: activeEdition ? { editionId: activeEdition.id } : {},
      include: {
        captain: true,
        members: { include: { user: true } },
        spocMembers: { include: { user: true } },
      },
    }),
    activeEdition
      ? prisma.systemSetting.findUnique({ where: { key: stageConfigKey(activeEdition.id) } })
      : Promise.resolve(null),
  ]);

  const team = mainCaptainTeam || spocCaptainTeam || mainMemberTeam;
  const isSpocOnlyCaptain = Boolean(spocCaptainTeam) && !mainCaptainTeam;
  const isSpocTeam = isSpocExhibitionTeam(team) && isSpocOnlyCaptain;
  const members = isSpocExhibitionTeam(team)
    ? spocTeamMembersFromTeam(team)
    : team?.members?.map((m: any) => m.user) || [];
  const playerTeam = mainCaptainTeam || mainMemberTeam || team;

  let stageConfig: { stages?: any[] } | null = null;
  if (stageSetting?.value) {
    try {
      stageConfig = JSON.parse(stageSetting.value);
    } catch {}
  }

  const spocStage = spocExhibitionStage(stageConfig?.stages);
  const spocRoundFormats = spocEventFormatsFromStage(spocStage);
  const teamsById = new Map(allTeams.map((t) => [t.id, { name: t.name, tag: t.tag }]));
  const spocMatchDays = spocCaptainTeam
    ? spocMatchDaysForTeam(spocCaptainTeam.id, stageConfig?.stages, teamsById)
    : [];

  // ── PLAYER DATA for the embedded player dashboard panel ─────────────────
  // Captains are also players — fetch all the same data PlayerClient needs
  const captainPlayerMatches = playerTeam ? await prisma.match.findMany({
    where: {
      OR: [
        { team1Id: playerTeam.id },
        { team2Id: playerTeam.id },
      ]
    },
    include: { team1: true, team2: true },
    orderBy: { scheduledTime: 'asc' },
  }) : [];

  const captainLiveStreams = captainUser
    ? await prisma.liveStream.findMany({
        where: {
          playerId: captainUser.id,
          ...(activeEdition?.id ? { editionId: activeEdition.id } : {}),
        },
        select: {
          id: true,
          matchId: true,
          status: true,
          createdAt: true,
          recordedAt: true,
          youtubeUrl: true,
          youtubeVideoId: true,
          youtubeEmbedUrl: true,
          match: { select: { round: true, matchNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  const boardPatterns = await prisma.boardPattern.findMany({ take: 5 });

  return (
    <CaptainClient
      initialTeam={team}
      initialMembers={members}
      initialSpocTeam={spocCaptainTeam}
      initialSpocMembers={spocCaptainTeam ? spocTeamMembersFromTeam(spocCaptainTeam) : []}
      initialPlayerTeam={playerTeam}
      initialAllTeams={allTeams}
      initialAllUsers={allUsers}
      initialActiveEdition={{
        ...activeEdition,
        roundsPerDay,
        roundFormats: savedRoundFormats,
        spocRoundFormats,
        spocMatchDays,
        isSpocTeam,
        hasMainCaptainDesk: Boolean(mainCaptainTeam),
        hasSpocCaptainDesk: Boolean(spocCaptainTeam),
      }}
      initialPlayer={captainUser || { ...sessionUser, wins: 0, losses: 0, rating: 1200, queenStrikes: 0, boardsWon: 0 }}
      initialPlayerMatches={captainPlayerMatches as any}
      initialPlayerStreams={captainLiveStreams as any}
      initialPatterns={boardPatterns as any}
    />
  );
}
