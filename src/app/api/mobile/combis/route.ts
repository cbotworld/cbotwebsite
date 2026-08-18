import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { userFromBearer } from '@/lib/mobile-session';
import { mobileCorsHeaders } from '@/lib/mobile-cors';
import { resolveEditionAndTeam } from '@/lib/mobile-team';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: mobileCorsHeaders });
}

function slotsForFormat(fmt: string) {
  const u = (fmt || 'SINGLES').toUpperCase();
  if (u.includes('TRIPLE')) return 3;
  if (u.includes('DOUBLE')) return 2;
  return 1;
}

function roundLabel(formats: string[], index: number) {
  let singles = 0;
  let doubles = 0;
  let triples = 0;
  let other = 0;
  for (let i = 0; i <= index; i++) {
    const fmt = (formats[i] || 'SINGLES').toUpperCase();
    if (fmt.includes('TRIPLE')) triples += 1;
    else if (fmt.includes('DOUBLE')) doubles += 1;
    else if (fmt.includes('SINGLE')) singles += 1;
    else other += 1;
  }
  const fmt = (formats[index] || 'SINGLES').toUpperCase();
  if (fmt.includes('TRIPLE')) return `Triples ${triples}`;
  if (fmt.includes('DOUBLE')) return `Doubles ${doubles}`;
  if (fmt.includes('SINGLE')) return `Singles ${singles}`;
  return `Match ${other}`;
}

function canEditCombis(role: string | undefined, teamCaptainId: string | null | undefined, userId: string) {
  if (role === 'ORGANIZER' || role === 'SUPER_ADMIN') return true;
  return Boolean(teamCaptainId && teamCaptainId === userId);
}

function parseLineups(raw?: string | null) {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, { rounds?: any[]; submittedAt?: string }>;
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

async function loadFullTeam(teamId: string) {
  return prisma.team.findUnique({
    where: { id: teamId },
    include: {
      captain: { select: { id: true, name: true, username: true } },
      members: { include: { user: { select: { id: true, name: true, username: true, role: true } } } },
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: mobileCorsHeaders });
    }

    const { edition, team: baseTeam } = await resolveEditionAndTeam(user.id);
    if (!baseTeam) {
      return NextResponse.json(
        {
          success: true,
          canEdit: false,
          warning: 'Your account is not assigned to a team yet.',
          team: null,
          members: [],
          roundFormats: [],
          roundsMeta: [],
          days: [],
        },
        { headers: mobileCorsHeaders },
      );
    }

    const team = await loadFullTeam(baseTeam.id);
    if (!team) {
      return NextResponse.json(
        { success: true, canEdit: false, warning: 'Team not found.', team: null, members: [], roundsMeta: [], days: [] },
        { headers: mobileCorsHeaders },
      );
    }

    const formats: string[] =
      edition?.patterns?.map((bp) => bp.matchFormat || 'SINGLES').filter(Boolean) || [];
    const roundFormats = formats.length ? formats : ['SINGLES', 'SINGLES', 'SINGLES', 'SINGLES', 'SINGLES'];
    const dayDates = parseDayDates(edition?.dayDates);
    const saved = parseLineups(team.savedLineups);
    const totalDays = edition?.totalDays || 10;
    const now = Date.now();

    const memberMap = new Map<string, { id: string; name: string; username?: string }>();
    if (team.captain) {
      memberMap.set(team.captain.id, {
        id: team.captain.id,
        name: team.captain.name || team.captain.username || 'Captain',
        username: team.captain.username,
      });
    }
    for (const m of team.members) {
      if (!m.user) continue;
      memberMap.set(m.user.id, {
        id: m.user.id,
        name: m.user.name || m.user.username || 'Player',
        username: m.user.username,
      });
    }

    const roundsMeta = roundFormats.map((format, index) => ({
      index,
      format,
      name: roundLabel(roundFormats, index),
      slots: slotsForFormat(format),
    }));

    const canEdit = canEditCombis(user.role, team.captainId, user.id);
    const days = Array.from({ length: totalDays }, (_, i) => {
      const dayNumber = i + 1;
      const calendarDate = dayDates[String(dayNumber)] || dayDates[dayNumber as any] || '';
      const cutoffIso = calendarDate ? `${calendarDate}T21:30:00+05:30` : null;
      const revealed = cutoffIso ? now >= new Date(cutoffIso).getTime() : false;
      const entry = saved[String(dayNumber)] || saved[dayNumber as any];
      return {
        dayNumber,
        calendarDate,
        cutoffIso,
        revealed,
        locked: revealed,
        submittedAt: revealed || canEdit ? entry?.submittedAt || null : null,
        rounds: revealed || canEdit ? entry?.rounds || [] : [],
      };
    }).filter((day) => canEdit || day.revealed);

    return NextResponse.json(
      {
        success: true,
        canEdit,
        team: { id: team.id, name: team.name, tag: team.tag, logo: team.logo },
        members: Array.from(memberMap.values()),
        roundFormats,
        roundsMeta,
        days,
      },
      { headers: mobileCorsHeaders },
    );
  } catch (error: any) {
    console.error('Mobile combis GET:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error.' },
      { status: 500, headers: mobileCorsHeaders },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: mobileCorsHeaders });
    }

    const { edition, team } = await resolveEditionAndTeam(user.id);
    if (!team) {
      return NextResponse.json({ success: false, error: 'No team found.' }, { status: 404, headers: mobileCorsHeaders });
    }
    if (!canEditCombis(user.role, team.captainId, user.id)) {
      return NextResponse.json(
        { success: false, error: 'Only the team captain can submit combis.' },
        { status: 403, headers: mobileCorsHeaders },
      );
    }

    const body = await request.json().catch(() => ({}));
    const dayNumber = Number(body.dayNumber);
    const rounds = Array.isArray(body.rounds) ? body.rounds : [];
    if (!dayNumber || rounds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'dayNumber and rounds are required.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }

    if (edition?.dayDates) {
      try {
        const dayDatesMap = JSON.parse(edition.dayDates);
        const dateStr = dayDatesMap[dayNumber] || dayDatesMap[String(dayNumber)];
        if (dateStr) {
          const cutoffTime = new Date(`${dateStr}T21:30:00+05:30`).getTime();
          if (Date.now() >= cutoffTime) {
            return NextResponse.json(
              {
                success: false,
                error: `Submissions for Day ${dayNumber} closed at 9:30 PM IST on ${dateStr}. This combi is locked.`,
              },
              { status: 400, headers: mobileCorsHeaders },
            );
          }
        }
      } catch {}
    }

    let lineupsObj: any = {};
    if (team.savedLineups) {
      try {
        lineupsObj = JSON.parse(team.savedLineups);
      } catch {}
    }

    const submittedAt =
      typeof body.submittedAt === 'string' && body.submittedAt.trim()
        ? body.submittedAt.trim()
        : `${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST`;

    lineupsObj[dayNumber] = { rounds, submittedAt };

    await prisma.team.update({
      where: { id: team.id },
      data: { savedLineups: JSON.stringify(lineupsObj) },
    });

    return NextResponse.json({ success: true, submittedAt }, { headers: mobileCorsHeaders });
  } catch (error: any) {
    console.error('Mobile combis PUT:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to save combi.' },
      { status: 500, headers: mobileCorsHeaders },
    );
  }
}
