import { combiRoundLabel } from '@/lib/combi-round-label';
import { LineupRound, parseSavedLineups, roundFormat, type RosterPlayer } from '@/lib/combi-results';

export type FallbackReasonType = 'SUBMITTED' | 'PREVIOUS_DAY' | 'GRADE_SEQUENCE';

export type ResolvedTeamCombi = {
  rounds: LineupRound[];
  isFallback: boolean;
  fallbackType: FallbackReasonType;
  sourceDay?: number;
  submittedAt?: string;
  reason: string;
};

export type GenericMember = {
  id?: string;
  userId?: string;
  name?: string | null;
  username?: string | null;
  grade?: string | null;
  category?: string | null;
  average?: number | null;
  target?: number | null;
  user?: {
    id?: string;
    name?: string | null;
    username?: string | null;
    grade?: string | null;
    category?: string | null;
    average?: number | null;
    target?: number | null;
    rating?: number | null;
  } | null;
};

export function parseGradeRank(grade?: string | null): number {
  if (!grade) return 999999;
  const match = String(grade).match(/\d+/);
  if (match) return parseInt(match[0], 10);
  return 999999;
}

export function extractMemberGrade(member: GenericMember, userGradeMap?: Map<string, string>): string {
  const uid = member.id || member.userId || member.user?.id;
  if (uid && userGradeMap?.has(uid)) {
    return userGradeMap.get(uid) || '';
  }
  if (member.grade) return String(member.grade).trim();
  if (member.category) return String(member.category).trim();
  if (member.user?.grade) return String(member.user.grade).trim();
  if (member.user?.category) return String(member.user.category).trim();
  return '';
}

export function normalizeRosterPlayer(m: GenericMember, userGradeMap?: Map<string, string>): {
  id: string;
  name: string;
  grade: string;
  gradeRank: number;
  average: number;
} {
  const id = m.id || m.userId || m.user?.id || '';
  const name = m.name || m.user?.name || m.user?.username || m.username || 'Player';
  const grade = extractMemberGrade(m, userGradeMap);
  const gradeRank = parseGradeRank(grade);
  const average = Number(m.average ?? m.user?.average ?? 0) || 0;
  return { id, name, grade, gradeRank, average };
}

export function sortRosterByGrade(members: GenericMember[], userGradeMap?: Map<string, string>) {
  const normalized = members.map((m) => normalizeRosterPlayer(m, userGradeMap)).filter((p) => Boolean(p.id));
  return normalized.sort((a, b) => {
    // 1. Grade sequence G1, G2, G3... (lowest grade rank first)
    if (a.gradeRank !== b.gradeRank) {
      return a.gradeRank - b.gradeRank;
    }
    // 2. Average (asc)
    if (a.average !== b.average) {
      return a.average - b.average;
    }
    // 3. Name (asc)
    return a.name.localeCompare(b.name);
  });
}

export function playersCountForFormat(fmt: string): number {
  const u = String(fmt || '').toUpperCase();
  if (u.includes('QUAD')) return 4;
  if (u.includes('TRIPLE')) return 3;
  if (u.includes('DOUBLE')) return 2;
  return 1;
}

export function generateGradeSequenceLineup(
  members: GenericMember[],
  roundFormats: string[] = ['SINGLES', 'SINGLES', 'SINGLES', 'DOUBLES', 'DOUBLES', 'TRIPLES', 'TRIPLES', 'DOUBLES', 'SINGLES'],
  userGradeMap?: Map<string, string>
): LineupRound[] {
  const sorted = sortRosterByGrade(members, userGradeMap);
  const cleanFormats = roundFormats.length
    ? roundFormats.map((f) => String(f || 'SINGLES').toUpperCase())
    : ['SINGLES', 'SINGLES', 'SINGLES', 'DOUBLES', 'DOUBLES', 'TRIPLES', 'TRIPLES', 'DOUBLES', 'SINGLES'];

  let playerCursor = 0;
  const rounds: LineupRound[] = [];

  cleanFormats.forEach((fmt, idx) => {
    const label = combiRoundLabel(cleanFormats, idx);
    const count = playersCountForFormat(fmt);
    const assigned: typeof sorted = [];

    for (let c = 0; c < count && playerCursor < sorted.length; c += 1) {
      assigned.push(sorted[playerCursor]);
      playerCursor += 1;
    }

    rounds.push({
      name: label,
      players: assigned.map((p) => p.name),
      playerIds: assigned.map((p) => p.id),
    });
  });

  return rounds;
}

export function resolveEffectiveTeamCombi(opts: {
  team: {
    id?: string;
    name?: string;
    savedLineups?: string | Record<string, any> | null;
    members?: GenericMember[];
    spocMembers?: GenericMember[];
  } | null | undefined;
  dayNumber: number;
  roundFormats?: string[];
  userGradeMap?: Map<string, string>;
}): ResolvedTeamCombi {
  const { team, dayNumber, roundFormats = [], userGradeMap } = opts;

  if (!team) {
    return {
      rounds: [],
      isFallback: true,
      fallbackType: 'GRADE_SEQUENCE',
      reason: 'No team provided',
    };
  }

  const saved = typeof team.savedLineups === 'string'
    ? parseSavedLineups(team.savedLineups)
    : (team.savedLineups || {});

  const currentDayData = saved[String(dayNumber)] || saved[dayNumber];
  const currentRounds = currentDayData?.rounds;

  // 1. If current day combi is submitted and valid
  if (Array.isArray(currentRounds) && currentRounds.length > 0) {
    const hasAnyPlayers = currentRounds.some(
      (r: LineupRound) => (r.playerIds && r.playerIds.length > 0) || (r.players && r.players.length > 0)
    );
    if (hasAnyPlayers) {
      return {
        rounds: currentRounds,
        isFallback: false,
        fallbackType: 'SUBMITTED',
        submittedAt: currentDayData.submittedAt,
        reason: 'Submitted by Captain',
      };
    }
  }

  // 2. If Day > 1: Carry over previous day's combi
  if (dayNumber > 1) {
    for (let prev = dayNumber - 1; prev >= 1; prev -= 1) {
      const prevData = saved[String(prev)] || saved[prev];
      const prevRounds = prevData?.rounds;
      if (Array.isArray(prevRounds) && prevRounds.length > 0) {
        const hasPlayers = prevRounds.some(
          (r: LineupRound) => (r.playerIds && r.playerIds.length > 0) || (r.players && r.players.length > 0)
        );
        if (hasPlayers) {
          return {
            rounds: prevRounds,
            isFallback: true,
            fallbackType: 'PREVIOUS_DAY',
            sourceDay: prev,
            reason: `Carried over from Day ${prev} (Captain missed submitting Day ${dayNumber} combi before 9:30 PM IST)`,
          };
        }
      }
    }
  }

  // 3. Day 1 or No previous day combi available: Auto-assign G1..GN sequence
  const members = (team.members && team.members.length > 0)
    ? team.members
    : (team.spocMembers && team.spocMembers.length > 0 ? team.spocMembers : []);

  const fallbackRounds = generateGradeSequenceLineup(members, roundFormats, userGradeMap);

  return {
    rounds: fallbackRounds,
    isFallback: true,
    fallbackType: 'GRADE_SEQUENCE',
    reason: dayNumber === 1
      ? 'Auto-generated from Grade Sequence (G1 → GN) as Captain missed Day 1 submission before 9:30 PM IST'
      : `Auto-generated from Grade Sequence (G1 → GN) as no combis were submitted for prior days`,
  };
}
