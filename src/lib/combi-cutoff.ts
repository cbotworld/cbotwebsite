/** Fallback calendar: the 200th edition ran Day 1 = 10 Aug 2026 … Day 15 = 24 Aug 2026. */
export const OFFICIAL_DAY1_CALENDAR = '2026-08-10';
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function addDaysIsoDate(dateStr: string, days: number) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().slice(0, 10);
}

/** YYYY-MM-DD in Asia/Kolkata, without Intl (unreliable on some Windows runtimes). */
export function istCalendarDateFromMs(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * YYYY-MM-DD for a date-only string, Date, or timestamp.
 * Date-only strings are taken as written; instants are read in IST, so both
 * UTC-midnight and IST-midnight storage resolve to the same calendar day.
 */
export function toCalendarDate(value: string | Date | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string' && DATE_ONLY.test(value.slice(0, 10)) && value.length <= 10) {
    return value.slice(0, 10);
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return istCalendarDateFromMs(parsed.getTime());
}

/** Midnight UTC, so a date-only read of a DateTime column can never slide back a day. */
export function calendarDateToUtcDate(dateStr: string): Date | null {
  const ymd = toCalendarDate(dateStr);
  return ymd ? new Date(`${ymd}T00:00:00.000Z`) : null;
}

export function coerceDayNumber(dayNumber: number | string): number {
  const day = typeof dayNumber === 'number' ? dayNumber : parseInt(String(dayNumber), 10);
  return Number.isFinite(day) ? day : 0;
}

export type DayDatesInput =
  | string
  | Record<number, string>
  | Record<string, string>
  | null
  | undefined;

/** Parses stored dayDates into a clean {dayNumber: YYYY-MM-DD} map, or null when unusable. */
export function normalizeDayDates(raw: DayDatesInput): Record<number, string> | null {
  if (!raw) return null;
  let source: Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      source = JSON.parse(raw);
    } catch {
      return null;
    }
  } else {
    source = raw as Record<string, unknown>;
  }
  if (!source || typeof source !== 'object') return null;

  const out: Record<number, string> = {};
  for (const [key, value] of Object.entries(source)) {
    const day = coerceDayNumber(key);
    const date = toCalendarDate(value as string);
    if (day >= 1 && date) out[day] = date;
  }
  return out[1] ? out : null;
}

/**
 * Calendar date for Day N: the organizer's stored dates win, missing days are
 * extrapolated from Day 1, and the 200th edition calendar is the last resort.
 */
export function combiCalendarDate(dayNumber: number | string, dayDates?: DayDatesInput): string {
  const day = coerceDayNumber(dayNumber);
  const map = normalizeDayDates(dayDates);
  const day1 = map?.[1] ?? OFFICIAL_DAY1_CALENDAR;
  if (day < 1) return day1;
  return map?.[day] ?? addDaysIsoDate(day1, day - 1);
}

/** 9:30 PM IST cutoff ISO for Day N combi submissions. */
export function combiCutoffIso(dayNumber: number | string, dayDates?: DayDatesInput): string {
  return `${combiCalendarDate(dayNumber, dayDates)}T21:30:00+05:30`;
}

export function isCombiSubmissionLocked(
  dayNumber: number | string,
  dayDates?: DayDatesInput,
  now = new Date(),
): boolean {
  const cutoff = new Date(combiCutoffIso(dayNumber, dayDates)).getTime();
  if (!Number.isFinite(cutoff)) return false;
  return now.getTime() >= cutoff;
}

/** Consecutive Day 1…N map starting at `day1` (defaults to the 200th edition calendar). */
export function buildDayDatesMap(totalDays = 15, day1: string = OFFICIAL_DAY1_CALENDAR): Record<number, string> {
  const start = toCalendarDate(day1) || OFFICIAL_DAY1_CALENDAR;
  const out: Record<number, string> = {};
  const n = Math.max(1, totalDays || 15);
  for (let day = 1; day <= n; day += 1) {
    out[day] = addDaysIsoDate(start, day - 1);
  }
  return out;
}

/** Back-compat alias for the 200th edition calendar. */
export function officialDayDatesMap(totalDays = 15): Record<number, string> {
  return buildDayDatesMap(totalDays, OFFICIAL_DAY1_CALENDAR);
}

/**
 * True only when stored dates are absent or unusable. Dates the organizer chose
 * are never "wrong" just because they differ from the 200th edition calendar.
 */
export function dayDatesNeedRepair(raw: DayDatesInput, totalDays = 15): boolean {
  const map = normalizeDayDates(raw);
  if (!map) return true;
  const n = Math.max(1, totalDays || 15);
  for (let day = 1; day <= n; day += 1) {
    if (!map[day]) return true;
  }
  return false;
}

/**
 * India-style label for a calendar date, with no UTC day-shift.
 * Date-only strings are used as written; timestamps are read in IST.
 */
export function formatIsoDateLabel(
  isoDate: string | Date,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const ymd = toCalendarDate(isoDate);
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    ...opts,
  });
}

export function currentCombiDayNumber(
  totalDays = 15,
  now = new Date(),
  dayDates?: DayDatesInput,
): number {
  const today = istCalendarDateFromMs(now.getTime());
  const n = Math.max(1, totalDays || 15);
  for (let day = 1; day <= n; day += 1) {
    if (combiCalendarDate(day, dayDates) === today) return day;
  }
  if (today < combiCalendarDate(1, dayDates)) return 1;
  return n;
}
