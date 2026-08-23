import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mobileCorsHeaders } from '@/lib/mobile-cors';
import { officialMatchDays } from '@/lib/bicentennial-monuments';
import { stageConfigKey } from '@/lib/tournament-stages';

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

function addDaysIsoDate(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().slice(0, 10);
}

function calendarDateForDay(dayNumber: number, dayDates: Record<string, string>) {
  const raw = dayDates[String(dayNumber)] || dayDates[dayNumber as any];
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return addDaysIsoDate('2026-08-10', dayNumber - 1);
}

function playersFromRound(round: any) {
  if (!round) return '';
  if (Array.isArray(round.players)) {
    return round.players.map((p: any) => String(p || '').trim()).filter(Boolean).join(', ');
  }
  return '';
}

function lineupSlots(savedLineups: string | null | undefined, dayNumber: number): Record<string, string> {
  const dayData = parseLineups(savedLineups)[String(dayNumber)] || parseLineups(savedLineups)[dayNumber as any];
  const rounds = dayData?.rounds || [];
  const result: Record<string, string> = {};
  rounds.forEach((r: any, idx: number) => {
    const rName = r?.name ? String(r.name).toLowerCase().replace(/\s+/g, '') : '';
    const playersStr = playersFromRound(r);
    if (rName && EVENT_SLOTS.some((s) => s.key === rName)) {
      result[rName] = playersStr;
    } else if (EVENT_SLOTS[idx] && !result[EVENT_SLOTS[idx].key]) {
      result[EVENT_SLOTS[idx].key] = playersStr;
    }
  });
  return result;
}

function teamPayload(team: any | undefined, fallbackName: string, fallbackTag: string) {
  return {
    id: team?.id || fallbackName,
    name: team?.name || fallbackName,
    tag: team?.tag || fallbackTag,
    logo: team?.logo || null,
    captainName: team?.captain?.name || team?.captain?.username || null,
    savedLineups: team?.savedLineups || null,
  };
}

function sameMatch(
  a: { team1Name: string; team2Name: string },
  b: { team1Name: string; team2Name: string },
) {
  const a1 = a.team1Name.toUpperCase().trim();
  const a2 = a.team2Name.toUpperCase().trim();
  const b1 = b.team1Name.toUpperCase().trim();
  const b2 = b.team2Name.toUpperCase().trim();
  return (a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1);
}

export async function GET() {
  try {
    const edition = await prisma.edition.findFirst({
      where: { OR: [{ number: 200 }, { status: 'IN_PROGRESS' }] },
      orderBy: { number: 'desc' },
      include: {
        patterns: { orderBy: { sequence: 'asc' } },
      },
    });

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

    const pairings = stages.flatMap((stage: any) =>
      (stage.matchPairings || []).map((p: any) => ({
        dayNumber: Number(p.dayNumber) || 0,
        stageName: stage.name || '',
        team1Id: p.team1Id,
        team2Id: p.team2Id,
        team1Name: p.team1Name,
        team2Name: p.team2Name,
      })),
    );

    const dayDates = parseDayDates(edition?.dayDates);
    const now = Date.now();
    const official = officialMatchDays();
    const matchesByDay = new Map<
      number,
      { title: string; matches: Array<{ team1Name: string; team2Name: string; team1Id?: string; team2Id?: string }> }
    >();

    official.forEach((d) => {
      matchesByDay.set(d.dayNumber, {
        title: d.title,
        matches: d.matches.map((m) => ({ team1Name: m.team1, team2Name: m.team2 })),
      });
    });

    pairings.forEach((p) => {
      if (!p.dayNumber || (!p.team1Name && !p.team1Id) || (!p.team2Name && !p.team2Id)) return;
      const incoming = {
        team1Name: teamsById.get(p.team1Id)?.name || p.team1Name || 'Team 1',
        team2Name: teamsById.get(p.team2Id)?.name || p.team2Name || 'Team 2',
        team1Id: p.team1Id,
        team2Id: p.team2Id,
      };
      const existing = matchesByDay.get(p.dayNumber);
      if (!existing) {
        matchesByDay.set(p.dayNumber, {
          title: p.stageName ? `${p.stageName} · Day ${p.dayNumber}` : `Day ${p.dayNumber}`,
          matches: [incoming],
        });
        return;
      }
      if (!existing.matches.some((m) => sameMatch(m, incoming))) existing.matches.push(incoming);
    });

    const totalDays = Math.max(
      edition?.totalDays || 0,
      ...official.map((d) => d.dayNumber),
      ...[...matchesByDay.keys()],
      1,
    );

    const days = Array.from({ length: totalDays }, (_, i) => i + 1).map((dayNumber) => {
      const calendarDate = calendarDateForDay(dayNumber, dayDates);
      const cutoffIso = `${calendarDate}T21:30:00+05:30`;
      const revealed = now >= new Date(cutoffIso).getTime();
      const bucket = matchesByDay.get(dayNumber);
      const stageName = pairings.find((p) => p.dayNumber === dayNumber)?.stageName || '';

      const matches = (bucket?.matches || []).map((m) => {
        const t1 =
          (m.team1Id && teamsById.get(m.team1Id)) ||
          teamsByName.get(String(m.team1Name || '').toUpperCase().trim());
        const t2 =
          (m.team2Id && teamsById.get(m.team2Id)) ||
          teamsByName.get(String(m.team2Name || '').toUpperCase().trim());
        const left = teamPayload(t1, m.team1Name, 'T1');
        const right = teamPayload(t2, m.team2Name, 'T2');
        const leftSlots = revealed ? lineupSlots(left.savedLineups, dayNumber) : {};
        const rightSlots = revealed ? lineupSlots(right.savedLineups, dayNumber) : {};

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
          events: EVENT_SLOTS.map((slot, index) => ({
            index,
            name: slot.name,
            format: slot.format,
            leftPlayers: revealed ? leftSlots[slot.key] || 'Not Submitted Yet' : 'Locked until 9:30 PM IST',
            rightPlayers: revealed ? rightSlots[slot.key] || 'Not Submitted Yet' : 'Locked until 9:30 PM IST',
          })),
        };
      });

      return {
        dayNumber,
        calendarDate,
        cutoffIso,
        revealed,
        title: bucket?.title || (stageName ? `${stageName} · Day ${dayNumber}` : `Day ${dayNumber}`),
        matches,
      };
    });

    return NextResponse.json({ success: true, days }, { headers: mobileCorsHeaders });
  } catch (error: any) {
    console.error('Mobile public combis GET:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error.' },
      { status: 500, headers: mobileCorsHeaders },
    );
  }
}
