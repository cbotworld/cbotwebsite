import type {
  LeagueGroupConfig,
  QualifierPairing,
  ScheduleMode,
  StageKind,
  StageSeeding,
  StandingRow,
  TournamentStage,
  TournamentStageConfig,
} from '@/types';
import {
  seedRoyalCarromLeaguePairings,
} from '@/lib/bicentennial-monuments';

export const STAGE_SETTING_PREFIX = 'edition-stages:';

export function stageConfigKey(editionId: string) {
  return `${STAGE_SETTING_PREFIX}${editionId}`;
}

export function defaultTournamentStages(teamCount = 0): TournamentStageConfig {
  const groupsNeeded = 2;
  const perGroup = teamCount > 0 ? Math.max(2, Math.ceil(teamCount / groupsNeeded)) : 4;
  return {
    scheduleMode: 'DIVIDED',
    stages: [
      {
        id: 'stage-1',
        order: 1,
        kind: 'ROUND_ROBIN',
        name: 'Round Robin',
        teamCount,
        startDay: 1,
        durationDays: 7,
        matchPairings: [],
      },
      {
        id: 'stage-2',
        order: 2,
        kind: 'LEAGUE',
        name: 'League',
        groupCount: groupsNeeded,
        teamsPerGroup: perGroup,
        qualifyPerGroup: 2,
        seeding: 'RR_STANDINGS_SNAKE',
        leagueIndex: 1,
        groups: emptyGroups(groupsNeeded, perGroup),
        startDay: 8,
        durationDays: 3,
        matchPairings: [],
      },
      {
        id: 'stage-3',
        order: 3,
        kind: 'QUALIFIER',
        name: 'Qualifiers',
        pairing: 'CROSS',
        startDay: 11,
        durationDays: 2,
        matchPairings: [],
      },
      {
        id: 'stage-4',
        order: 4,
        kind: 'FINALS',
        name: 'Finals',
        includeThirdPlace: false,
        startDay: 13,
        durationDays: 1,
        matchPairings: [],
      },
    ],
  };
}

export const DEFAULT_LEAGUE_GROUP_NAMES = ['Birchply', 'Rosewood', 'Group C', 'Group D'];

export function emptyGroups(
  groupCount: number,
  teamsPerGroup: number,
  existing?: LeagueGroupConfig[]
): LeagueGroupConfig[] {
  return Array.from({ length: groupCount }, (_, i) => {
    const letter = String.fromCharCode(65 + i);
    const prev = existing?.[i];
    const teamIds = Array.from({ length: teamsPerGroup }, (_, slot) => prev?.teamIds?.[slot] || '');
    return {
      key: prev?.key || letter,
      name: prev?.name || DEFAULT_LEAGUE_GROUP_NAMES[i] || `Group ${letter}`,
      teamIds,
    };
  });
}

export function groupKey(group: LeagueGroupConfig | undefined, index = 0): string {
  const key = (group?.key || '').trim();
  if (/^[A-Z]$/i.test(key)) return key.toUpperCase();
  const name = (group?.name || '').trim();
  if (/^[A-Z]$/i.test(name)) return name.toUpperCase();
  return String.fromCharCode(65 + index);
}

export function groupLabel(group: LeagueGroupConfig | undefined, index = 0): string {
  const name = (group?.name || '').trim();
  if (name) return name;
  return DEFAULT_LEAGUE_GROUP_NAMES[index] || `Group ${groupKey(group, index)}`;
}

export function leagueIndexOf(stage: { leagueIndex?: number } | number | undefined): number {
  if (typeof stage === 'number') return Math.max(1, stage);
  return Math.max(1, stage?.leagueIndex || 1);
}

export function leagueStageKey(groupName: string, leagueIndex = 1) {
  const group = String(groupName || 'A').trim().toUpperCase();
  return leagueIndex > 1 ? `LEAGUE${leagueIndex}_${group}` : `LEAGUE_${group}`;
}

export function parseLeagueGroup(stage?: string | null): string | null {
  if (!stage) return null;
  const match = /^LEAGUE\d*_([A-Z])$/i.exec(stage);
  return match ? match[1].toUpperCase() : null;
}

export function matchesStageKind(stage: string | undefined | null, kind: StageKind): boolean {
  const value = (stage || '').toUpperCase();
  if (kind === 'ROUND_ROBIN') return value === 'ROUND_ROBIN';
  if (kind === 'LEAGUE') return value.startsWith('LEAGUE');
  if (kind === 'QUALIFIER') return value.startsWith('QUALIFIER');
  if (kind === 'FINALS') {
    return (
      value === 'GRAND_FINAL' ||
      value === 'FINAL' ||
      value.endsWith('_PLACE') ||
      value.startsWith('PLACE_')
    );
  }
  if (kind === 'SPOC_EXHIBITION') return value === 'SPOC_EXHIBITION' || value.startsWith('SPOC_EXHIBITION_');
  return false;
}

export function formatMatchStage(stage?: string | null): string {
  const value = (stage || '').toUpperCase();
  if (!value) return 'Unassigned';
  if (value === 'ROUND_ROBIN') return 'Round Robin';
  if (value === 'GRAND_FINAL' || value === 'FINAL') return 'Grand Final';
  if (value === 'THIRD_PLACE') return '3rd Place';
  if (value === 'FIFTH_PLACE') return '5th Place';
  if (value === 'SEVENTH_PLACE') return '7th Place';
  if (value === 'SPOC_EXHIBITION' || value.startsWith('SPOC_EXHIBITION_')) return 'Spoc Exhibition';
  const league = parseLeagueGroup(value);
  if (league) {
    const numbered = /^LEAGUE(\d+)_/i.exec(value);
    const n = numbered ? parseInt(numbered[1], 10) : 1;
    return n > 1 ? `League ${n} Group ${league}` : `League Group ${league}`;
  }
  if (value.startsWith('LEAGUE')) return 'League';
  if (value.startsWith('QUALIFIER')) return value.replace('_', ' ');
  return value.replace(/_/g, ' ');
}

export function roundRobinPairs(teamIds: string[]): Array<[string, string]> {
  const ids = teamIds.filter(Boolean);
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push([ids[i], ids[j]]);
    }
  }
  return pairs;
}

/** Circle method: each team plays at most once per round (bye if odd count). */
export function circleMethodRounds(teamIds: string[]): Array<{ round: number; pairs: Array<[string, string]> }> {
  const ids = teamIds.filter(Boolean);
  if (ids.length < 2) return [];
  const rotation = [...ids];
  if (rotation.length % 2 === 1) rotation.push('BYE');
  const n = rotation.length;
  const rounds = n - 1;
  const half = n / 2;
  const result: Array<{ round: number; pairs: Array<[string, string]> }> = [];

  for (let r = 0; r < rounds; r++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < half; i++) {
      const a = rotation[i];
      const b = rotation[n - 1 - i];
      if (a !== 'BYE' && b !== 'BYE') pairs.push([a, b]);
    }
    result.push({ round: r + 1, pairs });
    const last = rotation.pop();
    if (last) rotation.splice(1, 0, last);
  }
  return result;
}

export function stageFamily(stage?: string | null): string {
  const value = (stage || '').toUpperCase();
  if (value.startsWith('LEAGUE')) return 'LEAGUE';
  if (value.startsWith('QUALIFIER')) return 'QUALIFIER';
  if (value === 'GRAND_FINAL' || value.endsWith('_PLACE') || value.startsWith('PLACE_') || value === 'FINAL') return 'FINALS';
  return value || 'UNKNOWN';
}

export function snakeSeed(rankedTeamIds: string[], groupCount: number, teamsPerGroup: number): LeagueGroupConfig[] {
  const groups = emptyGroups(groupCount, teamsPerGroup);
  let cursor = 0;
  for (let slot = 0; slot < teamsPerGroup; slot++) {
    const forward = slot % 2 === 0;
    for (let g = 0; g < groupCount; g++) {
      const groupIndex = forward ? g : groupCount - 1 - g;
      groups[groupIndex].teamIds[slot] = rankedTeamIds[cursor] || '';
      cursor += 1;
    }
  }
  return groups;
}

export function splitSeed(rankedTeamIds: string[], groupCount: number, teamsPerGroup: number): LeagueGroupConfig[] {
  const groups = emptyGroups(groupCount, teamsPerGroup);
  rankedTeamIds.forEach((id, idx) => {
    const groupIndex = Math.floor(idx / teamsPerGroup);
    const slot = idx % teamsPerGroup;
    if (groupIndex < groupCount) {
      groups[groupIndex].teamIds[slot] = id || '';
    }
  });
  return groups;
}

export function seedLeagueGroups(
  rankedTeamIds: string[],
  groupCount: number,
  teamsPerGroup: number,
  seeding: StageSeeding = 'RR_STANDINGS_SNAKE'
): LeagueGroupConfig[] {
  if (seeding === 'RR_STANDINGS_SPLIT') {
    return splitSeed(rankedTeamIds, groupCount, teamsPerGroup);
  }
  return snakeSeed(rankedTeamIds, groupCount, teamsPerGroup);
}

export interface StandingsInputMatch {
  team1Id?: string | null;
  team2Id?: string | null;
  score1?: number | null;
  score2?: number | null;
  queenStrikes1?: number | null;
  queenStrikes2?: number | null;
  status?: string | null;
  stage?: string | null;
}

export interface StandingsInputTeam {
  id: string;
  name: string;
  tag?: string | null;
}

export function computeStandings(
  teams: StandingsInputTeam[],
  matches: StandingsInputMatch[],
  stagePredicate?: (stage: string) => boolean
): StandingRow[] {
  const standingsMap: Record<string, StandingRow> = {};
  teams.forEach((t) => {
    standingsMap[t.id] = {
      rank: 0,
      teamId: t.id,
      teamName: t.name,
      teamTag: t.tag || '',
      played: 0,
      wins: 0,
      losses: 0,
      points: 0,
      scoreDiff: 0,
      queenStrikes: 0,
    };
  });

  matches.forEach((m) => {
    if (stagePredicate && !stagePredicate(m.stage || '')) return;
    if (m.status !== 'COMPLETED' || !m.team1Id || !m.team2Id) return;
    const s1 = standingsMap[m.team1Id];
    const s2 = standingsMap[m.team2Id];
    if (!s1 || !s2) return;

    s1.played += 1;
    s2.played += 1;
    s1.queenStrikes += m.queenStrikes1 || 0;
    s2.queenStrikes += m.queenStrikes2 || 0;
    s1.scoreDiff += (m.score1 || 0) - (m.score2 || 0);
    s2.scoreDiff += (m.score2 || 0) - (m.score1 || 0);

    if ((m.score1 || 0) > (m.score2 || 0)) {
      s1.wins += 1;
      s1.points += 3;
      s2.losses += 1;
    } else if ((m.score2 || 0) > (m.score1 || 0)) {
      s2.wins += 1;
      s2.points += 3;
      s1.losses += 1;
    }
  });

  const sorted = Object.values(standingsMap).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
    return b.queenStrikes - a.queenStrikes;
  });

  sorted.forEach((row, idx) => {
    row.rank = idx + 1;
  });

  return sorted;
}

export function qualifiedFromGroups(
  groups: LeagueGroupConfig[],
  standingsByGroup: Record<string, StandingRow[]>,
  qualifyPerGroup: number
): Array<{ group: string; rank: number; teamId: string; teamName: string }> {
  const qualified: Array<{ group: string; rank: number; teamId: string; teamName: string }> = [];
  groups.forEach((group, gi) => {
    const key = groupKey(group, gi);
    const table = (standingsByGroup[key] || standingsByGroup[group.name] || []).filter((row) => group.teamIds.includes(row.teamId));
    table.slice(0, qualifyPerGroup).forEach((row, idx) => {
      qualified.push({
        group: key,
        rank: idx + 1,
        teamId: row.teamId,
        teamName: row.teamName,
      });
    });
  });
  return qualified;
}

export interface SuggestedPairing {
  stage: string;
  label: string;
  team1Id: string;
  team2Id: string;
  team1Name?: string;
  team2Name?: string;
  round?: number;
  dayNumber?: number;
  scheduledTime?: string;
  tableNumber?: number;
}

export function circlePairings(
  teamIds: string[],
  stage: string,
  labelPrefix: string,
  teams: Array<{ id: string; name: string }> = []
): SuggestedPairing[] {
  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name || '';
  const out: SuggestedPairing[] = [];
  circleMethodRounds(teamIds).forEach(({ round, pairs }) => {
    pairs.forEach(([team1Id, team2Id], idx) => {
      out.push({
        stage,
        label: `${labelPrefix} · Round ${round} · Match ${idx + 1}`,
        team1Id,
        team2Id,
        team1Name: nameOf(team1Id),
        team2Name: nameOf(team2Id),
        round,
      });
    });
  });
  return out;
}

/** Single round robin across every team: each team plays all the others once. */
export function suggestRoundRobinPairings(
  teams: Array<{ id: string; name: string; tag?: string | null }>
): SuggestedPairing[] {
  return circlePairings(teams.map((t) => t.id), 'ROUND_ROBIN', 'Round Robin', teams);
}

export function nextRoundRobinPairing(existing: SuggestedPairing[]): SuggestedPairing {
  const n = existing.length + 1;
  const lastRound = Math.max(0, ...existing.map((p) => p.round || 0));
  return {
    stage: 'ROUND_ROBIN',
    label: `Round Robin · Match ${n}`,
    team1Id: '',
    team2Id: '',
    team1Name: '',
    team2Name: '',
    round: lastRound || 1,
  };
}

export function suggestLeaguePairings(
  groups: LeagueGroupConfig[],
  teams: Array<{ id: string; name: string; tag?: string | null }>,
  leagueIndex = 1
): SuggestedPairing[] {
  const byGroup = (groups || []).map((group, gi) =>
    circlePairings(group.teamIds || [], leagueStageKey(groupKey(group, gi), leagueIndex), groupLabel(group, gi), teams)
  );
  const maxRound = Math.max(0, ...byGroup.flat().map((p) => p.round || 1));
  const pairings: SuggestedPairing[] = [];
  for (let round = 1; round <= maxRound; round++) {
    byGroup.forEach((list) => {
      list.filter((p) => (p.round || 1) === round).forEach((p) => pairings.push(p));
    });
  }
  return pairings;
}

/** Official Birchply/Rosewood fixtures for the first league (Days 8–10, 8pm–8pm). */
export function officialFirstLeaguePairings(
  teams: Array<{ id: string; name: string; tag?: string | null }>,
  leagueIndex = 1
): SuggestedPairing[] | null {
  if (leagueIndex !== 1) return null;
  const official = seedRoyalCarromLeaguePairings(teams);
  if (!official.some((p) => p.team1Id && p.team2Id)) return null;
  return official;
}

export function leaguePairingsForStage(
  groups: LeagueGroupConfig[],
  teams: Array<{ id: string; name: string; tag?: string | null }>,
  leagueIndex = 1
): SuggestedPairing[] {
  return officialFirstLeaguePairings(teams, leagueIndex) || suggestLeaguePairings(groups, teams, leagueIndex);
}

export function pairingsAlreadyScheduled(pairings: SuggestedPairing[]): boolean {
  return pairings.length > 0 && pairings.every((p) => !!p.dayNumber && !!p.scheduledTime);
}

export function suggestQualifierPairings(
  qualified: Array<{ group: string; rank: number; teamId: string; teamName: string }>,
  pairing: QualifierPairing = 'CROSS'
): SuggestedPairing[] {
  if (qualified.length < 4) {
    return qualified.length >= 2
      ? [{
          stage: 'QUALIFIER_1',
          label: 'Qualifier 1',
          team1Id: qualified[0].teamId,
          team2Id: qualified[1].teamId,
          team1Name: qualified[0].teamName,
          team2Name: qualified[1].teamName,
        }]
      : [];
  }

  if (pairing === 'RANKED') {
    const ranked = [...qualified];
    return [
      {
        stage: 'QUALIFIER_1',
        label: 'Qualifier 1 · 1st vs 2nd',
        team1Id: ranked[0].teamId,
        team2Id: ranked[1].teamId,
        team1Name: ranked[0].teamName,
        team2Name: ranked[1].teamName,
      },
      {
        stage: 'QUALIFIER_2',
        label: 'Qualifier 2 · 3rd vs 4th',
        team1Id: ranked[2].teamId,
        team2Id: ranked[3].teamId,
        team1Name: ranked[2].teamName,
        team2Name: ranked[3].teamName,
      },
    ];
  }

  const a1 = qualified.find((q) => q.group === 'A' && q.rank === 1) || qualified[0];
  const a2 = qualified.find((q) => q.group === 'A' && q.rank === 2) || qualified[2];
  const b1 = qualified.find((q) => q.group === 'B' && q.rank === 1) || qualified[1];
  const b2 = qualified.find((q) => q.group === 'B' && q.rank === 2) || qualified[3];

  return [
    {
      stage: 'QUALIFIER_1',
      label: 'Qualifier 1 · A1 vs B2',
      team1Id: a1.teamId,
      team2Id: b2.teamId,
      team1Name: a1.teamName,
      team2Name: b2.teamName,
    },
    {
      stage: 'QUALIFIER_2',
      label: 'Qualifier 2 · B1 vs A2',
      team1Id: b1.teamId,
      team2Id: a2.teamId,
      team1Name: b1.teamName,
      team2Name: a2.teamName,
    },
  ];
}

export function suggestFinalsPairings(
  qualifierMatches: Array<{
    stage?: string | null;
    team1Id?: string | null;
    team2Id?: string | null;
    team1?: { name?: string } | null;
    team2?: { name?: string } | null;
    winnerId?: string | null;
    status?: string | null;
    score1?: number | null;
    score2?: number | null;
  }>,
  includeThirdPlace = false
): SuggestedPairing[] {
  const q1 = qualifierMatches.find((m) => (m.stage || '') === 'QUALIFIER_1');
  const q2 = qualifierMatches.find((m) => (m.stage || '') === 'QUALIFIER_2');

  const winnerOf = (match?: typeof q1) => {
    if (!match) return { id: '', name: 'TBD' };
    if (match.winnerId) {
      const name = match.winnerId === match.team1Id ? match.team1?.name : match.team2?.name;
      return { id: match.winnerId, name: name || 'Winner' };
    }
    if (match.status === 'COMPLETED') {
      const id = (match.score1 || 0) >= (match.score2 || 0) ? match.team1Id : match.team2Id;
      const name = id === match.team1Id ? match.team1?.name : match.team2?.name;
      return { id: id || '', name: name || 'Winner' };
    }
    return { id: '', name: 'Winner (pending)' };
  };

  const loserOf = (match?: typeof q1) => {
    if (!match || !match.team1Id || !match.team2Id) return { id: '', name: 'TBD' };
    const winner = winnerOf(match);
    if (!winner.id) return { id: '', name: 'Loser (pending)' };
    const loserId = winner.id === match.team1Id ? match.team2Id : match.team1Id;
    const name = loserId === match.team1Id ? match.team1?.name : match.team2?.name;
    return { id: loserId || '', name: name || 'Loser' };
  };

  const w1 = winnerOf(q1);
  const w2 = winnerOf(q2);
  const pairings: SuggestedPairing[] = [
    {
      stage: 'GRAND_FINAL',
      label: 'Grand Final · Q1 Winner vs Q2 Winner',
      team1Id: w1.id,
      team2Id: w2.id,
      team1Name: w1.name,
      team2Name: w2.name,
    },
  ];

  if (includeThirdPlace) {
    const l1 = loserOf(q1);
    const l2 = loserOf(q2);
    pairings.push({
      stage: 'THIRD_PLACE',
      label: '3rd Place · Q1 Loser vs Q2 Loser',
      team1Id: l1.id,
      team2Id: l2.id,
      team1Name: l1.name,
      team2Name: l2.name,
    });
  }

  return pairings;
}

export function orderPairingsForMode(pairings: SuggestedPairing[], mode: ScheduleMode): SuggestedPairing[] {
  const copy = [...pairings];
  if (mode === 'SEQUENCE') {
    return copy.sort((a, b) => {
      const fam = stageFamily(a.stage).localeCompare(stageFamily(b.stage));
      if (fam) return fam;
      const stg = a.stage.localeCompare(b.stage);
      if (stg) return stg;
      return (a.round || 1) - (b.round || 1);
    });
  }
  return copy.sort((a, b) => {
    const round = (a.round || 1) - (b.round || 1);
    if (round) return round;
    const fam = stageFamily(a.stage).localeCompare(stageFamily(b.stage));
    if (fam) return fam;
    return a.stage.localeCompare(b.stage);
  });
}

export function normalizeDayDates(
  dayDates?: Record<number, string> | Record<string, string> | null
): Record<number, string> {
  const out: Record<number, string> = {};
  if (!dayDates) return out;
  Object.entries(dayDates).forEach(([key, value]) => {
    const day = parseInt(key, 10);
    if (!Number.isNaN(day) && value) out[day] = value;
  });
  return out;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 8pm IST cutoff on a YYYY-MM-DD calendar date. */
function calendarDateEndMs(dateStr: string): number {
  const ymd = dateStr.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return NaN;
  return new Date(`${ymd}T20:00:00+05:30`).getTime();
}

export function lastCompletedDay(
  dayDates: Record<number, string> | Record<string, string>,
  today = new Date()
): number {
  const dates = normalizeDayDates(dayDates);
  const maxDay = Math.max(
    ...Object.keys(dates).map((key) => parseInt(key, 10)).filter((n) => n > 0),
    0
  );
  if (maxDay === 0 && !dates[1]) return 0;
  const checkLimit = Math.max(maxDay, 30);
  let last = 0;
  for (let day = 1; day <= checkLimit; day += 1) {
    if (!isCalendarDayCompleted(day, dates, today)) break;
    last = day;
  }
  return last;
}

export function isCalendarDayCompleted(
  dayNumber: number,
  dayDates: Record<number, string> | Record<string, string>,
  today = new Date()
): boolean {
  const dates = normalizeDayDates(dayDates);
  const calendarEnd = dates[dayNumber] ? calendarDateEndMs(dates[dayNumber]) : NaN;
  if (Number.isFinite(calendarEnd)) return today.getTime() >= calendarEnd;

  if (dates[1]) {
    const day1End = calendarDateEndMs(dates[1]);
    if (Number.isFinite(day1End)) {
      const calculatedEnd = day1End + (dayNumber - 1) * MS_PER_DAY;
      return today.getTime() >= calculatedEnd;
    }
  }

  return false;
}

export function defaultDurationForKind(kind: StageKind): number {
  if (kind === 'ROUND_ROBIN') return 7;
  if (kind === 'LEAGUE') return 3;
  if (kind === 'QUALIFIER') return 2;
  if (kind === 'SPOC_EXHIBITION') return 0;
  return 1;
}

export const STAGE_PATHS: Array<{ id: string; label: string; hint: string; kinds: StageKind[] }> = [
  { id: 'rr', label: 'Round Robin only', hint: 'Every team plays every other team.', kinds: ['ROUND_ROBIN'] },
  { id: 'rr-qf', label: 'Round Robin → Qualifiers → Final', hint: 'Table, then knockout.', kinds: ['ROUND_ROBIN', 'QUALIFIER', 'FINALS'] },
  { id: 'rr-lg', label: 'Round Robin → League → Qualifiers → Final', hint: 'Split into groups after the table.', kinds: ['ROUND_ROBIN', 'LEAGUE', 'QUALIFIER', 'FINALS'] },
  { id: 'rr-lg2', label: 'Round Robin → League → League 2 → Qualifiers → Final', hint: 'A second group stage before knockout.', kinds: ['ROUND_ROBIN', 'LEAGUE', 'LEAGUE', 'QUALIFIER', 'FINALS'] },
];

export function createTournamentStage(
  kind: StageKind,
  order: number,
  teamCount = 0,
  leagueIndex = 1
): TournamentStage {
  const id = `stage-${kind.toLowerCase().replace('_', '-')}-${order}-${leagueIndex}`;
  if (kind === 'LEAGUE') {
    const groupCount = 2;
    const teamsPerGroup = teamCount > 0 ? Math.max(2, Math.ceil(teamCount / groupCount)) : 4;
    return {
      id,
      order,
      kind,
      name: leagueIndex > 1 ? `League ${leagueIndex}` : 'League',
      groupCount,
      teamsPerGroup,
      qualifyPerGroup: 2,
      seeding: leagueIndex > 1 ? 'MANUAL' : 'RR_STANDINGS_SNAKE',
      leagueIndex,
      groups: emptyGroups(groupCount, teamsPerGroup),
      durationDays: defaultDurationForKind('LEAGUE'),
      matchPairings: [],
    };
  }
  if (kind === 'QUALIFIER') {
    return {
      id,
      order,
      kind,
      name: leagueIndex > 1 ? 'Qualifiers 2' : 'Qualifiers',
      pairing: 'CROSS',
      durationDays: 2,
      matchPairings: [],
    };
  }
  if (kind === 'FINALS') {
    return { id, order, kind, name: 'Finals', includeThirdPlace: false, durationDays: 1, matchPairings: [] };
  }
  if (kind === 'SPOC_EXHIBITION') {
    return {
      id,
      order,
      kind,
      name: 'Spoc Exhibition',
      durationDays: 0,
      spocEventCount: 3,
      spocEventFormats: ['SINGLES', 'DOUBLES', 'SINGLES'],
      matchPairings: [],
    };
  }
  return { id, order, kind, name: 'Round Robin', teamCount, startDay: 1, durationDays: defaultDurationForKind('ROUND_ROBIN'), matchPairings: [] };
}

export function stagesFromPath(
  kinds: StageKind[],
  existing: TournamentStage[] = [],
  teamCount = 0
): TournamentStage[] {
  const usedIds = new Set<string>();
  let leagueCount = 0;
  return kinds.map((kind, idx) => {
    if (kind === 'LEAGUE') leagueCount += 1;
    const match = existing.find((stage) => {
      if (usedIds.has(stage.id) || stage.kind !== kind) return false;
      if (kind === 'LEAGUE') return leagueIndexOf(stage) === leagueCount;
      return true;
    });
    if (match) {
      usedIds.add(match.id);
      return {
        ...match,
        order: idx + 1,
        name: kind === 'LEAGUE' && leagueCount > 1 && match.name === 'League' ? `League ${leagueCount}` : match.name,
        leagueIndex: kind === 'LEAGUE' ? leagueCount : match.leagueIndex,
      };
    }
    return createTournamentStage(kind, idx + 1, teamCount, kind === 'LEAGUE' ? leagueCount : 1);
  });
}

export function pathIdForStages(stages: TournamentStage[]): string | null {
  const kinds = stages.map((s) => s.kind).join(',');
  const found = STAGE_PATHS.find((p) => p.kinds.join(',') === kinds);
  return found?.id || null;
}

/** Where a newly added stage should sit so a 2nd qualifier lands after the first, not before it. */
export function insertIndexForNewStage(stages: TournamentStage[], kind: StageKind): number {
  if (kind === 'QUALIFIER') {
    let lastQualifierAt = -1;
    for (let i = 0; i < stages.length; i += 1) {
      if (stages[i].kind === 'QUALIFIER') lastQualifierAt = i;
    }
    const finalsAt = stages.findIndex((s) => s.kind === 'FINALS');
    if (lastQualifierAt >= 0) return lastQualifierAt + 1;
    if (finalsAt !== -1) return finalsAt;
    return stages.length;
  }
  if (kind === 'FINALS' || kind === 'SPOC_EXHIBITION') return stages.length;
  const knockoutAt = stages.findIndex((s) => s.kind === 'QUALIFIER' || s.kind === 'FINALS');
  return knockoutAt === -1 ? stages.length : knockoutAt;
}

export function stageJustFinishedForAverageReview(
  stages: TournamentStage[],
  lastDoneDay: number,
): { finishedStageName: string; nextStageName: string | null } | null {
  if (lastDoneDay <= 0) return null;
  const ordered = stages.filter((s) => s.kind !== 'SPOC_EXHIBITION');
  const finished = ordered.find((s) => {
    const start = s.startDay || 0;
    const duration = s.durationDays || 0;
    if (!start || !duration) return false;
    return start + duration - 1 === lastDoneDay;
  });
  if (!finished) return null;
  const next = ordered.find((s) => (s.order || 0) > (finished.order || 0));
  return { finishedStageName: finished.name, nextStageName: next?.name || null };
}

export function layoutStageDays(stages: TournamentStage[], lastDoneDay = 0): TournamentStage[] {
  let cursor = Math.max(1, lastDoneDay + 1);
  return stages.map((stage, idx) => {
    if (stage.kind === 'SPOC_EXHIBITION') {
      return { ...stage, order: idx + 1, durationDays: 0 };
    }
    const durationDays = stage.durationDays || defaultDurationForKind(stage.kind);
    const kept = (stage.startDay || 0) > 0 && (stage.startDay || 0) <= lastDoneDay;
    const startDay = kept ? stage.startDay! : Math.max(cursor, lastDoneDay + 1);
    cursor = Math.max(cursor, startDay + durationDays);
    return { ...stage, order: idx + 1, startDay, durationDays };
  });
}

export function stageSpanDays(stages: TournamentStage[]): number {
  return stages.reduce((max, stage) => {
    if (stage.kind === 'SPOC_EXHIBITION') return max;
    const start = stage.startDay || 1;
    const duration = stage.durationDays || defaultDurationForKind(stage.kind);
    return Math.max(max, start + duration - 1);
  }, 0);
}

export function ensureStageDayWindows(stages: TournamentStage[], lastDoneDay = 0): TournamentStage[] {
  return layoutStageDays(stages, lastDoneDay);
}

export function occupancySlots(
  matches: Array<{ stage?: string | null; round?: number | null }>,
  mode: ScheduleMode
): number {
  if (!matches.length) return 0;
  if (mode === 'SEQUENCE') return matches.length;
  const keys = new Set(matches.map((m) => `${stageFamily(m.stage)}-${m.round || 1}`));
  return keys.size || matches.length;
}

export function assignScheduleSlots(
  pairings: SuggestedPairing[],
  opts: {
    mode: ScheduleMode;
    eventsPerDay: number;
    dayDates: Record<number, string> | Record<string, string>;
    startSlot?: number;
    startDay?: number;
    durationDays?: number;
    startHour?: number;
    hoursPerSlot?: number;
  }
): SuggestedPairing[] {
  const eventsPerDay = Math.max(1, opts.eventsPerDay || 4);
  const startHour = opts.startHour ?? 10;
  const hoursPerSlot = opts.hoursPerSlot ?? 2;
  const startDay = Math.max(1, opts.startDay || 1);
  const durationDays = Math.max(1, opts.durationDays || 1);
  const dates = normalizeDayDates(opts.dayDates as Record<string, string>);
  const start = dates[1];

  const slotMeta = (dayNumber: number, eventIndex: number, tableNumber: number) => {
    const dateStr = dates[dayNumber];
    const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
    if (!dateStr) {
      if (start) {
        const fromStart = new Date(`${start}T00:00:00`);
        fromStart.setDate(fromStart.getDate() + (dayNumber - 1));
        fromStart.setHours(startHour + (eventIndex % 8) * hoursPerSlot, 0, 0, 0);
        return { dayNumber, scheduledTime: fromStart.toISOString(), tableNumber };
      }
      base.setDate(base.getDate() + (dayNumber - 1));
    }
    base.setHours(startHour + (eventIndex % 8) * hoursPerSlot, 0, 0, 0);
    return { dayNumber, scheduledTime: base.toISOString(), tableNumber };
  };

  const ordered = orderPairingsForMode(pairings, opts.mode);
  const waves = groupPairingWaves(ordered);
  const teamsOnDay = new Map<number, Set<string>>();
  const matchesOnDay = new Map<number, number>();
  const wavesOnDay = new Map<number, number>();
  const windowEnd = startDay + durationDays - 1;

  const batchTeamIds = (batch: SuggestedPairing[]) => {
    const ids: string[] = [];
    batch.forEach((p) => {
      if (p.team1Id) ids.push(p.team1Id);
      if (p.team2Id) ids.push(p.team2Id);
    });
    return ids;
  };

  const dayFreeFor = (day: number, ids: string[]) => {
    const used = teamsOnDay.get(day);
    if (!used) return true;
    return ids.every((id) => !used.has(id));
  };

  const earliestFreeDay = (ids: string[]) => {
    for (let day = startDay; day <= windowEnd; day += 1) {
      if (dayFreeFor(day, ids)) return day;
    }
    let day = startDay;
    while (!dayFreeFor(day, ids)) day += 1;
    return day;
  };

  const out: SuggestedPairing[] = [];
  waves.forEach((batch) => {
    const ids = batchTeamIds(batch);
    const day = earliestFreeDay(ids);
    const waveIndexOnDay = wavesOnDay.get(day) || 0;
    wavesOnDay.set(day, waveIndexOnDay + 1);
    const alreadyOnDay = matchesOnDay.get(day) || 0;

    batch.forEach((p, idx) => {
      const indexInDay = alreadyOnDay + idx;
      const timeSlot = opts.mode === 'SEQUENCE' ? waveIndexOnDay : Math.floor(indexInDay / eventsPerDay);
      const tableNumber = opts.mode === 'SEQUENCE' ? idx + 1 : (indexInDay % eventsPerDay) + 1;
      out.push({ ...p, ...slotMeta(day, timeSlot, tableNumber) });
    });

    matchesOnDay.set(day, alreadyOnDay + batch.length);
    const used = teamsOnDay.get(day) || new Set<string>();
    ids.forEach((id) => used.add(id));
    teamsOnDay.set(day, used);
  });
  return out;
}

export function groupPairingWaves(pairings: SuggestedPairing[]): SuggestedPairing[][] {
  const waves: SuggestedPairing[][] = [];
  let i = 0;
  while (i < pairings.length) {
    const current = pairings[i];
    const batch = [current];
    const used = new Set([current.team1Id, current.team2Id].filter(Boolean) as string[]);
    i += 1;
    while (i < pairings.length) {
      const next = pairings[i];
      if ((next.round || 1) !== (current.round || 1) || stageFamily(next.stage) !== stageFamily(current.stage)) break;
      const nextIds = [next.team1Id, next.team2Id].filter(Boolean) as string[];
      if (nextIds.some((id) => used.has(id))) break;
      nextIds.forEach((id) => used.add(id));
      batch.push(next);
      i += 1;
    }
    waves.push(batch);
  }
  return waves;
}

export function teamIdsBookedOnDay(
  pairings: SuggestedPairing[],
  dayNumber: number | undefined,
  exceptIndex = -1,
): Set<string> {
  const used = new Set<string>();
  if (!dayNumber) return used;
  pairings.forEach((p, i) => {
    if (i === exceptIndex || Number(p.dayNumber) !== Number(dayNumber)) return;
    if (p.team1Id) used.add(p.team1Id);
    if (p.team2Id) used.add(p.team2Id);
  });
  return used;
}

export function sameDayTeamClash(
  pairings: SuggestedPairing[],
): { dayNumber: number; teamId: string } | null {
  const byDay = new Map<number, string[]>();
  pairings.forEach((p) => {
    if (!p.dayNumber) return;
    const list = byDay.get(p.dayNumber) || [];
    if (p.team1Id) list.push(p.team1Id);
    if (p.team2Id) list.push(p.team2Id);
    byDay.set(p.dayNumber, list);
  });
  for (const [dayNumber, list] of byDay.entries()) {
    const seen = new Set<string>();
    for (const id of list) {
      if (seen.has(id)) return { dayNumber, teamId: id };
      seen.add(id);
    }
  }
  return null;
}

export function hasTeamPlayingTwiceOnSameDay(pairings: SuggestedPairing[]): boolean {
  return Boolean(sameDayTeamClash(pairings));
}

export function nextSlotAfter(pairings: SuggestedPairing[], startSlot: number, mode: ScheduleMode): number {
  if (!pairings.length) return startSlot;
  if (mode === 'SEQUENCE') return startSlot + pairings.length;
  const keys = new Set(pairings.map((p) => `${stageFamily(p.stage)}-${p.round || 1}-${p.scheduledTime || ''}`));
  if (pairings[0]?.scheduledTime) {
    const times = new Set(pairings.map((p) => p.scheduledTime));
    return startSlot + times.size;
  }
  return startSlot + (keys.size || pairings.length);
}

export function buildAutoPairingsForStage(
  stage: TournamentStage,
  teams: Array<{ id: string; name: string; tag?: string | null }>,
  matches: StandingsInputMatch[],
  extras?: { groups?: LeagueGroupConfig[] }
): SuggestedPairing[] {
  if (stage.kind === 'ROUND_ROBIN') {
    return circlePairings(teams.map((t) => t.id), 'ROUND_ROBIN', 'Round Robin', teams);
  }

  if (stage.kind === 'LEAGUE') {
    let groups = (extras?.groups || stage.groups || []).map((g) => ({
      name: g.name,
      teamIds: (g.teamIds || []).filter(Boolean),
    }));
    const missing = !groups.length || groups.every((g) => g.teamIds.length < 2);
    if (missing) {
      const ranked = computeStandings(teams, matches, (s) => matchesStageKind(s, 'ROUND_ROBIN'));
      const rankedIds = (ranked.length ? ranked.map((r) => r.teamId) : teams.map((t) => t.id));
      groups = seedLeagueGroups(
        rankedIds,
        stage.groupCount || 2,
        stage.teamsPerGroup || Math.ceil(rankedIds.length / 2),
        stage.seeding || 'RR_STANDINGS_SNAKE'
      );
    }
    return leaguePairingsForStage(groups, teams, leagueIndexOf(stage));
  }

  if (stage.kind === 'QUALIFIER') {
    const league = extras?.groups || stage.groups;
    const standingsByGroup: Record<string, StandingRow[]> = {};
    (league || []).forEach((group, gi) => {
      const groupTeams = teams.filter((t) => group.teamIds.includes(t.id));
      standingsByGroup[groupKey(group, gi)] = computeStandings(
        groupTeams.length ? groupTeams : teams,
        matches,
        (s) => s === leagueStageKey(groupKey(group, gi), leagueIndexOf(stage))
      );
    });
    let qualified = qualifiedFromGroups(league || [], standingsByGroup, stage.qualifyPerGroup || 2);
    if (qualified.length < 2) {
      const rr = computeStandings(teams, matches, (s) => matchesStageKind(s, 'ROUND_ROBIN'));
      qualified = rr.slice(0, 4).map((row, idx) => ({
        group: idx % 2 === 0 ? 'A' : 'B',
        rank: Math.floor(idx / 2) + 1,
        teamId: row.teamId,
        teamName: row.teamName,
      }));
    }
    return suggestQualifierPairings(qualified, stage.pairing || 'CROSS').map((p, idx) => ({ ...p, round: 1 + idx }));
  }

  const qualifierMatches = matches.filter((m) => matchesStageKind(m.stage, 'QUALIFIER'));
  return suggestFinalsPairings(qualifierMatches as any, !!stage.includeThirdPlace).map((p, idx) => ({
    ...p,
    round: idx + 1,
  }));
}

export function formatPairingSlot(pair: SuggestedPairing): string {
  if (!pair.dayNumber && !pair.scheduledTime) return '';
  const time = pair.scheduledTime
    ? new Date(pair.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const parts = [
    pair.dayNumber ? `Day ${pair.dayNumber}` : '',
    time,
    pair.tableNumber ? `Table ${pair.tableNumber}` : '',
    pair.round ? `Round ${pair.round}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

export function retargetPairingDay(
  pair: SuggestedPairing,
  dayNumber: number,
  dayDates: Record<number, string> | Record<string, string>,
  startHour = 10
): SuggestedPairing {
  const dates = normalizeDayDates(dayDates);
  const dateStr = dates[dayNumber];
  const prev = pair.scheduledTime ? new Date(pair.scheduledTime) : null;
  const hours = prev && !Number.isNaN(prev.getTime()) ? prev.getHours() : startHour;
  const mins = prev && !Number.isNaN(prev.getTime()) ? prev.getMinutes() : 0;
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  if (!dateStr) base.setDate(base.getDate() + (dayNumber - 1));
  base.setHours(hours, mins, 0, 0);
  return { ...pair, dayNumber, scheduledTime: base.toISOString() };
}

export function normalizeStageConfig(
  raw: TournamentStageConfig | null | undefined,
  teamCount = 8
): TournamentStageConfig {
  if (!raw?.stages?.length) return defaultTournamentStages(teamCount);
  let leagueCount = 0;
  return {
    scheduleMode: raw.scheduleMode || 'DIVIDED',
    stages: raw.stages.map((stage, idx) => {
      if (stage.kind === 'LEAGUE') leagueCount += 1;
      return {
        ...stage,
        id: stage.id || `stage-${idx + 1}`,
        order: stage.order || idx + 1,
        name: stage.name || (stage.kind === 'LEAGUE' && leagueCount > 1 ? `League ${leagueCount}` : KIND_LABEL_SAFE(stage.kind, idx)),
        leagueIndex: stage.kind === 'LEAGUE' ? stage.leagueIndex || leagueCount : stage.leagueIndex,
        startDay: stage.startDay,
        durationDays: stage.durationDays || defaultDurationForKind(stage.kind),
      };
    }),
  };
}

function KIND_LABEL_SAFE(kind: StageKind, idx: number) {
  if (kind === 'ROUND_ROBIN') return 'Round Robin';
  if (kind === 'LEAGUE') return 'League';
  if (kind === 'QUALIFIER') return 'Qualifiers';
  if (kind === 'FINALS') return 'Finals';
  return `Stage ${idx + 1}`;
}

export function stageMatchStages(stage: TournamentStage): string[] {
  const extra = (stage.matchPairings || []).map((p) => p.stage).filter(Boolean);
  const unique = (keys: string[]) => [...new Set(keys.filter(Boolean))];
  if (stage.kind === 'ROUND_ROBIN') return ['ROUND_ROBIN'];
  if (stage.kind === 'LEAGUE') {
    const count = stage.groupCount || stage.groups?.length || 2;
    const index = leagueIndexOf(stage);
    return unique([
      ...Array.from({ length: count }, (_, i) => leagueStageKey(String.fromCharCode(65 + i), index)),
      ...extra,
    ]);
  }
  if (stage.kind === 'QUALIFIER') return unique(['QUALIFIER_1', 'QUALIFIER_2', ...extra]);
  if (stage.kind === 'SPOC_EXHIBITION') return unique(['SPOC_EXHIBITION', ...extra]);
  return unique([
    'GRAND_FINAL',
    ...(stage.includeThirdPlace ? ['THIRD_PLACE'] : []),
    ...extra,
  ]);
}

export function nextSpocExhibitionPairing(existing: SuggestedPairing[]): SuggestedPairing {
  const n = existing.length + 1;
  return {
    stage: n === 1 ? 'SPOC_EXHIBITION' : `SPOC_EXHIBITION_${n}`,
    label: `Spoc Match ${n}`,
    team1Id: '',
    team2Id: '',
    team1Name: '',
    team2Name: '',
    round: n,
  };
}

export function nextQualifierPairing(existing: SuggestedPairing[]): SuggestedPairing {
  const n = existing.length + 1;
  return {
    stage: `QUALIFIER_${n}`,
    label: `Qualifier ${n}`,
    team1Id: '',
    team2Id: '',
    team1Name: '',
    team2Name: '',
    round: n,
  };
}

export function nextFinalsPairing(existing: SuggestedPairing[]): SuggestedPairing {
  const used = new Set(existing.map((p) => p.stage));
  const presets: SuggestedPairing[] = [
    { stage: 'GRAND_FINAL', label: 'Grand Final', team1Id: '', team2Id: '', round: 1 },
    { stage: 'THIRD_PLACE', label: '3rd Place', team1Id: '', team2Id: '', round: 2 },
    { stage: 'FIFTH_PLACE', label: '5th Place', team1Id: '', team2Id: '', round: 3 },
    { stage: 'SEVENTH_PLACE', label: '7th Place', team1Id: '', team2Id: '', round: 4 },
  ];
  const next = presets.find((p) => !used.has(p.stage));
  if (next) return { ...next, team1Name: '', team2Name: '' };
  const n = existing.length + 1;
  return {
    stage: `PLACE_${n}`,
    label: `Placement match ${n}`,
    team1Id: '',
    team2Id: '',
    team1Name: '',
    team2Name: '',
    round: n,
  };
}
