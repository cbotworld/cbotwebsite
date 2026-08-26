import { prisma } from '@/lib/prisma';
import {
  buildDayDatesMap,
  calendarDateToUtcDate,
  dayDatesNeedRepair,
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

  // Never invent a start date and write it. A new tournament stays undated
  // until the organizer picks Day 1 — writing "today + 7" was snapping the
  // picker back to that placeholder on every dashboard refresh.
  const day1 = stored?.[1] || toCalendarDate(edition.tournamentStartDate ?? null);
  if (!day1) return edition;
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
