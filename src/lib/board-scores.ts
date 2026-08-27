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
): DayBoardScore[] {
  if (Array.isArray(raw) && raw.length > 0) {
    const boards: DayBoardScore[] = [];
    for (const item of raw.slice(0, MAX_DAY_BOARDS)) {
      const score = typeof item?.score === 'number' ? item.score : parseInt(String(item?.score ?? ''), 10);
      const slams = typeof item?.slams === 'number' ? item.slams : parseInt(String(item?.slams ?? 0), 10);
      if (!Number.isFinite(score) || score < 0 || !Number.isInteger(score)) continue;
      boards.push({
        score,
        slams: Number.isFinite(slams) && slams >= 0 ? slams : 0,
      });
    }
    if (boards.length) return boards;
  }
  if (fallbackScore == null || !Number.isFinite(Number(fallbackScore))) return [];
  return [{ score: Number(fallbackScore), slams: Number(fallbackSlams) || 0 }];
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
 * Calculates progressive edition average across submitted days in order using
 * (Current average + that day's average) / 2 for each day.
 */
export function computeEditionRunningAverage(
  initialAverage: number | null | undefined,
  rows: Array<{ score: number; slams?: number; boards?: unknown; dayNumber?: number }>,
) {
  let totalScore = 0;
  let boardCount = 0;
  const initial = Number(initialAverage);
  let running = Number.isFinite(initial) && initial > 0 ? initial : 0;
  let daysProcessed = 0;

  const sorted = [...rows].sort((a, b) => (Number(a.dayNumber) || 0) - (Number(b.dayNumber) || 0));
  for (const row of sorted) {
    const boards = normalizeBoards(row.boards, row.score, row.slams);
    const agg = aggregateBoards(boards);
    totalScore += agg.score;
    boardCount += agg.boardCount;
    if (agg.boardCount > 0) {
      const dayAvg = agg.score / agg.boardCount;
      if (running > 0) {
        running = roundAverage((running + dayAvg) / 2);
      } else {
        running = roundAverage(dayAvg);
      }
      daysProcessed += 1;
    }
  }

  return {
    totalScore,
    boardCount,
    average: running > 0 ? running : 0,
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
    if (!Number.isFinite(score) || score < 0 || !Number.isInteger(score)) {
      return { ok: false, error: `Board ${i + 1} score must be a whole number of 0 or more.` };
    }
    if (slams !== 0 && slams !== 1) {
      return { ok: false, error: `Board ${i + 1} slam must be Yes (1) or No (0).` };
    }
    boards.push({ score, slams });
  }
  const agg = aggregateBoards(boards);
  if (agg.slams > 50) return { ok: false, error: 'Total slams cannot exceed 50.' };
  return { ok: true, boards, score: agg.score, slams: agg.slams };
}

export function resolveScoreInput(score: unknown, slams: unknown, boards?: unknown) {
  if (boards !== undefined && boards !== null) {
    return validateBoardsPayload(boards);
  }
  const parsedScore = typeof score === 'number' ? score : parseInt(String(score ?? ''), 10);
  const parsedSlams = typeof slams === 'number' ? slams : parseInt(String(slams ?? ''), 10);
  if (!Number.isFinite(parsedScore) || parsedScore < 0 || !Number.isInteger(parsedScore)) {
    return { ok: false as const, error: 'Score must be a whole number of 0 or more.' };
  }
  if (!Number.isFinite(parsedSlams) || parsedSlams < 0 || !Number.isInteger(parsedSlams) || parsedSlams > 50) {
    return { ok: false as const, error: 'Slams must be a whole number between 0 and 50.' };
  }
  return {
    ok: true as const,
    boards: [{ score: parsedScore, slams: parsedSlams }],
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
