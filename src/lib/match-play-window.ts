/**
 * Players may play match days in any order inside a rolling unlock window.
 *
 * At any point they can play 4 days including the current tournament day
 * (today + the next 3). Earlier unlocked days stay open, so the ceiling grows:
 *   Day 1 → days 1–4
 *   Day 2 → days 1–7
 *   Day 3 → days 1–10
 * Formula: maxPlayable = min(totalDays, 1 + 3 * currentDay)
 */

export const MATCH_LOOKAHEAD_DAYS = 3;

export type PlayWindowDay = {
  dayNumber: number;
  status: string;
};

export function currentPlayDayNumber(days: PlayWindowDay[]): number {
  const live = days.find((d) => d.status === 'live' || d.status === 'LIVE');
  if (live?.dayNumber) return live.dayNumber;

  const completed = days
    .filter((d) => d.status === 'completed' || d.status === 'COMPLETED')
    .map((d) => d.dayNumber)
    .filter((n) => n > 0);
  if (completed.length) return Math.max(...completed) + 1;

  const upcoming = days
    .filter((d) => d.dayNumber > 0)
    .map((d) => d.dayNumber);
  if (upcoming.length) return Math.min(...upcoming);
  return 1;
}

export function maxPlayableDayNumber(currentDay: number, totalDays: number) {
  const cap = Math.max(1, totalDays || 1);
  const day = Math.max(1, currentDay || 1);
  return Math.min(cap, 1 + MATCH_LOOKAHEAD_DAYS * day);
}

export function isDayPlayable(dayNumber: number, currentDay: number, totalDays: number) {
  if (dayNumber < 1) return false;
  return dayNumber <= maxPlayableDayNumber(currentDay, totalDays);
}
