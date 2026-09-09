'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  assignScheduleSlots,
  buildAutoPairingsForStage,
  computeStandings,
  defaultTournamentStages,
  groupKey,
  leagueIndexOf,
  leagueStageKey,
  matchesStageKind,
  nextSlotAfter,
  normalizeStageConfig,
  ensureStageDayWindows,
  lastCompletedDay,
  occupancySlots,
  seedLeagueGroups,
  stageConfigKey,
  stageMatchStages,
  suggestFinalsPairings,
  suggestQualifierPairings,
  pairingsAlreadyScheduled,
  sameDayTeamClash,
  type SuggestedPairing,
  normalizeDayDates,
} from '@/lib/tournament-stages';
import type { ScheduleMode, TournamentStage, TournamentStageConfig } from '@/types';
import { filterMainTeams, filterSpocTeams } from '@/lib/spoc-teams';

async function requireOrganizer() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || (role !== 'ORGANIZER' && role !== 'SUPER_ADMIN')) {
    return null;
  }
  return session;
}

function revalidateSchedulePaths() {
  revalidateTag('organizer-schedule');
  revalidateTag('edition-combis-data');
  [
    '/admin',
    '/dashboard/organizer',
    '/dashboard/player',
    '/dashboard/captain',
    '/fixtures',
    '/schedule',
    '/combis',
    '/teams-and-players',
  ].forEach((path) => revalidatePath(path));
}

async function enrichStagePairingNames(editionId: string, config: TournamentStageConfig): Promise<TournamentStageConfig> {
  const teams = await prisma.team.findMany({
    where: { editionId },
    select: { id: true, name: true },
  });
  const byId = new Map(teams.map((t) => [t.id, t.name]));
  return {
    ...config,
    stages: (config.stages || []).map((stage) => ({
      ...stage,
      matchPairings: (stage.matchPairings || []).map((p) => ({
        ...p,
        team1Name: byId.get(p.team1Id) || p.team1Name || '',
        team2Name: byId.get(p.team2Id) || p.team2Name || '',
      })),
    })),
  };
}

export async function generateRoundRobinFixtures(editionId: string, teamsList: any[]) {
  if (teamsList.length < 2) {
    return { success: false, error: 'At least 2 teams are required to generate a Round-Robin schedule.' };
  }

  try {
    const generatedMatches = [];
    let matchCounter = 1;
    const baseDate = new Date();

    for (let i = 0; i < teamsList.length; i++) {
      for (let j = i + 1; j < teamsList.length; j++) {
        const matchDate = new Date(baseDate);
        matchDate.setHours(10 + (matchCounter % 6) * 2, 0, 0, 0);

        const newMatch = await prisma.match.create({
          data: {
            editionId,
            round: Math.floor(matchCounter / (teamsList.length / 2)) + 1,
            matchNumber: matchCounter,
            stage: 'ROUND_ROBIN',
            team1Id: teamsList[i].id,
            team2Id: teamsList[j].id,
            score1: 0,
            score2: 0,
            queenStrikes1: 0,
            queenStrikes2: 0,
            status: 'SCHEDULED',
            scheduledTime: matchDate,
            tableNumber: (matchCounter % 8) + 1,
          }
        });

        generatedMatches.push(newMatch);
        matchCounter++;
      }
    }

    revalidatePath('/dashboard/admin');
    revalidatePath('/fixtures');

    return { success: true, matches: generatedMatches };
  } catch (error) {
    console.error('Failed to generate fixtures:', error);
    return { success: false, error: 'Failed to generate fixtures' };
  }
}

export async function calculateLeagueStandings(editionId: string) {
  try {
    const teams = await prisma.team.findMany({ where: { editionId } });
    const matches = await prisma.match.findMany({ where: { editionId } });

    const standingsMap: { [teamId: string]: any } = {};

    teams.forEach((t) => {
      standingsMap[t.id] = {
        rank: 0,
        teamId: t.id,
        teamName: t.name,
        teamTag: t.tag,
        played: 0,
        wins: 0,
        losses: 0,
        points: 0,
        scoreDiff: 0,
        queenStrikes: 0,
      };
    });

    matches.forEach((m) => {
      if (m.status === 'COMPLETED' && m.team1Id && m.team2Id) {
        const s1 = standingsMap[m.team1Id];
        const s2 = standingsMap[m.team2Id];

        if (s1 && s2) {
          s1.played += 1;
          s2.played += 1;

          s1.queenStrikes += m.queenStrikes1 || 0;
          s2.queenStrikes += m.queenStrikes2 || 0;

          s1.scoreDiff += m.score1 - m.score2;
          s2.scoreDiff += m.score2 - m.score1;

          if (m.score1 > m.score2) {
            s1.wins += 1;
            s1.points += 3;
            s2.losses += 1;
          } else if (m.score2 > m.score1) {
            s2.wins += 1;
            s2.points += 3;
            s1.losses += 1;
          }
        }
      }
    });

    const sortedStandings = Object.values(standingsMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
      return b.queenStrikes - a.queenStrikes;
    });

    sortedStandings.forEach((s, idx) => {
      s.rank = idx + 1;
    });

    return { success: true, standings: sortedStandings };
  } catch (error) {
    console.error('Failed to calculate standings:', error);
    return { success: false, error: 'Failed to calculate standings' };
  }
}

export async function generatePlayoffFixtures(editionId: string, standings: any[], teams: any[]) {
  if (standings.length < 4) {
    return { success: false, error: 'At least 4 teams with calculated standings are required for playoffs.' };
  }

  try {
    const team1st = teams.find((t) => t.id === standings[0].teamId) || teams[0];
    const team2nd = teams.find((t) => t.id === standings[1].teamId) || teams[1];
    const team3rd = teams.find((t) => t.id === standings[2].teamId) || teams[2];
    const team4th = teams.find((t) => t.id === standings[3].teamId) || teams[3];

    const now = new Date();

    // Qualifier 1 (1st vs 2nd)
    const q1Date = new Date(now);
    q1Date.setHours(14, 0, 0, 0);
    const qualifier1 = await prisma.match.create({
      data: {
        editionId,
        round: 1,
        matchNumber: 101,
        stage: 'QUALIFIER_1',
        team1Id: team1st.id,
        team2Id: team2nd.id,
        score1: 0,
        score2: 0,
        status: 'SCHEDULED',
        scheduledTime: q1Date,
        tableNumber: 1,
      }
    });

    // Qualifier 2 (3rd vs 4th)
    const q2Date = new Date(now);
    q2Date.setHours(16, 0, 0, 0);
    const qualifier2 = await prisma.match.create({
      data: {
        editionId,
        round: 1,
        matchNumber: 102,
        stage: 'QUALIFIER_2',
        team1Id: team3rd.id,
        team2Id: team4th.id,
        score1: 0,
        score2: 0,
        status: 'SCHEDULED',
        scheduledTime: q2Date,
        tableNumber: 2,
      }
    });

    // Grand Final (Winner Q1 vs Winner Q2)
    const gfDate = new Date(now);
    gfDate.setDate(gfDate.getDate() + 1);
    gfDate.setHours(18, 0, 0, 0);
    const grandFinal = await prisma.match.create({
      data: {
        editionId,
        round: 2,
        matchNumber: 201,
        stage: 'GRAND_FINAL',
        team1Id: team1st.id,
        team2Id: team3rd.id,
        score1: 0,
        score2: 0,
        status: 'SCHEDULED',
        scheduledTime: gfDate,
        tableNumber: 1,
      }
    });

    revalidatePath('/dashboard/admin');
    revalidatePath('/fixtures');

    return {
      success: true,
      playoffs: {
        qualifier1,
        qualifier2,
        grandFinal,
      },
    };
  } catch (error) {
    console.error('Failed to generate playoffs:', error);
    return { success: false, error: 'Failed to generate playoffs' };
  }
}

export async function rescheduleFixture(matchId: string, newScheduledTime: string, newTableNumber: number) {
  try {
    const match = await prisma.match.update({
      where: { id: matchId },
      data: {
        scheduledTime: new Date(newScheduledTime),
        tableNumber: newTableNumber,
      }
    });
    
    revalidatePath('/dashboard/admin');
    revalidatePath('/fixtures');
    return { success: true, match };
  } catch (error) {
    return { success: false, error: 'Match fixture not found or update failed' };
  }
}

export async function saveScheduledMatches(editionId: string, matchesData: any[]) {
  try {
    let nextMatchNumber = 1;
    const existingMatches = await prisma.match.findMany({
      where: { editionId },
      orderBy: { matchNumber: 'desc' },
      take: 1
    });

    if (existingMatches.length > 0) {
      nextMatchNumber = existingMatches[0].matchNumber + 1;
    }

    const createdMatches = [];
    for (const data of matchesData) {
      const matchDate = new Date();
      if (data.day) {
        // Simple heuristic: set date relative to tournament start or just fake date based on Day
        matchDate.setDate(matchDate.getDate() + (parseInt(data.day, 10) || 0));
      }

      const match = await prisma.match.create({
        data: {
          editionId,
          round: parseInt(data.day, 10) || 1,
          matchNumber: nextMatchNumber++,
          stage: data.stage || 'LEAGUE',
          team1Id: data.team1Id,
          team2Id: data.team2Id,
          score1: 0,
          score2: 0,
          queenStrikes1: 0,
          queenStrikes2: 0,
          status: 'SCHEDULED',
          scheduledTime: matchDate,
          tableNumber: 1, // Default table
        }
      });
      createdMatches.push(match);
    }

    revalidatePath('/admin');
    revalidatePath('/dashboard/organizer');
    revalidatePath('/fixtures');

    return { success: true, count: createdMatches.length };
  } catch (error: any) {
    console.error('Failed to save scheduled matches:', error);
    return { success: false, error: error.message };
  }
}

export type StagePairingInput = {
  stage: string;
  team1Id?: string;
  team2Id?: string;
  label?: string;
  round?: number;
  dayNumber?: number;
  scheduledTime?: string;
  tableNumber?: number;
};

async function loadStageConfig(editionId: string, teamCount = 8): Promise<TournamentStageConfig> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: stageConfigKey(editionId) },
  });
  if (!setting?.value) return defaultTournamentStages(teamCount);
  try {
    const parsed = JSON.parse(setting.value);
    const editionTeams = await prisma.team.findMany({
      where: { editionId },
      select: { id: true },
    });
    const validTeamIds = new Set(editionTeams.map((t) => t.id));

    if (parsed?.stages && Array.isArray(parsed.stages)) {
      parsed.stages = parsed.stages.map((st: any) => ({
        ...st,
        matchPairings: (st.matchPairings || []).filter(
          (p: any) =>
            (p.team1Id && validTeamIds.has(p.team1Id)) ||
            (p.team2Id && validTeamIds.has(p.team2Id))
        ),
        groups: (st.groups || []).map((g: any) => ({
          ...g,
          teamIds: (g.teamIds || []).filter((id: string) => validTeamIds.has(id)),
        })),
      }));
    }

    return normalizeStageConfig(parsed, teamCount);
  } catch {
    return defaultTournamentStages(teamCount);
  }
}

async function nextMatchNumber(editionId: string) {
  const last = await prisma.match.findFirst({
    where: { editionId },
    orderBy: { matchNumber: 'desc' },
    select: { matchNumber: true },
  });
  return (last?.matchNumber || 0) + 1;
}

function scheduleFromOffset(base: Date, index: number) {
  const slot = new Date(base);
  slot.setDate(base.getDate() + Math.floor(index / 4));
  slot.setHours(10 + (index % 4) * 2, 0, 0, 0);
  return slot;
}

export async function getEditionStageSnapshot(editionId: string): Promise<
  | {
      success: true;
      edition: { id: string; title: string; totalDays: number; dayDates: string | null; tournamentStartDate: Date | null };
      teams: Array<{ id: string; name: string; tag: string }>;
      spocTeams: Array<{ id: string; name: string; tag: string }>;
      matches: any[];
      config: TournamentStageConfig;
      rrStandings: ReturnType<typeof computeStandings>;
      standingsByGroup: Record<string, ReturnType<typeof computeStandings>>;
    }
  | { success: false; error: string }
> {
  if (!(await requireOrganizer())) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }

  try {
    const [edition, allTeams, matches] = await Promise.all([
      prisma.edition.findUnique({ where: { id: editionId }, select: { id: true, title: true, totalDays: true, dayDates: true, tournamentStartDate: true } }),
      prisma.team.findMany({ where: { editionId }, orderBy: { createdAt: 'asc' } }),
      prisma.match.findMany({
        where: { editionId },
        include: { team1: true, team2: true, winner: true },
        orderBy: { matchNumber: 'asc' },
      }),
    ]);

    if (!edition) return { success: false, error: 'Edition not found.' };

    const teams = filterMainTeams(allTeams);
    const spocTeams = filterSpocTeams(allTeams);
    const config = await loadStageConfig(editionId, teams.length || 8);
    const rrStandings = computeStandings(teams, matches, (stage) => matchesStageKind(stage, 'ROUND_ROBIN'));

    const standingsByGroup: Record<string, ReturnType<typeof computeStandings>> = {};
    const leagueStage = [...config.stages].reverse().find((s) => s.kind === 'LEAGUE');
    (leagueStage?.groups || []).forEach((group, gi) => {
      const groupTeams = teams.filter((t) => group.teamIds.includes(t.id));
      standingsByGroup[groupKey(group, gi)] = computeStandings(
        groupTeams.length ? groupTeams : teams,
        matches,
        (stage) => stage === leagueStageKey(groupKey(group, gi), leagueIndexOf(leagueStage))
      );
    });

    return {
      success: true,
      edition,
      teams: teams.map((t) => ({ id: t.id, name: t.name, tag: t.tag })),
      spocTeams: spocTeams.map((t) => ({ id: t.id, name: t.name, tag: t.tag })),
      matches,
      config,
      rrStandings,
      standingsByGroup,
    };
  } catch (error: any) {
    console.error('Failed to load stage snapshot:', error);
    return { success: false, error: error?.message || 'Failed to load tournament stages' };
  }
}

export async function saveTournamentStageConfig(
  editionId: string,
  config: TournamentStageConfig
): Promise<{ success: true; config: TournamentStageConfig } | { success: false; error: string }> {
  if (!(await requireOrganizer())) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }

  try {
    const normalized = await enrichStagePairingNames(editionId, normalizeStageConfig(config));
    const allPairings = (normalized.stages || []).flatMap((stage) => stage.matchPairings || []);
    const clash = sameDayTeamClash(allPairings);
    if (clash) {
      const team = await prisma.team.findUnique({
        where: { id: clash.teamId },
        select: { name: true },
      });
      return {
        success: false,
        error: `${team?.name || 'A team'} is already booked on Day ${clash.dayNumber}. A team can play only one match per day.`,
      };
    }
    await prisma.systemSetting.upsert({
      where: { key: stageConfigKey(editionId) },
      update: { value: JSON.stringify(normalized) },
      create: { key: stageConfigKey(editionId), value: JSON.stringify(normalized) },
    });

    try {
      await prisma.edition.update({
        where: { id: editionId },
        data: { format: 'MULTI_STAGE' },
      });
    } catch {
      // format update is best-effort
    }

    revalidateSchedulePaths();
    return { success: true, config: normalized };
  } catch (error: any) {
    console.error('Failed to save stage config:', error);
    return { success: false, error: error?.message || 'Failed to save stage design' };
  }
}

async function replaceStageMatches(editionId: string, stages: string[]) {
  if (!stages.length) return;
  await prisma.match.deleteMany({
    where: { editionId, stage: { in: stages } },
  });
}

export async function generateStageFixtures(
  editionId: string,
  stageId: string,
  payload?: {
    regenerate?: boolean;
    groups?: { name: string; teamIds: string[] }[];
    pairings?: StagePairingInput[];
    schedule?: {
      mode: ScheduleMode;
      eventsPerDay: number;
      dayDates: Record<number, string>;
      startSlot?: number;
      startDay?: number;
      durationDays?: number;
    };
  }
): Promise<
  | { success: true; count: number; matches: any[]; config: TournamentStageConfig }
  | { success: false; error: string }
> {
  if (!(await requireOrganizer())) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }

  try {
    const allTeams = await prisma.team.findMany({ where: { editionId }, orderBy: { createdAt: 'asc' } });
    const mainTeams = filterMainTeams(allTeams);
    const spocTeams = filterSpocTeams(allTeams);
    const matches = await prisma.match.findMany({
      where: { editionId },
      include: { team1: true, team2: true, winner: true },
      orderBy: { matchNumber: 'asc' },
    });
    const config = await loadStageConfig(editionId, mainTeams.length || 8);
    const stage = config.stages.find((s) => s.id === stageId);
    if (!stage) return { success: false, error: 'Stage not found in the saved tournament design.' };

    const teams = stage.kind === 'SPOC_EXHIBITION' ? spocTeams : mainTeams;

    const existingForStage = matches.filter((m) => stageMatchStages(stage).includes(m.stage));
    if (existingForStage.length > 0 && !payload?.regenerate) {
      return { success: false, error: `${stage.name} fixtures already exist. Confirm regenerate to replace them.` };
    }

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { tournamentStartDate: true, dayDates: true },
    });
    let baseDate = edition?.tournamentStartDate ? new Date(edition.tournamentStartDate) : new Date();
    if (edition?.dayDates) {
      try {
        const map = JSON.parse(edition.dayDates);
        const first = map['1'] || map[1];
        if (first) baseDate = new Date(first);
      } catch {}
    }

    if (payload?.groups && stage.kind === 'LEAGUE') {
      stage.groups = payload.groups;
      stage.seeding = 'MANUAL';
    }

    let pairings = payload?.pairings;
    if (payload?.schedule && pairings?.length && !pairingsAlreadyScheduled(pairings as SuggestedPairing[])) {
      pairings = assignScheduleSlots(pairings as SuggestedPairing[], {
        mode: payload.schedule.mode,
        eventsPerDay: payload.schedule.eventsPerDay,
        dayDates: payload.schedule.dayDates,
        startSlot: payload.schedule.startSlot || 0,
        startDay: payload.schedule.startDay,
        durationDays: payload.schedule.durationDays,
      });
    }

    if (pairings?.length) {
      stage.matchPairings = pairings.map((p) => ({
        stage: p.stage,
        label: p.label || p.stage,
        team1Id: p.team1Id || '',
        team2Id: p.team2Id || '',
        round: p.round,
        dayNumber: p.dayNumber,
        scheduledTime: p.scheduledTime,
        tableNumber: p.tableNumber,
      }));
    }

    const created = await createMatchesForStage(editionId, stage, teams, matches, {
      pairings,
      baseDate,
      replaceStages: payload?.regenerate,
    });

    if (!created.success) return created;

    await prisma.systemSetting.upsert({
      where: { key: stageConfigKey(editionId) },
      update: { value: JSON.stringify(config) },
      create: { key: stageConfigKey(editionId), value: JSON.stringify(config) },
    });

    revalidateSchedulePaths();
    return { success: true, count: created.count, matches: created.matches, config };
  } catch (error: any) {
    console.error('Failed to generate stage fixtures:', error);
    return { success: false, error: error?.message || 'Failed to generate stage fixtures' };
  }
}

async function createMatchesForStage(
  editionId: string,
  stage: TournamentStage,
  teams: Array<{ id: string; name: string; tag: string }>,
  existingMatches: any[],
  opts: { pairings?: StagePairingInput[]; baseDate: Date; replaceStages?: boolean }
): Promise<{ success: true; count: number; matches: any[] } | { success: false; error: string }> {
  const stageKeys = stageMatchStages(stage);
  if (opts.replaceStages) {
    await replaceStageMatches(editionId, stageKeys);
  }

  const rows: Array<{
    stage: string;
    team1Id?: string;
    team2Id?: string;
    round?: number;
    scheduledTime?: string;
    tableNumber?: number;
  }> = [];

  const pushPairings = (pairings: StagePairingInput[]) => {
    pairings.forEach((p) => {
      rows.push({
        stage: p.stage,
        team1Id: p.team1Id || undefined,
        team2Id: p.team2Id || undefined,
        round: p.round,
        scheduledTime: p.scheduledTime,
        tableNumber: p.tableNumber,
      });
    });
  };

  if (stage.kind === 'ROUND_ROBIN') {
    if (opts.pairings?.length) {
      pushPairings(opts.pairings);
    } else {
      const ids = teams.map((t) => t.id);
      if (ids.length < 2) return { success: false, error: 'At least 2 teams are required for Round Robin.' };
      buildAutoPairingsForStage(stage, teams, existingMatches).forEach((p) => {
        rows.push({ stage: p.stage, team1Id: p.team1Id, team2Id: p.team2Id, round: p.round });
      });
    }
  } else if (stage.kind === 'LEAGUE') {
    if (opts.pairings?.length) {
      const incomplete = opts.pairings.find((p) => !p.team1Id || !p.team2Id || p.team1Id === p.team2Id);
      if (incomplete) {
        return { success: false, error: 'Every league match needs two different teams. Edit the pairings like qualifiers, then generate.' };
      }
      opts.pairings.forEach((p) => {
        rows.push({
          stage: p.stage || leagueStageKey('A', leagueIndexOf(stage)),
          team1Id: p.team1Id || undefined,
          team2Id: p.team2Id || undefined,
          round: p.round,
          scheduledTime: p.scheduledTime,
          tableNumber: p.tableNumber,
        });
      });
    } else {
      const generated = buildAutoPairingsForStage(stage, teams, existingMatches, { groups: stage.groups });
      if (!generated.length) {
        return { success: false, error: 'Assign teams to league groups before generating fixtures.' };
      }
      generated.forEach((p) => {
        rows.push({
          stage: p.stage,
          team1Id: p.team1Id,
          team2Id: p.team2Id,
          round: p.round,
          scheduledTime: p.scheduledTime,
          tableNumber: p.tableNumber,
        });
      });
    }
  } else if (stage.kind === 'QUALIFIER' || stage.kind === 'FINALS') {
    const pairings = opts.pairings?.length
      ? opts.pairings
      : stage.kind === 'QUALIFIER'
        ? autoQualifierPairings(stage, teams, existingMatches)
        : suggestFinalsPairings(
            existingMatches.filter((m) => matchesStageKind(m.stage, 'QUALIFIER')),
            !!stage.includeThirdPlace
          );

    if (!pairings.length) {
      return {
        success: false,
        error: stage.kind === 'QUALIFIER'
          ? 'Could not seed qualifier pairings. Finish league matches or pick teams manually.'
          : 'Could not seed finals. Finish qualifier matches or pick teams manually.',
      };
    }

    pairings.forEach((p) => {
      rows.push({
        stage: p.stage,
        team1Id: p.team1Id || undefined,
        team2Id: p.team2Id || undefined,
        round: p.round,
        scheduledTime: p.scheduledTime,
        tableNumber: p.tableNumber,
      });
    });
  } else if (stage.kind === 'SPOC_EXHIBITION') {
    const pairings = opts.pairings?.length ? opts.pairings : stage.matchPairings || [];
    if (!pairings.length) {
      return { success: false, error: 'Add Spoc exhibition match pairings before generating fixtures.' };
    }
    const incomplete = pairings.find((p) => !p.team1Id || !p.team2Id || p.team1Id === p.team2Id);
    if (incomplete) {
      return { success: false, error: 'Every Spoc exhibition match needs two different teams.' };
    }
    pushPairings(pairings);
  }

  if (!rows.length) return { success: false, error: 'No fixtures to generate for this stage.' };

  let matchNumber = await nextMatchNumber(editionId);
  const createdMatches = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const created = await prisma.match.create({
      data: {
        editionId,
        round: row.round || stage.order || 1,
        matchNumber: matchNumber++,
        stage: row.stage,
        team1Id: row.team1Id || null,
        team2Id: row.team2Id || null,
        score1: 0,
        score2: 0,
        queenStrikes1: 0,
        queenStrikes2: 0,
        status: 'SCHEDULED',
        scheduledTime: row.scheduledTime ? new Date(row.scheduledTime) : scheduleFromOffset(opts.baseDate, i),
        tableNumber: row.tableNumber || (i % 8) + 1,
      },
      include: { team1: true, team2: true },
    });
    createdMatches.push(created);
  }

  return { success: true, count: createdMatches.length, matches: createdMatches };
}

function autoQualifierPairings(
  stage: TournamentStage,
  teams: Array<{ id: string; name: string; tag: string }>,
  existingMatches: any[]
) {
  const rr = computeStandings(teams, existingMatches, (s) => matchesStageKind(s, 'ROUND_ROBIN'));
  const qualified = rr.slice(0, 4).map((row, idx) => ({
    group: idx % 2 === 0 ? 'A' : 'B',
    rank: Math.floor(idx / 2) + 1,
    teamId: row.teamId,
    teamName: row.teamName,
  }));
  return suggestQualifierPairings(qualified, stage.pairing || 'CROSS');
}

export async function seedLeagueGroupsFromStandings(
  editionId: string,
  stageId: string,
  seeding?: 'RR_STANDINGS_SNAKE' | 'RR_STANDINGS_SPLIT'
) {
  if (!(await requireOrganizer())) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }

  try {
    const teams = await prisma.team.findMany({ where: { editionId } });
    const matches = await prisma.match.findMany({ where: { editionId } });
    const config = await loadStageConfig(editionId, teams.length || 8);
    const stage = config.stages.find((s) => s.id === stageId && s.kind === 'LEAGUE');
    if (!stage) return { success: false, error: 'League stage not found.' };

    const ranked = computeStandings(teams, matches, (s) => matchesStageKind(s, 'ROUND_ROBIN'));
    const rankedIds = ranked.map((r) => r.teamId);
    const groupCount = stage.groupCount || 2;
    const teamsPerGroup = stage.teamsPerGroup || Math.ceil((rankedIds.length || 8) / groupCount);
    stage.groups = seedLeagueGroups(rankedIds, groupCount, teamsPerGroup, seeding || stage.seeding || 'RR_STANDINGS_SNAKE');
    stage.seeding = seeding || stage.seeding || 'RR_STANDINGS_SNAKE';

    await prisma.systemSetting.upsert({
      where: { key: stageConfigKey(editionId) },
      update: { value: JSON.stringify(config) },
      create: { key: stageConfigKey(editionId), value: JSON.stringify(config) },
    });

    return { success: true, groups: stage.groups, config };
  } catch (error: any) {
    console.error('Failed to seed league groups:', error);
    return { success: false, error: error?.message || 'Failed to seed groups' };
  }
}

export async function autoScheduleTournamentStages(
  editionId: string,
  opts: {
    mode: ScheduleMode;
    eventsPerDay: number;
    dayDates?: Record<number, string>;
    stageIds?: string[];
    regenerate?: boolean;
    keepExistingRoundRobin?: boolean;
  }
): Promise<
  | { success: true; count: number; scheduled: Array<{ stage: string; count: number }>; config: TournamentStageConfig }
  | { success: false; error: string }
> {
  if (!(await requireOrganizer())) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }

  try {
    const teams = await prisma.team.findMany({ where: { editionId }, orderBy: { createdAt: 'asc' } });
    if (teams.length < 2) {
      return { success: false, error: 'At least 2 teams are required to auto-schedule matches.' };
    }

    let matches = await prisma.match.findMany({
      where: { editionId },
      include: { team1: true, team2: true, winner: true },
      orderBy: { matchNumber: 'asc' },
    });
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { tournamentStartDate: true, dayDates: true, totalDays: true },
    });

    let dayDates = normalizeDayDates(opts.dayDates);
    if (!Object.keys(dayDates).length && edition?.dayDates) {
      try {
        dayDates = normalizeDayDates(JSON.parse(edition.dayDates));
      } catch {}
    }

    const config = await loadStageConfig(editionId, teams.length || 8);
    const lastDone = lastCompletedDay(dayDates);
    config.stages = ensureStageDayWindows(config.stages, lastDone || 7);
    config.scheduleMode = opts.mode;
    const keepRR = opts.keepExistingRoundRobin !== false;
    const rrMatches = matches
      .filter((m) => m.stage === 'ROUND_ROBIN')
      .sort((a, b) => a.matchNumber - b.matchNumber);
    const rrExists = rrMatches.length > 0;

    const targets = config.stages.filter((stage) => {
      if (opts.stageIds?.length) return opts.stageIds.includes(stage.id);
      if (keepRR && rrExists && stage.kind === 'ROUND_ROBIN') return false;
      return true;
    });

    if (!targets.length && !(keepRR && rrExists)) {
      return { success: false, error: 'No stages left to auto-schedule. Round robin is already on the calendar.' };
    }

    let startSlot = 0;
    const scheduled: Array<{ stage: string; count: number }> = [];
    let createdTotal = 0;

    if (keepRR && rrExists && !opts.stageIds?.length) {
      const rrPairings: SuggestedPairing[] = rrMatches.map((m, idx) => ({
        stage: 'ROUND_ROBIN',
        label: `Round Robin · Match ${idx + 1}`,
        team1Id: m.team1Id || '',
        team2Id: m.team2Id || '',
        round: m.round || Math.floor(idx / Math.max(1, Math.floor(teams.length / 2))) + 1,
      }));
      const slottedRR = assignScheduleSlots(rrPairings, {
        mode: opts.mode,
        eventsPerDay: opts.eventsPerDay,
        dayDates,
        startDay: config.stages.find((s) => s.kind === 'ROUND_ROBIN')?.startDay || 1,
        durationDays: config.stages.find((s) => s.kind === 'ROUND_ROBIN')?.durationDays || 7,
      });
      for (let i = 0; i < rrMatches.length; i++) {
        const slot = slottedRR[i];
        if (!slot) continue;
        await prisma.match.update({
          where: { id: rrMatches[i].id },
          data: {
            scheduledTime: slot.scheduledTime ? new Date(slot.scheduledTime) : undefined,
            tableNumber: slot.tableNumber || rrMatches[i].tableNumber,
            round: slot.round || rrMatches[i].round,
          },
        });
      }
      startSlot = nextSlotAfter(slottedRR, 0, opts.mode);
      scheduled.push({ stage: 'Round Robin (re-timed)', count: rrMatches.length });
      createdTotal += rrMatches.length;
    } else {
      const priorStages = config.stages.filter((s) => !targets.some((t) => t.id === s.id));
      priorStages.forEach((stage) => {
        const subset = matches.filter((m) => stageMatchStages(stage).includes(m.stage));
        startSlot += occupancySlots(subset, opts.mode);
      });
    }

    for (const stage of targets) {
      const existing = matches.filter((m) => stageMatchStages(stage).includes(m.stage));
      if (existing.length && !opts.regenerate && !(opts.stageIds || []).includes(stage.id)) {
        startSlot += occupancySlots(existing, opts.mode);
        continue;
      }

      if (stage.kind === 'LEAGUE') {
        const assigned = (stage.groups || []).some((g) => (g.teamIds || []).filter(Boolean).length >= 2);
        if (!assigned) {
          const ranked = computeStandings(teams, matches, (s) => matchesStageKind(s, 'ROUND_ROBIN'));
          const rankedIds = ranked.length ? ranked.map((r) => r.teamId) : teams.map((t) => t.id);
          stage.groups = seedLeagueGroups(
            rankedIds,
            stage.groupCount || 2,
            stage.teamsPerGroup || 4,
            stage.seeding || 'RR_STANDINGS_SNAKE'
          );
        }
      }

      const pairings = buildAutoPairingsForStage(stage, teams, matches, { groups: stage.groups });

      if (!pairings.length) {
        return { success: false, error: `Could not auto-build pairings for ${stage.name}.` };
      }

      const slotted = pairingsAlreadyScheduled(pairings)
        ? pairings
        : assignScheduleSlots(pairings, {
            mode: opts.mode,
            eventsPerDay: opts.eventsPerDay,
            dayDates,
            startDay: stage.startDay,
            durationDays: stage.durationDays,
          });

      stage.matchPairings = slotted;
      const created = await createMatchesForStage(editionId, stage, teams, matches, {
        pairings: slotted,
        baseDate: edition?.tournamentStartDate ? new Date(edition.tournamentStartDate) : new Date(),
        replaceStages: true,
      });
      if (!created.success) return created;

      createdTotal += created.count;
      scheduled.push({ stage: stage.name, count: created.count });
      startSlot = nextSlotAfter(slotted, startSlot, opts.mode);

      matches = await prisma.match.findMany({
        where: { editionId },
        include: { team1: true, team2: true, winner: true },
        orderBy: { matchNumber: 'asc' },
      });
    }

    await prisma.systemSetting.upsert({
      where: { key: stageConfigKey(editionId) },
      update: { value: JSON.stringify(config) },
      create: { key: stageConfigKey(editionId), value: JSON.stringify(config) },
    });

    revalidateSchedulePaths();
    if (!createdTotal) {
      return { success: false, error: 'Every remaining stage already has fixtures. Open a stage and auto-schedule it to rebuild that calendar.' };
    }
    return { success: true, count: createdTotal, scheduled, config };
  } catch (error: any) {
    console.error('Failed to auto-schedule stages:', error);
    return { success: false, error: error?.message || 'Failed to auto-schedule tournament stages' };
  }
}
