export type TeamFace = {
  name: string;
  tag: string;
  logo: string;
  color?: string;
  border?: string;
  bg?: string;
};

export type TeamCatalogEntry = {
  id: string;
  name?: string | null;
  tag?: string | null;
  logo?: string | null;
};

/** Official 200th Edition faces. Name, tag, and poster always belong together. */
export const OFFICIAL_TEAM_FACES: Record<string, TeamFace> = {
  'PLYWOOD PIONEERS': {
    name: 'PLYWOOD PIONEERS',
    tag: 'PP',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/plywood-pioneers.jpeg',
    color: 'text-amber-400',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
  },
  'SUPERNOVA QUEEN': {
    name: 'SUPERNOVA QUEEN',
    tag: 'SQ',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/supernova-queen.jpeg',
    color: 'text-pink-400',
    border: 'border-pink-500/40',
    bg: 'bg-pink-500/10',
  },
  'POCKET DYNAMOS': {
    name: 'POCKET DYNAMOS',
    tag: 'PD',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/pocket-dynamos.jpeg',
    color: 'text-sky-400',
    border: 'border-sky-500/40',
    bg: 'bg-sky-500/10',
  },
  'LUMEN PILLAR': {
    name: 'LUMEN PILLAR',
    tag: 'LP',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/lumen-pillar.jpeg',
    color: 'text-yellow-400',
    border: 'border-yellow-500/40',
    bg: 'bg-yellow-500/10',
  },
  'VANILLA FALCONS': {
    name: 'VANILLA FALCONS',
    tag: 'VF',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/vanilla-falcons.jpeg',
    color: 'text-emerald-400',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
  },
  'VINTAGE STRIKERS': {
    name: 'VINTAGE STRIKERS',
    tag: 'VS',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/vintage-strikers.jpeg',
    color: 'text-orange-400',
    border: 'border-orange-500/40',
    bg: 'bg-orange-500/10',
  },
  'EBONY OVERLORDS': {
    name: 'EBONY OVERLORDS',
    tag: 'EO',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/ebony-overlords.jpeg',
    color: 'text-purple-400',
    border: 'border-purple-500/40',
    bg: 'bg-purple-500/10',
  },
  'BORIC SPEEDSTERS': {
    name: 'BORIC SPEEDSTERS',
    tag: 'BS',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/boric-speedsters.jpeg',
    color: 'text-cyan-400',
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-500/10',
  },
};

const FACES = Object.values(OFFICIAL_TEAM_FACES);
const FACE_BY_TAG = new Map(FACES.map((t) => [t.tag.toUpperCase(), t]));

function normName(name?: string | null) {
  return (name || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function logoKey(url?: string | null) {
  if (!url) return '';
  const file = url.split('/').pop()?.split('?')[0]?.toLowerCase() || url.toLowerCase();
  return file.replace(/\.[a-z0-9]+$/i, '');
}

const FACE_BY_LOGO = new Map(
  FACES.flatMap((t) => {
    const key = logoKey(t.logo);
    return key ? [[key, t] as const] : [];
  }),
);

function officialFromName(name?: string | null) {
  return OFFICIAL_TEAM_FACES[normName(name)];
}

function officialFromTag(tag?: string | null) {
  if (!tag) return undefined;
  return FACE_BY_TAG.get(tag.toUpperCase().trim());
}

function officialFromLogo(logo?: string | null) {
  const key = logoKey(logo);
  return key ? FACE_BY_LOGO.get(key) : undefined;
}

function customFace(name?: string | null, tag?: string | null, logo?: string | null): TeamFace {
  const resolvedName = normName(name) || 'TEAM';
  return {
    name: resolvedName,
    tag: (tag || resolvedName.slice(0, 3) || 'TBD').toUpperCase().trim(),
    logo: logo || '/logo.png',
  };
}

/**
 * Resolve one team slot to a single identity.
 * Never mix Team A's name with Team B's tag or poster.
 * A logo the organizer set is authoritative. Failing that, when stored fields
 * disagree, poster then tag beat a stale name (e.g. "SUPERNOVA QUEEN" saved
 * next to the Ebony Overlords poster / EO).
 */
export function resolveTeamFace(input: {
  id?: string | null;
  name?: string | null;
  tag?: string | null;
  logo?: string | null;
  teams?: TeamCatalogEntry[];
}): TeamFace {
  const fromId = input.id && input.teams?.length ? input.teams.find((t) => t.id === input.id) : undefined;
  const name = fromId?.name || input.name;
  const tag = fromId?.tag || input.tag;
  const logo = fromId?.logo || input.logo;

  const byLogo = officialFromLogo(logo);

  // A poster the organizer uploaded is the team's own artwork, so it wins over
  // the built-in catalog even when the name or tag still matches an official
  // team. The catalog is only a fallback for teams that have no logo of their own.
  if (logo && !byLogo) {
    return customFace(name, tag, logo);
  }

  const byTag = officialFromTag(tag);
  const byName = officialFromName(name);

  if (byLogo && byTag && byLogo.tag !== byTag.tag) return byLogo;
  if (byLogo && byName && byLogo.tag !== byName.tag) return byLogo;
  if (byTag && byName && byTag.tag !== byName.tag) return byTag;

  if (byLogo) return byLogo;
  if (byTag) return byTag;
  if (byName) return byName;

  if (fromId?.name) return customFace(fromId.name, fromId.tag, fromId.logo);
  return customFace(name, tag, logo);
}

export function coherentMatchSides(
  match: {
    team1?: string;
    team2?: string;
    team1Tag?: string | null;
    team2Tag?: string | null;
    team1Logo?: string | null;
    team2Logo?: string | null;
    team1Id?: string | null;
    team2Id?: string | null;
  },
  teams?: TeamCatalogEntry[],
) {
  const team1 = resolveTeamFace({
    id: match.team1Id,
    name: match.team1,
    tag: match.team1Tag,
    logo: match.team1Logo,
    teams,
  });
  const team2 = resolveTeamFace({
    id: match.team2Id,
    name: match.team2,
    tag: match.team2Tag,
    logo: match.team2Logo,
    teams,
  });
  return { team1, team2 };
}
