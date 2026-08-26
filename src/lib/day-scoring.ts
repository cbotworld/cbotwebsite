import {
  addDaysIsoDate,
  combiCalendarDate,
  type DayDatesInput,
  istCalendarDateFromMs,
} from '@/lib/combi-cutoff';
import { stageSpanDays } from '@/lib/tournament-stages';
import type { TournamentStage } from '@/types';

export const SCORE_CUTOFF_HOUR = 20;

export function scoreCutoffIso(dayNumber: number | string, dayDates?: DayDatesInput): string {
  return `${combiCalendarDate(dayNumber, dayDates)}T20:00:00+05:30`;
}

export function scoreWindowStartIso(dayNumber: number | string, dayDates?: DayDatesInput): string {
  return `${combiCalendarDate(dayNumber, dayDates)}T00:00:00+05:30`;
}

export function isDayScorePublished(
  dayNumber: number | string,
  dayDates?: DayDatesInput,
  now = new Date(),
): boolean {
  const cutoff = new Date(scoreCutoffIso(dayNumber, dayDates)).getTime();
  return Number.isFinite(cutoff) && now.getTime() >= cutoff;
}

export function isScoreSubmitOpen(
  dayNumber: number | string,
  dayDates?: DayDatesInput,
  now = new Date(),
): boolean {
  const start = new Date(scoreWindowStartIso(dayNumber, dayDates)).getTime();
  const cutoff = new Date(scoreCutoffIso(dayNumber, dayDates)).getTime();
  const t = now.getTime();
  return Number.isFinite(start) && Number.isFinite(cutoff) && t >= start && t < cutoff;
}

export function tomorrowIstCalendarDate(now = new Date()): string {
  return addDaysIsoDate(istCalendarDateFromMs(now.getTime()), 1);
}

export function todayIstCalendarDate(now = new Date()): string {
  return istCalendarDateFromMs(now.getTime());
}

export function calendarDaysInEdition(
  stages: TournamentStage[] | undefined,
  totalDays?: number | null,
): number {
  const span = stageSpanDays(stages || []);
  if (span > 0) return span;
  return Math.max(1, totalDays || 1);
}

export function hasSubmittedPriorDays(
  submittedDays: number[],
  dayNumber: number,
): boolean {
  const set = new Set(submittedDays);
  for (let d = 1; d < dayNumber; d += 1) {
    if (!set.has(d)) return false;
  }
  return true;
}

export function nextEligibleDay(
  submittedDays: number[],
  maxDay: number,
): number {
  for (let d = 1; d <= maxDay; d += 1) {
    if (!submittedDays.includes(d)) return d;
  }
  return maxDay;
}

export function validateScorePayload(score: unknown, slams: unknown): { ok: true; score: number; slams: number } | { ok: false; error: string } {
  const s = typeof score === 'number' ? score : parseInt(String(score ?? ''), 10);
  const sl = typeof slams === 'number' ? slams : parseInt(String(slams ?? ''), 10);
  if (!Number.isFinite(s) || s < 0 || !Number.isInteger(s)) {
    return { ok: false, error: 'Score must be a whole number of 0 or more.' };
  }
  if (!Number.isFinite(sl) || sl < 0 || !Number.isInteger(sl) || sl > 50) {
    return { ok: false, error: 'Slams must be a whole number between 0 and 50.' };
  }
  return { ok: true, score: s, slams: sl };
}
