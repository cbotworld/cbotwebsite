import { prisma } from '@/lib/prisma';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import { resolveCurrentEdition } from '@/lib/current-edition';
import { filterMainTeams, filterSpocTeams, isSpocExhibitionTeam } from '@/lib/spoc-teams';
import { resolveTeamFace } from '@/lib/team-identity';
import { safePublicImageUrl } from '@/lib/safe-image-url';
import { DELETED_USERNAMES } from '@/lib/mock-data';
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

function toMember(
  user: { id: string; name?: string | null; username?: string | null; image?: string | null },
  isCaptain: boolean,
) {
  return {
    id: user.id,
    name: user.name || user.username || 'Player',
    username: user.username || '',
    image: safePublicImageUrl(user.image) || undefined,
    isCaptain,
  };
}

export default async function TeamsAndPlayersPage() {
  const cms = await getWebsiteCmsContent();

  const edition = await resolveCurrentEdition();

  const teams = edition
    ? await prisma.team.findMany({
        where: { editionId: edition.id },
        include: {
          captain: { select: { id: true, name: true, username: true, image: true } },
          members: {
            include: { user: { select: { id: true, name: true, username: true, image: true } } },
          },
          spocMembers: {
            include: { user: { select: { id: true, name: true, username: true, image: true } } },
          },
        },
        orderBy: { name: 'asc' },
      })
    : [];

  const toRoster = (team: (typeof teams)[number]): RosterTeam => {
    const face = resolveTeamFace({ id: team.id, name: team.name, tag: team.tag, logo: team.logo });
    const captain = team.captain && isVisibleUser(team.captain) ? team.captain : null;
    const fromParticipants = isSpocExhibitionTeam(team)
      ? (team.spocMembers || []).map((m) => m.user)
      : (team.members || []).map((m) => m.user);

    const byId = new Map<string, ReturnType<typeof toMember>>();
    if (captain) byId.set(captain.id, toMember(captain, true));
    for (const user of fromParticipants) {
      if (!isVisibleUser(user)) continue;
      if (byId.has(user.id)) continue;
      byId.set(user.id, toMember(user, captain?.id === user.id));
    }

    const members = Array.from(byId.values()).sort((a, b) => {
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
