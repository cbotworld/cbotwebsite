import type {
  EditionProfileStats,
  PlayerAverageLogRow,
  PlayerDayScoreRow,
  PlayerRankingRow,
  TournamentStage,
} from '@/types';
import { isDayScorePublished } from '@/lib/day-scoring';
import { averageForDay, walkoverRankingScore } from '@/lib/player-average';
import { combiCalendarDate, isCombiSubmissionLocked, type DayDatesInput } from '@/lib/combi-cutoff';
import { parseSavedLineups, scoreMatchDay, type LineupRound, type RosterPlayer } from '@/lib/combi-results';

export type RankedPlayer = {
  userId: string;
  name: string;
  teamId: string;
  teamName: string;
  average?: number | null;
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
  const logsByUser = new Map<string, PlayerAverageLogRow[]>();
  for (const log of opts.logs) {
    const list = logsByUser.get(log.userId) || [];
    list.push(log);
    logsByUser.set(log.userId, list);
  }

  const rows: PlayerRankingRow[] = opts.players.map((player) => {
    let totalScore = 0;
    let walkovers = 0;
    for (const day of days) {
      const submitted = byKey.get(scoreKey(player.userId, day));
      if (submitted) {
        totalScore += submitted.score;
      } else {
        const ymd = combiCalendarDate(day, opts.dayDates);
        const avg = averageForDay(logsByUser.get(player.userId), ymd, player.average || 0);
        totalScore += walkoverRankingScore(avg);
        walkovers += 1;
      }
    }
    return {
      userId: player.userId,
      name: player.name,
      teamId: player.teamId,
      teamName: player.teamName,
      daysCounted: days.length,
      walkovers,
      totalScore,
      rank: 0,
    };
  });

  rows.sort((a, b) => {
    if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore;
    if (a.walkovers !== b.walkovers) return a.walkovers - b.walkovers;
    return a.name.localeCompare(b.name);
  });
  let lastTotal = Number.NaN;
  let lastWalk = Number.NaN;
  let lastRank = 0;
  rows.forEach((row, i) => {
    if (row.totalScore === lastTotal && row.walkovers === lastWalk) {
      row.rank = lastRank;
    } else {
      lastRank = i + 1;
      lastTotal = row.totalScore;
      lastWalk = row.walkovers;
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
    const ymd = combiCalendarDate(row.dayNumber, opts.dayDates);
    const avg = averageForDay(opts.logs, ymd, opts.fallbackAverage || 0);
    if (row.score < avg) averageBonuses += 1;
  }
  return { wins: opts.eventWins || 0, slams, averageBonuses };
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
): number {
  const scoreMapByDay = new Map<number, Record<string, { score: number; slams: number }>>();
  for (const row of scores) {
    const map = scoreMapByDay.get(row.dayNumber) || {};
    map[row.userId] = { score: row.score, slams: row.slams };
    scoreMapByDay.set(row.dayNumber, map);
  }
  const byId = new Map(teams.map((t) => [t.id, t]));
  let wins = 0;
  for (const pair of pairings) {
    if (!isCombiSubmissionLocked(pair.dayNumber, dayDates, now)) continue;
    const t1 = byId.get(pair.team1Id);
    const t2 = byId.get(pair.team2Id);
    if (!t1 || !t2) continue;
    const lineups1 = parseSavedLineups(t1.savedLineups);
    const lineups2 = parseSavedLineups(t2.savedLineups);
    const result = scoreMatchDay(
      lineups1[String(pair.dayNumber)]?.rounds as LineupRound[] | undefined,
      lineups2[String(pair.dayNumber)]?.rounds as LineupRound[] | undefined,
      t1.members,
      t2.members,
      scoreMapByDay.get(pair.dayNumber) || {},
    );
    for (const event of result.events) {
      if (event.winnerTeam === 1 && event.team1PlayerIds.includes(userId)) wins += 1;
      if (event.winnerTeam === 2 && event.team2PlayerIds.includes(userId)) wins += 1;
    }
  }
  return wins;
}

export function daysForStage(stage: Pick<TournamentStage, 'startDay' | 'durationDays'>): number[] {
  const start = stage.startDay || 1;
  const duration = Math.max(1, stage.durationDays || 1);
  const days: number[] = [];
  for (let d = start; d < start + duration; d += 1) days.push(d);
  return days;
}
