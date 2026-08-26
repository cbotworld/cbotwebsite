import type { PlayerAverageLogRow } from '@/types';
import { todayIstCalendarDate, tomorrowIstCalendarDate } from '@/lib/day-scoring';

export function averageForDay(
  logs: PlayerAverageLogRow[] | undefined,
  calendarDate: string,
  fallback = 0,
): number {
  const applicable = (logs || [])
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.effectiveFrom && row.effectiveFrom <= calendarDate)
    .sort((a, b) => {
      if (a.row.effectiveFrom !== b.row.effectiveFrom) {
        return a.row.effectiveFrom < b.row.effectiveFrom ? 1 : -1;
      }
      return b.index - a.index;
    });
  if (applicable.length) return Number(applicable[0].row.average) || 0;
  return Number(fallback) || 0;
}

export function walkoverRankingScore(averageInEffect: number): number {
  return (Number(averageInEffect) || 0) + 1;
}

export function averageChangeEffectiveFrom(now = new Date()): string {
  return tomorrowIstCalendarDate(now);
}

export function averageAppliesToday(effectiveFrom: string, now = new Date()): boolean {
  return effectiveFrom <= todayIstCalendarDate(now);
}

export function logsForUser(logs: PlayerAverageLogRow[], userId: string): PlayerAverageLogRow[] {
  return logs
    .filter((row) => row.userId === userId)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0));
}
