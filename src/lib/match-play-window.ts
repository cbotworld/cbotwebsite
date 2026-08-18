import { eventDayWindows, monumentStatus } from '@/lib/bicentennial-monuments';

/**
 * Players may play match days in any order inside a forward unlock window.
 *
 * Past days are closed. From the current tournament day they can play today
 * plus the next 3, and as days complete more future days unlock:
 *   Day 1 → days 1–4 (not 5+)
 *   Day 2 → days 2–7 (day 1 closed)
 *   Day 9 → days 9–10 when the event only has 10 days
 * Formula: currentDay <= day <= min(totalDays, 1 + 3 * currentDay)
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
  if (dayNumber < currentDay) return false;
  return dayNumber <= maxPlayableDayNumber(currentDay, totalDays);
}

/** Current day + playable ceiling from official 8pm IST windows, not organizer date overrides. */
export function tournamentPlayWindow(nowMs = Date.now(), extraTotalDays = 0) {
  const official = eventDayWindows();
  const currentDay = currentPlayDayNumber(
    official.map((window) => ({
      dayNumber: window.dayNumber,
      status: monumentStatus(window, nowMs),
    })),
  );
  const totalDays = Math.max(
    extraTotalDays || 0,
    ...official.map((window) => window.dayNumber),
    currentDay,
    1,
  );
  return {
    currentDay,
    totalDays,
    playableFromDay: currentDay,
    playableUntilDay: maxPlayableDayNumber(currentDay, totalDays),
  };
}
