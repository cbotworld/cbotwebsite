import type {
  EditionProfileStats,
  PlayerAverageLogRow,
  PlayerDayScoreRow,
  PlayerRankingRow,
  TournamentStage,
} from '@/types';
import { isDayScorePublished, todayIstCalendarDate } from '@/lib/day-scoring';
import {
  aggregateBoards,
  computeEditionRunningAverage,
  editionBoardAverage,
  normalizeBoards,
  previewTargetBonus,
  roundAverage,
} from '@/lib/board-scores';
import { averageForDay, logsForUser } from '@/lib/player-average';
import { isCombiSubmissionLocked, type DayDatesInput } from '@/lib/combi-cutoff';
import { scoreMatchDay, type LineupRound, type RosterPlayer } from '@/lib/combi-results';
import { resolveEffectiveTeamCombi } from '@/lib/combi-fallback';

export type RankedPlayer = {
  userId: string;
  name: string;
  teamId: string;
  teamName: string;
  average?: number | null;
  grade?: string | null;
  target?: number | null;
  matchesWon?: number;
};

export function publishedDays(maxDay: number, dayDates?: DayDatesInput, now = new Date()): number[] {
  const days: number[] = [];
  for (let d = 1; d <= maxDay; d += 1) {
    if (isDayScorePublished(d, dayDates, now)) days.push(d);
  }
  return days;
}

export function rankPlayers(opts: {
  players: RankedPlayer[];
  scores: PlayerDayScoreRow[];
  logs: PlayerAverageLogRow[];
  maxDay: number;
  dayDates?: DayDatesInput;
  now?: Date;
}): PlayerRankingRow[] {
  const now = opts.now || new Date();
  const days = publishedDays(opts.maxDay, opts.dayDates, now);
  const scoreKey = (userId: string, day: number) => `${userId}:${day}`;
  const byKey = new Map<string, PlayerDayScoreRow>();
  for (const row of opts.scores) byKey.set(scoreKey(row.userId, row.dayNumber), row);

  // Compute highest average among players for walkover penalty calculation
  const allSeedAverages = opts.players
    .map((p) => {
      const seed = averageForDay(
        logsForUser(opts.logs, p.userId),
        todayIstCalendarDate(now),
        Number(p.average) || 0,
      );
      return Number.isFinite(seed) && seed > 0 ? seed : 0;
    })
    .filter((a) => a > 0);

  const highestAverage = allSeedAverages.length > 0 ? Math.max(...allSeedAverages) : 0;

  const rows: PlayerRankingRow[] = opts.players.map((player) => {
    const seed = 0;
    let running = 0;
    let totalScore = 0;
    let boardCount = 0;
    let slams = 0;
    let walkovers = 0;
    let daysProcessed = 0;
    const dayScores: Array<{
      dayNumber: number;
      score: number;
      slams: number;
      isWalkover?: boolean;
      eventName?: string;
      breakdown?: any;
    }> = [];

    for (const day of days) {
      const row = byKey.get(scoreKey(player.userId, day));
      if (row) {
        if (row.isWalkover) {
          walkovers += 1;
        }
        dayScores.push({
          dayNumber: day,
          score: row.score,
          slams: row.slams || 0,
          isWalkover: row.isWalkover,
          eventName: row.eventName,
          breakdown: row.breakdown,
        });
        const boards = normalizeBoards(row.boards, row.score, row.slams);
        const agg = aggregateBoards(boards);
        totalScore += agg.score;
        boardCount += agg.boardCount;
        slams += row.slams || agg.slams || 0;
        if (agg.boardCount > 0) {
          const dayAvg = agg.score / agg.boardCount;
          running = running > 0 ? roundAverage((running + dayAvg) / 2) : roundAverage(dayAvg);
          daysProcessed += 1;
        }
      } else {
        // Walkover: no score submitted by player or captain
        walkovers += 1;
        const playerBase = running > 0 ? running : seed > 0 ? seed : 0;
        const maxRef = Math.max(highestAverage, playerBase);
        const walkoverDayAvg = (maxRef > 0 ? maxRef : 25) + 1;
        dayScores.push({
          dayNumber: day,
          score: walkoverDayAvg,
          slams: 0,
          isWalkover: true,
        });
        running = running > 0 ? roundAverage((running + walkoverDayAvg) / 2) : roundAverage(walkoverDayAvg);
        daysProcessed += 1;
      }
    }

    const rankingAverage =
      daysProcessed > 0
        ? (running > 0 ? running : null)
        : Number.isFinite(seed) && seed > 0
          ? roundAverage(seed)
          : null;

    return {
      userId: player.userId,
      name: player.name,
      teamId: player.teamId,
      teamName: player.teamName,
      grade: player.grade || null,
      target: player.target ?? null,
      daysCounted: days.length - walkovers,
      walkovers,
      totalScore,
      boardCount,
      boardAverage: rankingAverage,
      matchesWon: player.matchesWon || 0,
      slams,
      rank: 0,
      dayScores,
    };
  });

  // Sort purely by average (lowest first). Slams and matches won are NOT considered.
  rows.sort((a, b) => {
    const aAvg = a.boardAverage;
    const bAvg = b.boardAverage;
    if (aAvg == null && bAvg == null) return a.name.localeCompare(b.name);
    if (aAvg == null) return 1;
    if (bAvg == null) return -1;
    if (aAvg !== bAvg) return aAvg - bAvg;
    return a.name.localeCompare(b.name);
  });

  // Players with the same average receive the same ranking
  let lastAvg: number | null = null;
  let lastRank = 0;
  rows.forEach((row, i) => {
    if (row.boardAverage != null && row.boardAverage === lastAvg) {
      row.rank = lastRank;
    } else {
      lastRank = i + 1;
      lastAvg = row.boardAverage;
      row.rank = lastRank;
    }
  });
  return rows;
}

export function editionProfileStats(opts: {
  userId: string;
  scores: PlayerDayScoreRow[];
  logs: PlayerAverageLogRow[];
  fallbackAverage?: number;
  fallbackTarget?: number;
  dayDates?: DayDatesInput;
  now?: Date;
  eventWins?: number;
}): EditionProfileStats {
  const now = opts.now || new Date();
  let slams = 0;
  let averageBonuses = 0;
  for (const row of opts.scores) {
    if (!isDayScorePublished(row.dayNumber, opts.dayDates, now)) continue;
    slams += row.slams || 0;
    if (previewTargetBonus(row.score, opts.fallbackTarget) === true) averageBonuses += 1;
  }
  return { wins: opts.eventWins || 0, slams, averageBonuses };
}

export function computeEventWinsMap(
  teams: Array<{
    id: string;
    savedLineups?: string | null;
    members: RosterPlayer[];
  }>,
  pairings: Array<{ dayNumber: number; team1Id: string; team2Id: string }>,
  scores: PlayerDayScoreRow[],
  dayDates?: DayDatesInput,
  now = new Date(),
  userGradeMap?: Map<string, string>,
  roundFormats?: string[],
): Map<string, number> {
  const winsMap = new Map<string, number>();
  const scoreMapByDay = new Map<number, Record<string, { score: number; slams: number; isWalkover?: boolean }>>();
  for (const row of scores) {
    const map = scoreMapByDay.get(row.dayNumber) || {};
    map[row.userId] = { score: row.score, slams: row.slams, isWalkover: row.isWalkover };
    scoreMapByDay.set(row.dayNumber, map);
  }
  const byId = new Map(teams.map((t) => [t.id, t]));
  for (const pair of pairings) {
    if (!isCombiSubmissionLocked(pair.dayNumber, dayDates, now)) continue;
    const t1 = byId.get(pair.team1Id);
    const t2 = byId.get(pair.team2Id);
    if (!t1 || !t2) continue;
    const combi1 = resolveEffectiveTeamCombi({ team: t1, dayNumber: pair.dayNumber, userGradeMap, roundFormats });
    const combi2 = resolveEffectiveTeamCombi({ team: t2, dayNumber: pair.dayNumber, userGradeMap, roundFormats });
    const result = scoreMatchDay(
      combi1.rounds as LineupRound[] | undefined,
      combi2.rounds as LineupRound[] | undefined,
      t1.members,
      t2.members,
      scoreMapByDay.get(pair.dayNumber) || {},
    );
    for (const event of result.events) {
      if (event.winnerTeam === 1) {
        for (const pid of event.team1PlayerIds) {
          winsMap.set(pid, (winsMap.get(pid) || 0) + 1);
        }
      } else if (event.winnerTeam === 2) {
        for (const pid of event.team2PlayerIds) {
          winsMap.set(pid, (winsMap.get(pid) || 0) + 1);
        }
      }
    }
  }
  return winsMap;
}

export function countEventWinsForPlayer(
  userId: string,
  teams: Array<{
    id: string;
    savedLineups?: string | null;
    members: RosterPlayer[];
  }>,
  pairings: Array<{ dayNumber: number; team1Id: string; team2Id: string }>,
  scores: PlayerDayScoreRow[],
  dayDates?: DayDatesInput,
  now = new Date(),
  userGradeMap?: Map<string, string>,
  roundFormats?: string[],
): number {
  const winsMap = computeEventWinsMap(teams, pairings, scores, dayDates, now, userGradeMap, roundFormats);
  return winsMap.get(userId) || 0;
}

export function daysForStage(stage: Pick<TournamentStage, 'startDay' | 'durationDays'>): number[] {
  const start = stage.startDay || 1;
  const duration = Math.max(1, stage.durationDays || 1);
  const days: number[] = [];
  for (let d = start; d < start + duration; d += 1) days.push(d);
  return days;
}
