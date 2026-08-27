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
    return { name, format, team1PlayerIds: side1, team2PlayerIds: side2, team1Pts: 1, team2Pts: 1, reason: 'tie', winnerTeam: 0 };
  }
  if (empty1) {
    return { name, format, team1PlayerIds: side1, team2PlayerIds: side2, team1Pts: 0, team2Pts: 2, reason: 'walkover', winnerTeam: 2 };
  }
  if (empty2) {
    return { name, format, team1PlayerIds: side1, team2PlayerIds: side2, team1Pts: 2, team2Pts: 0, reason: 'walkover', winnerTeam: 1 };
  }
  const wo1 = side1.some((id) => !scores[id]);
  const wo2 = side2.some((id) => !scores[id]);
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

  // Case 1: Both team captains did NOT submit combis — consider as a DRAW match and give 1 point each
  if (a.length === 0 && b.length === 0) {
    return {
      team1EventPts: 1,
      team2EventPts: 1,
      matchWinner: 0,
      events: [
        {
          name: 'Match Draw (No Combis Submitted)',
          format: 'OTHER',
          team1PlayerIds: [],
          team2PlayerIds: [],
          team1Pts: 1,
          team2Pts: 1,
          reason: 'tie',
          winnerTeam: 0,
        },
      ],
    };
  }

  // Case 2: Team 1 submitted combi, but Team 2 did NOT submit combi — consider submitted team (Team 1) as winner
  if (a.length > 0 && b.length === 0) {
    const events: EventResult[] = a.map((round, i) => {
      const name = round.name || `Event ${i + 1}`;
      const format = roundFormat(name);
      const team1PlayerIds = resolveRoundPlayerIds(round, roster1);
      return {
        name,
        format,
        team1PlayerIds,
        team2PlayerIds: [],
        team1Pts: 2,
        team2Pts: 0,
        reason: 'walkover',
        winnerTeam: 1,
      };
    });
    const team1EventPts = events.reduce((sum, e) => sum + e.team1Pts, 0);
    return {
      team1EventPts,
      team2EventPts: 0,
      matchWinner: 1,
      events,
    };
  }

  // Case 3: Team 2 submitted combi, but Team 1 did NOT submit combi — consider submitted team (Team 2) as winner
  if (b.length > 0 && a.length === 0) {
    const events: EventResult[] = b.map((round, i) => {
      const name = round.name || `Event ${i + 1}`;
      const format = roundFormat(name);
      const team2PlayerIds = resolveRoundPlayerIds(round, roster2);
      return {
        name,
        format,
        team1PlayerIds: [],
        team2PlayerIds,
        team1Pts: 0,
        team2Pts: 2,
        reason: 'walkover',
        winnerTeam: 2,
      };
    });
    const team2EventPts = events.reduce((sum, e) => sum + e.team2Pts, 0);
    return {
      team1EventPts: 0,
      team2EventPts,
      matchWinner: 2,
      events,
    };
  }

  // Case 4: Both teams submitted combis
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

export type PlayerMatchEvent = {
  revealed: boolean;
  selected: boolean;
  name: string;
  format: string;
  myPlayers: string[];
  oppPlayers: string[];
  myScore: number | null;
  oppScore: number | null;
  result: 'WIN' | 'LOSS' | 'TIE' | 'WALKOVER' | null;
  reason: EventResult['reason'] | null;
  eventPts: number;
  scoresReady: boolean;
};

function namesForIds(ids: string[], roster: RosterPlayer[]) {
  const byId = new Map(roster.map((p) => [p.id, String(p.name || '').trim() || 'Player']));
  return ids.map((id) => byId.get(id) || 'Player');
}

export function sideScoreSum(ids: string[], scores: DayScoreMap): number | null {
  if (!ids.length) return null;
  const known = ids.map((id) => scores[id]?.score).filter((n): n is number => typeof n === 'number');
  if (!known.length) return null;
  return known.reduce((a, b) => a + b, 0);
}

export function playerMatchEvent(opts: {
  userId: string;
  playerIsTeam1: boolean;
  revealed: boolean;
  scoresReady: boolean;
  roundsMine?: LineupRound[];
  roundsOpp?: LineupRound[];
  rosterMine: RosterPlayer[];
  rosterOpp: RosterPlayer[];
  scores: DayScoreMap;
}): PlayerMatchEvent {
  const empty: PlayerMatchEvent = {
    revealed: opts.revealed,
    selected: false,
    name: '',
    format: '',
    myPlayers: [],
    oppPlayers: [],
    myScore: null,
    oppScore: null,
    result: null,
    reason: null,
    eventPts: 0,
    scoresReady: opts.scoresReady,
  };
  if (!opts.revealed) return empty;

  const scored = scoreMatchDay(
    opts.roundsMine,
    opts.roundsOpp,
    opts.rosterMine,
    opts.rosterOpp,
    opts.scores,
  );
  const hit = scored.events.find((ev) => {
    const mine = opts.playerIsTeam1 ? ev.team1PlayerIds : ev.team2PlayerIds;
    return mine.includes(opts.userId);
  });
  if (!hit) return empty;

  const myIds = opts.playerIsTeam1 ? hit.team1PlayerIds : hit.team2PlayerIds;
  const oppIds = opts.playerIsTeam1 ? hit.team2PlayerIds : hit.team1PlayerIds;
  const myPts = opts.playerIsTeam1 ? hit.team1Pts : hit.team2Pts;
  const won = opts.playerIsTeam1 ? hit.winnerTeam === 1 : hit.winnerTeam === 2;
  const lost = opts.playerIsTeam1 ? hit.winnerTeam === 2 : hit.winnerTeam === 1;
  let result: PlayerMatchEvent['result'] = null;
  if (opts.scoresReady) {
    if (hit.reason === 'walkover') result = won ? 'WIN' : 'WALKOVER';
    else if (hit.reason === 'tie') result = 'TIE';
    else if (won) result = 'WIN';
    else if (lost) result = 'LOSS';
  }

  return {
    revealed: true,
    selected: true,
    name: hit.name,
    format: hit.format,
    myPlayers: namesForIds(myIds, opts.rosterMine),
    oppPlayers: namesForIds(oppIds, opts.rosterOpp),
    myScore: opts.scoresReady ? sideScoreSum(myIds, opts.scores) : null,
    oppScore: opts.scoresReady ? sideScoreSum(oppIds, opts.scores) : null,
    result,
    reason: hit.reason,
    eventPts: myPts,
    scoresReady: opts.scoresReady,
  };
}
