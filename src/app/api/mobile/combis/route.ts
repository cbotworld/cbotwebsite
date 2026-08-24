import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { userFromBearer } from '@/lib/mobile-session';
import { mobileCorsHeaders } from '@/lib/mobile-cors';
import { listCaptainDesks, resolveEditionAndTeam } from '@/lib/mobile-team';
import { stageConfigKey } from '@/lib/tournament-stages';
import {
  isSpocExhibitionTeam,
  spocEventFormatsFromStage,
  spocExhibitionStage,
  spocMatchDaysForTeam,
} from '@/lib/spoc-teams';
import {
  combiCutoffIso,
  isCombiSubmissionLocked,
  officialCombiCalendarDate,
} from '@/lib/combi-cutoff';

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

function playersLabel(round: any, fallback = 'Not Submitted Yet') {
  if (!round) return fallback;
  if (Array.isArray(round.players) && round.players.length > 0) {
    const names = round.players.map((p: any) => String(p || '').trim()).filter(Boolean);
    if (names.length) return names.join(', ');
  }
  return fallback;
}

async function loadFullTeam(teamId: string) {
  return prisma.team.findUnique({
    where: { id: teamId },
    include: {
      captain: { select: { id: true, name: true, username: true } },
      members: { include: { user: { select: { id: true, name: true, username: true, role: true } } } },
      spocMembers: { include: { user: { select: { id: true, name: true, username: true, role: true } } } },
    },
  });
}

async function loadStageConfig(editionId: string | undefined) {
  if (!editionId) return { stages: [] as any[] };
  const setting = await prisma.systemSetting.findUnique({ where: { key: stageConfigKey(editionId) } });
  if (!setting?.value) return { stages: [] as any[] };
  try {
    return JSON.parse(setting.value) as { stages?: any[] };
  } catch {
    return { stages: [] as any[] };
  }
}

async function loadStagePairings(editionId: string | undefined, spocOnly = false) {
  const config = await loadStageConfig(editionId);
  const stages = config.stages || [];
  const source = spocOnly
    ? stages.filter((stage: any) => stage.kind === 'SPOC_EXHIBITION')
    : stages.filter((stage: any) => stage.kind !== 'SPOC_EXHIBITION');

  return source.flatMap((stage: any) =>
    (stage.matchPairings || []).map((p: any) => ({
      dayNumber: Number(p.dayNumber) || 0,
      team1Id: p.team1Id,
      team2Id: p.team2Id,
      team1Name: p.team1Name,
      team2Name: p.team2Name,
    })),
  );
}

export async function GET(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: mobileCorsHeaders });
    }

    const preview = await resolveEditionAndTeam(user.id);
    const requestedTeamId = (request.nextUrl.searchParams.get('teamId') || '').trim() || undefined;
    const requestedDesk = (request.nextUrl.searchParams.get('desk') || '').trim().toUpperCase();
    const captainDesks = await listCaptainDesks(user.id, preview.edition?.id);
    const deskTeamId =
      requestedTeamId ||
      (requestedDesk === 'SPOC'
        ? captainDesks.find((d) => d.kind === 'SPOC')?.id
        : requestedDesk === 'MAIN'
          ? captainDesks.find((d) => d.kind === 'MAIN')?.id
          : captainDesks.find((d) => d.kind === 'MAIN')?.id || captainDesks[0]?.id);

    const { edition, team: baseTeam } = await resolveEditionAndTeam(user.id, {
      teamId: deskTeamId,
    });
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

    const isSpocTeam = isSpocExhibitionTeam(team);
    const stageConfig = await loadStageConfig(edition?.id);
    const spocStage = spocExhibitionStage(stageConfig.stages);

    const formats: string[] = isSpocTeam
      ? spocEventFormatsFromStage(spocStage)
      : edition?.patterns?.map((bp) => bp.matchFormat || 'SINGLES').filter(Boolean) || [];
    const roundFormats = formats.length
      ? formats
      : isSpocTeam
        ? ['SINGLES', 'DOUBLES', 'SINGLES']
        : ['SINGLES', 'SINGLES', 'SINGLES', 'SINGLES', 'SINGLES'];
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
    const roster = isSpocTeam ? team.spocMembers : team.members;
    for (const m of roster) {
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

    const editionTeams = edition?.id
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
    const teamsById = new Map(editionTeams.map((t) => [t.id, t]));
    const teamsByName = new Map(editionTeams.map((t) => [t.name.toUpperCase().trim(), t]));
    const pairings = await loadStagePairings(edition?.id, isSpocTeam);
    const opponentByDay = new Map<number, (typeof editionTeams)[number]>();
    const myNameUpper = team.name.toUpperCase().trim();

    for (const p of pairings) {
      if (!p.dayNumber) continue;
      const t1Name = (p.team1Name || teamsById.get(p.team1Id || '')?.name || '').toUpperCase().trim();
      const t2Name = (p.team2Name || teamsById.get(p.team2Id || '')?.name || '').toUpperCase().trim();
      let opp: (typeof editionTeams)[number] | undefined;
      if (p.team1Id === team.id || t1Name === myNameUpper) {
        opp = (p.team2Id && teamsById.get(p.team2Id)) || teamsByName.get(t2Name);
      } else if (p.team2Id === team.id || t2Name === myNameUpper) {
        opp = (p.team1Id && teamsById.get(p.team1Id)) || teamsByName.get(t1Name);
      }
      if (opp) opponentByDay.set(p.dayNumber, opp);
    }

    const spocScheduledDays = isSpocTeam
      ? spocMatchDaysForTeam(team.id, stageConfig.stages, teamsById).map((d) => d.dayNumber)
      : [];

    const dayNumbers = isSpocTeam
      ? (spocScheduledDays.length ? spocScheduledDays : [])
      : Array.from({ length: totalDays }, (_, i) => i + 1);

    const canEdit = canEditCombis(user.role, team.captainId, user.id);
    const days = dayNumbers.map((dayNumber) => {
      const calendarDate = officialCombiCalendarDate(dayNumber, dayDates);
      const cutoffIso = combiCutoffIso(dayNumber, dayDates);
      const revealed = now >= new Date(cutoffIso).getTime();
      const entry = saved[String(dayNumber)] || saved[dayNumber as any];
      const showMine = revealed || canEdit;
      const myRounds = showMine ? entry?.rounds || [] : [];

      const oppTeam = opponentByDay.get(dayNumber) || null;
      const oppSaved = oppTeam ? parseLineups(oppTeam.savedLineups) : {};
      const oppEntry = oppSaved[String(dayNumber)] || oppSaved[dayNumber as any];
      // Opponent lineup only after public reveal (same rule as website)
      const showOpp = Boolean(revealed && oppTeam);
      const oppRounds = showOpp ? oppEntry?.rounds || [] : [];

      const eventCount = Math.max(roundsMeta.length, myRounds.length, oppRounds.length);
      const events = Array.from({ length: eventCount }, (_, idx) => {
        const meta = roundsMeta[idx];
        const myRound = myRounds[idx];
        const oppRound = oppRounds[idx];
        const format = meta?.format || myRound?.format || 'SINGLES';
        const name = meta?.name || myRound?.name || oppRound?.name || `Event ${idx + 1}`;
        return {
          index: idx,
          name,
          format,
          myPlayers: showMine ? playersLabel(myRound, revealed ? 'Not Submitted Yet' : '—') : '—',
          opponentPlayers: showOpp ? playersLabel(oppRound, 'Not Submitted Yet') : revealed ? 'Not Submitted Yet' : 'Locked until 9:30 PM IST',
        };
      });

      return {
        dayNumber,
        calendarDate,
        cutoffIso,
        revealed,
        locked: revealed,
        submittedAt: showMine ? entry?.submittedAt || null : null,
        rounds: myRounds,
        isSpocExhibition: isSpocTeam,
        opponent: oppTeam
          ? {
              id: oppTeam.id,
              name: oppTeam.name,
              tag: oppTeam.tag,
              logo: oppTeam.logo,
              captainName: oppTeam.captain?.name || oppTeam.captain?.username || null,
            }
          : null,
        opponentSubmittedAt: showOpp ? oppEntry?.submittedAt || null : null,
        opponentRounds: oppRounds,
        events,
      };
    }).filter((day) => canEdit || day.revealed);

    return NextResponse.json(
      {
        success: true,
        canEdit,
        isSpocTeam,
        captainDesks,
        team: {
          id: team.id,
          name: team.name,
          tag: team.tag,
          logo: team.logo,
          captainName: team.captain?.name || team.captain?.username || null,
          kind: isSpocTeam ? 'SPOC' : 'MAIN',
        },
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

    const body = await request.json().catch(() => ({}));
    const requestedTeamId = typeof body.teamId === 'string' ? body.teamId.trim() : undefined;
    const { edition, team } = await resolveEditionAndTeam(user.id, { teamId: requestedTeamId });
    if (!team) {
      return NextResponse.json({ success: false, error: 'No team found.' }, { status: 404, headers: mobileCorsHeaders });
    }
    if (!canEditCombis(user.role, team.captainId, user.id)) {
      return NextResponse.json(
        { success: false, error: 'Only the team captain can submit combis.' },
        { status: 403, headers: mobileCorsHeaders },
      );
    }

    const dayNumber = Number(body.dayNumber);
    const rounds = Array.isArray(body.rounds) ? body.rounds : [];
    if (!dayNumber || rounds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'dayNumber and rounds are required.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }

    if (team.teamType === 'SPOC_EXHIBITION') {
      const full = await prisma.team.findUnique({
        where: { id: team.id },
        include: { spocMembers: { select: { userId: true } } },
      });
      const allowed = new Set((full?.spocMembers || []).map((m) => m.userId));
      if (team.captainId) allowed.add(team.captainId);
      const invalid = rounds
        .flatMap((r: any) => (r.playerIds || []).filter(Boolean))
        .find((pid: string) => !allowed.has(pid));
      if (invalid) {
        return NextResponse.json(
          { success: false, error: 'Spoc combi can only include players from your Spoc exhibition roster.' },
          { status: 400, headers: mobileCorsHeaders },
        );
      }
    }

    let dayDatesMap: Record<string, string> = {};
    if (edition?.dayDates) {
      try {
        dayDatesMap = JSON.parse(edition.dayDates);
      } catch {
        dayDatesMap = {};
      }
    }
    if (isCombiSubmissionLocked(dayNumber, dayDatesMap)) {
      const dateStr = officialCombiCalendarDate(dayNumber, dayDatesMap);
      return NextResponse.json(
        {
          success: false,
          error: `Submissions for Day ${dayNumber} closed at 9:30 PM IST on ${dateStr}. This combi is locked.`,
        },
        { status: 400, headers: mobileCorsHeaders },
      );
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
