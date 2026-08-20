import { officialMatchDays, monumentStatus } from '@/lib/bicentennial-monuments';
import { stageSpanDays } from '@/lib/tournament-stages';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export interface OrganizerScheduleStage {
  order?: number;
  kind?: string;
  name?: string;
  startDay?: number;
  durationDays?: number;
}

export interface OrganizerScheduleMatch {
  team1: string;
  team2: string;
  isSpocExhibition?: boolean;
  team1Logo?: string;
  team2Logo?: string;
  team1Tag?: string;
  team2Tag?: string;
  matchLabel?: string;
}

export interface OrganizerScheduleDay {
  dayNumber: number;
  title: string;
  timeRange: string;
  startIso: string;
  endIso: string;
  calendarDate: string;
  stageName: string;
  stageKind: string;
  stageOrder: number;
  stageLabel: string;
  isSpocDay?: boolean;
  matches: OrganizerScheduleMatch[];
}

function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}TH`;
  if (v % 10 === 1) return `${n}ST`;
  if (v % 10 === 2) return `${n}ND`;
  if (v % 10 === 3) return `${n}RD`;
  return `${n}TH`;
}

export function addDaysIsoDate(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().slice(0, 10);
}

export function calendarDateForDay(
  dayNumber: number,
  dayDates?: Record<number, string> | Record<string, string>
) {
  const dates = (dayDates || {}) as Record<string | number, string>;
  const raw = dates[dayNumber] ?? dates[String(dayNumber)];
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return addDaysIsoDate('2026-08-10', dayNumber - 1);
}

export function formatDayRange(startIso: string, endIso: string) {
  const fmt = (iso: string) => {
    const [datePart, timePart] = iso.split('T');
    const [, m, d] = datePart.split('-').map(Number);
    const hour = timePart ? parseInt(timePart.slice(0, 2), 10) : 20;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${ordinal(d)} ${MONTHS[(m || 1) - 1]} ${h12} ${ampm}`;
  };
  return `${fmt(startIso)} TO ${fmt(endIso)}`;
}

export function stageForDay(dayNumber: number, stages?: OrganizerScheduleStage[]) {
  return (stages || []).find((s) => {
    const start = s.startDay || 0;
    const end = start + (s.durationDays || 1) - 1;
    return dayNumber >= start && dayNumber <= end;
  });
}

function kindShort(kind?: string, name?: string) {
  if (kind === 'ROUND_ROBIN') return 'RR';
  if (kind === 'LEAGUE') return name || 'League';
  if (kind === 'QUALIFIER') return 'Qualifiers';
  if (kind === 'FINALS') return 'Finals';
  if (kind === 'SPOC_EXHIBITION') return 'Spoc Exhibition';
  return name || kind || 'Stage';
}

export function stageChipLabel(stage: OrganizerScheduleStage | undefined, dayNumber: number) {
  if (!stage) return `Day ${dayNumber}`;
  return `Stage ${stage.order || 1}`;
}

export function liveStageSummary(
  days: OrganizerScheduleDay[],
  stages?: OrganizerScheduleStage[],
  nowMs = Date.now()
) {
  const live = days.find((d) => monumentStatus(d, nowMs) === 'live');
  const focus = live || days.find((d) => monumentStatus(d, nowMs) === 'upcoming') || days[days.length - 1];
  if (!focus) return 'Official match fixtures';
  const stage = stageForDay(focus.dayNumber, stages) || {
    order: focus.stageOrder,
    kind: focus.stageKind,
    name: focus.stageName,
    startDay: focus.dayNumber,
    durationDays: 1,
  };
  const start = stage.startDay || focus.dayNumber;
  const end = start + (stage.durationDays || 1) - 1;
  const prefix = live ? 'Live' : monumentStatus(focus, nowMs) === 'completed' ? 'Completed' : 'Upcoming';
  return `${prefix} · Stage ${stage.order || 1} · ${kindShort(stage.kind, stage.name)} · Days ${start}–${end}`;
}

export function pathSummary(stages?: OrganizerScheduleStage[]) {
  const names = (stages || [])
    .map((s) => s.name || kindShort(s.kind, s.name))
    .filter(Boolean);
  return names.length ? names.join(' → ') : 'Round Robin → League → Qualifiers → Finals';
}

export function liveFixtureTitle(
  days: OrganizerScheduleDay[],
  stages?: OrganizerScheduleStage[],
  nowMs = Date.now()
) {
  const live = days.find((d) => monumentStatus(d, nowMs) === 'live');
  const focus = live || days.find((d) => monumentStatus(d, nowMs) === 'upcoming') || days[days.length - 1];
  if (!focus) return 'MATCH SCHEDULE';
  const stage = stageForDay(focus.dayNumber, stages);
  const kind = stage?.kind || focus.stageKind;
  if (kind === 'ROUND_ROBIN' || (!kind && focus.dayNumber <= 7)) {
    return 'BICENTENNIAL MONUMENTS FIXTURE';
  }
  if (kind === 'LEAGUE' || (!kind && focus.dayNumber >= 8 && focus.dayNumber <= 10)) {
    return 'ROYAL CARROMS FIXTURE';
  }
  const name = (stage?.name || focus.stageName || focus.title).toUpperCase();
  return name.includes('FIXTURE') ? name : `${name} FIXTURE`;
}

export function formatCalendarDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${ordinal(d)} ${MONTHS[(m || 1) - 1]} ${y}`;
}

export function buildOrganizerScheduleDays(opts?: {
  totalDays?: number;
  dayDates?: Record<number, string> | Record<string, string>;
  pairings?: Array<{
    dayNumber?: number;
    team1Name?: string;
    team2Name?: string;
    team1Logo?: string;
    team2Logo?: string;
    team1Tag?: string;
    team2Tag?: string;
    isSpocExhibition?: boolean;
    matchLabel?: string;
    stageKind?: string;
    stageName?: string;
  }>;
  stages?: OrganizerScheduleStage[];
}): OrganizerScheduleDay[] {
  const dates = opts?.dayDates;
  const stages = opts?.stages || [];
  const byDay = new Map<number, OrganizerScheduleDay>();

  const pushDay = (
    dayNumber: number,
    title: string,
    startIso: string,
    endIso: string,
    timeRange: string,
    matches: OrganizerScheduleMatch[]
  ) => {
    const stage = stageForDay(dayNumber, stages);
    const allSpoc = matches.length > 0 && matches.every((m) => m.isSpocExhibition);
    const calendarDate = calendarDateForDay(dayNumber, dates);
    byDay.set(dayNumber, {
      dayNumber,
      title: allSpoc ? `SPOC EXHIBITION · DAY ${dayNumber}` : title,
      timeRange,
      startIso,
      endIso,
      calendarDate,
      stageName: allSpoc ? 'Spoc Exhibition' : stage?.name || kindShort(stage?.kind),
      stageKind: allSpoc ? 'SPOC_EXHIBITION' : stage?.kind || '',
      stageOrder: stage?.order || 1,
      stageLabel: allSpoc ? 'Spoc Exhibition' : stageChipLabel(stage, dayNumber),
      isSpocDay: allSpoc,
      matches: matches.map((m) => ({
        team1: m.team1.toUpperCase().trim(),
        team2: m.team2.toUpperCase().trim(),
        isSpocExhibition: m.isSpocExhibition,
        team1Logo: m.team1Logo,
        team2Logo: m.team2Logo,
        team1Tag: m.team1Tag,
        team2Tag: m.team2Tag,
        matchLabel: m.matchLabel,
      })),
    });
  };

  officialMatchDays().forEach((d) => {
    pushDay(d.dayNumber, d.title, d.startIso, d.endIso, d.timeRange, d.matches.map((m) => ({ ...m, isSpocExhibition: false })));
  });

  const pairingsByDay = new Map<number, OrganizerScheduleMatch[]>();
  (opts?.pairings || []).forEach((p) => {
    const dayNumber = p.dayNumber;
    if (!dayNumber || !p.team1Name || !p.team2Name) return;
    const list = pairingsByDay.get(dayNumber) || [];
    list.push({
      team1: p.team1Name.toUpperCase().trim(),
      team2: p.team2Name.toUpperCase().trim(),
      isSpocExhibition: p.isSpocExhibition,
      team1Logo: p.team1Logo,
      team2Logo: p.team2Logo,
      team1Tag: p.team1Tag,
      team2Tag: p.team2Tag,
      matchLabel: p.matchLabel,
    });
    pairingsByDay.set(dayNumber, list);
  });

  pairingsByDay.forEach((matches, dayNumber) => {
    const existing = byDay.get(dayNumber);
    if (existing) {
      const spocMatches = matches.filter((m) => m.isSpocExhibition);
      const mainMatches = existing.matches.filter((m) => !m.isSpocExhibition);
      existing.matches = [...mainMatches, ...spocMatches];
      if (spocMatches.length && mainMatches.length === 0) {
        existing.isSpocDay = true;
        existing.stageKind = 'SPOC_EXHIBITION';
        existing.stageName = 'Spoc Exhibition';
        existing.stageLabel = 'Spoc Exhibition';
        existing.title = `SPOC EXHIBITION · DAY ${dayNumber}`;
      } else if (spocMatches.length && mainMatches.length) {
        existing.title = `${existing.title} + SPOC EXHIBITION`;
      }
      return;
    }
    const calendarDate = calendarDateForDay(dayNumber, dates);
    const startIso = `${addDaysIsoDate(calendarDate, -1)}T20:00:00+05:30`;
    const endIso = `${calendarDate}T20:00:00+05:30`;
    const allSpoc = matches.every((m) => m.isSpocExhibition);
    const stage = allSpoc
      ? { order: 99, kind: 'SPOC_EXHIBITION', name: 'Spoc Exhibition', startDay: dayNumber, durationDays: 1 }
      : stageForDay(dayNumber, stages);
    pushDay(
      dayNumber,
      allSpoc
        ? `SPOC EXHIBITION · DAY ${dayNumber}`
        : stage?.name
          ? `${stage.name.toUpperCase()} · DAY ${dayNumber}`
          : `DAY ${dayNumber}`,
      startIso,
      endIso,
      formatDayRange(startIso, endIso),
      matches
    );
  });

  const officialMax = officialMatchDays().reduce((max, d) => Math.max(max, d.dayNumber), 7);
  const stageMax = stages.length ? stageSpanDays(stages as any) : 0;
  const totalDays = Math.max(officialMax, opts?.totalDays || 0, stageMax, 7);

  const days: OrganizerScheduleDay[] = [];
  for (let n = 1; n <= totalDays; n += 1) {
    if (byDay.has(n)) {
      days.push(byDay.get(n)!);
      continue;
    }
    const calendarDate = calendarDateForDay(n, dates);
    const startIso = `${addDaysIsoDate(calendarDate, -1)}T20:00:00+05:30`;
    const endIso = `${calendarDate}T20:00:00+05:30`;
    const stage = stageForDay(n, stages);
    pushDay(
      n,
      stage?.name ? `${stage.name.toUpperCase()} · DAY ${n}` : `DAY ${n}`,
      startIso,
      endIso,
      formatDayRange(startIso, endIso),
      []
    );
    days.push(byDay.get(n)!);
  }
  return days;
}
