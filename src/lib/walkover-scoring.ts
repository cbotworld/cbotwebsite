/**
 * Walkover Score Computation Module
 *
 * Rules:
 * When a Player A is a Walkover on Day X in an event (Single, Double, Triple, Quad):
 * 1. Player A's team must lose the event:
 *    - Singles: Player A score = Opponent score + 1
 *    - Doubles / Triples / Quads:
 *      (Sum of teammates in event + Player A score) = (Opponents total in event + 1)
 *      => Player A loss score = max(0, Opponent Team Total + 1 - Teammates Total)
 * 2. Player A score must be higher than the worst score in Player A's grade (e.g. G3):
 *    - Grade score = (Highest score among all players in Player A's grade on Day X) + 1
 * 3. Target constraint:
 *    - If Player A has a Target assigned (> 0), Player A score = Target + 1
 * 4. Ultimate Walkover Score for Player A:
 *    - Final Score = Math.max(EventLossScore, GradeWorstScore, TargetLossScore)
 */

import { parseSavedLineups, resolveRoundPlayerIds, type LineupRound, type RosterPlayer } from '@/lib/combi-results';
import { resolveEffectiveTeamCombi } from '@/lib/combi-fallback';
import { summaryToBoards } from '@/lib/board-scores';

export type WalkoverCalcParams = {
  /** Scores of teammates playing with Player A in the same event */
  teammateScores?: number[];
  /** Scores of all opponent players in the same event */
  opponentScores?: number[];
  /** All recorded scores on Day X for players sharing Player A's grade (e.g. G3) */
  gradeDayScores?: number[];
  /** Player A's assigned target for the edition/day */
  playerTarget?: number | null;
  /** Fallback score if no opponents or grade scores are available */
  fallbackScore?: number;
};

export type WalkoverCalcBreakdown = {
  eventLossScore: number;
  opponentsTotal: number;
  teammatesTotal: number;
  gradeWorstScore: number;
  gradeMaxDayScore: number | null;
  targetLossScore: number;
  finalScore: number;
  appliedConstraint: 'EVENT_LOSS' | 'GRADE_WORST' | 'TARGET_LOSS' | 'FALLBACK';
};

/**
 * Computes the complete breakdown and final walkover score for a player.
 */
export function computeWalkoverPlayerScore(params: WalkoverCalcParams): WalkoverCalcBreakdown {
  const {
    teammateScores = [],
    opponentScores = [],
    gradeDayScores = [],
    playerTarget = null,
    fallbackScore = 25,
  } = params;

  // 1. Event Loss Score
  const opponentsTotal = opponentScores.reduce((sum, s) => sum + (Number.isFinite(s) ? s : 0), 0);
  const teammatesTotal = teammateScores.reduce((sum, s) => sum + (Number.isFinite(s) ? s : 0), 0);

  let eventLossScore = 0;
  if (opponentScores.length > 0) {
    eventLossScore = Math.max(0, opponentsTotal + 1 - teammatesTotal);
  } else {
    // If opponent didn't play or event has no opponents, fallback
    eventLossScore = fallbackScore;
  }

  // 2. Grade Worst Score (In carrom, worst = highest numerical score)
  const validGradeScores = gradeDayScores.filter((s) => Number.isFinite(s) && s > 0);
  let gradeWorstScore = 0;
  let gradeMaxDayScore: number | null = null;
  if (validGradeScores.length > 0) {
    gradeMaxDayScore = Math.max(...validGradeScores);
    gradeWorstScore = gradeMaxDayScore + 1;
  }

  // 3. Target Loss Score (Must exceed target to not get bonus)
  let targetLossScore = 0;
  if (playerTarget !== null && playerTarget !== undefined && Number(playerTarget) > 0) {
    targetLossScore = Number(playerTarget) + 1;
  }

  // 4. Final Walkover Score = max of all constraints
  const finalScore = Math.max(
    eventLossScore,
    gradeWorstScore,
    targetLossScore,
    1, // Score cannot be <= 0
  );

  let appliedConstraint: WalkoverCalcBreakdown['appliedConstraint'] = 'FALLBACK';
  if (finalScore === targetLossScore && targetLossScore > 0) {
    appliedConstraint = 'TARGET_LOSS';
  } else if (finalScore === gradeWorstScore && gradeWorstScore > 0) {
    appliedConstraint = 'GRADE_WORST';
  } else if (finalScore === eventLossScore && eventLossScore > 0) {
    appliedConstraint = 'EVENT_LOSS';
  }

  return {
    eventLossScore,
    opponentsTotal,
    teammatesTotal,
    gradeWorstScore,
    gradeMaxDayScore,
    targetLossScore,
    finalScore,
    appliedConstraint,
  };
}

export type WalkoverPlayerContext = {
  userId: string;
  name: string;
  grade?: string | null;
  target?: number | null;
  dayNumber: number;
  eventName?: string;
  isWalkover: boolean;
  breakdown?: WalkoverCalcBreakdown | null;
};

/**
 * Resolves all walkover scores and their calculation breakdowns across all teams and matches for a day.
 */
export function resolveDayWalkoversAndScores(opts: {
  dayNumber: number;
  teams: Array<{
    id: string;
    savedLineups?: string | null;
    members: Array<{ id: string; name?: string | null; grade?: string | null; target?: number | null }>;
  }>;
  pairings: Array<{ dayNumber: number; team1Id: string; team2Id: string }>;
  existingScores: Array<{ userId: string; dayNumber: number; score: number; slams: number; boards?: unknown }>;
  userGradeMap?: Map<string, string>;
  userTargetMap?: Map<string, number>;
}): {
  effectiveScores: Array<{
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
  }>;
  walkoverContexts: Map<string, WalkoverPlayerContext>;
} {
  const { dayNumber, teams, pairings, existingScores, userGradeMap, userTargetMap } = opts;

  const scoreMap = new Map<string, { score: number; slams: number; boards?: unknown }>();
  for (const s of existingScores) {
    if (s.dayNumber === dayNumber) {
      scoreMap.set(s.userId, { score: s.score, slams: s.slams, boards: s.boards });
    }
  }

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const gradeScoresMap = new Map<string, number[]>();

  // Map known scores to grades
  for (const [userId, s] of scoreMap.entries()) {
    const grade = userGradeMap?.get(userId);
    if (grade && s.score > 0) {
      const list = gradeScoresMap.get(grade) || [];
      list.push(s.score);
      gradeScoresMap.set(grade, list);
    }
  }

  const dayPairings = pairings.filter((p) => p.dayNumber === dayNumber);
  const walkoverContexts = new Map<string, WalkoverPlayerContext>();
  const effectiveScores: Array<{
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

  // Track all players who played or need a score
  const processedUserIds = new Set<string>();

  for (const pair of dayPairings) {
    const t1 = teamMap.get(pair.team1Id);
    const t2 = teamMap.get(pair.team2Id);
    if (!t1 || !t2) continue;
    const combi1 = resolveEffectiveTeamCombi({ team: t1, dayNumber, userGradeMap });
    const combi2 = resolveEffectiveTeamCombi({ team: t2, dayNumber, userGradeMap });

    const rounds1: LineupRound[] = combi1.rounds || [];
    const rounds2: LineupRound[] = combi2.rounds || [];
    const maxRounds = Math.max(rounds1.length, rounds2.length);

    for (let r = 0; r < maxRounds; r++) {
      const r1 = rounds1[r];
      const r2 = rounds2[r];
      const rName =
        r1?.name ||
        r2?.name ||
        (r1?.playerIds?.length === 1 ? 'Singles' : r1?.playerIds?.length === 2 ? 'Doubles' : r1?.playerIds?.length === 3 ? 'Triples' : 'Quads') ||
        `Event ${r + 1}`;

      const t1PlayerIds: string[] = resolveRoundPlayerIds(r1, t1.members as RosterPlayer[]);
      const t2PlayerIds: string[] = resolveRoundPlayerIds(r2, t2.members as RosterPlayer[]);

      // Find players with known scores
      const t1KnownScores = t1PlayerIds
        .map((id) => scoreMap.get(id)?.score)
        .filter((s): s is number => typeof s === 'number');
      const t2KnownScores = t2PlayerIds
        .map((id) => scoreMap.get(id)?.score)
        .filter((s): s is number => typeof s === 'number');

      // Process side 1 walkovers
      for (const id of t1PlayerIds) {
        if (!scoreMap.has(id)) {
          const userObj = t1.members.find((m) => m.id === id);
          const grade = userGradeMap?.get(id) || userObj?.grade || null;
          const target = userTargetMap?.get(id) ?? userObj?.target ?? null;
          const teammateScores = t1PlayerIds
            .filter((tid) => tid !== id && scoreMap.has(tid))
            .map((tid) => scoreMap.get(tid)!.score);
          const opponentScores = t2KnownScores;
          const gradeDayScores = grade ? gradeScoresMap.get(grade) || [] : [];

          const breakdown = computeWalkoverPlayerScore({
            teammateScores,
            opponentScores,
            gradeDayScores,
            playerTarget: target,
          });

          walkoverContexts.set(id, {
            userId: id,
            name: userObj?.name || 'Player',
            grade,
            target,
            dayNumber,
            eventName: rName,
            isWalkover: true,
            breakdown,
          });

          effectiveScores.push({
            userId: id,
            dayNumber,
            score: breakdown.finalScore,
            slams: 0,
            boards: summaryToBoards(breakdown.finalScore, 4, 0),
            isWalkover: true,
            eventName: rName,
            playerGrade: grade,
            playerTarget: target,
            breakdown,
          });
          processedUserIds.add(id);
        }
      }

      // Process side 2 walkovers
      for (const id of t2PlayerIds) {
        if (!scoreMap.has(id)) {
          const userObj = t2.members.find((m) => m.id === id);
          const grade = userGradeMap?.get(id) || userObj?.grade || null;
          const target = userTargetMap?.get(id) ?? userObj?.target ?? null;
          const teammateScores = t2PlayerIds
            .filter((tid) => tid !== id && scoreMap.has(tid))
            .map((tid) => scoreMap.get(tid)!.score);
          const opponentScores = t1KnownScores;
          const gradeDayScores = grade ? gradeScoresMap.get(grade) || [] : [];

          const breakdown = computeWalkoverPlayerScore({
            teammateScores,
            opponentScores,
            gradeDayScores,
            playerTarget: target,
          });

          walkoverContexts.set(id, {
            userId: id,
            name: userObj?.name || 'Player',
            grade,
            target,
            dayNumber,
            eventName: rName,
            isWalkover: true,
            breakdown,
          });

          effectiveScores.push({
            userId: id,
            dayNumber,
            score: breakdown.finalScore,
            slams: 0,
            boards: summaryToBoards(breakdown.finalScore, 4, 0),
            isWalkover: true,
            eventName: rName,
            playerGrade: grade,
            playerTarget: target,
            breakdown,
          });
          processedUserIds.add(id);
        }
      }
    }
  }

  // Include remaining regular scores
  for (const s of existingScores) {
    if (s.dayNumber === dayNumber && !processedUserIds.has(s.userId)) {
      effectiveScores.push({
        userId: s.userId,
        dayNumber: s.dayNumber,
        score: s.score,
        slams: s.slams,
        boards: s.boards,
        playerGrade: userGradeMap?.get(s.userId) || null,
        playerTarget: userTargetMap?.get(s.userId) ?? null,
      });
      processedUserIds.add(s.userId);
    }
  }

  return { effectiveScores, walkoverContexts };
}
