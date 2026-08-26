import { scoreMatchDay, scoreOneEvent } from '@/lib/combi-results';
import { averageForDay, walkoverRankingScore } from '@/lib/player-average';
import { rankPlayers } from '@/lib/player-ranking';
import { buildStageStandingBlocks, rankStandingRows, type StandingTeam } from '@/lib/team-standings';
import { insertIndexForNewStage, stageJustFinishedForAverageReview } from '@/lib/tournament-stages';
import type { StageStandingRow, TournamentStage } from '@/types';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const scores = {
  a: { score: 20, slams: 1 },
  b: { score: 22, slams: 0 },
  c: { score: 18, slams: 0 },
  d: { score: 19, slams: 0 },
};

assert(scoreOneEvent(['a'], ['b'], scores, 'Singles 1').winnerTeam === 1, 'singles lowest wins');

const singlesWo = scoreOneEvent(['missing'], ['b'], scores, 'Singles 1');
assert(singlesWo.team2Pts === 2 && singlesWo.team1Pts === 0 && singlesWo.winnerTeam === 2, 'singles WO');

const doublesOneWo = scoreOneEvent(['a', 'missing'], ['c', 'd'], scores, 'Doubles 1');
assert(doublesOneWo.winnerTeam === 2 && doublesOneWo.team2Pts === 2 && doublesOneWo.team1Pts === 0, 'doubles one WO loses event');

const bothWo = scoreOneEvent(['missing'], ['gone'], scores, 'Singles 1');
assert(bothWo.reason === 'double-walkover' && bothWo.team1Pts === 0 && bothWo.team2Pts === 0, 'both WO');

const emptyVsFilled = scoreOneEvent([], ['b'], scores, 'Singles 1');
assert(emptyVsFilled.winnerTeam === 2 && emptyVsFilled.team2Pts === 2, 'empty vs filled');

const bothEmpty = scoreOneEvent([], [], scores, 'Singles 1');
assert(bothEmpty.reason === 'void' && bothEmpty.team1Pts === 0 && bothEmpty.team2Pts === 0, 'both empty void');

assert(scoreOneEvent(['a', 'c'], ['b', 'd'], scores, 'Doubles 1').winnerTeam === 1, 'sum 38 vs 41');

const tie = scoreOneEvent(['a'], ['twin'], { a: { score: 20, slams: 0 }, twin: { score: 20, slams: 0 } }, 'Singles');
assert(tie.team1Pts === 1 && tie.team2Pts === 1 && tie.reason === 'tie', 'tie +1 each');

const quads = scoreOneEvent(
  ['a', 'c', 'd', 'b'],
  ['q1', 'q2', 'q3', 'q4'],
  {
    ...scores,
    q1: { score: 21, slams: 0 },
    q2: { score: 21, slams: 0 },
    q3: { score: 21, slams: 0 },
    q4: { score: 21, slams: 0 },
  },
  'Quads 1',
);
assert(quads.format === 'QUADS' && quads.winnerTeam === 1 && quads.team1Pts === 2, 'quads handled');

const day = scoreMatchDay(
  [{ name: 'Singles 1', playerIds: ['a'] }],
  [{ name: 'Singles 1', playerIds: ['b'] }],
  [{ id: 'a', name: 'A' }],
  [{ id: 'b', name: 'B' }],
  scores,
);
assert(day.matchWinner === 1, 'match winner');

assert(averageForDay([{ userId: 'u', average: 24, effectiveFrom: '2026-08-11' }], '2026-08-10', 20) === 20, 'today keeps old average');
assert(averageForDay([{ userId: 'u', average: 24, effectiveFrom: '2026-08-11' }], '2026-08-11', 20) === 24, 'tomorrow uses new average');
assert(
  averageForDay(
    [
      { userId: 'u', average: 22, effectiveFrom: '2026-08-10' },
      { userId: 'u', average: 18, effectiveFrom: '2026-08-12' },
    ],
    '2026-08-11',
    99,
  ) === 22,
  'averageForDay uses yesterday if changed today',
);
assert(
  averageForDay(
    [
      { userId: 'u', average: 21, effectiveFrom: '2026-08-12' },
      { userId: 'u', average: 18, effectiveFrom: '2026-08-12' },
    ],
    '2026-08-12',
    99,
  ) === 18,
  'same-day last save wins',
);
assert(walkoverRankingScore(24) === 25, 'WO ranking = avg+1');
assert(walkoverRankingScore(0) === 1, 'null/0 average walkover counts as 1');

const ranked = rankPlayers({
  players: [
    { userId: 'a', name: 'A', teamId: 't', teamName: 'T' },
    { userId: 'b', name: 'B', teamId: 't', teamName: 'T' },
  ],
  scores: [
    { userId: 'a', dayNumber: 1, score: 20, slams: 0 },
    { userId: 'b', dayNumber: 1, score: 22, slams: 0 },
  ],
  logs: [],
  maxDay: 1,
  now: new Date('2026-08-10T20:00:00+05:30'),
  dayDates: { 1: '2026-08-10' },
});
assert(ranked[0].userId === 'a' && ranked[0].rank === 1 && ranked[0].boardAverage === 20, 'lowest board average is rank 1');

const rankedWo = rankPlayers({
  players: [
    { userId: 'a', name: 'A', teamId: 't', teamName: 'T', average: 24 },
    { userId: 'b', name: 'B', teamId: 't', teamName: 'T', average: 24 },
  ],
  scores: [{ userId: 'a', dayNumber: 1, score: 20, slams: 0 }],
  logs: [
    { userId: 'b', average: 24, effectiveFrom: '2026-08-10' },
    { userId: 'b', average: 18, effectiveFrom: '2026-08-11' },
  ],
  maxDay: 1,
  now: new Date('2026-08-10T20:00:00+05:30'),
  dayDates: { 1: '2026-08-10' },
});
const bRow = rankedWo.find((r) => r.userId === 'b');
assert(bRow?.walkovers === 1 && bRow.boardAverage === 24 && bRow.boardCount === 0, 'walkover days are excluded from board count; current average still ranks');
assert(rankedWo[0].userId === 'a' && rankedWo[0].rank === 1, 'lower current/board average ranks first');

const rankedCurrent = rankPlayers({
  players: [
    { userId: 'a', name: 'A', teamId: 't', teamName: 'T', average: 18 },
    { userId: 'b', name: 'B', teamId: 't', teamName: 'T', average: 22 },
  ],
  scores: [
    { userId: 'a', dayNumber: 1, score: 40, slams: 0 },
    { userId: 'b', dayNumber: 1, score: 10, slams: 0 },
  ],
  logs: [],
  maxDay: 1,
  now: new Date('2026-08-10T20:00:00+05:30'),
  dayDates: { 1: '2026-08-10' },
});
assert(rankedCurrent[0].userId === 'a' && rankedCurrent[0].boardAverage === 18, 'current average ranks ahead of day scores');
assert(rankedCurrent[1].userId === 'b' && rankedCurrent[1].boardAverage === 22, 'higher current average ranks second');

const rankedBoards = rankPlayers({
  players: [
    { userId: 'a', name: 'A', teamId: 't', teamName: 'T' },
    { userId: 'b', name: 'B', teamId: 't', teamName: 'T' },
  ],
  scores: [
    { userId: 'a', dayNumber: 1, score: 40, slams: 0, boards: [{ score: 20, slams: 0 }, { score: 20, slams: 0 }] },
    { userId: 'b', dayNumber: 1, score: 22, slams: 0, boards: [{ score: 22, slams: 0 }] },
  ],
  logs: [],
  maxDay: 1,
  now: new Date('2026-08-10T20:00:00+05:30'),
  dayDates: { 1: '2026-08-10' },
});
assert(rankedBoards[0].userId === 'a' && rankedBoards[0].boardAverage === 20, 'lower total-score/boards ranks first');
assert(rankedBoards[1].userId === 'b' && rankedBoards[1].boardAverage === 22, 'higher average ranks second despite lower total');

const qfThenFinals: TournamentStage[] = [
  { id: 'rr', order: 1, kind: 'ROUND_ROBIN', name: 'Round Robin' },
  { id: 'q1', order: 2, kind: 'QUALIFIER', name: 'Qualifiers' },
  { id: 'fn', order: 3, kind: 'FINALS', name: 'Finals' },
];
assert(insertIndexForNewStage(qfThenFinals, 'QUALIFIER') === 2, '2nd qualifier inserts after first, before finals');
assert(insertIndexForNewStage(qfThenFinals, 'LEAGUE') === 1, 'league still inserts before knockout');

const review = stageJustFinishedForAverageReview(
  [
    { id: 'rr', order: 1, kind: 'ROUND_ROBIN', name: 'Round Robin', startDay: 1, durationDays: 7 },
    { id: 'lg', order: 2, kind: 'LEAGUE', name: 'League', startDay: 8, durationDays: 3 },
  ],
  7,
);
assert(review?.finishedStageName === 'Round Robin' && review.nextStageName === 'League', 'prompt after last RR day');

const dayDates = { 1: '2026-08-10' };
const lineup = (playerId: string) =>
  JSON.stringify({ '1': { rounds: [{ name: 'Singles 1', playerIds: [playerId] }] } });
const standingTeams: StandingTeam[] = [
  { id: 'main1', name: 'Main 1', teamType: 'MAIN', savedLineups: lineup('m1'), members: [{ id: 'm1', name: 'M1', average: 24, target: 24 }] },
  { id: 'main2', name: 'Main 2', teamType: 'MAIN', savedLineups: lineup('m2'), members: [{ id: 'm2', name: 'M2', average: 24, target: 24 }] },
  { id: 'spoc1', name: 'Spoc 1', teamType: 'SPOC_EXHIBITION', savedLineups: lineup('s1'), members: [{ id: 's1', name: 'S1', average: 24, target: 24 }] },
  { id: 'spoc2', name: 'Spoc 2', teamType: 'SPOC_EXHIBITION', savedLineups: lineup('s2'), members: [{ id: 's2', name: 'S2', average: 24, target: 24 }] },
];
const standingStages: TournamentStage[] = [
  {
    id: 'rr',
    order: 1,
    kind: 'ROUND_ROBIN',
    name: 'Round Robin',
    startDay: 1,
    durationDays: 1,
    matchPairings: [{ stage: 'ROUND_ROBIN', label: 'RR', team1Id: 'main1', team2Id: 'main2', dayNumber: 1 }],
  },
  {
    id: 'spoc',
    order: 2,
    kind: 'SPOC_EXHIBITION',
    name: 'Spoc Exhibition',
    startDay: 1,
    durationDays: 0,
    matchPairings: [{ stage: 'SPOC_EXHIBITION', label: 'Spoc', team1Id: 'spoc1', team2Id: 'spoc2', dayNumber: 1 }],
  },
];
const standingScores = [
  { userId: 'm1', dayNumber: 1, score: 20, slams: 2 },
  { userId: 'm2', dayNumber: 1, score: 22, slams: 0 },
  { userId: 's1', dayNumber: 1, score: 10, slams: 5 },
  { userId: 's2', dayNumber: 1, score: 11, slams: 0 },
];
const standingLogs = [
  { userId: 'm1', average: 24, effectiveFrom: '2026-08-10' },
  { userId: 's1', average: 24, effectiveFrom: '2026-08-10' },
];

function standingAt(nowIso: string) {
  return buildStageStandingBlocks({
    stages: standingStages,
    teams: standingTeams,
    scores: standingScores,
    logs: standingLogs,
    dayDates,
    now: new Date(nowIso),
  });
}

const beforeEight = standingAt('2026-08-10T19:59:00+05:30');
const rrBeforeEight = beforeEight.find((b) => b.kind === 'ROUND_ROBIN')?.groups[0].rows.find((r) => r.teamId === 'main1');
assert(rrBeforeEight?.eventPts === 0 && rrBeforeEight.slamBonus === 0 && rrBeforeEight.avgBonus === 0, 'slam/avg hidden before 8pm');

const afterEight = standingAt('2026-08-10T20:00:00+05:30');
const rrAfterEight = afterEight.find((b) => b.kind === 'ROUND_ROBIN')?.groups[0].rows.find((r) => r.teamId === 'main1');
assert(rrAfterEight?.eventPts === 0, 'eventPts hidden until 9:30');
assert(rrAfterEight?.slamBonus === 2 && rrAfterEight.avgBonus === 1, 'slam/avg after 8pm');
assert(
  rrAfterEight?.days?.some((d) => d.targetBonusPlayers?.some((p) => p.name === 'M1' && p.score === 20)),
  'target bonus popup lists the player by day',
);

const afterCombi = standingAt('2026-08-10T21:30:00+05:30');
const rrBlock = afterCombi.find((b) => b.kind === 'ROUND_ROBIN');
const spocBlock = afterCombi.find((b) => b.kind === 'SPOC_EXHIBITION');
assert(rrBlock && spocBlock, 'SPOC gets its own block');
const rrIds = (rrBlock?.groups[0].rows || []).map((r) => r.teamId);
const spocIds = (spocBlock?.groups[0].rows || []).map((r) => r.teamId);
assert(rrIds.includes('main1') && rrIds.includes('main2') && !rrIds.includes('spoc1') && !rrIds.includes('spoc2'), 'RR excludes SPOC teams');
assert(spocIds.includes('spoc1') && spocIds.includes('spoc2') && !spocIds.includes('main1') && !spocIds.includes('main2'), 'SPOC table only SPOC teams');
const rrMain = rrBlock?.groups[0].rows.find((r) => r.teamId === 'main1');
const spocRow = spocBlock?.groups[0].rows.find((r) => r.teamId === 'spoc1');
assert(rrMain?.eventPts === 2 && rrMain.slamBonus === 2 && rrMain.avgBonus === 1, 'RR event pts after 9:30');
assert(spocRow?.eventPts === 2 && spocRow.slamBonus === 5, 'SPOC points stay on SPOC table');
assert(rrMain?.slamBonus !== 5 && rrMain?.eventPts !== 4, 'SPOC results do not mix into RR');

function standingRow(partial: Partial<StageStandingRow> & Pick<StageStandingRow, 'teamId' | 'teamName'>): StageStandingRow {
  return {
    eventPts: 0,
    slamBonus: 0,
    avgBonus: 0,
    total: 0,
    matchesWon: 0,
    rank: 0,
    ...partial,
  };
}

const tiedOnPoints = rankStandingRows([
  standingRow({ teamId: 'lowWins', teamName: 'Low Wins', total: 10, matchesWon: 1, slamBonus: 9 }),
  standingRow({ teamId: 'highWins', teamName: 'High Wins', total: 10, matchesWon: 3, slamBonus: 1 }),
  standingRow({ teamId: 'leader', teamName: 'Leader', total: 12, matchesWon: 0, slamBonus: 0 }),
]);
assert(tiedOnPoints[0].teamId === 'leader' && tiedOnPoints[0].rank === 1, 'highest total ranks first even with zero wins');
assert(tiedOnPoints[1].teamId === 'highWins' && tiedOnPoints[1].rank === 2, 'same points: more matches won ranks higher');
assert(tiedOnPoints[2].teamId === 'lowWins' && tiedOnPoints[2].rank === 3, 'same points: fewer matches won ranks lower');

const tiedOnWins = rankStandingRows([
  standingRow({ teamId: 'fewSlams', teamName: 'Few Slams', total: 8, matchesWon: 2, slamBonus: 1 }),
  standingRow({ teamId: 'manySlams', teamName: 'Many Slams', total: 8, matchesWon: 2, slamBonus: 4 }),
]);
assert(tiedOnWins[0].teamId === 'manySlams' && tiedOnWins[0].rank === 1, 'same points and wins: more slams ranks higher');
assert(tiedOnWins[1].teamId === 'fewSlams' && tiedOnWins[1].rank === 2, 'same points and wins: fewer slams ranks lower');

const fullTie = rankStandingRows([
  standingRow({ teamId: 'b', teamName: 'Beta', total: 6, matchesWon: 1, slamBonus: 2 }),
  standingRow({ teamId: 'a', teamName: 'Alpha', total: 6, matchesWon: 1, slamBonus: 2 }),
]);
assert(fullTie[0].teamId === 'a' && fullTie[1].teamId === 'b', 'name is display order only after a full tie');
assert(fullTie[0].rank === 1 && fullTie[1].rank === 1, 'same points, wins, and slams share rank');

console.log('verify-combi-results: all asserts passed');
