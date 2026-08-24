import { eventDayWindow, eventDayWindows } from '@/lib/bicentennial-monuments';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const OFFICIAL_DAY1_CALENDAR = '2026-08-10';

/** Official 8pm IST window end for Day N (chained past Days 1–10). */
export function sequentialPlayEndMs(dayNumber: number): number | null {
  const official = eventDayWindow(dayNumber);
  if (official) return new Date(official.endIso).getTime();
  const prior = eventDayWindows()
    .filter((window) => window.dayNumber < dayNumber)
    .sort((a, b) => b.dayNumber - a.dayNumber)[0];
  if (!prior) return null;
  return new Date(prior.endIso).getTime() + (dayNumber - prior.dayNumber) * MS_PER_DAY;
}

function addDaysIsoDate(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().slice(0, 10);
}

/** YYYY-MM-DD in Asia/Kolkata for a timestamp. */
export function istCalendarDateFromMs(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

/**
 * Calendar date used for Day N combi cutoff / display.
 * Prefers the official 8pm–8pm sequence (Day 15 → 24 Aug) over early stored dayDates (e.g. 22 Aug).
 */
export function officialCombiCalendarDate(
  dayNumber: number,
  dayDates?: Record<number, string> | Record<string, string> | null,
): string {
  const sequentialEnd = sequentialPlayEndMs(dayNumber);
  if (sequentialEnd != null) {
    return istCalendarDateFromMs(sequentialEnd);
  }
  const raw =
    dayDates?.[dayNumber as keyof typeof dayDates] ??
    dayDates?.[String(dayNumber) as keyof typeof dayDates];
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }
  return addDaysIsoDate(OFFICIAL_DAY1_CALENDAR, dayNumber - 1);
}

/** 9:30 PM IST cutoff ISO for Day N combi submissions. */
export function combiCutoffIso(
  dayNumber: number,
  dayDates?: Record<number, string> | Record<string, string> | null,
): string {
  return `${officialCombiCalendarDate(dayNumber, dayDates)}T21:30:00+05:30`;
}

export function isCombiSubmissionLocked(
  dayNumber: number,
  dayDates?: Record<number, string> | Record<string, string> | null,
  now = new Date(),
): boolean {
  const cutoff = new Date(combiCutoffIso(dayNumber, dayDates)).getTime();
  if (!Number.isFinite(cutoff)) return false;
  return now.getTime() >= cutoff;
}

/** Build Day 1…N map with official Aug 10 start (Day 15 = Aug 24). */
export function officialDayDatesMap(totalDays = 15): Record<number, string> {
  const out: Record<number, string> = {};
  for (let day = 1; day <= totalDays; day += 1) {
    out[day] = addDaysIsoDate(OFFICIAL_DAY1_CALENDAR, day - 1);
  }
  return out;
}
