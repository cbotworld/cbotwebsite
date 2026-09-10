export const MAX_DAY_BOARDS = 10;

export type DayBoardScore = {
  score: number;
  slams: number;
};

export type BoardDraft = {
  score: string;
  slams: string;
};

export function emptyBoardDraft(): BoardDraft {
  return { score: '', slams: '0' };
}

export function boardsToDraft(boards: DayBoardScore[] | null | undefined, fallbackScore?: number | null, fallbackSlams?: number | null): BoardDraft[] {
  const normalized = normalizeBoards(boards, fallbackScore, fallbackSlams);
  if (!normalized.length) return [emptyBoardDraft()];
  return normalized.map((b) => ({ score: String(b.score), slams: String(b.slams ?? 0) }));
}

export function normalizeBoards(
  raw: unknown,
  fallbackScore?: number | null,
  fallbackSlams?: number | null,
  defaultBoardCount = 4,
): DayBoardScore[] {
  if (Array.isArray(raw) && raw.length > 0) {
    const boards: DayBoardScore[] = [];
    for (const item of raw.slice(0, MAX_DAY_BOARDS)) {
      const score = typeof item?.score === 'number' ? item.score : parseInt(String(item?.score ?? ''), 10);
      const slams = typeof item?.slams === 'number' ? item.slams : parseInt(String(item?.slams ?? 0), 10);
      const validSlam = Number.isFinite(slams) && slams > 0 ? 1 : 0;
      if (!Number.isFinite(score) || !Number.isInteger(score)) continue;
      if (validSlam === 0 && score < 0) continue;
      boards.push({
        score,
        slams: validSlam,
      });
    }
    if (boards.length > 1) return boards;
    if (boards.length === 1) {
      if (boards[0].score > 12) {
        return summaryToBoards(boards[0].score, defaultBoardCount, boards[0].slams);
      }
      return boards;
    }
  }
  if (fallbackScore == null || !Number.isFinite(Number(fallbackScore))) return [];
  return summaryToBoards(Number(fallbackScore), defaultBoardCount, Number(fallbackSlams) || 0);
}

export function aggregateBoards(boards: DayBoardScore[]) {
  return {
    score: boards.reduce((sum, b) => sum + b.score, 0),
    slams: boards.reduce((sum, b) => sum + (b.slams || 0), 0),
    boardCount: boards.length,
  };
}

export function roundAverage(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Calculates updated player average using (Current average + today's average) / 2.
 * If prior average is 0 or null, returns the day's average.
 */
export function computeUpdatedAverage(currentAverage: number | null | undefined, dayAverage: number): number {
  const current = Number(currentAverage);
  if (!Number.isFinite(current) || current <= 0) {
    return roundAverage(dayAverage);
  }
  return roundAverage((current + dayAverage) / 2);
}

/**
 * Calculates edition average across submitted days as:
 * Sum of each day's match average / Number of matches played.
 */
export function computeEditionRunningAverage(
  initialAverage: number | null | undefined,
  rows: Array<{ score: number; slams?: number; boards?: unknown; dayNumber?: number }>,
) {
  let totalScore = 0;
  let boardCount = 0;
  let dayAveragesSum = 0;
  let daysProcessed = 0;

  const sorted = [...rows].sort((a, b) => (Number(a.dayNumber) || 0) - (Number(b.dayNumber) || 0));
  for (const row of sorted) {
    const boards = normalizeBoards(row.boards, row.score, row.slams);
    const agg = aggregateBoards(boards);
    totalScore += agg.score;
    boardCount += agg.boardCount;
    if (agg.boardCount > 0) {
      const dayAvg = agg.score / agg.boardCount;
      dayAveragesSum += dayAvg;
      daysProcessed += 1;
    }
  }

  const finalAvg = daysProcessed > 0 ? roundAverage(dayAveragesSum / daysProcessed) : 0;

  return {
    totalScore,
    boardCount,
    average: finalAvg,
    daysProcessed,
  };
}

export function editionBoardAverage(rows: Array<{ score: number; slams?: number; boards?: unknown }>) {
  let totalScore = 0;
  let boardCount = 0;
  for (const row of rows) {
    const boards = normalizeBoards(row.boards, row.score, row.slams);
    const agg = aggregateBoards(boards);
    totalScore += agg.score;
    boardCount += agg.boardCount;
  }
  return {
    totalScore,
    boardCount,
    average: boardCount > 0 ? roundAverage(totalScore / boardCount) : 0,
  };
}

export function previewTargetBonus(score: number | null | undefined, target: number | null | undefined): boolean | null {
  if (score == null || !Number.isFinite(Number(score))) return null;
  const tgt = Number(target);
  if (!Number.isFinite(tgt) || tgt <= 0) return null;
  return Number(score) < tgt;
}

export function validateBoardsPayload(raw: unknown): { ok: true; boards: DayBoardScore[]; score: number; slams: number } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: 'Enter at least one board score.' };
  }
  if (raw.length > MAX_DAY_BOARDS) {
    return { ok: false, error: `Maximum ${MAX_DAY_BOARDS} boards per day.` };
  }
  const boards: DayBoardScore[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i] || {};
    const score = typeof item.score === 'number' ? item.score : parseInt(String(item.score ?? ''), 10);
    const slams = typeof item.slams === 'number' ? item.slams : parseInt(String(item.slams ?? 0), 10);
    if (!Number.isFinite(score) || !Number.isInteger(score)) {
      return { ok: false, error: `Board ${i + 1} score must be a valid whole number.` };
    }
    if (slams !== 0 && slams !== 1) {
      return { ok: false, error: `Board ${i + 1} slam must be Yes (1) or No (0).` };
    }
    if (slams === 0 && score < 0) {
      return { ok: false, error: `Board ${i + 1} score cannot be negative unless a slam is scored on that board.` };
    }
    boards.push({ score, slams });
  }
  const agg = aggregateBoards(boards);
  if (agg.slams > 50) return { ok: false, error: 'Total slams cannot exceed 50.' };
  return { ok: true, boards, score: agg.score, slams: agg.slams };
}

export function resolveScoreInput(score: unknown, slams: unknown, boards?: unknown, defaultBoardCount = 4) {
  if (boards !== undefined && boards !== null) {
    return validateBoardsPayload(boards);
  }
  const parsedScore = typeof score === 'number' ? score : parseInt(String(score ?? ''), 10);
  const parsedSlams = typeof slams === 'number' ? slams : parseInt(String(slams ?? ''), 10);
  if (!Number.isFinite(parsedScore) || !Number.isInteger(parsedScore)) {
    return { ok: false as const, error: 'Score must be a valid whole number.' };
  }
  if (!Number.isFinite(parsedSlams) || parsedSlams < 0 || !Number.isInteger(parsedSlams) || parsedSlams > 50) {
    return { ok: false as const, error: 'Slams must be a whole number between 0 and 50.' };
  }
  if (parsedSlams === 0 && parsedScore < 0) {
    return { ok: false as const, error: 'Score cannot be negative unless a slam is scored.' };
  }
  return {
    ok: true as const,
    boards: summaryToBoards(parsedScore, defaultBoardCount, parsedSlams),
    score: parsedScore,
    slams: parsedSlams,
  };
}

export function draftToPayload(drafts: BoardDraft[]) {
  return drafts.map((b) => ({
    score: b.score === '' ? NaN : parseInt(b.score, 10),
    slams: parseInt(b.slams || '0', 10),
  }));
}

export function summaryToBoards(totalScore: number, boardCount: number, slams: number): DayBoardScore[] {
  const count = Math.max(1, Math.min(MAX_DAY_BOARDS, Math.floor(boardCount) || 1));
  const score = Math.floor(totalScore) || 0;
  const totalSlams = Math.max(0, Math.min(count, Math.floor(slams) || 0));

  if (score < 0 && totalSlams > 0) {
    const baseNegative = Math.floor(score / totalSlams);
    const remainder = Math.abs(score % totalSlams);
    const boards: DayBoardScore[] = [];
    for (let i = 0; i < count; i++) {
      const isSlam = i < totalSlams ? 1 : 0;
      const boardScore = isSlam ? baseNegative - (i < remainder ? 1 : 0) : 0;
      boards.push({ score: boardScore, slams: isSlam });
    }
    return boards;
  }

  const baseScore = Math.floor(score / count);
  const remainder = score % count;

  const boards: DayBoardScore[] = [];
  for (let i = 0; i < count; i++) {
    boards.push({
      score: baseScore + (i < remainder ? 1 : 0),
      slams: i < totalSlams ? 1 : 0,
    });
  }
  return boards;
}

export function summaryToDraft(totalScore: string | number, boardCount: string | number, slams: string | number): BoardDraft[] {
  const s = typeof totalScore === 'number' ? totalScore : parseInt(String(totalScore ?? ''), 10) || 0;
  const c = typeof boardCount === 'number' ? boardCount : parseInt(String(boardCount ?? ''), 10) || 1;
  const sl = typeof slams === 'number' ? slams : parseInt(String(slams ?? ''), 10) || 0;
  const boards = summaryToBoards(s, c, sl);
  return boards.map((b) => ({ score: String(b.score), slams: String(b.slams) }));
}

