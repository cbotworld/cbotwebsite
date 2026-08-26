export type LineupRound = {
  name?: string;
  players?: string[];
  playerIds?: (string | null | undefined)[];
};

export type RosterPlayer = { id: string; name?: string | null };

export type DayScoreMap = Record<string, { score: number; slams: number }>;

export type EventResult = {
  name: string;
  format: string;
  team1PlayerIds: string[];
  team2PlayerIds: string[];
  team1Pts: number;
  team2Pts: number;
  reason: 'walkover' | 'double-walkover' | 'score' | 'tie' | 'void';
  winnerTeam: 1 | 2 | 0;
};

export type MatchDayResult = {
  team1EventPts: number;
  team2EventPts: number;
  matchWinner: 1 | 2 | 0;
  events: EventResult[];
};

function normName(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function roundFormat(name: string | undefined): string {
  const u = String(name || '').toUpperCase();
  if (u.includes('QUAD')) return 'QUADS';
  if (u.includes('TRIPLE')) return 'TRIPLES';
  if (u.includes('DOUBLE')) return 'DOUBLES';
  if (u.includes('SINGLE')) return 'SINGLES';
  return 'OTHER';
}

export function resolveRoundPlayerIds(round: LineupRound | undefined, roster: RosterPlayer[]): string[] {
  if (!round) return [];
  const fromIds = (round.playerIds || []).map((id) => String(id || '').trim()).filter(Boolean);
  if (fromIds.length) return fromIds;
  const names = (round.players || []).map((n) => String(n || '').trim()).filter(Boolean);
  if (!names.length) return [];
  const byName = new Map(roster.map((p) => [normName(p.name), p.id]));
  return names.map((n) => byName.get(normName(n)) || '').filter(Boolean);
}

export function parseSavedLineups(raw?: string | null): Record<string, { rounds?: LineupRound[]; submittedAt?: string }> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function scoreOneEvent(
  side1: string[],
  side2: string[],
  scores: DayScoreMap,
  name = '',
): EventResult {
  const format = roundFormat(name);
  const empty1 = side1.length === 0;
  const empty2 = side2.length === 0;
  if (empty1 && empty2) {
    return { name, format, team1PlayerIds: side1, team2PlayerIds: side2, team1Pts: 0, team2Pts: 0, reason: 'void', winnerTeam: 0 };
  }
  const wo1 = empty1 || side1.some((id) => !scores[id]);
  const wo2 = empty2 || side2.some((id) => !scores[id]);
  if (wo1 && wo2) {
    return { name, format, team1PlayerIds: side1, team2PlayerIds: side2, team1Pts: 0, team2Pts: 0, reason: 'double-walkover', winnerTeam: 0 };
  }
  if (wo1) {
    return { name, format, team1PlayerIds: side1, team2PlayerIds: side2, team1Pts: 0, team2Pts: 2, reason: 'walkover', winnerTeam: 2 };
  }
  if (wo2) {
    return { name, format, team1PlayerIds: side1, team2PlayerIds: side2, team1Pts: 2, team2Pts: 0, reason: 'walkover', winnerTeam: 1 };
  }
  const sum1 = side1.reduce((n, id) => n + (scores[id]?.score || 0), 0);
  const sum2 = side2.reduce((n, id) => n + (scores[id]?.score || 0), 0);
  if (sum1 < sum2) {
    return { name, format, team1PlayerIds: side1, team2PlayerIds: side2, team1Pts: 2, team2Pts: 0, reason: 'score', winnerTeam: 1 };
  }
  if (sum2 < sum1) {
    return { name, format, team1PlayerIds: side1, team2PlayerIds: side2, team1Pts: 0, team2Pts: 2, reason: 'score', winnerTeam: 2 };
  }
  return { name, format, team1PlayerIds: side1, team2PlayerIds: side2, team1Pts: 1, team2Pts: 1, reason: 'tie', winnerTeam: 0 };
}

export function scoreMatchDay(
  rounds1: LineupRound[] | undefined,
  rounds2: LineupRound[] | undefined,
  roster1: RosterPlayer[],
  roster2: RosterPlayer[],
  scores: DayScoreMap,
): MatchDayResult {
  const a = rounds1 || [];
  const b = rounds2 || [];
  const n = Math.max(a.length, b.length);
  const events: EventResult[] = [];
  let team1EventPts = 0;
  let team2EventPts = 0;
  for (let i = 0; i < n; i += 1) {
    const name = a[i]?.name || b[i]?.name || `Event ${i + 1}`;
    const result = scoreOneEvent(
      resolveRoundPlayerIds(a[i], roster1),
      resolveRoundPlayerIds(b[i], roster2),
      scores,
      name,
    );
    team1EventPts += result.team1Pts;
    team2EventPts += result.team2Pts;
    events.push(result);
  }
  let matchWinner: 1 | 2 | 0 = 0;
  if (team1EventPts > team2EventPts) matchWinner = 1;
  else if (team2EventPts > team1EventPts) matchWinner = 2;
  return { team1EventPts, team2EventPts, matchWinner, events };
}
