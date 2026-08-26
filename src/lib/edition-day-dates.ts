import { prisma } from '@/lib/prisma';
import {
  OFFICIAL_DAY1_CALENDAR,
  addDaysIsoDate,
  buildDayDatesMap,
  calendarDateToUtcDate,
  dayDatesNeedRepair,
  istCalendarDateFromMs,
  normalizeDayDates,
  toCalendarDate,
} from '@/lib/combi-cutoff';

type RepairableEdition = {
  id: string;
  status?: string | null;
  dayDates?: string | null;
  totalDays?: number | null;
  tournamentStartDate?: Date | string | null;
};

const FINISHED_STATUSES = new Set(['COMPLETED', 'FINISHED', 'ARCHIVED', 'CANCELLED']);

/**
 * An edition already under way keeps the 200th edition calendar as its fallback.
 * One that has not started yet gets a near-future placeholder instead, so its days
 * are not born already in the past — the organizer then sets the real start date.
 */
function defaultDay1(edition: RepairableEdition): string {
  const inProgress = String(edition.status || '').toUpperCase() === 'IN_PROGRESS';
  if (inProgress) return OFFICIAL_DAY1_CALENDAR;
  return addDaysIsoDate(istCalendarDateFromMs(Date.now()), 7);
}

export function canRepairDayDates(edition: RepairableEdition | null | undefined): boolean {
  if (!edition?.id) return false;
  return !FINISHED_STATUSES.has(String(edition.status || '').toUpperCase());
}

/**
 * Fills in a missing or incomplete day-date calendar so every screen agrees on Day N.
 * Dates the organizer already chose are kept as-is; Day 1 falls back to the stored
 * start date, then to the 200th edition calendar. Finished editions are never touched.
 */
export async function ensureOfficialDayDates<T extends RepairableEdition>(
  edition: T | null | undefined,
): Promise<T | null | undefined> {
  if (!edition || !canRepairDayDates(edition)) return edition;

  const totalDays = edition.totalDays || 15;
  const stored = normalizeDayDates(edition.dayDates);
  const needsRepair = dayDatesNeedRepair(edition.dayDates, totalDays);
  if (!needsRepair) return edition;

  const day1 =
    stored?.[1] || toCalendarDate(edition.tournamentStartDate ?? null) || defaultDay1(edition);
  const filled = buildDayDatesMap(totalDays, day1);
  for (const [day, date] of Object.entries(stored ?? {})) {
    const num = Number(day);
    if (num >= 1 && num <= totalDays) filled[num] = date;
  }

  const repaired = await prisma.edition.update({
    where: { id: edition.id },
    data: {
      dayDates: JSON.stringify(filled),
      tournamentStartDate: calendarDateToUtcDate(filled[1]),
      tournamentEndDate: calendarDateToUtcDate(filled[totalDays] || filled[1]),
    },
  });

  return Object.assign(edition, repaired) as T;
}
