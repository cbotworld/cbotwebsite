import type { PlayerAverageLogRow, PlayerDayScoreRow, StageStandingRow, StandingDayBreakdown, TournamentStage } from '@/types';
import { isCombiSubmissionLocked, type DayDatesInput } from '@/lib/combi-cutoff';
import { isDayScorePublished } from '@/lib/day-scoring';
import { previewTargetBonus } from '@/lib/board-scores';
import { parseSavedLineups, scoreMatchDay, type LineupRound, type RosterPlayer } from '@/lib/combi-results';
import { resolveEffectiveTeamCombi } from '@/lib/combi-fallback';
import { daysForStage } from '@/lib/player-ranking';
import { filterMainTeams, filterSpocTeams } from '@/lib/spoc-teams';
import { toStorageProxyUrl } from '@/lib/supabase';

export type StandingTeam = {
  id: string;
  name: string;
  logo?: string | null;
  tag?: string | null;
  teamType?: string | null;
  savedLineups?: string | null;
  members: Array<RosterPlayer & { average?: number | null; target?: number | null }>;
};

export type StagePairing = {
  dayNumber: number;
  team1Id: string;
  team2Id: string;
  label?: string;
  stageKey?: string;
  stageId?: string;
};

export type KnockoutMatchRow = {
  label: string;
  team1Name: string;
  team2Name: string;
  team1Id: string;
  team2Id: string;
  team1EventPts: number | null;
  team2EventPts: number | null;
  winnerTeamId: string | null;
  dayNumber: number;
  events?: Array<{
    name: string;
    format: string;
    team1Players: string;
    team2Players: string;
    team1PlayerList: any[];
    team2PlayerList: any[];
    team1Pts: number;
    team2Pts: number;
    team1Score: number | null;
    team2Score: number | null;
    result: string;
    reason?: string;
  }>;
};

export type StageStandingBlock = {
  stageId: string;
  kind: string;
  name: string;
  current: boolean;
  groups: Array<{ key: string; name: string; rows: StageStandingRow[] }>;
  knockout?: KnockoutMatchRow[];
};

function scoreMapForDay(scores: PlayerDayScoreRow[], day: number) {
  const map: Record<string, { score: number; slams: number; isWalkover?: boolean }> = {};
  for (const row of scores) {
    if (row.dayNumber === day) map[row.userId] = { score: row.score, slams: row.slams, isWalkover: row.isWalkover };
  }
  return map;
}

function standingRankKey(row: Pick<StageStandingRow, 'total' | 'matchesWon' | 'teamScore' | 'slamBonus'>) {
  return `${row.total}:${row.matchesWon}:${row.teamScore}:${row.slamBonus}`;
}

export function rankStandingRows(rows: StageStandingRow[]): StageStandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    // 1. Total Points (highest first)
    if (b.total !== a.total) return b.total - a.total;
    // 2. Number of Match Wins (highest first)
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
    // 3. Team Total Score (lowest first in Carrom / tiebreaker)
    if (a.teamScore !== b.teamScore) return a.teamScore - b.teamScore;
    // 4. Slam Bonus (highest first)
    if (b.slamBonus !== a.slamBonus) return b.slamBonus - a.slamBonus;
    return a.teamName.localeCompare(b.teamName);
  });
  let lastKey = '';
  let lastRank = 0;
  sorted.forEach((row, i) => {
    const key = standingRankKey(row);
    if (key === lastKey) row.rank = lastRank;
    else {
      lastRank = i + 1;
      lastKey = key;
      row.rank = lastRank;
    }
  });
  return sorted;
}

function emptyRow(team: StandingTeam): StageStandingRow {
  return {
    teamId: team.id,
    teamName: team.name,
    teamLogo: toStorageProxyUrl(team.logo) || undefined,
    teamTag: team.tag || undefined,
    eventPts: 0,
    slamBonus: 0,
    avgBonus: 0,
    total: 0,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    matchesTied: 0,
    teamScore: 0,
    rank: 0,
    days: [],
  };
}

function dayBucket(row: StageStandingRow, day: number): StandingDayBreakdown {
  if (!row.days) row.days = [];
  let d = row.days.find((x) => x.dayNumber === day);
  if (!d) {
    d = {
      dayNumber: day,
      opponentName: null,
      eventPts: 0,
      slamBonus: 0,
      avgBonus: 0,
      total: 0,
      matchResult: null,
      events: [],
      targetBonusPlayers: [],
      slamPlayers: [],
    };
    row.days.push(d);
  }
  return d;
}

function playerDetailsFor(ids: string[], team: StandingTeam, map: Record<string, { score: number; slams: number; isWalkover?: boolean }>) {
  const byId = new Map(team.members.map((m) => [m.id, String(m.name || '').trim() || 'Player']));
  return ids.map((id) => {
    const name = byId.get(id) || 'Player';
    const s = map[id];
    return {
      id,
      name,
      score: typeof s?.score === 'number' ? s.score : null,
      isWalkover: Boolean(s?.isWalkover),
    };
  });
}

function namesFor(ids: string[], team: StandingTeam, map?: Record<string, { score: number; slams: number; isWalkover?: boolean }>) {
  const byId = new Map(team.members.map((m) => [m.id, String(m.name || '').trim() || 'Player']));
  return ids.map((id) => {
    const name = byId.get(id) || 'Player';
    const isWO = map?.[id]?.isWalkover;
    return isWO ? `${name} [Walkover]` : name;
  }).join(', ');
}

function formatEventResultLabel(ev: { winnerTeam: 0 | 1 | 2; reason?: string }, myTeamNum: 1 | 2) {
  const oppTeamNum = myTeamNum === 1 ? 2 : 1;
  if (ev.reason === 'double-walkover') {
    return 'Double WO';
  }
  if (ev.reason === 'walkover') {
    if (ev.winnerTeam === myTeamNum) return 'Win (WO)';
    if (ev.winnerTeam === oppTeamNum) return 'Loss (WO)';
    return 'Void (WO)';
  }
  if (ev.winnerTeam === myTeamNum) return 'Win';
  if (ev.winnerTeam === oppTeamNum) return 'Loss';
  return 'Tie';
}

function sideSum(ids: string[], map: Record<string, { score: number; slams: number }>): number | null {
  if (!ids.length) return null;
  const known = ids.map((id) => map[id]?.score).filter((n): n is number => typeof n === 'number');
  if (!known.length) return null;
  return known.reduce((a, b) => a + b, 0);
}

function applyBonuses(
  row: StageStandingRow,
  team: StandingTeam,
  days: number[],
  scores: PlayerDayScoreRow[],
  dayDates: DayDatesInput,
  now: Date,
) {
  row.teamScore = 0;
  for (const day of days) {
    if (!isDayScorePublished(day, dayDates, now)) continue;
    let dayTeamScore = 0;
    for (const member of team.members) {
      const score = scores.find((s) => s.userId === member.id && s.dayNumber === day);
      if (!score) continue;
      const pts = Number(score.score) || 0;
      row.teamScore += pts;
      dayTeamScore += pts;
      const playerName = String(member.name || '').trim() || 'Player';
      row.slamBonus += score.slams || 0;
      const bucket = dayBucket(row, day);
      bucket.slamBonus += score.slams || 0;
      if ((score.slams || 0) > 0) {
        bucket.slamPlayers = bucket.slamPlayers || [];
        bucket.slamPlayers.push({ userId: member.id, name: playerName, slams: score.slams || 0 });
      }
      if (previewTargetBonus(score.score, member.target) === true) {
        row.avgBonus += 1;
        bucket.avgBonus += 1;
        bucket.targetBonusPlayers = bucket.targetBonusPlayers || [];
        bucket.targetBonusPlayers.push({
          userId: member.id,
          name: playerName,
          score: score.score,
          target: member.target ?? null,
        });
      }
    }
    const bucket = dayBucket(row, day);
    bucket.teamScore = dayTeamScore;
  }
  row.total = row.eventPts + row.slamBonus + row.avgBonus;
}

function applyPairings(
  rowsByTeam: Map<string, StageStandingRow>,
  teamsById: Map<string, StandingTeam>,
  pairings: StagePairing[],
  days: Set<number>,
  scores: PlayerDayScoreRow[],
  dayDates: DayDatesInput,
  now: Date,
  stageId?: string,
) {
  for (const pair of pairings) {
    if (stageId && pair.stageId && pair.stageId !== stageId) continue;
    if (!days.has(pair.dayNumber)) continue;
    if (!isCombiSubmissionLocked(pair.dayNumber, dayDates, now)) continue;
    const t1 = teamsById.get(pair.team1Id);
    const t2 = teamsById.get(pair.team2Id);
    const r1 = rowsByTeam.get(pair.team1Id);
    const r2 = rowsByTeam.get(pair.team2Id);
    if (!t1 || !t2 || !r1 || !r2) continue;
    const combi1 = resolveEffectiveTeamCombi({ team: t1, dayNumber: pair.dayNumber });
    const combi2 = resolveEffectiveTeamCombi({ team: t2, dayNumber: pair.dayNumber });
    const result = scoreMatchDay(
      combi1.rounds,
      combi2.rounds,
      t1.members,
      t2.members,
      scoreMapForDay(scores, pair.dayNumber),
    );
    r1.eventPts += result.team1EventPts;
    r2.eventPts += result.team2EventPts;
    r1.matchesPlayed += 1;
    r2.matchesPlayed += 1;
    if (result.matchWinner === 1) {
      r1.matchesWon += 1;
      r2.matchesLost += 1;
    } else if (result.matchWinner === 2) {
      r2.matchesWon += 1;
      r1.matchesLost += 1;
    } else {
      r1.matchesTied += 1;
      r2.matchesTied += 1;
    }
    const map = scoreMapForDay(scores, pair.dayNumber);
    const d1 = dayBucket(r1, pair.dayNumber);
    const d2 = dayBucket(r2, pair.dayNumber);
    d1.eventPts += result.team1EventPts;
    d2.eventPts += result.team2EventPts;
    d1.opponentName = t2.name;
    d2.opponentName = t1.name;
    d1.matchResult = result.matchWinner === 1 ? 'W' : result.matchWinner === 2 ? 'L' : 'T';
    d2.matchResult = result.matchWinner === 2 ? 'W' : result.matchWinner === 1 ? 'L' : 'T';
    d1.events = result.events.map((ev) => ({
      name: ev.name,
      format: ev.format,
      myPlayers: namesFor(ev.team1PlayerIds, t1, map),
      oppPlayers: namesFor(ev.team2PlayerIds, t2, map),
      myPlayerList: playerDetailsFor(ev.team1PlayerIds, t1, map),
      oppPlayerList: playerDetailsFor(ev.team2PlayerIds, t2, map),
      myPts: ev.team1Pts,
      oppPts: ev.team2Pts,
      myScore: sideSum(ev.team1PlayerIds, map),
      oppScore: sideSum(ev.team2PlayerIds, map),
      result: formatEventResultLabel(ev, 1),
      reason: ev.reason,
    }));
    d2.events = result.events.map((ev) => ({
      name: ev.name,
      format: ev.format,
      myPlayers: namesFor(ev.team2PlayerIds, t2, map),
      oppPlayers: namesFor(ev.team1PlayerIds, t1, map),
      myPlayerList: playerDetailsFor(ev.team2PlayerIds, t2, map),
      oppPlayerList: playerDetailsFor(ev.team1PlayerIds, t1, map),
      myPts: ev.team2Pts,
      oppPts: ev.team1Pts,
      myScore: sideSum(ev.team2PlayerIds, map),
      oppScore: sideSum(ev.team1PlayerIds, map),
      result: formatEventResultLabel(ev, 2),
      reason: ev.reason,
    }));
  }
}

export function pairingsFromStages(stages: TournamentStage[]): StagePairing[] {
  const out: StagePairing[] = [];
  for (const stage of stages) {
    for (const p of stage.matchPairings || []) {
      if (!p.team1Id || !p.team2Id) continue;
      out.push({
        dayNumber: p.dayNumber || stage.startDay || 1,
        team1Id: p.team1Id,
        team2Id: p.team2Id,
        label: p.label,
        stageKey: p.stage,
        stageId: stage.id,
      });
    }
  }
  return out;
}

function daysForStandingStage(stage: TournamentStage): number[] {
  if (stage.kind === 'SPOC_EXHIBITION') {
    const fromPairings = [
      ...new Set(
        (stage.matchPairings || [])
          .map((p) => p.dayNumber)
          .filter((d): d is number => typeof d === 'number' && d > 0),
      ),
    ].sort((a, b) => a - b);
    return fromPairings;
  }
  return daysForStage(stage);
}

function rosterTeamIdsForStage(stage: TournamentStage, teams: StandingTeam[]): string[] {
  const pool = stage.kind === 'SPOC_EXHIBITION' ? filterSpocTeams(teams) : filterMainTeams(teams);
  return pool.map((t) => t.id);
}

export function buildStageStandingBlocks(opts: {
  stages: TournamentStage[];
  teams: StandingTeam[];
  scores: PlayerDayScoreRow[];
  logs: PlayerAverageLogRow[];
  pairings?: StagePairing[];
  dayDates?: DayDatesInput;
  now?: Date;
  currentDay?: number;
}): StageStandingBlock[] {
  const now = opts.now || new Date();
  const pairings = opts.pairings?.length ? opts.pairings : pairingsFromStages(opts.stages);
  const teamsById = new Map(opts.teams.map((t) => [t.id, t]));
  const currentDay = opts.currentDay || 0;

  return opts.stages.map((stage) => {
    const days = daysForStandingStage(stage);
    const daySet = new Set(days);
    const isCurrent = !!currentDay && days.includes(currentDay);

    if (stage.kind === 'QUALIFIER' || stage.kind === 'FINALS') {
        const knockout: KnockoutMatchRow[] = (stage.matchPairings || [])
          .filter((p) => p.team1Id && p.team2Id)
          .map((p) => {
            const day = p.dayNumber || stage.startDay || 1;
            const t1 = teamsById.get(p.team1Id);
            const t2 = teamsById.get(p.team2Id);
            const ready = isCombiSubmissionLocked(day, opts.dayDates, now);
            let team1EventPts: number | null = null;
            let team2EventPts: number | null = null;
            let winnerTeamId: string | null = null;
            let events: any[] = [];
            if (ready && t1 && t2) {
              const combi1 = resolveEffectiveTeamCombi({ team: t1, dayNumber: day });
              const combi2 = resolveEffectiveTeamCombi({ team: t2, dayNumber: day });
              const result = scoreMatchDay(
                combi1.rounds,
                combi2.rounds,
                t1.members,
                t2.members,
                scoreMapForDay(opts.scores, day),
              );
              team1EventPts = result.team1EventPts;
              team2EventPts = result.team2EventPts;
              if (result.matchWinner === 1) winnerTeamId = t1.id;
              if (result.matchWinner === 2) winnerTeamId = t2.id;
              const map = scoreMapForDay(opts.scores, day);
              events = result.events.map((ev) => ({
                name: ev.name,
                format: ev.format,
                team1Players: namesFor(ev.team1PlayerIds, t1, map),
                team2Players: namesFor(ev.team2PlayerIds, t2, map),
                team1PlayerList: playerDetailsFor(ev.team1PlayerIds, t1, map),
                team2PlayerList: playerDetailsFor(ev.team2PlayerIds, t2, map),
                team1Pts: ev.team1Pts,
                team2Pts: ev.team2Pts,
                team1Score: sideSum(ev.team1PlayerIds, map),
                team2Score: sideSum(ev.team2PlayerIds, map),
                result: formatEventResultLabel(ev, 1),
                reason: ev.reason,
              }));
            }
            return {
              label: p.label || p.stage || stage.name,
              team1Name: t1?.name || p.team1Name || 'TBD',
              team2Name: t2?.name || p.team2Name || 'TBD',
              team1Id: p.team1Id,
              team2Id: p.team2Id,
              team1EventPts,
              team2EventPts,
              winnerTeamId,
              dayNumber: day,
              events,
            };
          });
        return {
          stageId: stage.id,
          kind: stage.kind,
          name: stage.name,
          current: isCurrent,
          groups: [],
          knockout,
        };
      }

      const allowedTeamIds = new Set(rosterTeamIdsForStage(stage, opts.teams));
      const groups =
        stage.kind === 'LEAGUE' && stage.groups?.length
          ? stage.groups.map((g, idx) => ({
              key: g.key || String.fromCharCode(65 + idx),
              name: g.name || `Group ${String.fromCharCode(65 + idx)}`,
              teamIds: (g.teamIds || []).filter((id) => allowedTeamIds.has(id)),
            }))
          : [{ key: 'all', name: stage.name, teamIds: [...allowedTeamIds] }];

      const groupTables = groups.map((group) => {
        const groupTeams = group.teamIds.map((id) => teamsById.get(id)).filter(Boolean) as StandingTeam[];
        const rowsByTeam = new Map(groupTeams.map((t) => [t.id, emptyRow(t)]));
        applyPairings(rowsByTeam, teamsById, pairings, daySet, opts.scores, opts.dayDates, now, stage.id);
        for (const team of groupTeams) {
          const row = rowsByTeam.get(team.id)!;
          applyBonuses(row, team, days, opts.scores, opts.dayDates, now);
          row.days = (row.days || [])
            .map((d) => ({ ...d, total: d.eventPts + d.slamBonus + d.avgBonus }))
            .filter((d) => d.eventPts || d.slamBonus || d.avgBonus || (d.events || []).length)
            .sort((a, b) => a.dayNumber - b.dayNumber);
        }
        return { key: group.key, name: group.name, rows: rankStandingRows([...rowsByTeam.values()]) };
      });

      return {
        stageId: stage.id,
        kind: stage.kind,
        name: stage.name,
        current: isCurrent,
        groups: groupTables,
      };
    });
}

export function placementRanking(
  knockout: KnockoutMatchRow[],
): Array<{ place: number; teamId: string; teamName: string; label: string }> {
  const out: Array<{ place: number; teamId: string; teamName: string; label: string }> = [];
  const map: Record<string, [number, number]> = {
    GRAND_FINAL: [1, 2],
    THIRD_PLACE: [3, 4],
    FIFTH_PLACE: [5, 6],
    SEVENTH_PLACE: [7, 8],
  };
  for (const match of knockout) {
    const key = Object.keys(map).find((k) => (match.label || '').toUpperCase().includes(k.replace('_', ' ')) || (match.label || '').toUpperCase().includes(k));
    const places = key ? map[key] : null;
    const labelUpper = (match.label || '').toUpperCase();
    let pair: [number, number] | null = places;
    if (!pair) {
      if (labelUpper.includes('GRAND') || (labelUpper.includes('FINAL') && !labelUpper.includes('3'))) pair = [1, 2];
      else if (labelUpper.includes('3')) pair = [3, 4];
      else if (labelUpper.includes('5')) pair = [5, 6];
      else if (labelUpper.includes('7')) pair = [7, 8];
    }
    if (!pair || !match.winnerTeamId) continue;
    const loserId = match.winnerTeamId === match.team1Id ? match.team2Id : match.team1Id;
    const winnerName = match.winnerTeamId === match.team1Id ? match.team1Name : match.team2Name;
    const loserName = loserId === match.team1Id ? match.team1Name : match.team2Name;
    out.push({ place: pair[0], teamId: match.winnerTeamId, teamName: winnerName, label: match.label });
    out.push({ place: pair[1], teamId: loserId, teamName: loserName, label: match.label });
  }
  return out.sort((a, b) => a.place - b.place);
}
