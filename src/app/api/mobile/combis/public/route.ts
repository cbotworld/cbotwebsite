import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mobileCorsHeaders } from '@/lib/mobile-cors';
import { buildOrganizerScheduleDays, resolveOrganizerPairings } from '@/lib/organizer-schedule';
import { resolveTeamFace } from '@/lib/team-identity';
import { stageConfigKey } from '@/lib/tournament-stages';
import { combiCutoffIso, combiCalendarDate } from '@/lib/combi-cutoff';
import { ensureOfficialDayDates } from '@/lib/edition-day-dates';
import { resolveCurrentEdition } from '@/lib/current-edition';
import { combiRoundLabel } from '@/lib/combi-round-label';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: mobileCorsHeaders });
}

const EVENT_SLOTS = [
  { key: 'singles1', name: 'Singles 1', format: 'SINGLES' },
  { key: 'singles2', name: 'Singles 2', format: 'SINGLES' },
  { key: 'singles3', name: 'Singles 3', format: 'SINGLES' },
  { key: 'singles4', name: 'Singles 4', format: 'SINGLES' },
  { key: 'doubles1', name: 'Doubles 1', format: 'DOUBLES' },
  { key: 'doubles2', name: 'Doubles 2', format: 'DOUBLES' },
  { key: 'doubles3', name: 'Doubles 3', format: 'DOUBLES' },
  { key: 'triples1', name: 'Triples 1', format: 'TRIPLES' },
  { key: 'triples2', name: 'Triples 2', format: 'TRIPLES' },
] as const;

function parseLineups(raw?: string | null) {
  if (!raw) return {} as Record<string, { rounds?: any[] }>;
  try {
    return JSON.parse(raw) as Record<string, { rounds?: any[] }>;
  } catch {
    return {};
  }
}

function parseDayDates(raw?: string | null) {
  if (!raw) return {} as Record<string, string>;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function playersFromRound(round: any) {
  if (!round) return '';
  if (Array.isArray(round.players)) {
    return round.players.map((p: any) => String(p || '').trim()).filter(Boolean).join(', ');
  }
  return '';
}

type EventSlot = { key: string; name: string; format: string };

function slotKey(name: string, index: number) {
  const cleaned = String(name || '').toLowerCase().replace(/\s+/g, '');
  return cleaned || `event${index + 1}`;
}

function roundLabel(formats: string[], index: number) {
  return combiRoundLabel(formats, index);
}

function eventSlotsFromPatterns(patterns?: Array<{ matchFormat?: string | null }>): EventSlot[] {
  const formats = (patterns || []).map((p) => p.matchFormat || 'SINGLES').filter(Boolean);
  if (!formats.length) return EVENT_SLOTS.map((s) => ({ ...s }));
  return formats.map((format, index) => {
    const name = roundLabel(formats, index);
    return { key: slotKey(name, index), name, format };
  });
}

function lineupSlots(
  savedLineups: string | null | undefined,
  dayNumber: number,
  slots: EventSlot[],
): Record<string, string> {
  const parsed = parseLineups(savedLineups);
  const dayData = parsed[String(dayNumber)] || parsed[dayNumber as any];
  const rounds = dayData?.rounds || [];
  const result: Record<string, string> = {};
  rounds.forEach((r: any, idx: number) => {
    const rName = r?.name ? String(r.name).toLowerCase().replace(/\s+/g, '') : '';
    const playersStr = playersFromRound(r);
    if (rName && slots.some((s) => s.key === rName)) {
      result[rName] = playersStr;
    } else if (slots[idx] && !result[slots[idx].key]) {
      result[slots[idx].key] = playersStr;
    }
  });
  return result;
}

function teamPayload(
  team: any | undefined,
  fallbackName: string,
  fallbackTag: string,
  catalog?: Array<{ id: string; name?: string | null; tag?: string | null; logo?: string | null }>,
) {
  const face = resolveTeamFace({
    id: team?.id,
    name: team?.name || fallbackName,
    tag: team?.tag || fallbackTag,
    logo: team?.logo,
    teams: catalog,
  });
  return {
    id: team?.id || face.name,
    name: face.name,
    tag: face.tag,
    logo: face.logo,
    captainName: team?.captain?.name || team?.captain?.username || null,
    savedLineups: team?.savedLineups || null,
  };
}

export async function GET() {
  try {
    const editionRef = await resolveCurrentEdition();
    const rawEdition = editionRef
      ? await prisma.edition.findUnique({
          where: { id: editionRef.id },
          include: {
            patterns: { orderBy: { sequence: 'asc' } },
          },
        })
      : null;
    const edition = await ensureOfficialDayDates(rawEdition);

    const teams = edition?.id
      ? await prisma.team.findMany({
          where: { editionId: edition.id },
          select: {
            id: true,
            name: true,
            tag: true,
            logo: true,
            savedLineups: true,
            captain: { select: { name: true, username: true } },
          },
        })
      : [];

    const teamsById = new Map(teams.map((t) => [t.id, t]));
    const teamsByName = new Map(teams.map((t) => [t.name.toUpperCase().trim(), t]));

    let stages: any[] = [];
    if (edition?.id) {
      const setting = await prisma.systemSetting.findUnique({ where: { key: stageConfigKey(edition.id) } });
      if (setting?.value) {
        try {
          stages = JSON.parse(setting.value)?.stages || [];
        } catch {}
      }
    }

    const pairings = resolveOrganizerPairings(stages, teams);
    const dayDates = parseDayDates(edition?.dayDates);
    const now = Date.now();
    const slots = eventSlotsFromPatterns(edition?.patterns);
    const scheduleDays = buildOrganizerScheduleDays({
      totalDays: edition?.totalDays,
      dayDates,
      teams,
      pairings,
      stages,
    });

    const days = scheduleDays.map((day) => {
      const calendarDate = day.calendarDate || combiCalendarDate(day.dayNumber, dayDates);
      const cutoffIso = combiCutoffIso(day.dayNumber, dayDates);
      const revealed = now >= new Date(cutoffIso).getTime();

      const matches = (day.matches || []).map((m) => {
        const t1 =
          (m.team1Id && teamsById.get(m.team1Id)) ||
          teamsByName.get(String(m.team1 || '').toUpperCase().trim());
        const t2 =
          (m.team2Id && teamsById.get(m.team2Id)) ||
          teamsByName.get(String(m.team2 || '').toUpperCase().trim());
        const left = teamPayload(t1, m.team1, m.team1Tag || 'T1', teams);
        const right = teamPayload(t2, m.team2, m.team2Tag || 'T2', teams);
        const leftSlots = revealed ? lineupSlots(left.savedLineups, day.dayNumber, slots) : {};
        const rightSlots = revealed ? lineupSlots(right.savedLineups, day.dayNumber, slots) : {};

        return {
          team1: {
            id: left.id,
            name: left.name,
            tag: left.tag,
            logo: left.logo,
            captainName: left.captainName,
          },
          team2: {
            id: right.id,
            name: right.name,
            tag: right.tag,
            logo: right.logo,
            captainName: right.captainName,
          },
          events: slots.map((slot, index) => ({
            index,
            name: slot.name,
            format: slot.format,
            leftPlayers: revealed ? leftSlots[slot.key] || 'NA' : 'Locked until 9:30 PM IST',
            rightPlayers: revealed ? rightSlots[slot.key] || 'NA' : 'Locked until 9:30 PM IST',
          })),
        };
      });

      return {
        dayNumber: day.dayNumber,
        calendarDate,
        cutoffIso,
        revealed,
        title: day.title,
        matches,
      };
    });

    return NextResponse.json(
      { success: true, days },
      { headers: { ...mobileCorsHeaders, 'Cache-Control': 'no-store' } },
    );
  } catch (error: any) {
    console.error('Mobile public combis GET:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error.' },
      { status: 500, headers: mobileCorsHeaders },
    );
  }
}
