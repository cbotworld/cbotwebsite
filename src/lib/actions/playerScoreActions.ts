'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { ensureOfficialDayDates } from '@/lib/edition-day-dates';
import { lastCompletedDay, stageConfigKey, stageJustFinishedForAverageReview } from '@/lib/tournament-stages';
import type { PlayerAverageLogRow, PlayerDayScoreRow, TournamentStageConfig } from '@/types';
import {
  calendarDaysInEdition,
  hasSubmittedPriorDays,
  isCaptainScoreEditOpen,
  isScoreSubmitOpen,
  nextEligibleDay,
  isDayScorePublished,
  scoreCutoffIso,
  scoreWindowStartIso,
  todayIstCalendarDate,
} from '@/lib/day-scoring';
import {
  SCORE_EDIT_CAPTAIN_CLOSED,
  SCORE_EDIT_NOT_OPEN_YET,
  SCORE_EDIT_PLAYER_CLOSED,
} from '@/lib/score-edit-policy';
import {
  computeEditionRunningAverage,
  editionBoardAverage,
  normalizeBoards,
  previewTargetBonus,
  resolveScoreInput,
  type DayBoardScore,
} from '@/lib/board-scores';
import { averageChangeEffectiveFrom, averageForDay, logsForUser } from '@/lib/player-average';
import { PUBLIC_PLAYER_SCORES_PATH, PUBLIC_STANDINGS_PATH } from '@/lib/website-cms';
import { combiCalendarDate, normalizeDayDates, OFFICIAL_DAY1_CALENDAR } from '@/lib/combi-cutoff';
import { buildStageStandingBlocks, pairingsFromStages, placementRanking } from '@/lib/team-standings';
import { countEventWinsForPlayer, editionProfileStats, rankPlayers } from '@/lib/player-ranking';
import { resolveCurrentEdition } from '@/lib/current-edition';

function roleOf(session: any) {
  return String(session?.user?.role || '');
}

function isOrganiser(session: any) {
  const role = roleOf(session);
  return role === 'ORGANIZER' || role === 'SUPER_ADMIN';
}

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as any).id) return { error: 'Please log in.' as const, session: null };
  return { session, error: null };
}

export async function loadLatestEdition() {
  const current = await resolveCurrentEdition();
  if (!current) return null;
  const edition = await prisma.edition.findUnique({
    where: { id: current.id },
    select: { id: true, title: true, number: true, dayDates: true, totalDays: true, status: true, tournamentStartDate: true },
  });
  return ensureOfficialDayDates(edition);
}

async function loadStageConfig(editionId: string): Promise<TournamentStageConfig> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: stageConfigKey(editionId) } });
  if (!setting?.value) return { stages: [] };
  try {
    const parsed = JSON.parse(setting.value);
    return { stages: parsed.stages || [], scheduleMode: parsed.scheduleMode };
  } catch {
    return { stages: [] };
  }
}

function revalidateScorePages() {
  revalidatePath(PUBLIC_PLAYER_SCORES_PATH);
  revalidatePath(PUBLIC_STANDINGS_PATH);
  revalidatePath('/dashboard/player');
  revalidatePath('/dashboard/captain');
  revalidatePath('/dashboard/organizer');
}

async function upsertDayScore(opts: {
  editionId: string;
  userId: string;
  dayNumber: number;
  score: number;
  slams: number;
  boards: DayBoardScore[];
  enteredByUserId: string;
}) {
  return prisma.playerDayScore.upsert({
    where: { editionId_userId_dayNumber: { editionId: opts.editionId, userId: opts.userId, dayNumber: opts.dayNumber } },
    create: {
      editionId: opts.editionId,
      userId: opts.userId,
      dayNumber: opts.dayNumber,
      score: opts.score,
      slams: opts.slams,
      boards: opts.boards,
      enteredByUserId: opts.enteredByUserId,
    },
    update: {
      score: opts.score,
      slams: opts.slams,
      boards: opts.boards,
      enteredByUserId: opts.enteredByUserId,
    },
  });
}

async function refreshPlayerEditionAverage(editionId: string, userId: string, changedById: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { average: true },
  });
  const rows = await prisma.playerDayScore.findMany({
    where: { editionId, userId },
    orderBy: { dayNumber: 'asc' },
    select: { score: true, slams: true, boards: true, dayNumber: true },
  });
  if (!rows.length) return;
  const logs = await prisma.playerAverageLog.findMany({
    where: { editionId, userId },
    orderBy: { effectiveFrom: 'asc' },
  });
  const seed = logs.length > 0 ? Number(logs[0].average) : Number(user?.average) || 0;
  const stats = computeEditionRunningAverage(seed, rows);
  if (stats.daysProcessed <= 0 || stats.average <= 0) return;
  await prisma.user.update({ where: { id: userId }, data: { average: stats.average } });
  await recordPlayerAverageChange(userId, stats.average, changedById, true);
}

async function userOnEditionTeam(userId: string, editionId: string) {
  const team = await prisma.team.findFirst({
    where: {
      editionId,
      OR: [
        { captainId: userId },
        { members: { some: { userId } } },
        { spocMembers: { some: { userId } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(team);
}

async function playerHasGoneLive(userId: string, editionId?: string): Promise<boolean> {
  const count = await prisma.liveStream.count({
    where: {
      playerId: userId,
      ...(editionId ? { editionId } : {}),
    },
  });
  return count > 0;
}

function describeScoreWindow(day: number, dayDates: any, hasGoneLive = true) {
  if (day > 1 && !hasGoneLive) {
    return {
      windowOpen: false,
      windowReason: `Go live at least once to submit scores for Day ${day}.`,
    };
  }
  if (isScoreSubmitOpen(day, dayDates)) {
    return { windowOpen: true, windowReason: null as string | null };
  }
  return {
    windowOpen: false,
    windowReason: SCORE_EDIT_PLAYER_CLOSED,
  };
}

export async function submitPlayerDayScoreForUser(
  userId: string,
  dayNumber: number,
  score: unknown,
  slams: unknown,
  boards?: unknown,
) {
  const parsed = resolveScoreInput(score, slams, boards);
  if (!parsed.ok) return { success: false as const, error: parsed.error };
  const edition = await loadLatestEdition();
  if (!edition) return { success: false as const, error: 'No edition found.' };
  if (!(await userOnEditionTeam(userId, edition.id))) {
    return { success: false as const, error: 'You must be on a team in this edition to submit a day score.' };
  }
  const stages = (await loadStageConfig(edition.id)).stages;
  const maxDay = calendarDaysInEdition(stages, edition.totalDays);
  const day = Number(dayNumber);
  if (!Number.isInteger(day) || day < 1 || day > maxDay) return { success: false as const, error: 'Invalid day.' };

  if (day > 1) {
    const hasLive = await playerHasGoneLive(userId, edition.id);
    if (!hasLive) {
      return {
        success: false as const,
        error: `Please go live at least once before submitting scores for Day ${day}.`,
      };
    }
  }

  if (!isScoreSubmitOpen(day, edition.dayDates)) {
    return {
      success: false as const,
      error: SCORE_EDIT_PLAYER_CLOSED,
    };
  }

  await upsertDayScore({
    editionId: edition.id,
    userId,
    dayNumber: day,
    score: parsed.score,
    slams: parsed.slams,
    boards: parsed.boards,
    enteredByUserId: userId,
  });
  await refreshPlayerEditionAverage(edition.id, userId, userId);
  revalidateScorePages();
  return { success: true as const };
}

export async function submitTeamDayScoresForActor(opts: {
  actorId: string;
  isOrganiser: boolean;
  teamId: string;
  dayNumber: number;
  rows: Array<{ userId: string; score?: unknown; slams?: unknown; boards?: unknown }>;
}) {
  const edition = await loadLatestEdition();
  if (!edition) return { success: false as const, error: 'No edition found.' };
  const team = await prisma.team.findFirst({
    where: { id: opts.teamId, editionId: edition.id },
    include: {
      members: { select: { userId: true } },
      spocMembers: { select: { userId: true } },
    },
  });
  if (!team) return { success: false as const, error: 'Team not found.' };
  if (!opts.isOrganiser && team.captainId !== opts.actorId) {
    return { success: false as const, error: 'Only this team’s captain can enter these scores.' };
  }

  const stages = (await loadStageConfig(edition.id)).stages;
  const maxDay = calendarDaysInEdition(stages, edition.totalDays);
  const day = Number(opts.dayNumber);
  if (!Number.isInteger(day) || day < 1 || day > maxDay) return { success: false as const, error: 'Invalid day.' };
  if (!opts.isOrganiser && !isCaptainScoreEditOpen(day, edition.dayDates)) {
    return { success: false as const, error: SCORE_EDIT_CAPTAIN_CLOSED };
  }

  const memberIds = new Set([
    ...team.members.map((m) => m.userId),
    ...team.spocMembers.map((m) => m.userId),
  ]);
  const priors = await prisma.playerDayScore.findMany({
    where: { editionId: edition.id, userId: { in: [...memberIds] } },
    select: { userId: true, dayNumber: true },
  });
  const priorByUser = new Map<string, number[]>();
  for (const row of priors) {
    const list = priorByUser.get(row.userId) || [];
    list.push(row.dayNumber);
    priorByUser.set(row.userId, list);
  }

  for (const row of opts.rows) {
    if (!memberIds.has(row.userId)) return { success: false as const, error: 'Can only enter scores for this team.' };
    const parsed = resolveScoreInput(row.score, row.slams, row.boards);
    if (!parsed.ok) return { success: false as const, error: parsed.error };
    await upsertDayScore({
      editionId: edition.id,
      userId: row.userId,
      dayNumber: day,
      score: parsed.score,
      slams: parsed.slams,
      boards: parsed.boards,
      enteredByUserId: opts.actorId,
    });
    await refreshPlayerEditionAverage(edition.id, row.userId, opts.actorId);
  }
  revalidateScorePages();
  return { success: true as const };
}

export async function submitPlayerDayScore(dayNumber: number, score: unknown, slams: unknown, boards?: unknown) {
  const { session, error } = await requireSession();
  if (error || !session) return { success: false as const, error };
  return submitPlayerDayScoreForUser((session.user as any).id as string, dayNumber, score, slams, boards);
}

export async function submitTeamDayScores(
  teamId: string,
  dayNumber: number,
  rows: Array<{ userId: string; score?: unknown; slams?: unknown; boards?: unknown }>,
) {
  const { session, error } = await requireSession();
  if (error || !session) return { success: false as const, error };
  return submitTeamDayScoresForActor({
    actorId: (session.user as any).id as string,
    isOrganiser: isOrganiser(session),
    teamId,
    dayNumber,
    rows,
  });
}

export async function organiserUpsertPlayerDayScore(
  userId: string,
  dayNumber: number,
  score: unknown,
  slams: unknown,
  boards?: unknown,
) {
  const { session, error } = await requireSession();
  if (error || !session) return { success: false as const, error };
  if (!isOrganiser(session)) return { success: false as const, error: 'Organiser access required.' };
  const parsed = resolveScoreInput(score, slams, boards);
  if (!parsed.ok) return { success: false as const, error: parsed.error };
  const edition = await loadLatestEdition();
  if (!edition) return { success: false as const, error: 'No edition found.' };
  const player = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!player) return { success: false as const, error: 'Player not found.' };
  const stages = (await loadStageConfig(edition.id)).stages;
  const maxDay = calendarDaysInEdition(stages, edition.totalDays);
  const day = Number(dayNumber);
  if (!Number.isInteger(day) || day < 1 || day > maxDay) return { success: false as const, error: 'Invalid day.' };

  await upsertDayScore({
    editionId: edition.id,
    userId,
    dayNumber: day,
    score: parsed.score,
    slams: parsed.slams,
    boards: parsed.boards,
    enteredByUserId: (session.user as any).id,
  });
  await refreshPlayerEditionAverage(edition.id, userId, (session.user as any).id);
  revalidateScorePages();
  return { success: true };
}

export async function getOrganiserScoreDesk() {
  const { session, error } = await requireSession();
  if (error || !session) return { success: false as const, error, maxDay: 1, days: [] as any[], scores: [] as any[] };
  if (!isOrganiser(session)) return { success: false as const, error: 'Organiser access required.', maxDay: 1, days: [] as any[], scores: [] as any[] };
  const edition = await loadLatestEdition();
  if (!edition) return { success: false as const, error: 'No edition found.', maxDay: 1, days: [] as any[], scores: [] as any[] };
  const stages = (await loadStageConfig(edition.id)).stages;
  const maxDay = calendarDaysInEdition(stages, edition.totalDays);
  const rows = await prisma.playerDayScore.findMany({
    where: { editionId: edition.id },
    select: {
      userId: true,
      dayNumber: true,
      score: true,
      slams: true,
      boards: true,
      enteredByUserId: true,
    },
  });
  const entererIds = [...new Set(rows.map((r) => r.enteredByUserId).filter(Boolean))] as string[];
  const enterers = entererIds.length
    ? await prisma.user.findMany({
        where: { id: { in: entererIds } },
        select: { id: true, name: true, username: true, role: true },
      })
    : [];
  const byEnterer = new Map(enterers.map((u) => [u.id, u]));
  const days = Array.from({ length: maxDay }, (_, i) => {
    const dayNumber = i + 1;
    return {
      dayNumber,
      calendarDate: combiCalendarDate(dayNumber, edition.dayDates),
      published: isDayScorePublished(dayNumber, edition.dayDates),
    };
  });
  return {
    success: true as const,
    maxDay,
    days,
    scores: rows.map((s) => {
      const enterer = s.enteredByUserId ? byEnterer.get(s.enteredByUserId) : null;
      const source =
        !s.enteredByUserId
          ? 'Saved'
          : s.enteredByUserId === s.userId
            ? 'Player'
            : enterer?.role === 'ORGANIZER' || enterer?.role === 'SUPER_ADMIN'
              ? 'Organiser'
              : 'Captain';
      return {
        userId: s.userId,
        dayNumber: s.dayNumber,
        score: s.score,
        slams: s.slams,
        boards: normalizeBoards(s.boards, s.score, s.slams),
        source,
        enteredByName: enterer?.name || enterer?.username || null,
      };
    }),
  };
}

export async function getMyDayScoresForUser(userId: string) {
  const edition = await loadLatestEdition();
  if (!edition) {
    return {
      success: false as const,
      error: 'No edition found.',
      scores: [] as any[],
      eligibleDay: 1,
      maxDay: 1,
      windowOpen: false,
      windowReason: 'No edition found.',
      published: false,
      publishedDays: [] as Array<{ dayNumber: number; published: boolean }>,
      cutoffIso: '',
      editionTitle: '',
    };
  }
  const stages = (await loadStageConfig(edition.id)).stages;
  const maxDay = calendarDaysInEdition(stages, edition.totalDays);
  const scores = await prisma.playerDayScore.findMany({
    where: { editionId: edition.id, userId },
    orderBy: { dayNumber: 'asc' },
  });
  const hasGoneLive = await playerHasGoneLive(userId, edition.id);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { average: true, target: true } });
  const submittedDays = scores.map((s) => s.dayNumber);
  const days: Array<{
    dayNumber: number;
    windowOpen: boolean;
    windowReason: string | null;
    submitted: boolean;
  }> = [];
  for (let d = 1; d <= maxDay; d += 1) {
    const windowForDay = describeScoreWindow(d, edition.dayDates, hasGoneLive);
    days.push({
      dayNumber: d,
      windowOpen: windowForDay.windowOpen,
      windowReason: windowForDay.windowReason,
      submitted: submittedDays.includes(d),
    });
  }
  let eligibleDay =
    days.find((d) => d.windowOpen)?.dayNumber ||
    nextEligibleDay(submittedDays, maxDay);
  if (!isScoreSubmitOpen(eligibleDay, edition.dayDates)) {
    for (let d = eligibleDay - 1; d >= 1; d -= 1) {
      if (isScoreSubmitOpen(d, edition.dayDates) && submittedDays.includes(d)) {
        eligibleDay = d;
        break;
      }
    }
  }
  const window = describeScoreWindow(eligibleDay, edition.dayDates, hasGoneLive);
  const publishedFlags: Array<{ dayNumber: number; published: boolean }> = [];
  for (let d = 1; d <= maxDay; d += 1) {
    publishedFlags.push({ dayNumber: d, published: isDayScorePublished(d, edition.dayDates) });
  }
  return {
    success: true as const,
    scores: scores.map((s) => ({
      dayNumber: s.dayNumber,
      score: s.score,
      slams: s.slams,
      boards: Array.isArray((s as { boards?: unknown }).boards) ? (s as { boards: unknown }).boards : [],
    })),
    days,
    eligibleDay,
    maxDay,
    windowOpen: window.windowOpen,
    windowReason: window.windowReason,
    published: isDayScorePublished(eligibleDay, edition.dayDates),
    publishedDays: publishedFlags,
    cutoffIso: scoreCutoffIso(eligibleDay, edition.dayDates),
    editionTitle: edition.title,
    target: user?.target || 0,
    average: user?.average || 0,
  };
}

export async function getMyDayScores() {
  const { session, error } = await requireSession();
  if (error || !session) {
    return { success: false as const, error, scores: [] as any[], eligibleDay: 1, maxDay: 1, windowOpen: false };
  }
  return getMyDayScoresForUser((session.user as any).id as string);
}

export async function getTeamDayScoresForActor(
  teamId: string,
  dayNumber: number,
  actorId: string,
  isOrganiserActor: boolean,
) {
  const edition = await loadLatestEdition();
  if (!edition) return { success: false as const, error: 'No edition found.', players: [] as any[] };
  const team = await prisma.team.findFirst({
    where: { id: teamId, editionId: edition.id },
    include: {
      members: { include: { user: { select: { id: true, name: true, username: true, average: true, target: true } } } },
      spocMembers: { include: { user: { select: { id: true, name: true, username: true, average: true, target: true } } } },
    },
  });
  if (!team) return { success: false as const, error: 'Team not found.', players: [] };
  if (!isOrganiserActor && team.captainId !== actorId) {
    return { success: false as const, error: 'Captain access required.', players: [] };
  }
  const roster = [
    ...team.members.map((m) => m.user),
    ...team.spocMembers.map((m) => m.user),
  ].filter((u, idx, arr) => u && arr.findIndex((x) => x.id === u.id) === idx);
  const memberIds = roster.map((u) => u.id);
  const allScores = memberIds.length
    ? await prisma.playerDayScore.findMany({
        where: { editionId: edition.id, userId: { in: memberIds } },
        select: { userId: true, dayNumber: true, score: true, slams: true, boards: true },
      })
    : [];
  const byUserDay = new Map(allScores.filter((s) => s.dayNumber === dayNumber).map((s) => [s.userId, s]));
  const daysByUser = new Map<string, number[]>();
  for (const row of allScores) {
    const list = daysByUser.get(row.userId) || [];
    list.push(row.dayNumber);
    daysByUser.set(row.userId, list);
  }
  const avgLogs = memberIds.length
    ? await prisma.playerAverageLog.findMany({
        where: { editionId: edition.id, userId: { in: memberIds } },
        select: { userId: true, average: true, effectiveFrom: true },
      })
    : [];
  const calendarDate = combiCalendarDate(dayNumber, edition.dayDates);
  const captainWindowOpen = isCaptainScoreEditOpen(dayNumber, edition.dayDates) || isOrganiserActor;
  return {
    success: true as const,
    windowOpen: captainWindowOpen,
    playerWindowOpen: isScoreSubmitOpen(dayNumber, edition.dayDates),
    published: isDayScorePublished(dayNumber, edition.dayDates),
    cutoffIso: scoreCutoffIso(dayNumber, edition.dayDates),
    captainCutoffIso: `${calendarDate}T21:30:00+05:30`,
    players: roster.map((u) => {
      const row = byUserDay.get(u.id);
      const score = row?.score ?? null;
      const slams = row?.slams ?? null;
      const averageInEffect = averageForDay(
        logsForUser(avgLogs, u.id),
        calendarDate,
        u.average || 0,
      );
      return {
        userId: u.id,
        name: u.name || u.username,
        average: u.average,
        averageInEffect,
        target: u.target || 0,
        score,
        slams,
        boards: Array.isArray(row?.boards) ? row.boards : [],
        hasTargetBonus: previewTargetBonus(score, u.target),
        hasAvgBonus: previewTargetBonus(score, u.target),
        missingPrior: false,
      };
    }),
  };
}

export async function getTeamDayScores(teamId: string, dayNumber: number) {
  const { session, error } = await requireSession();
  if (error || !session) return { success: false as const, error, players: [] as any[] };
  return getTeamDayScoresForActor(teamId, dayNumber, (session.user as any).id as string, isOrganiser(session));
}

export async function recordPlayerAverageChange(
  userId: string,
  newAverage: number,
  changedById: string,
  applyToday = false,
) {
  const edition = await loadLatestEdition();
  if (!edition) return;
  const next = Number(newAverage);
  if (!Number.isFinite(next)) return;
  const logs = await prisma.playerAverageLog.findMany({
    where: { editionId: edition.id, userId },
    orderBy: [{ effectiveFrom: 'asc' }, { changedAt: 'asc' }],
  });
  const day1 = combiCalendarDate(1, edition.dayDates);
  const effectiveFrom = applyToday ? todayIstCalendarDate() : averageChangeEffectiveFrom();
  if (logs.length === 0) {
    await prisma.playerAverageLog.create({
      data: { editionId: edition.id, userId, average: next, effectiveFrom: day1, changedById },
    });
    revalidateScorePages();
    return;
  }
  const latest = logs[logs.length - 1];
  if (Number(latest.average) === next) return;
  const sameDate = [...logs].reverse().find((row) => row.effectiveFrom === effectiveFrom);
  if (sameDate) {
    await prisma.playerAverageLog.update({
      where: { id: sameDate.id },
      data: { average: next, changedById },
    });
  } else {
    await prisma.playerAverageLog.create({
      data: {
        editionId: edition.id,
        userId,
        average: next,
        effectiveFrom,
        changedById,
      },
    });
  }
  revalidateScorePages();
}

export async function recordPlayerTargetChange(
  userId: string,
  newTarget: number,
  changedById: string,
  applyToday = false,
) {
  const edition = await loadLatestEdition();
  if (!edition) return;
  const next = Math.round(Number(newTarget));
  if (!Number.isFinite(next)) return;
  const logs = await prisma.playerTargetLog.findMany({
    where: { editionId: edition.id, userId },
    orderBy: [{ effectiveFrom: 'asc' }, { changedAt: 'asc' }],
  });
  const day1 = combiCalendarDate(1, edition.dayDates);
  const effectiveFrom = applyToday ? todayIstCalendarDate() : averageChangeEffectiveFrom();
  if (logs.length === 0) {
    await prisma.playerTargetLog.create({
      data: { editionId: edition.id, userId, target: next, effectiveFrom: day1, changedById },
    });
    revalidateScorePages();
    return;
  }
  const latest = logs[logs.length - 1];
  if (Number(latest.target) === next) return;
  const sameDate = [...logs].reverse().find((row) => row.effectiveFrom === effectiveFrom);
  if (sameDate) {
    await prisma.playerTargetLog.update({
      where: { id: sameDate.id },
      data: { target: next, changedById },
    });
  } else {
    await prisma.playerTargetLog.create({
      data: {
        editionId: edition.id,
        userId,
        target: next,
        effectiveFrom,
        changedById,
      },
    });
  }
  revalidateScorePages();
}


const emptyScoreboard = {
  edition: null as { id: string; title: string; number: number } | null,
  days: [] as Array<{ dayNumber: number; published: boolean; calendarDate: string }>,
  teams: [] as any[],
  scores: [] as any[],
  maxDay: 1,
};

export async function getPublicScoreboard() {
  try {
    return await loadPublicScoreboard();
  } catch (error) {
    console.error('getPublicScoreboard', error);
    return emptyScoreboard;
  }
}

async function loadPublicScoreboard() {
  const edition = await loadLatestEdition();
  if (!edition) return emptyScoreboard;
  const stages = (await loadStageConfig(edition.id)).stages;
  const maxDay = calendarDaysInEdition(stages, edition.totalDays);
  const teams = await prisma.team.findMany({
    where: { editionId: edition.id, teamType: { not: 'SPOC_EXHIBITION' } },
    include: {
      members: { include: { user: { select: { id: true, name: true, username: true, average: true } } } },
    },
    orderBy: { name: 'asc' },
  });
  const scores = await prisma.playerDayScore.findMany({ where: { editionId: edition.id } });
  const days: Array<{ dayNumber: number; published: boolean; calendarDate: string }> = [];
  for (let d = 1; d <= maxDay; d += 1) {
    days.push({
      dayNumber: d,
      published: isDayScorePublished(d, edition.dayDates),
      calendarDate: combiCalendarDate(d, edition.dayDates),
    });
  }
  return {
    edition: { id: edition.id, title: edition.title, number: edition.number },
    maxDay,
    days,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      tag: t.tag,
      players: t.members
        .filter((m) => m.user)
        .map((m) => ({
          id: m.user.id,
          name: m.user.name || m.user.username,
        })),
    })),
    scores: scores.map((s) => ({ userId: s.userId, dayNumber: s.dayNumber, score: s.score, slams: s.slams })),
  };
}

export async function getPublicStandings() {
  try {
    return await loadPublicStandings();
  } catch (error) {
    console.error('getPublicStandings', error);
    return { edition: null, blocks: [] as any[], players: [] as any[], placement: [] as any[], stages: [] as any[] };
  }
}

async function loadPublicStandings() {
  const edition = await loadLatestEdition();
  if (!edition) return { edition: null, blocks: [], players: [], placement: [], stages: [] };
  const config = await loadStageConfig(edition.id);
  const maxDay = calendarDaysInEdition(config.stages, edition.totalDays);
  const teams = await prisma.team.findMany({
    where: { editionId: edition.id },
    include: {
      captain: { select: { id: true, name: true, username: true, average: true, target: true } },
      members: { include: { user: { select: { id: true, name: true, username: true, average: true, target: true } } } },
      spocMembers: { include: { user: { select: { id: true, name: true, username: true, average: true, target: true } } } },
    },
  });
  const scores = await prisma.playerDayScore.findMany({ where: { editionId: edition.id } });
  const logs = await prisma.playerAverageLog.findMany({ where: { editionId: edition.id } });
  const standingTeams = teams.map((t) => {
    const isSpoc = t.teamType === 'SPOC_EXHIBITION';
    const roster = isSpoc ? t.spocMembers : t.members;
    const byId = new Map<string, { id: string; name: string | null; average?: number | null; target?: number | null }>();
    if (t.captain) {
      byId.set(t.captain.id, {
        id: t.captain.id,
        name: t.captain.name || t.captain.username,
        average: t.captain.average,
        target: t.captain.target,
      });
    }
    for (const m of roster) {
      if (!m.user) continue;
      byId.set(m.user.id, {
        id: m.user.id,
        name: m.user.name || m.user.username,
        average: m.user.average,
        target: m.user.target,
      });
    }
    return {
      id: t.id,
      name: t.name,
      tag: t.tag,
      teamType: t.teamType,
      savedLineups: t.savedLineups,
      members: Array.from(byId.values()),
    };
  });
  const scoreRows: PlayerDayScoreRow[] = scores.map((s) => ({
    userId: s.userId,
    dayNumber: s.dayNumber,
    score: s.score,
    slams: s.slams,
    boards: (s as { boards?: unknown }).boards,
  }));
  const logRows: PlayerAverageLogRow[] = logs.map((l) => ({
    userId: l.userId,
    average: l.average,
    effectiveFrom: l.effectiveFrom,
  }));
  const pairings = pairingsFromStages(config.stages);
  const blocks = buildStageStandingBlocks({
    stages: config.stages,
    teams: standingTeams,
    scores: scoreRows,
    logs: logRows,
    pairings,
    dayDates: edition.dayDates,
  });
  const finals = blocks.find((b) => b.kind === 'FINALS');
  const placement = finals?.knockout ? placementRanking(finals.knockout) : [];
  const rosterPlayers = standingTeams
    .filter((t) => t.teamType !== 'SPOC_EXHIBITION')
    .flatMap((t) => t.members.map((m) => ({
      userId: m.id,
      name: m.name || 'Player',
      teamId: t.id,
      teamName: t.name,
      average: m.average,
      matchesWon: countEventWinsForPlayer(m.id, standingTeams, pairings, scoreRows, edition.dayDates),
    })));
  const players = rankPlayers({
    players: rosterPlayers,
    scores: scoreRows,
    logs: logRows,
    maxDay,
    dayDates: edition.dayDates,
  });
  return {
    edition: { id: edition.id, title: edition.title, number: edition.number },
    blocks,
    players,
    placement,
    stages: config.stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind })),
  };
}

export async function getAverageReviewPrompt() {
  const edition = await loadLatestEdition();
  if (!edition) return null;
  const config = await loadStageConfig(edition.id);
  return stageJustFinishedForAverageReview(config.stages, lastCompletedDay(edition.dayDates || {}));
}

export async function getEditionProfileStatsForUser(userId: string) {
  const edition = await loadLatestEdition();
  if (!edition) return { wins: 0, slams: 0, averageBonuses: 0, history: [] as any[], targetHistory: [] as any[], average: 0 };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { average: true, target: true } });
  const scores = await prisma.playerDayScore.findMany({ where: { editionId: edition.id, userId } });
  const logs = await prisma.playerAverageLog.findMany({
    where: { editionId: edition.id, userId },
    orderBy: { effectiveFrom: 'asc' },
  });
  const targetLogs = await prisma.playerTargetLog.findMany({
    where: { editionId: edition.id, userId },
    orderBy: { effectiveFrom: 'asc' },
  });
  const config = await loadStageConfig(edition.id);
  const teams = await prisma.team.findMany({
    where: { editionId: edition.id },
    include: { members: { include: { user: { select: { id: true, name: true } } } } },
  });
  const wins = countEventWinsForPlayer(
    userId,
    teams.map((t) => ({
      id: t.id,
      savedLineups: t.savedLineups,
      members: t.members.map((m) => ({ id: m.user.id, name: m.user.name })),
    })),
    pairingsFromStages(config.stages),
    scores.map((s) => ({ userId: s.userId, dayNumber: s.dayNumber, score: s.score, slams: s.slams })),
    edition.dayDates,
  );
  const stats = editionProfileStats({
    userId,
    scores: scores.map((s) => ({ userId: s.userId, dayNumber: s.dayNumber, score: s.score, slams: s.slams })),
    logs: logs.map((l) => ({ userId: l.userId, average: l.average, effectiveFrom: l.effectiveFrom })),
    fallbackAverage: user?.average || 0,
    fallbackTarget: user?.target || 0,
    dayDates: edition.dayDates,
    eventWins: wins,
  });

  const map = normalizeDayDates(edition.dayDates);
  const targetHistory = targetLogs.map((log) => {
    let dayNumber = 1;
    const entry = map ? Object.entries(map).find(([_, date]) => date === log.effectiveFrom) : null;
    if (entry) {
      dayNumber = Number(entry[0]);
    } else {
      const day1 = map?.[1] ?? OFFICIAL_DAY1_CALENDAR;
      const d1 = new Date(day1).getTime();
      const dTarget = new Date(log.effectiveFrom).getTime();
      if (Number.isFinite(d1) && Number.isFinite(dTarget)) {
        dayNumber = Math.round((dTarget - d1) / (24 * 60 * 60 * 1000)) + 1;
      }
    }
    return {
      dayNumber,
      effectiveFrom: log.effectiveFrom,
      target: log.target,
      changedAt: log.changedAt.toISOString(),
    };
  });

  if (targetHistory.length === 0 && user?.target) {
    targetHistory.push({
      dayNumber: 1,
      effectiveFrom: map?.[1] ?? OFFICIAL_DAY1_CALENDAR,
      target: user.target,
      changedAt: new Date(edition.tournamentStartDate || Date.now()).toISOString(),
    });
  }

  const standings = await loadPublicStandings();
  const playerRank = standings.players.find((p) => p.userId === userId);
  const calculatedAverage = playerRank && playerRank.boardAverage != null ? Number(playerRank.boardAverage) : (user?.average || 0);

  return {
    ...stats,
    average: calculatedAverage,
    history: logsForUser(
      logs.map((l) => ({ userId: l.userId, average: l.average, effectiveFrom: l.effectiveFrom })),
      userId,
    ),
    targetHistory,
    editionTitle: edition.title,
  };
}
