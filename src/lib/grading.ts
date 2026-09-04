export type GradingTargetTier = {
  fromRow: number;
  toRow: number;
  target: number;
};

export type GradingColumn = {
  id: string;
  label: string;
  tiers?: GradingTargetTier[];
};

export type GradingGrid = {
  columns: GradingColumn[];
  rowCount: number;
  /** `${columnId}:${rowIndex}` → userId */
  cells: Record<string, string>;
};

export const DEFAULT_GRADING_GRID: GradingGrid = {
  columns: [
    { id: 'g1', label: 'G1', tiers: [] },
    { id: 'g2', label: 'G2', tiers: [] },
    { id: 'g3', label: 'G3', tiers: [] },
  ],
  rowCount: 4,
  cells: {},
};

export function gradingSettingKey(editionId: string) {
  return `edition_grading_${editionId}`;
}

export function cellKey(columnId: string, rowIndex: number) {
  return `${columnId}:${rowIndex}`;
}

function sanitizeTiers(tiers: GradingTargetTier[] | undefined, rowCount: number): GradingTargetTier[] {
  return normalizeSequentialTiers(tiers, rowCount);
}

export function normalizeSequentialTiers(
  tiers: GradingTargetTier[] | undefined,
  rowCount: number,
): GradingTargetTier[] {
  if (!Array.isArray(tiers)) return [];
  const sorted = tiers
    .map((t) => ({
      fromRow: Math.max(1, Math.round(Number(t.fromRow))),
      toRow: Math.max(1, Math.round(Number(t.toRow))),
      target: Math.round(Number(t.target)),
    }))
    .filter((t) => Number.isFinite(t.target) && t.target >= 0 && t.fromRow <= rowCount)
    .map((t) => ({ ...t, toRow: Math.min(t.toRow, rowCount) }))
    .filter((t) => t.fromRow <= t.toRow)
    .sort((a, b) => a.fromRow - b.fromRow || a.toRow - b.toRow);

  const out: GradingTargetTier[] = [];
  let coveredThrough = 0;

  for (const tier of sorted) {
    if (tier.fromRow <= coveredThrough) continue;
    out.push(tier);
    coveredThrough = tier.toRow;
  }

  return out;
}

export function parseGradingGrid(raw?: string | null): GradingGrid {
  if (!raw) {
    return {
      ...DEFAULT_GRADING_GRID,
      columns: DEFAULT_GRADING_GRID.columns.map((c) => ({ ...c, tiers: [] })),
      cells: {},
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<GradingGrid>;
    const rowCount = Math.max(1, Math.min(50, Number(parsed.rowCount) || DEFAULT_GRADING_GRID.rowCount));
    const columns = Array.isArray(parsed.columns)
      ? parsed.columns
          .filter((c) => c && typeof c.id === 'string' && typeof c.label === 'string')
          .map((c) => ({
            id: c.id,
            label: c.label.trim() || 'G?',
            tiers: sanitizeTiers(c.tiers, rowCount),
          }))
      : DEFAULT_GRADING_GRID.columns.map((c) => ({ ...c, tiers: [] }));
    const cells: Record<string, string> = {};
    if (parsed.cells && typeof parsed.cells === 'object') {
      Object.entries(parsed.cells).forEach(([key, userId]) => {
        if (typeof userId === 'string' && userId.trim()) cells[key] = userId.trim();
      });
    }
    return {
      columns: columns.length ? columns : DEFAULT_GRADING_GRID.columns.map((c) => ({ ...c, tiers: [] })),
      rowCount,
      cells,
    };
  } catch {
    return { ...DEFAULT_GRADING_GRID, columns: DEFAULT_GRADING_GRID.columns.map((c) => ({ ...c, tiers: [] })), cells: {} };
  }
}

export function nextGradeLabel(columns: GradingColumn[]) {
  const used = new Set(columns.map((c) => c.label.toUpperCase()));
  let n = columns.length + 1;
  while (used.has(`G${n}`)) n += 1;
  return `G${n}`;
}

export function resolveTargetForCell(column: GradingColumn, rowIndex: number): number | null {
  const row = rowIndex + 1;
  const tiers = column.tiers || [];
  for (const tier of tiers) {
    if (row >= tier.fromRow && row <= tier.toRow) return tier.target;
  }
  return null;
}

export function computePlayerTargetUpdates(grid: GradingGrid): Array<{ userId: string; target: number }> {
  const out: Array<{ userId: string; target: number }> = [];
  const seen = new Set<string>();

  grid.columns.forEach((col) => {
    for (let rowIndex = 0; rowIndex < grid.rowCount; rowIndex += 1) {
      const userId = grid.cells[cellKey(col.id, rowIndex)];
      if (!userId || seen.has(userId)) continue;
      const target = resolveTargetForCell(col, rowIndex);
      if (target === null || target < 0) continue;
      seen.add(userId);
      out.push({ userId, target });
    }
  });

  return out;
}

export function computePlayerGradeUpdates(grid: GradingGrid): Array<{ userId: string; grade: string }> {
  const out: Array<{ userId: string; grade: string }> = [];
  const seen = new Set<string>();

  grid.columns.forEach((col) => {
    const grade = col.label.trim() || 'G?';
    for (let rowIndex = 0; rowIndex < grid.rowCount; rowIndex += 1) {
      const userId = grid.cells[cellKey(col.id, rowIndex)];
      if (!userId || seen.has(userId)) continue;
      seen.add(userId);
      out.push({ userId, grade });
    }
  });

  return out;
}

export function assignedUserIdsFromGrid(grid: GradingGrid): Set<string> {
  return new Set(Object.values(grid.cells).filter(Boolean));
}

export function detectTiersForColumn(
  columnId: string,
  grid: GradingGrid,
  targetForUser: (userId: string) => number | null | undefined,
): GradingTargetTier[] {
  const tiers: GradingTargetTier[] = [];
  let tierStart = -1;
  let currentTarget: number | null = null;

  const flush = (endRowIndex: number) => {
    if (tierStart < 0 || currentTarget === null) return;
    tiers.push({
      fromRow: tierStart + 1,
      toRow: endRowIndex + 1,
      target: currentTarget,
    });
    tierStart = -1;
    currentTarget = null;
  };

  for (let rowIndex = 0; rowIndex < grid.rowCount; rowIndex += 1) {
    const userId = grid.cells[cellKey(columnId, rowIndex)];
    const raw = userId ? targetForUser(userId) : null;
    const target = raw !== null && raw !== undefined && Number(raw) > 0 ? Math.round(Number(raw)) : null;

    if (target === null) {
      flush(rowIndex - 1);
      continue;
    }

    if (currentTarget === target && tierStart >= 0) continue;

    flush(rowIndex - 1);
    tierStart = rowIndex;
    currentTarget = target;
  }

  flush(grid.rowCount - 1);
  return tiers;
}

export function setColumnQuickTarget(column: GradingColumn, rowCount: number, target: number): GradingColumn {
  const next = Math.round(Number(target));
  if (!Number.isFinite(next) || next <= 0) return column;
  return {
    ...column,
    tiers: [{ fromRow: 1, toRow: rowCount, target: next }],
  };
}

export function isUniformColumnTarget(tiers: GradingTargetTier[] | undefined, rowCount: number): boolean {
  if (!tiers?.length) return true;
  return tiers.length === 1 && tiers[0].fromRow === 1 && tiers[0].toRow >= rowCount;
}

export function uniformTargetValue(tiers: GradingTargetTier[] | undefined, rowCount: number): number | null {
  if (!tiers?.length || !isUniformColumnTarget(tiers, rowCount)) return null;
  return tiers[0].target;
}

export function formatTiersAsRangeString(tiers: GradingTargetTier[]): string {
  return (tiers || [])
    .map((t) => (t.fromRow === t.toRow ? `${t.fromRow}=${t.target}` : `${t.fromRow}-${t.toRow}=${t.target}`))
    .join(', ');
}

export type SplitDraft = { fromRow: number; toRow: number; target: string };

export function tiersToSplitDrafts(tiers: GradingTargetTier[]): SplitDraft[] {
  return (tiers || []).map((t) => ({
    fromRow: t.fromRow,
    toRow: t.toRow,
    target: String(t.target),
  }));
}

export function defaultSplitDrafts(rowCount: number, tiers?: GradingTargetTier[]): SplitDraft[] {
  const normalized = normalizeSequentialTiers(tiers, rowCount);
  if (normalized.length && !isUniformColumnTarget(normalized, rowCount)) {
    return tiersToSplitDrafts(normalized);
  }
  const target = normalized[0]?.target ? String(normalized[0].target) : '';
  return [{ fromRow: 1, toRow: rowCount, target }];
}

export function getSplitEndOptions(fromRow: number, rowCount: number): number[] {
  if (rowCount <= 0) return [];
  const start = Math.max(1, Math.min(fromRow, rowCount));
  const opts: number[] = [];
  for (let r = start; r <= rowCount; r += 1) opts.push(r);
  return opts.length ? opts : [rowCount];
}

export function extendTiersWhenRowsAdded(
  tiers: GradingTargetTier[] | undefined,
  oldRowCount: number,
  newRowCount: number,
): GradingTargetTier[] | undefined {
  if (!tiers?.length || newRowCount <= oldRowCount) return tiers;

  const next = normalizeSequentialTiers(tiers, oldRowCount);
  if (!next.length) return tiers;

  if (isUniformColumnTarget(next, oldRowCount)) {
    return [{ ...next[0], toRow: newRowCount }];
  }

  const last = next[next.length - 1];
  if (last.toRow !== oldRowCount) {
    return normalizeSequentialTiers(next, newRowCount);
  }

  for (let row = oldRowCount + 1; row <= newRowCount; row += 1) {
    const target = Math.max(1, Math.round(Number(next[next.length - 1].target)) + 1);
    next.push({ fromRow: row, toRow: row, target });
  }

  return next;
}

export function shrinkTiersWhenRowsRemoved(
  tiers: GradingTargetTier[] | undefined,
  oldRowCount: number,
  newRowCount: number,
): GradingTargetTier[] | undefined {
  if (!tiers?.length || newRowCount >= oldRowCount) return tiers;

  let next = normalizeSequentialTiers(tiers, oldRowCount);

  while (next.length > 0) {
    const last = next[next.length - 1];
    if (last.fromRow > newRowCount) {
      next.pop();
      continue;
    }
    if (last.fromRow === last.toRow && last.toRow === oldRowCount) {
      next.pop();
      break;
    }
    if (last.toRow > newRowCount) {
      next[next.length - 1] = { ...last, toRow: newRowCount };
    }
    break;
  }

  if (next.length === 1 && isUniformColumnTarget(next, oldRowCount)) {
    return [{ ...next[0], toRow: newRowCount }];
  }

  return normalizeSequentialTiers(next, newRowCount);
}

export function removeSplitAt(splits: SplitDraft[], index: number): SplitDraft[] {
  if (index <= 0 || index >= splits.length) return splits;
  return splits.slice(0, index);
}

export function setSplitEndRow(
  splits: SplitDraft[],
  index: number,
  newEnd: number,
  rowCount: number,
): SplitDraft[] {
  const fromRow = index === 0 ? 1 : splits[index].fromRow;
  const options = getSplitEndOptions(fromRow, rowCount);
  const toRow = options.includes(newEnd) ? newEnd : options[options.length - 1];

  const next = splits.slice(0, index).concat([{ ...splits[index], fromRow, toRow }]);

  if (toRow >= rowCount) return next;

  const nextStart = toRow + 1;
  next.push({ fromRow: nextStart, toRow: rowCount, target: '' });
  return next;
}

export function splitDraftsToTiers(
  splits: SplitDraft[],
  rowCount: number,
): { ok: true; tiers: GradingTargetTier[] } | { ok: false; error: string } {
  if (!splits.length) return { ok: true, tiers: [] };
  const last = splits[splits.length - 1];
  if (last.toRow !== rowCount) {
    return { ok: false, error: `Select row ${rowCount} on the last split` };
  }

  const tiers: GradingTargetTier[] = [];
  for (const split of splits) {
    const target = Math.round(Number(split.target));
    if (!Number.isFinite(target) || target < 0) {
      return { ok: false, error: 'Enter target for each split' };
    }
    tiers.push({ fromRow: split.fromRow, toRow: split.toRow, target });
  }
  const normalized = normalizeSequentialTiers(tiers, rowCount);
  if (normalized.length !== tiers.length) {
    return { ok: false, error: 'Splits cannot overlap rows' };
  }
  const lastNorm = normalized[normalized.length - 1];
  if (!lastNorm || lastNorm.toRow !== rowCount) {
    return { ok: false, error: `Select row ${rowCount} on the last split` };
  }
  return { ok: true, tiers: normalized };
}

export type ParseTargetRangeResult =
  | { ok: true; tiers: GradingTargetTier[] }
  | { ok: false; error: string };

export function parseTargetRangeString(input: string, rowCount: number): ParseTargetRangeResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, tiers: [] };

  const parts = trimmed
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const tiers: GradingTargetTier[] = [];
  const usedRows = new Set<number>();

  for (const part of parts) {
    const match = part.match(/^(\d+)\s*(?:-\s*(\d+))?\s*=\s*(\d+)$/);
    if (!match) {
      return { ok: false, error: `Invalid: "${part}". Use 1-3=10 or 5=12` };
    }
    const fromRow = parseInt(match[1], 10);
    const toRow = match[2] ? parseInt(match[2], 10) : fromRow;
    const target = parseInt(match[3], 10);

    if (!Number.isFinite(fromRow) || !Number.isFinite(toRow) || !Number.isFinite(target)) {
      return { ok: false, error: `Invalid numbers in "${part}"` };
    }
    if (fromRow < 1 || toRow > rowCount || fromRow > toRow) {
      return { ok: false, error: `Rows must be between 1 and ${rowCount}` };
    }
    if (target < 0) {
      return { ok: false, error: `Target cannot be negative in "${part}"` };
    }

    for (let r = fromRow; r <= toRow; r += 1) {
      if (usedRows.has(r)) {
        return { ok: false, error: `Row ${r} appears in more than one range` };
      }
      usedRows.add(r);
    }

    tiers.push({ fromRow, toRow, target });
  }

  tiers.sort((a, b) => a.fromRow - b.fromRow || a.toRow - b.toRow);
  return { ok: true, tiers };
}

export function formatColumnTargetSummary(column: GradingColumn, rowCount?: number): string {
  const tiers = column.tiers || [];
  if (!tiers.length) return '';
  if (rowCount !== undefined && isUniformColumnTarget(tiers, rowCount)) {
    return `All → ${tiers[0].target}`;
  }
  return formatTiersAsRangeString(tiers).replace(/, /g, ' · ');
}

export type CountSplit = { count: number; target: number };

export function tiersFromCountSplits(splits: CountSplit[], rowCount: number): GradingTargetTier[] {
  let row = 1;
  const tiers: GradingTargetTier[] = [];
  splits.forEach((split) => {
    const count = Math.max(0, Math.round(Number(split.count)));
    const target = Math.round(Number(split.target));
    if (count <= 0 || target < 0 || row > rowCount) return;
    const toRow = Math.min(rowCount, row + count - 1);
    tiers.push({ fromRow: row, toRow, target });
    row = toRow + 1;
  });
  return tiers;
}

export function countSplitsFromTiers(tiers: GradingTargetTier[]): CountSplit[] {
  return (tiers || []).map((t) => ({
    count: Math.max(1, t.toRow - t.fromRow + 1),
    target: t.target,
  }));
}

export function nextTierSuggestion(column: GradingColumn, rowCount: number): GradingTargetTier {
  const tiers = column.tiers || [];
  if (!tiers.length) {
    return { fromRow: 1, toRow: Math.min(3, rowCount), target: 7 };
  }
  const last = tiers[tiers.length - 1];
  const fromRow = Math.min(rowCount, last.toRow + 1);
  const toRow = Math.min(rowCount, fromRow + 2);
  return { fromRow, toRow: Math.max(fromRow, toRow), target: last.target };
}

export function sanitizeGradingGrid(grid: GradingGrid): GradingGrid {
  const rowCount = Math.max(1, Math.min(50, grid.rowCount));
  const columns = grid.columns.slice(0, 20).map((c) => ({
    id: c.id,
    label: c.label.trim() || 'G?',
    tiers: sanitizeTiers(c.tiers, rowCount),
  }));
  const validColIds = new Set(columns.map((c) => c.id));
  const seenUsers = new Set<string>();
  const cells: Record<string, string> = {};

  Object.entries(grid.cells).forEach(([key, userId]) => {
    const [colId, rowStr] = key.split(':');
    const rowIndex = parseInt(rowStr, 10);
    if (!validColIds.has(colId) || !Number.isFinite(rowIndex) || rowIndex < 0 || rowIndex >= rowCount) return;
    if (!userId || seenUsers.has(userId)) return;
    seenUsers.add(userId);
    cells[cellKey(colId, rowIndex)] = userId;
  });

  return { columns, rowCount, cells };
}
