import { officialMatchDays, monumentStatus } from '@/lib/bicentennial-monuments';
import { coherentMatchSides, resolveTeamFace, type TeamCatalogEntry } from '@/lib/team-identity';
import { stageSpanDays } from '@/lib/tournament-stages';
import { combiCalendarDate } from '@/lib/combi-cutoff';

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
  team1Id?: string;
  team2Id?: string;
  team1Logo?: string;
  team2Logo?: string;
  team1Tag?: string;
  team2Tag?: string;
  matchLabel?: string;
}

function sanitizeSides(
  match: {
    team1?: string;
    team2?: string;
    team1Tag?: string | null;
    team2Tag?: string | null;
    team1Logo?: string | null;
    team2Logo?: string | null;
    team1Id?: string | null;
    team2Id?: string | null;
    isSpocExhibition?: boolean;
    matchLabel?: string;
  },
  teams?: TeamCatalogEntry[],
): OrganizerScheduleMatch {
  const sides = coherentMatchSides(match, teams);
  return {
    team1: sides.team1.name,
    team2: sides.team2.name,
    isSpocExhibition: match.isSpocExhibition,
    team1Id: match.team1Id || undefined,
    team2Id: match.team2Id || undefined,
    team1Logo: sides.team1.logo,
    team2Logo: sides.team2.logo,
    team1Tag: sides.team1.tag,
    team2Tag: sides.team2.tag,
    matchLabel: match.matchLabel,
  };
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
  return combiCalendarDate(dayNumber, dayDates);
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

export function stageDayWindow(stage?: { startDay?: number; durationDays?: number }) {
  const start = Number(stage?.startDay) || 0;
  const end = start + (Number(stage?.durationDays) || 1) - 1;
  return { start, end };
}

/** Team IDs win over stale saved names so the schedule never shows the wrong opponent. */
export function resolveOrganizerPairings(
  stages: Array<{
    kind?: string;
    name?: string;
    startDay?: number;
    durationDays?: number;
    matchPairings?: Array<{
      dayNumber?: number;
      team1Id?: string;
      team2Id?: string;
      team1Name?: string;
      team2Name?: string;
      label?: string;
    }>;
  }> | undefined,
  teams: Array<{ id: string; name?: string | null; tag?: string | null; logo?: string | null }>,
) {
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const resolved: Array<{
    dayNumber: number;
    team1Name: string;
    team2Name: string;
    team1Id?: string;
    team2Id?: string;
    team1Logo?: string;
    team2Logo?: string;
    team1Tag?: string;
    team2Tag?: string;
    isSpocExhibition?: boolean;
    matchLabel?: string;
    stageName?: string;
  }> = [];

  const allStages = stages || [];
  for (const stage of allStages) {
    const { start, end } = stageDayWindow(stage);
    const isSpoc = stage.kind === 'SPOC_EXHIBITION';
    for (const p of stage.matchPairings || []) {
      const dayNumber = Number(p.dayNumber) || 0;
      if (dayNumber < 1) continue;
      if (!isSpoc) {
        const owner = stageForDay(dayNumber, allStages);
        if (owner) {
          const sameStage =
            (owner.startDay || 0) === (stage.startDay || 0) && (owner.kind || '') === (stage.kind || '');
          if (!sameStage) continue;
        } else if (start > 0 && (dayNumber < start || dayNumber > end)) {
          continue;
        }
      }

      const t1 = p.team1Id ? teamsById.get(p.team1Id) : undefined;
      const t2 = p.team2Id ? teamsById.get(p.team2Id) : undefined;
      const face1 = resolveTeamFace({
        id: p.team1Id,
        name: t1?.name || p.team1Name,
        tag: t1?.tag,
        logo: t1?.logo,
        teams,
      });
      const face2 = resolveTeamFace({
        id: p.team2Id,
        name: t2?.name || p.team2Name,
        tag: t2?.tag,
        logo: t2?.logo,
        teams,
      });
      if (!face1.name || !face2.name) continue;
      if (face1.name === face2.name) continue;

      resolved.push({
        dayNumber,
        team1Name: face1.name,
        team2Name: face2.name,
        team1Id: p.team1Id,
        team2Id: p.team2Id,
        team1Logo: face1.logo,
        team2Logo: face2.logo,
        team1Tag: face1.tag,
        team2Tag: face2.tag,
        isSpocExhibition: isSpoc,
        matchLabel: p.label || (isSpoc ? 'Spoc Exhibition Match' : undefined),
        stageName: stage.name,
      });
    }
  }

  const seen = new Set<string>();
  return resolved.filter((p) => {
    const a = p.team1Name.toUpperCase();
    const b = p.team2Name.toUpperCase();
    const key = `${p.dayNumber}:${[a, b].sort().join('|')}:${p.isSpocExhibition ? 's' : 'm'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
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
  const configured = (stage?.name || focus.stageName || '').trim();
  if (configured) {
    const upper = configured.toUpperCase();
    return upper.includes('FIXTURE') ? upper : `${upper} FIXTURE`;
  }
  if (kind === 'ROUND_ROBIN' || (!kind && focus.dayNumber <= 7)) {
    return 'ROUND ROBIN FIXTURE';
  }
  if (kind === 'LEAGUE' || (!kind && focus.dayNumber >= 8 && focus.dayNumber <= 10)) {
    return 'LEAGUE FIXTURE';
  }
  const name = focus.title.toUpperCase();
  return name.includes('FIXTURE') ? name : `${name} FIXTURE`;
}

export function formatCalendarDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${ordinal(d)} ${MONTHS[(m || 1) - 1]} ${y}`;
}

export function buildOrganizerScheduleDays(opts?: {
  totalDays?: number;
  dayDates?: Record<number, string> | Record<string, string>;
  teams?: TeamCatalogEntry[];
  pairings?: Array<{
    dayNumber?: number;
    team1Name?: string;
    team2Name?: string;
    team1Id?: string;
    team2Id?: string;
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
  const teams = opts?.teams;
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

    // The seeded fixtures carry the original edition's dates. Once this edition's
    // own calendar moves a day, recompute its 8pm-8pm window from that date so a
    // relocated tournament is not judged against the old schedule.
    const seededEndDate = endIso.slice(0, 10);
    const moved = Boolean(calendarDate) && calendarDate !== seededEndDate;
    const playStartIso = moved ? `${addDaysIsoDate(calendarDate, -1)}T20:00:00+05:30` : startIso;
    const playEndIso = moved ? `${calendarDate}T20:00:00+05:30` : endIso;

    // A stage name configured by the organizer always outranks the seeded title.
    const stageTitle = stage?.name ? `${stage.name.toUpperCase()} · DAY ${dayNumber}` : title;

    byDay.set(dayNumber, {
      dayNumber,
      title: allSpoc ? `SPOC EXHIBITION · DAY ${dayNumber}` : stageTitle,
      timeRange: moved ? formatDayRange(playStartIso, playEndIso) : timeRange,
      startIso: playStartIso,
      endIso: playEndIso,
      calendarDate,
      stageName: allSpoc ? 'Spoc Exhibition' : stage?.name || kindShort(stage?.kind),
      stageKind: allSpoc ? 'SPOC_EXHIBITION' : stage?.kind || '',
      stageOrder: stage?.order || 1,
      stageLabel: allSpoc ? 'Spoc Exhibition' : stageChipLabel(stage, dayNumber),
      isSpocDay: allSpoc,
      matches: matches.map((m) => sanitizeSides(m, teams)),
    });
  };

  // Seeded legacy fixtures are only a fallback when this edition has no
  // stage path of its own. Otherwise Day 8–10 would keep showing Royal Carroms
  // pairings after the organizer designed a 7-day round robin.
  if (!stages.length) {
    officialMatchDays().forEach((d) => {
      pushDay(d.dayNumber, d.title, d.startIso, d.endIso, d.timeRange, d.matches.map((m) => ({ ...m, isSpocExhibition: false })));
    });
  }

  const pairingsByDay = new Map<number, OrganizerScheduleMatch[]>();
  (opts?.pairings || []).forEach((p) => {
    const dayNumber = p.dayNumber;
    if (!dayNumber || !p.team1Name || !p.team2Name) return;
    const list = pairingsByDay.get(dayNumber) || [];
    list.push(
      sanitizeSides(
        {
          team1: p.team1Name,
          team2: p.team2Name,
          team1Id: p.team1Id,
          team2Id: p.team2Id,
          isSpocExhibition: p.isSpocExhibition,
          team1Logo: p.team1Logo,
          team2Logo: p.team2Logo,
          team1Tag: p.team1Tag,
          team2Tag: p.team2Tag,
          matchLabel: p.matchLabel,
        },
        teams,
      ),
    );
    pairingsByDay.set(dayNumber, list);
  });

  pairingsByDay.forEach((matches, dayNumber) => {
    const existing = byDay.get(dayNumber);
    if (existing) {
      const organizerMain = matches.filter((m) => !m.isSpocExhibition);
      const organizerSpoc = matches.filter((m) => m.isSpocExhibition);
      const officialMain = existing.matches.filter((m) => !m.isSpocExhibition);
      const officialSpoc = existing.matches.filter((m) => m.isSpocExhibition);
      const mainMatches = organizerMain.length ? organizerMain : officialMain;
      const spocMatches = organizerSpoc.length ? organizerSpoc : officialSpoc;
      existing.matches = [...mainMatches, ...spocMatches].map((m) => sanitizeSides(m, teams));
      const stage = stageForDay(dayNumber, stages);
      if (organizerMain.length && stage?.name) {
        existing.stageName = stage.name;
        existing.stageKind = stage.kind || existing.stageKind;
        existing.stageOrder = stage.order || existing.stageOrder;
        existing.stageLabel = stageChipLabel(stage, dayNumber);
        existing.title = `${stage.name.toUpperCase()} · DAY ${dayNumber}`;
        existing.isSpocDay = false;
      }
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

  const officialMax = stages.length
    ? 0
    : officialMatchDays().reduce((max, d) => Math.max(max, d.dayNumber), 7);
  const stageMax = stages.length ? stageSpanDays(stages as any) : 0;
  const totalDays = stages.length
    ? Math.max(stageMax, 1)
    : Math.max(officialMax, opts?.totalDays || 0, 7);

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
