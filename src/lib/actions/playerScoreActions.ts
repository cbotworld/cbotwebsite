'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { ensureOfficialDayDates } from '@/lib/edition-day-dates';
import { memoryCache } from '@/lib/memory-cache';
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
  summaryToBoards,
  MAX_DAY_BOARDS,
  type DayBoardScore,
} from '@/lib/board-scores';
import { averageChangeEffectiveFrom, averageForDay, logsForUser } from '@/lib/player-average';
import { PUBLIC_PLAYER_SCORES_PATH, PUBLIC_STANDINGS_PATH } from '@/lib/website-cms';
import { combiCalendarDate, isCombiSubmissionLocked, normalizeDayDates, toCalendarDate, type DayDatesInput } from '@/lib/combi-cutoff';
import { buildStageStandingBlocks, pairingsFromStages, placementRanking } from '@/lib/team-standings';
import { computeEventWinsMap, countEventWinsForPlayer, editionProfileStats, rankPlayers } from '@/lib/player-ranking';
import { resolveCurrentEdition } from '@/lib/current-edition';
import { gradingSettingKey, parseGradingGrid, resolveTargetForCell } from '@/lib/grading';
import { resolveDayWalkoversAndScores, type WalkoverCalcBreakdown } from '@/lib/walkover-scoring';

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
  return loadEditionById(current.id);
}

export async function loadEditionById(editionId?: string | null) {
  if (!editionId) return null;
  return await memoryCache.getOrSet(`edition_by_id_${editionId}`, 180, async () => {
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, title: true, number: true, dayDates: true, totalDays: true, status: true, tournamentStartDate: true },
    });
    return ensureOfficialDayDates(edition);
  });
}

async function loadStageConfig(editionId: string): Promise<TournamentStageConfig> {
  return await memoryCache.getOrSet(`stage_config_${editionId}`, 180, async () => {
    const setting = await prisma.systemSetting.findUnique({ where: { key: stageConfigKey(editionId) } });
    if (!setting?.value) return { stages: [] };
    try {
      const parsed = JSON.parse(setting.value);
      return { stages: parsed.stages || [], scheduleMode: parsed.scheduleMode };
    } catch {
      return { stages: [] };
    }
  });
}

function revalidateScorePages() {
  memoryCache.invalidate('public_standings_');
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

export async function recalculateAndPopulateAveragesForEndedDays(editionId: string, effectiveScoresInput?: PlayerDayScoreRow[]) {
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { id: true, dayDates: true },
  });
  if (!edition) return;

  const scores = effectiveScoresInput || (await prisma.playerDayScore.findMany({
    where: { editionId },
    select: { userId: true, dayNumber: true, score: true, slams: true, boards: true },
    orderBy: { dayNumber: 'asc' },
  }));

  const endedScores = scores.filter((s) => isDayScorePublished(s.dayNumber, edition.dayDates));

  if (endedScores.length === 0) {
    await prisma.playerAverageLog.deleteMany({ where: { editionId } });
    const teams = await prisma.team.findMany({
      where: { editionId },
      include: { members: { select: { userId: true } }, spocMembers: { select: { userId: true } } },
    });
    const allMemberIds = [
      ...new Set(teams.flatMap((t) => [...t.members.map((m) => m.userId), ...t.spocMembers.map((m) => m.userId)])),
    ];
    if (allMemberIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: allMemberIds } },
        data: { average: 0 },
      });
    }
    return;
  }

  const userIdsWithScores = new Set(endedScores.map((s) => s.userId));
  for (const userId of userIdsWithScores) {
    const userEndedRows = endedScores.filter((s) => s.userId === userId);
    const stats = computeEditionRunningAverage(0, userEndedRows);
    if (stats.daysProcessed > 0 && stats.average > 0) {
      await prisma.user.update({ where: { id: userId }, data: { average: stats.average } });
      await recordPlayerAverageChange(userId, stats.average, 'SYSTEM', true);
    }
  }
}

async function refreshPlayerEditionAverage(editionId: string, userId: string, changedById: string) {
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { dayDates: true },
  });
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

  // Average is ONLY calculated after day end (when score cutoff is reached / published)
  const endedRows = rows.filter((r) => isDayScorePublished(r.dayNumber, edition?.dayDates));
  if (!endedRows.length) return;

  const logs = await prisma.playerAverageLog.findMany({
    where: { editionId, userId },
    orderBy: { effectiveFrom: 'asc' },
  });
  const seed = logs.length > 0 ? Number(logs[0].average) : Number(user?.average) || 0;
  const stats = computeEditionRunningAverage(seed, endedRows);
  if (stats.daysProcessed <= 0 || stats.average <= 0) return;
  await prisma.user.update({ where: { id: userId }, data: { average: stats.average } });
  await recordPlayerAverageChange(userId, stats.average, changedById, true);
}

async function userOnEditionTeamOrEnrolled(userId: string, editionId: string) {
  const [team, participant] = await Promise.all([
    prisma.team.findFirst({
      where: {
        editionId,
        OR: [
          { captainId: userId },
          { members: { some: { userId } } },
          { spocMembers: { some: { userId } } },
        ],
      },
      select: { id: true },
    }),
    prisma.editionParticipant.findFirst({
      where: { editionId, userId },
      select: { id: true },
    }),
  ]);
  return Boolean(team || participant);
}

async function playerHasGoneLive(userId: string, editionId?: string, dayNumber?: number): Promise<boolean> {
  const count = await prisma.liveStream.count({
    where: {
      playerId: userId,
      ...(editionId ? { editionId } : {}),
      ...(dayNumber ? { dayNumber } : {}),
    },
  });
  return count > 0;
}

function describeScoreWindow(day: number, dayDates: any, _hasGoneLive = true) {
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
  requestedEditionId?: string,
  slot?: 'A' | 'B',
) {
  const parsed = resolveScoreInput(score, slams, boards);
  if (!parsed.ok) return { success: false as const, error: parsed.error };
  
  let edition: any = null;
  if (requestedEditionId) {
    edition = await loadEditionById(requestedEditionId);
  } else if (slot) {
    const ref = await resolveCurrentEdition();
    if (slot === 'B') {
      const nextRef = await prisma.edition.findFirst({
        where: { slot: 'B' },
        select: { id: true },
      });
      if (nextRef) edition = await loadEditionById(nextRef.id);
    } else if (ref) {
      edition = await loadEditionById(ref.id);
    }
  }
  if (!edition) {
    edition = await loadLatestEdition();
  }
  if (!edition) return { success: false as const, error: 'No edition found.' };

  const isEligible = await userOnEditionTeamOrEnrolled(userId, edition.id);
  if (!isEligible) {
    return { success: false as const, error: 'You must be enrolled or on a team in this edition to submit a day score.' };
  }

  const stages = (await loadStageConfig(edition.id)).stages;
  const maxDay = calendarDaysInEdition(stages, edition.totalDays);
  const day = Number(dayNumber);
  if (!Number.isInteger(day) || day < 1 || day > maxDay) return { success: false as const, error: 'Invalid day.' };

  const live = await resolveCurrentEdition();
  const isAdvancePlay = edition.id !== live?.id;

  if (isAdvancePlay && stages.length === 0) {
    return { success: false as const, error: 'Tournament stages have not been scheduled yet for this edition.' };
  }

  if (isAdvancePlay) {
    // For advance tournament play: enforce strict sequence (Day 1, Day 2...)
    const priorScores = await prisma.playerDayScore.findMany({
      where: { editionId: edition.id, userId },
      select: { dayNumber: true },
    });
    const priorDays = priorScores.map((s) => s.dayNumber);
    for (let p = 1; p < day; p++) {
      if (!priorDays.includes(p)) {
        return {
          success: false as const,
          error: `Please submit scores for Day ${p} before submitting Day ${day}.`,
        };
      }
    }
  } else {
    if (!isScoreSubmitOpen(day, edition.dayDates)) {
      return {
        success: false as const,
        error: SCORE_EDIT_PLAYER_CLOSED,
      };
    }
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

export async function submitPlayerDayScore(
  dayNumber: number,
  score: unknown,
  slams: unknown,
  boards?: unknown,
  requestedEditionId?: string,
  slot?: 'A' | 'B',
) {
  const { session, error } = await requireSession();
  if (error || !session) return { success: false as const, error };
  return submitPlayerDayScoreForUser(
    (session.user as any).id as string,
    dayNumber,
    score,
    slams,
    boards,
    requestedEditionId,
    slot,
  );
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
  editionId?: string,
) {
  const { session, error } = await requireSession();
  if (error || !session) return { success: false as const, error };
  if (!isOrganiser(session)) return { success: false as const, error: 'Organiser access required.' };
  const parsed = resolveScoreInput(score, slams, boards);
  if (!parsed.ok) return { success: false as const, error: parsed.error };
  const edition = editionId ? await loadEditionById(editionId) : await loadLatestEdition();
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

export async function bulkOrganiserUpsertDayScores(opts: {
  editionId?: string;
  dayNumber?: number;
  rows: Array<{
    userId: string;
    dayNumber?: number;
    score?: number | null;
    boardCount?: number | null;
    slams?: number | null;
    isWalkover?: boolean;
  }>;
}) {
  const { session, error } = await requireSession();
  if (error || !session) return { success: false as const, error };
  if (!isOrganiser(session)) return { success: false as const, error: 'Organiser access required.' };
  const edition = opts.editionId ? await loadEditionById(opts.editionId) : await loadLatestEdition();
  if (!edition) return { success: false as const, error: 'No edition found.' };

  const stages = (await loadStageConfig(edition.id)).stages;
  const maxDay = calendarDaysInEdition(stages, edition.totalDays);

  const entererId = (session.user as any).id;
  const modifiedUserIds = new Set<string>();

  for (const row of opts.rows) {
    if (!row.userId) continue;
    const rowDay = Number(row.dayNumber || opts.dayNumber || 1);
    if (!Number.isInteger(rowDay) || rowDay < 1 || rowDay > maxDay) continue;

    if (row.isWalkover || row.score === null || row.score === undefined || isNaN(Number(row.score))) {
      // Clear/delete manual score so system walkover calculation dynamically takes effect
      await prisma.playerDayScore.deleteMany({
        where: {
          editionId: edition.id,
          userId: row.userId,
          dayNumber: rowDay,
        },
      });
      modifiedUserIds.add(row.userId);
    } else {
      const scoreVal = Math.max(0, Math.round(Number(row.score)));
      const boardCountVal = Math.max(1, Math.min(MAX_DAY_BOARDS, Math.round(Number(row.boardCount || 4))));
      const slamsVal = Math.max(0, Math.round(Number(row.slams || 0)));
      const boards = summaryToBoards(scoreVal, boardCountVal, slamsVal);

      await upsertDayScore({
        editionId: edition.id,
        userId: row.userId,
        dayNumber: rowDay,
        score: scoreVal,
        slams: slamsVal,
        boards,
        enteredByUserId: entererId,
      });
      modifiedUserIds.add(row.userId);
    }
  }

  // Refresh edition averages for all updated players
  for (const uid of modifiedUserIds) {
    await refreshPlayerEditionAverage(edition.id, uid, entererId);
  }

  revalidateScorePages();
  return { success: true as const, count: modifiedUserIds.size };
}

export async function getOrganiserScoreDesk(editionId?: string) {
  const { session, error } = await requireSession();
  if (error || !session) return { success: false as const, error, maxDay: 1, days: [] as any[], scores: [] as any[] };
  if (!isOrganiser(session)) return { success: false as const, error: 'Organiser access required.', maxDay: 1, days: [] as any[], scores: [] as any[] };
  const edition = editionId ? await loadEditionById(editionId) : await loadLatestEdition();
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
  const [gradingSetting, editionParticipants, targetLogs, editionTeams] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: gradingSettingKey(edition.id) } }),
    prisma.editionParticipant.findMany({ where: { editionId: edition.id }, select: { userId: true, category: true } }),
    prisma.playerTargetLog.findMany({ where: { editionId: edition.id }, select: { userId: true, target: true } }),
    prisma.team.findMany({
      where: { editionId: edition.id },
      include: {
        captain: { select: { id: true, name: true, username: true, average: true, target: true } },
        members: { include: { user: { select: { id: true, name: true, username: true, average: true, target: true } } } },
        spocMembers: { include: { user: { select: { id: true, name: true, username: true, average: true, target: true } } } },
      },
    }),
  ]);
  const rosterTeams = buildRosterTeams(editionTeams);
  const { userGradeMap } = await extractGradeAndTargetMaps(gradingSetting, editionParticipants, targetLogs, rosterTeams);
  const userGradeRecord = Object.fromEntries(userGradeMap.entries());

  return {
    success: true as const,
    maxDay,
    days,
    userGradeMap: userGradeRecord,
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

export async function getMyDayScoresForUser(
  userId: string,
  requestedEditionId?: string,
  slot?: 'A' | 'B',
) {
  let edition: any = null;
  if (requestedEditionId) {
    edition = await loadEditionById(requestedEditionId);
  } else if (slot) {
    if (slot === 'B') {
      const nextRef = await prisma.edition.findFirst({
        where: { slot: 'B' },
        select: { id: true },
      });
      if (nextRef) edition = await loadEditionById(nextRef.id);
    } else {
      const currentRef = await resolveCurrentEdition();
      if (currentRef) edition = await loadEditionById(currentRef.id);
    }
  }
  if (!edition) {
    edition = await loadLatestEdition();
  }

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
      editionNumber: 0,
      editionId: '',
      isAdvancePlay: false,
      isEnrolled: false,
    };
  }

  const live = await resolveCurrentEdition();
  const isAdvancePlay = edition.id !== live?.id;

  const [stagesConfig, participant, gradingSetting, editionParticipants, targetLogs, user] = await Promise.all([
    loadStageConfig(edition.id),
    prisma.editionParticipant.findFirst({
      where: { editionId: edition.id, userId },
      include: { team: { select: { id: true, name: true, tag: true } } },
    }),
    prisma.systemSetting.findUnique({ where: { key: gradingSettingKey(edition.id) } }),
    prisma.editionParticipant.findMany({ where: { editionId: edition.id, userId }, select: { userId: true, category: true } }),
    prisma.playerTargetLog.findMany({ where: { editionId: edition.id, userId }, orderBy: { effectiveFrom: 'desc' }, select: { userId: true, target: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { average: true, target: true } }),
  ]);

  const { userGradeMap, userTargetMap } = await extractGradeAndTargetMaps(gradingSetting, editionParticipants, targetLogs, []);
  const resolvedTarget = userTargetMap.get(userId) ?? 0;
  const resolvedGrade = userGradeMap.get(userId) ?? participant?.category ?? null;

  const stages = stagesConfig.stages;
  const maxDay = calendarDaysInEdition(stages, edition.totalDays);
  const scores = await prisma.playerDayScore.findMany({
    where: { editionId: edition.id, userId },
    orderBy: { dayNumber: 'asc' },
  });
  const hasGoneLive = await playerHasGoneLive(userId, edition.id);
  const submittedDays = scores.map((s) => s.dayNumber);

  const days: Array<{
    dayNumber: number;
    windowOpen: boolean;
    windowReason: string | null;
    submitted: boolean;
  }> = [];

  if (isAdvancePlay) {
    // In advance tournament, days unlock in strict sequence 1, 2, 3...
    const nextUnsubmitted = nextEligibleDay(submittedDays, maxDay);
    for (let d = 1; d <= maxDay; d += 1) {
      const isSub = submittedDays.includes(d);
      const isOpen = Boolean(participant) && (d === nextUnsubmitted || isSub);
      let reason: string | null = null;
      if (!participant) {
        reason = 'Enroll in this tournament to play advance days.';
      } else if (d > nextUnsubmitted) {
        reason = `Play and submit Day ${d - 1} first.`;
      }
      days.push({
        dayNumber: d,
        windowOpen: isOpen,
        windowReason: reason,
        submitted: isSub,
      });
    }
  } else {
    for (let d = 1; d <= maxDay; d += 1) {
      const windowForDay = describeScoreWindow(d, edition.dayDates, hasGoneLive);
      days.push({
        dayNumber: d,
        windowOpen: windowForDay.windowOpen,
        windowReason: windowForDay.windowReason,
        submitted: submittedDays.includes(d),
      });
    }
  }

  let eligibleDay = isAdvancePlay
    ? nextEligibleDay(submittedDays, maxDay)
    : (days.find((d) => d.windowOpen)?.dayNumber || nextEligibleDay(submittedDays, maxDay));

  if (!isAdvancePlay && !isScoreSubmitOpen(eligibleDay, edition.dayDates)) {
    for (let d = eligibleDay - 1; d >= 1; d -= 1) {
      if (isScoreSubmitOpen(d, edition.dayDates) && submittedDays.includes(d)) {
        eligibleDay = d;
        break;
      }
    }
  }

  const window = isAdvancePlay
    ? { windowOpen: Boolean(participant), windowReason: participant ? null : 'Enroll in this tournament to play advance days.' }
    : describeScoreWindow(eligibleDay, edition.dayDates, hasGoneLive);

  const publishedFlags: Array<{ dayNumber: number; published: boolean }> = [];
  for (let d = 1; d <= maxDay; d += 1) {
    publishedFlags.push({
      dayNumber: d,
      published: isAdvancePlay ? submittedDays.includes(d) : isDayScorePublished(d, edition.dayDates),
    });
  }

  return {
    success: true as const,
    editionId: edition.id,
    editionTitle: edition.title,
    editionNumber: edition.number,
    editionSlot: edition.slot || (isAdvancePlay ? 'B' : 'A'),
    isAdvancePlay,
    isEnrolled: Boolean(participant),
    teamId: participant?.team?.id || null,
    teamName: participant?.team?.name || (isAdvancePlay ? 'TBD (Advance Play)' : null),
    teamTag: participant?.team?.tag || (isAdvancePlay ? 'TBD' : null),
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
    published: isAdvancePlay ? submittedDays.includes(eligibleDay) : isDayScorePublished(eligibleDay, edition.dayDates),
    publishedDays: publishedFlags,
    cutoffIso: scoreCutoffIso(eligibleDay, edition.dayDates),
    target: resolvedTarget,
    grade: resolvedGrade,
    average: user?.average || 0,
  };
}

export async function getMyDayScores(requestedEditionId?: string, slot?: 'A' | 'B') {
  const { session, error } = await requireSession();
  if (error || !session) {
    return { success: false as const, error, scores: [] as any[], eligibleDay: 1, maxDay: 1, windowOpen: false };
  }
  return getMyDayScoresForUser((session.user as any).id as string, requestedEditionId, slot);
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
  const [avgLogs, targetLogs, gradingSetting, editionParticipants] = await Promise.all([
    memberIds.length
      ? prisma.playerAverageLog.findMany({
          where: { editionId: edition.id, userId: { in: memberIds } },
          select: { userId: true, average: true, effectiveFrom: true },
        })
      : [],
    memberIds.length
      ? prisma.playerTargetLog.findMany({
          where: { editionId: edition.id, userId: { in: memberIds } },
          orderBy: { effectiveFrom: 'desc' },
          select: { userId: true, target: true },
        })
      : [],
    prisma.systemSetting.findUnique({ where: { key: gradingSettingKey(edition.id) } }),
    memberIds.length
      ? prisma.editionParticipant.findMany({
          where: { editionId: edition.id, userId: { in: memberIds } },
          select: { userId: true, category: true },
        })
      : [],
  ]);

  const { userGradeMap, userTargetMap } = await extractGradeAndTargetMaps(gradingSetting, editionParticipants, targetLogs, []);

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
      const resolvedTarget = userTargetMap.get(u.id) ?? 0;
      const resolvedGrade = userGradeMap.get(u.id) ?? null;
      return {
        userId: u.id,
        name: u.name || u.username,
        average: u.average,
        averageInEffect,
        target: resolvedTarget,
        grade: resolvedGrade,
        score,
        slams,
        boards: Array.isArray(row?.boards) ? row.boards : [],
        hasTargetBonus: previewTargetBonus(score, resolvedTarget),
        hasAvgBonus: previewTargetBonus(score, resolvedTarget),
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
  targetEditionId?: string,
) {
  let edition: any = null;
  if (targetEditionId) {
    edition = await loadEditionById(targetEditionId);
  } else {
    const live = await resolveCurrentEdition();
    if (live) edition = await loadEditionById(live.id);
  }
  if (!edition) {
    edition = await loadLatestEdition();
  }
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
  targetEditionId?: string,
) {
  let edition: any = null;
  if (targetEditionId) {
    edition = await loadEditionById(targetEditionId);
  } else {
    const live = await resolveCurrentEdition();
    if (live) edition = await loadEditionById(live.id);
  }
  if (!edition) {
    edition = await loadLatestEdition();
  }
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
  streams: [] as any[],
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

function buildRosterTeams(teams: any[]) {
  return teams.map((t) => {
    const isSpoc = t.teamType === 'SPOC_EXHIBITION';
    const roster = isSpoc ? t.spocMembers || [] : t.members || [];
    const byId = new Map<string, { id: string; name: string | null; average?: number | null; target?: number | null; grade?: string | null }>();
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
      logo: t.logo,
      tag: t.tag,
      teamType: t.teamType,
      savedLineups: t.savedLineups,
      members: Array.from(byId.values()),
    };
  });
}

export async function extractGradeAndTargetMaps(
  gradingSetting: any,
  editionParticipants: any[],
  targetLogs: any[],
  teams: any[],
) {
  const latestTargetByUserId = new Map<string, number>();
  for (const log of targetLogs) {
    if (!latestTargetByUserId.has(log.userId) && log.target !== undefined && log.target !== null && Number(log.target) >= 0) {
      latestTargetByUserId.set(log.userId, Number(log.target));
    }
  }

  const gradingGrid = gradingSetting?.value ? parseGradingGrid(gradingSetting.value) : null;
  const userGradeMap = new Map<string, string>();
  const userTargetMap = new Map<string, number>();

  if (gradingGrid && Object.keys(gradingGrid.cells).length > 0) {
    const colById = new Map(gradingGrid.columns.map((c) => [c.id, c]));
    Object.entries(gradingGrid.cells).forEach(([key, userId]) => {
      const [colId, rowStr] = key.split(':');
      const col = colById.get(colId);
      const rowIndex = parseInt(rowStr, 10);
      const grade = col?.label || null;
      let target = col ? resolveTargetForCell(col, rowIndex) : null;
      if ((target === null || target === undefined || target < 0) && latestTargetByUserId.has(userId)) {
        target = latestTargetByUserId.get(userId) ?? null;
      }
      if (grade) userGradeMap.set(userId, grade);
      if (target !== null && target !== undefined) userTargetMap.set(userId, target);
    });
  }

  if (editionParticipants.length > 0) {
    for (const p of editionParticipants) {
      if (p.category && !userGradeMap.has(p.userId)) {
        userGradeMap.set(p.userId, p.category);
      }
      if (!userTargetMap.has(p.userId) && latestTargetByUserId.has(p.userId)) {
        userTargetMap.set(p.userId, latestTargetByUserId.get(p.userId)!);
      }
    }
  }

  for (const [userId, target] of latestTargetByUserId.entries()) {
    if (!userTargetMap.has(userId)) {
      userTargetMap.set(userId, target);
    }
  }

  for (const team of teams) {
    for (const member of team.members) {
      if (!userGradeMap.has(member.id) && member.grade) {
        userGradeMap.set(member.id, member.grade);
      }
    }
  }

  return { userGradeMap, userTargetMap };
}

function resolveAllEffectiveScores(
  maxDay: number,
  teams: any[],
  pairings: any[],
  existingScores: any[],
  userGradeMap: Map<string, string>,
  userTargetMap: Map<string, number>,
  dayDates?: DayDatesInput,
  now = new Date(),
) {
  const allEffectiveScores: Array<{
    userId: string;
    dayNumber: number;
    score: number;
    slams: number;
    boards?: unknown;
    isWalkover?: boolean;
    eventName?: string;
    playerGrade?: string | null;
    playerTarget?: number | null;
    breakdown?: WalkoverCalcBreakdown;
  }> = [];

  for (let d = 1; d <= maxDay; d++) {
    const isLocked = isCombiSubmissionLocked(d, dayDates, now);

    // If day is still active and not locked (before 9:30pm IST), only include actual submitted scores (no walkovers)
    if (!isLocked) {
      const dayScores = existingScores.filter((s) => s.dayNumber === d);
      for (const s of dayScores) {
        allEffectiveScores.push({
          userId: s.userId,
          dayNumber: d,
          score: s.score,
          slams: s.slams,
          boards: s.boards,
          isWalkover: false,
          playerGrade: userGradeMap.get(s.userId) || null,
          playerTarget: userTargetMap.get(s.userId) ?? null,
        });
      }
    } else {
      // Day is locked / ended (after 9:30pm IST): compute official walkovers
      const { effectiveScores } = resolveDayWalkoversAndScores({
        dayNumber: d,
        teams,
        pairings,
        existingScores,
        userGradeMap,
        userTargetMap,
      });
      allEffectiveScores.push(...effectiveScores);
    }
  }

  return allEffectiveScores;
}

async function loadPublicScoreboard() {
  const edition = await loadLatestEdition();
  if (!edition) return emptyScoreboard;

  const [
    stageSetting,
    teams,
    scores,
    gradingSetting,
    editionParticipants,
    targetLogs,
    streams,
  ] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: stageConfigKey(edition.id) } }),
    prisma.team.findMany({
      where: { editionId: edition.id, teamType: { not: 'SPOC_EXHIBITION' } },
      include: {
        captain: { select: { id: true, name: true, username: true, average: true, target: true } },
        members: { include: { user: { select: { id: true, name: true, username: true, average: true, target: true } } } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.playerDayScore.findMany({ where: { editionId: edition.id } }),
    prisma.systemSetting.findUnique({ where: { key: gradingSettingKey(edition.id) } }),
    prisma.editionParticipant.findMany({ where: { editionId: edition.id }, select: { userId: true, category: true } }),
    prisma.playerTargetLog.findMany({ where: { editionId: edition.id }, orderBy: { effectiveFrom: 'desc' }, select: { userId: true, target: true } }),
    prisma.liveStream.findMany({
      where: {
        editionId: edition.id,
        OR: [
          { youtubeUrl: { not: null } },
          { youtubeVideoId: { not: null } },
        ],
      },
      select: {
        id: true,
        playerId: true,
        dayNumber: true,
        youtubeUrl: true,
        youtubeVideoId: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  let stages: any[] = [];
  try {
    stages = stageSetting?.value ? JSON.parse(stageSetting.value).stages || [] : [];
  } catch {}

  const maxDay = calendarDaysInEdition(stages, edition.totalDays);
  const rosterTeams = buildRosterTeams(teams);
  const { userGradeMap, userTargetMap } = await extractGradeAndTargetMaps(gradingSetting, editionParticipants, targetLogs, rosterTeams);
  for (const team of rosterTeams) {
    for (const member of team.members) {
      if (userGradeMap.has(member.id)) member.grade = userGradeMap.get(member.id)!;
      if (userTargetMap.has(member.id)) member.target = userTargetMap.get(member.id)!;
    }
  }
  const pairings = pairingsFromStages(stages);
  const allEffectiveScores = resolveAllEffectiveScores(maxDay, rosterTeams, pairings, scores, userGradeMap, userTargetMap, edition.dayDates);

  const days: Array<{ dayNumber: number; published: boolean; calendarDate: string }> = [];
  for (let d = 1; d <= maxDay; d += 1) {
    days.push({
      dayNumber: d,
      published: isCombiSubmissionLocked(d, edition.dayDates),
      calendarDate: combiCalendarDate(d, edition.dayDates),
    });
  }
  return {
    edition: { id: edition.id, title: edition.title, number: edition.number },
    maxDay,
    days,
    teams: rosterTeams.map((t) => {
      const rawTeam = teams.find((raw) => raw.id === t.id);
      const capId = rawTeam?.captain?.id;
      return {
        id: t.id,
        name: t.name,
        tag: t.tag,
        captainId: capId || null,
        players: t.members.map((m) => ({
          id: m.id,
          name: m.name || 'Player',
          grade: m.grade || null,
          isCaptain: Boolean(capId && m.id === capId),
        })),
      };
    }),
    scores: allEffectiveScores,
    streams: streams || [],
  };
}

export async function getPublicStandings(editionId?: string) {
  try {
    const cacheKey = `public_standings_${editionId || 'latest'}`;
    return await memoryCache.getOrSet(cacheKey, 300, () => loadPublicStandings(editionId));
  } catch (error) {
    console.error('getPublicStandings', error);
    return { edition: null, blocks: [] as any[], players: [] as any[], placement: [] as any[], stages: [] as any[], allEditions: [] as any[] };
  }
}

export async function snapshotEditionStandings(editionId: string) {
  try {
    memoryCache.invalidate('public_standings_');
    const data = await loadPublicStandings(editionId, { skipSnapshotRead: true });
    if (data && data.edition?.id) {
      const textJson = JSON.stringify(data);
      await prisma.systemSetting.upsert({
        where: { key: `edition_${editionId}_standings_snapshot` },
        update: { value: textJson },
        create: { key: `edition_${editionId}_standings_snapshot`, value: textJson },
      });
      if (data.edition.number) {
        await prisma.systemSetting.upsert({
          where: { key: `edition_num_${data.edition.number}_standings_snapshot` },
          update: { value: textJson },
          create: { key: `edition_num_${data.edition.number}_standings_snapshot`, value: textJson },
        });
      }
    }
    return { success: true as const };
  } catch (err) {
    console.error('[snapshotEditionStandings]', err);
    return { success: false as const, error: 'Failed to snapshot standings.' };
  }
}

async function loadPublicStandings(editionId?: string, options?: { skipSnapshotRead?: boolean }) {
  let edition = editionId ? await loadEditionById(editionId) : null;
  if (!edition) {
    edition = await loadLatestEdition();
  }
  if (!edition) return { edition: null, blocks: [], players: [], placement: [], stages: [], allEditions: [] };

  const allEditionsRaw = await prisma.edition.findMany({
    where: { status: { in: ['IN_PROGRESS', 'COMPLETED', 'FINISHED', 'ARCHIVED'] } },
    orderBy: { number: 'desc' },
    select: { id: true, number: true, title: true, status: true, slot: true },
  });
  const allEditions = allEditionsRaw.map((e) => ({
    id: e.id,
    number: e.number,
    title: e.title || `Edition ${e.number}`,
    status: e.status,
    isCurrent: e.slot === 'A' || e.status === 'IN_PROGRESS',
  }));

  const isCompleted = ['COMPLETED', 'FINISHED', 'ARCHIVED'].includes(String(edition.status || '').toUpperCase());

  // If completed and permanent snapshot text exists, load directly from permanent text snapshot
  if (isCompleted && !options?.skipSnapshotRead) {
    const snapshotKey = `edition_${edition.id}_standings_snapshot`;
    const snapshotNumKey = `edition_num_${edition.number}_standings_snapshot`;
    const existing = await prisma.systemSetting.findFirst({
      where: { key: { in: [snapshotKey, snapshotNumKey] } },
    });
    if (existing?.value) {
      try {
        const parsed = JSON.parse(existing.value);
        return {
          ...parsed,
          allEditions,
        };
      } catch (e) {
        console.error('Failed to parse standings snapshot', e);
      }
    }
  }

  const [
    stageSetting,
    teams,
    scores,
    logs,
    gradingSetting,
    editionParticipants,
    targetLogs,
  ] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: stageConfigKey(edition.id) } }),
    prisma.team.findMany({
      where: { editionId: edition.id },
      include: {
        captain: { select: { id: true, name: true, username: true, average: true, target: true } },
        members: { include: { user: { select: { id: true, name: true, username: true, average: true, target: true } } } },
        spocMembers: { include: { user: { select: { id: true, name: true, username: true, average: true, target: true } } } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.playerDayScore.findMany({ where: { editionId: edition.id } }),
    prisma.playerAverageLog.findMany({ where: { editionId: edition.id } }),
    prisma.systemSetting.findUnique({ where: { key: gradingSettingKey(edition.id) } }),
    prisma.editionParticipant.findMany({ where: { editionId: edition.id }, select: { userId: true, category: true } }),
    prisma.playerTargetLog.findMany({ where: { editionId: edition.id }, orderBy: { effectiveFrom: 'desc' }, select: { userId: true, target: true } }),
  ]);

  let stages: any[] = [];
  try {
    stages = stageSetting?.value ? JSON.parse(stageSetting.value).stages || [] : [];
  } catch {}

  const maxDay = calendarDaysInEdition(stages, edition.totalDays);
  const standingTeams = buildRosterTeams(teams);
  const { userGradeMap, userTargetMap } = await extractGradeAndTargetMaps(gradingSetting, editionParticipants, targetLogs, standingTeams);
  for (const team of standingTeams) {
    for (const member of team.members) {
      if (userGradeMap.has(member.id)) member.grade = userGradeMap.get(member.id)!;
      if (userTargetMap.has(member.id)) member.target = userTargetMap.get(member.id)!;
    }
  }
  const pairings = pairingsFromStages(stages);
  const allEffectiveScores = resolveAllEffectiveScores(maxDay, standingTeams, pairings, scores, userGradeMap, userTargetMap, edition.dayDates);

  const scoreRows: PlayerDayScoreRow[] = allEffectiveScores.map((s) => ({
    userId: s.userId,
    dayNumber: s.dayNumber,
    score: s.score,
    slams: s.slams,
    boards: s.boards,
    isWalkover: s.isWalkover,
    eventName: s.eventName,
    playerGrade: s.playerGrade,
    playerTarget: s.playerTarget,
    breakdown: s.breakdown,
  }));

  const logRows: PlayerAverageLogRow[] = logs.map((l) => ({
    userId: l.userId,
    average: l.average,
    effectiveFrom: l.effectiveFrom,
  }));

  const blocks = buildStageStandingBlocks({
    stages,
    teams: standingTeams,
    scores: scoreRows,
    logs: logRows,
    pairings,
    dayDates: edition.dayDates,
  });

  const finals = blocks.find((b) => b.kind === 'FINALS');
  const placement = finals?.knockout ? placementRanking(finals.knockout) : [];

  const eventWinsMap = computeEventWinsMap(standingTeams, pairings, scoreRows, edition.dayDates, undefined, userGradeMap);

  const rosterPlayers = standingTeams
    .filter((t) => t.teamType !== 'SPOC_EXHIBITION')
    .flatMap((t) => t.members.map((m) => ({
      userId: m.id,
      name: m.name || 'Player',
      teamId: t.id,
      teamName: t.name,
      average: m.average,
      grade: userGradeMap.get(m.id) || (m as any).grade || null,
      target: userTargetMap.get(m.id) ?? null,
      matchesWon: eventWinsMap.get(m.id) || 0,
    })));

  const players = rankPlayers({
    players: rosterPlayers,
    scores: scoreRows,
    logs: logRows,
    maxDay,
    dayDates: edition.dayDates,
    pairings,
  });

  const resultPayload = {
    edition: { id: edition.id, title: edition.title, number: edition.number, status: edition.status },
    blocks,
    players,
    placement,
    stages: stages.map((s: any) => ({ id: s.id, name: s.name, kind: s.kind })),
    allEditions,
  };

  // If completed, save snapshot text to SystemSetting permanently
  if (isCompleted) {
    try {
      const textJson = JSON.stringify(resultPayload);
      await prisma.systemSetting.upsert({
        where: { key: `edition_${edition.id}_standings_snapshot` },
        update: { value: textJson },
        create: { key: `edition_${edition.id}_standings_snapshot`, value: textJson },
      });
      if (edition.number) {
        await prisma.systemSetting.upsert({
          where: { key: `edition_num_${edition.number}_standings_snapshot` },
          update: { value: textJson },
          create: { key: `edition_num_${edition.number}_standings_snapshot`, value: textJson },
        });
      }
    } catch (e) {
      console.error('Failed to auto-save standings snapshot text', e);
    }
  }

  return resultPayload;
}

export async function getAverageReviewPrompt(editionId?: string) {
  const edition = editionId ? await loadEditionById(editionId) : await loadLatestEdition();
  if (!edition) return null;
  const config = await loadStageConfig(edition.id);
  return stageJustFinishedForAverageReview(config.stages, lastCompletedDay(edition.dayDates || {}));
}

export async function getEditionProfileStatsForUser(userId: string, requestedEditionId?: string) {
  let edition: any = null;
  if (requestedEditionId) {
    edition = await loadEditionById(requestedEditionId);
  } else {
    const live = await resolveCurrentEdition();
    if (live) edition = await loadEditionById(live.id);
  }
  if (!edition) {
    edition = await loadLatestEdition();
  }
  if (!edition) return { wins: 0, slams: 0, averageBonuses: 0, history: [] as any[], targetHistory: [] as any[], average: 0, target: 0 };
  const [user, allScores, logs, targetLogs, config, teams, gradingSetting, editionParticipants] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { average: true, target: true } }),
    prisma.playerDayScore.findMany({ where: { editionId: edition.id } }),
    prisma.playerAverageLog.findMany({
      where: { editionId: edition.id, userId },
      orderBy: { effectiveFrom: 'asc' },
    }),
    prisma.playerTargetLog.findMany({
      where: { editionId: edition.id, userId },
      orderBy: { effectiveFrom: 'asc' },
    }),
    loadStageConfig(edition.id),
    prisma.team.findMany({
      where: { editionId: edition.id },
      include: { members: { include: { user: { select: { id: true, name: true, average: true, target: true } } } } },
    }),
    prisma.systemSetting.findUnique({ where: { key: gradingSettingKey(edition.id) } }),
    prisma.editionParticipant.findMany({ where: { editionId: edition.id }, select: { userId: true, category: true } }),
  ]);

  const standingTeams = buildRosterTeams(teams);
  const { userGradeMap, userTargetMap } = await extractGradeAndTargetMaps(gradingSetting, editionParticipants, targetLogs, standingTeams);
  for (const team of standingTeams) {
    for (const member of team.members) {
      if (userGradeMap.has(member.id)) member.grade = userGradeMap.get(member.id)!;
      if (userTargetMap.has(member.id)) member.target = userTargetMap.get(member.id)!;
    }
  }

  const wins = countEventWinsForPlayer(
    userId,
    standingTeams,
    pairingsFromStages(config.stages),
    allScores.map((s) => ({ userId: s.userId, dayNumber: s.dayNumber, score: s.score, slams: s.slams })),
    edition.dayDates,
    undefined,
    userGradeMap,
  );
  const userScores = allScores.filter((s) => s.userId === userId);
  const resolvedTarget = userTargetMap.get(userId) ?? 0;
  const stats = editionProfileStats({
    userId,
    scores: userScores.map((s) => ({ userId: s.userId, dayNumber: s.dayNumber, score: s.score, slams: s.slams })),
    logs: logs.map((l) => ({ userId: l.userId, average: l.average, effectiveFrom: l.effectiveFrom })),
    fallbackAverage: user?.average || 0,
    fallbackTarget: resolvedTarget,
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
      const day1 = map?.[1] ?? toCalendarDate(edition.tournamentStartDate) ?? '';
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

  if (targetHistory.length === 0 && resolvedTarget) {
    targetHistory.push({
      dayNumber: 1,
      effectiveFrom: map?.[1] ?? toCalendarDate(edition.tournamentStartDate) ?? '',
      target: resolvedTarget,
      changedAt: new Date(edition.tournamentStartDate || Date.now()).toISOString(),
    });
  }

  const standings = await getPublicStandings(edition.id);
  const playerRank = (standings.players as any[]).find((p: any) => p.userId === userId);
  const calculatedAverage = playerRank && playerRank.boardAverage != null ? Number(playerRank.boardAverage) : (user?.average || 0);

  return {
    ...stats,
    target: resolvedTarget,
    average: calculatedAverage,
    history: logsForUser(
      logs.map((l) => ({ userId: l.userId, average: l.average, effectiveFrom: l.effectiveFrom })),
      userId,
    ),
    targetHistory,
    editionTitle: edition.title,
  };
}
