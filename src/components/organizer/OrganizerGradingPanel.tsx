'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  GraduationCap,
  Plus,
  Minus,
  Save,
  Loader2,
  Search,
  X,
  Users,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Grid3X3,
  Target,
  Sparkles,
  Download,
  Image as ImageIcon,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getEditionGrading, saveEditionGrading } from '@/lib/actions/gradingActions';
import {
  cellKey,
  defaultSplitDrafts,
  extendTiersWhenRowsAdded,
  formatColumnTargetSummary,
  getSplitEndOptions,
  isUniformColumnTarget,
  nextGradeLabel,
  resolveTargetForCell,
  sanitizeGradingGrid,
  removeSplitAt,
  setSplitEndRow,
  shrinkTiersWhenRowsRemoved,
  splitDraftsToTiers,
  uniformTargetValue,
  type GradingColumn,
  type GradingGrid,
  type GradingTargetTier,
  type SplitDraft,
} from '@/lib/grading';

const noSpinner =
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

export type PlayerLite = {
  id: string;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  target?: number | null;
  average?: number | null;
};

export type EnrolledParticipantLite = {
  id?: string;
  userId: string;
  gradeAverage?: number | null;
  gradeAverageLocked?: boolean;
  user?: {
    id: string;
    name?: string | null;
    username?: string | null;
    average?: number | null;
    target?: number | null;
    role?: string | null;
  } | null;
};

export function getGradeAverageForUser(
  user: PlayerLite,
  participantMap: Map<string, EnrolledParticipantLite>,
): number | null {
  const p = participantMap.get(user.id);
  if (p && p.gradeAverage !== undefined && p.gradeAverage !== null && Number(p.gradeAverage) > 0) {
    return Number(p.gradeAverage);
  }
  if (p?.user?.average !== undefined && p.user.average !== null && Number(p.user.average) > 0) {
    return Number(p.user.average);
  }
  if (user.average !== undefined && user.average !== null && Number(user.average) > 0) {
    return Number(user.average);
  }
  return null;
}

export function sortPlayersForGrading(
  players: PlayerLite[],
  participantMap: Map<string, EnrolledParticipantLite>,
): PlayerLite[] {
  return [...players].sort((a, b) => {
    const aVal = getGradeAverageForUser(a, participantMap);
    const bVal = getGradeAverageForUser(b, participantMap);
    const aMissing = aVal === null;
    const bMissing = bVal === null;
    if (aMissing && bMissing) return (a.name || a.username || '').localeCompare(b.name || b.username || '');
    if (aMissing) return 1;
    if (bMissing) return -1;
    if (aVal === bVal) return (a.name || a.username || '').localeCompare(b.name || b.username || '');
    return (aVal || 0) - (bVal || 0);
  });
}

function playerLabel(user?: PlayerLite | null) {
  if (!user) return 'Unknown';
  return user.name?.trim() || user.username || 'Player';
}

function ColumnTargetControl({
  column,
  rowCount,
  onChange,
}: {
  column: GradingColumn;
  rowCount: number;
  onChange: (tiers: GradingTargetTier[]) => void;
}) {
  const [splitOpen, setSplitOpen] = React.useState(false);
  const [splitDrafts, setSplitDrafts] = React.useState<SplitDraft[]>([]);
  const [splitError, setSplitError] = React.useState<string | null>(null);
  const [uniformDraft, setUniformDraft] = React.useState('');
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const tiers = column.tiers || [];
  const isUniform = isUniformColumnTarget(tiers, rowCount);
  const uniformValue = uniformTargetValue(tiers, rowCount);
  const splitSummary = isUniform ? '' : formatColumnTargetSummary(column, rowCount);

  React.useEffect(() => {
    setUniformDraft(uniformValue !== null ? String(uniformValue) : '');
  }, [uniformValue, column.id]);

  const wasSplitOpen = React.useRef(false);
  React.useEffect(() => {
    if (splitOpen && !wasSplitOpen.current) {
      setSplitDrafts(defaultSplitDrafts(rowCount, tiers));
      setSplitError(null);
    }
    wasSplitOpen.current = splitOpen;
  }, [splitOpen, tiers, rowCount]);

  React.useEffect(() => {
    if (!splitOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setSplitOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [splitOpen]);

  const applyUniform = (raw: string) => {
    const target = Math.round(Number(raw));
    if (!raw.trim()) {
      onChange([]);
      return;
    }
    if (!Number.isFinite(target) || target < 0) return;
    onChange([{ fromRow: 1, toRow: rowCount, target }]);
  };

  const applySplit = () => {
    const parsed = splitDraftsToTiers(splitDrafts, rowCount);
    if (!parsed.ok) {
      setSplitError(parsed.error);
      return;
    }
    onChange(parsed.tiers);
    setSplitOpen(false);
    setSplitError(null);
  };

  const updateSplitEnd = (index: number, newEnd: number) => {
    setSplitDrafts((prev) => setSplitEndRow(prev, index, newEnd, rowCount));
    setSplitError(null);
  };

  const updateSplitTarget = (index: number, target: string) => {
    setSplitDrafts((prev) => prev.map((s, i) => (i === index ? { ...s, target } : s)));
    setSplitError(null);
  };

  const removeSplit = (index: number) => {
    setSplitDrafts((prev) => removeSplitAt(prev, index));
    setSplitError(null);
  };

  return (
    <div ref={wrapRef} className="relative mt-1.5 space-y-1">
      {isUniform ? (
        <div className="flex items-center gap-1.5">
          <Target className="h-3 w-3 shrink-0 text-violet-400" />
          <Input
            type="text"
            inputMode="numeric"
            value={uniformDraft}
            onChange={(e) => setUniformDraft(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={() => applyUniform(uniformDraft)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyUniform(uniformDraft);
            }}
            placeholder="Target"
            className={`h-7 flex-1 min-w-0 px-2 text-center text-[11px] font-bold border-violet-500/30 ${noSpinner}`}
          />
          {rowCount > 1 ? (
            <button
              type="button"
              onClick={() => setSplitOpen(true)}
              className="shrink-0 text-[9px] font-bold text-muted-foreground hover:text-amber-400 underline underline-offset-2"
            >
              Split
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setSplitOpen(true)}
          className="w-full rounded-md border border-violet-500/35 bg-violet-500/10 px-2 py-1.5 text-left text-[10px] font-bold text-violet-200 hover:bg-violet-500/15"
        >
          <span className="inline-flex items-start gap-1 w-full">
            <Target className="h-3 w-3 shrink-0 mt-0.5" />
            <span className="truncate leading-snug">{splitSummary}</span>
          </span>
        </button>
      )}

      {splitOpen ? (
        <div className="absolute left-1/2 z-50 mt-1 w-[min(300px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-border bg-card p-3 shadow-2xl shadow-black/50 text-left">
          <p className="text-xs font-extrabold text-foreground mb-2">{column.label} · rows 1–{rowCount}</p>

          <div className="space-y-2">
            {splitDrafts.map((split, index) => {
              const endOptions = getSplitEndOptions(split.fromRow, rowCount);
              const isLast = index === splitDrafts.length - 1;
              return (
                <div key={`${column.id}-split-${index}`} className="flex items-center gap-1.5">
                  <Select
                    value={String(split.fromRow)}
                    disabled
                    className="h-8 w-11 px-1 text-center text-[11px] font-bold opacity-80"
                  >
                    <option value={split.fromRow}>{split.fromRow}</option>
                  </Select>
                  <span className="text-[10px] text-muted-foreground">–</span>
                  <Select
                    value={String(split.toRow)}
                    onChange={(e) => updateSplitEnd(index, parseInt(e.target.value, 10))}
                    disabled={!isLast}
                    className="h-8 w-11 px-1 text-center text-[11px] font-bold"
                  >
                    {endOptions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={split.target}
                    onChange={(e) => updateSplitTarget(index, e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="Target"
                    className={`h-8 w-16 px-2 text-center text-[11px] font-bold ${noSpinner}`}
                  />
                  {index > 0 ? (
                    <button
                      type="button"
                      onClick={() => removeSplit(index)}
                      className="rounded p-1 text-muted-foreground hover:bg-rose-500/15 hover:text-rose-400"
                      aria-label="Remove split"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {splitError ? <p className="mt-2 text-[10px] font-semibold text-rose-400">{splitError}</p> : null}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
            <button
              type="button"
              onClick={() => {
                onChange([]);
                setSplitOpen(false);
                setSplitError(null);
              }}
              className="text-[10px] font-semibold text-muted-foreground hover:text-rose-400"
            >
              Clear
            </button>
            <div className="flex items-center gap-1.5">
              <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => setSplitOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" className="h-7 text-[10px] font-bold px-3" onClick={applySplit}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlayerCellPicker({
  value,
  players,
  assignedElsewhere,
  cellTarget,
  participantMap,
  onSelect,
  onClear,
}: {
  value: string | null;
  players: PlayerLite[];
  assignedElsewhere: Set<string>;
  cellTarget: number | null;
  participantMap?: Map<string, EnrolledParticipantLite>;
  onSelect: (userId: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [panelStyle, setPanelStyle] = React.useState<React.CSSProperties>({});
  const [mounted, setMounted] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const selected = players.find((p) => p.id === value) || null;

  const searchQuery = query.trim().toLowerCase();

  const matchingPlayers = React.useMemo(() => {
    if (!searchQuery) return [];
    return players.filter((p) => {
      if (assignedElsewhere.has(p.id) && p.id !== value) return false;
      const hay = `${p.name || ''} ${p.username || ''}`.toLowerCase();
      return hay.includes(searchQuery);
    });
  }, [players, searchQuery, assignedElsewhere, value]);

  const selectableOptions = matchingPlayers.slice(0, 3);
  const hasMoreMatches = matchingPlayers.length > 3;

  React.useEffect(() => setMounted(true), []);

  const updatePanelPosition = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 272);
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const flip = spaceBelow < 140 && spaceAbove > spaceBelow;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));

    setPanelStyle({
      position: 'fixed',
      left,
      width,
      top: flip ? rect.top - gap : rect.bottom + gap,
      transform: flip ? 'translateY(-100%)' : undefined,
      zIndex: 9999,
    });
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
    searchRef.current?.focus({ preventScroll: true });
    window.addEventListener('scroll', updatePanelPosition, true);
    window.addEventListener('resize', updatePanelPosition);
    return () => {
      window.removeEventListener('scroll', updatePanelPosition, true);
      window.removeEventListener('resize', updatePanelPosition);
    };
  }, [open, updatePanelPosition]);

  React.useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    setQuery('');
  }, [open]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const togglePicker = () => {
    setOpen((v) => !v);
  };

  const pickPlayer = (userId: string) => {
    onSelect(userId);
    setOpen(false);
    setQuery('');
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (!selectableOptions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % selectableOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + selectableOptions.length) % selectableOptions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = selectableOptions[activeIndex];
      if (pick) pickPlayer(pick.id);
    }
  };

  const dropdown = open && mounted ? (
    <div
      ref={panelRef}
      style={panelStyle}
      className="fixed z-[9999] rounded-xl border border-amber-500/30 bg-card shadow-2xl shadow-black/60 overflow-hidden"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="border-b border-border/60 bg-muted/30 px-2 py-1.5">
        <Input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Type name to search…"
          className="h-8 text-xs border-amber-500/25"
        />
      </div>
      <div ref={listRef} className="grading-player-list overflow-y-auto overscroll-contain max-h-[108px]">
        {!searchQuery ? (
          <p className="px-3 py-2 text-xs text-muted-foreground text-center">Type to search players</p>
        ) : selectableOptions.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground text-center">No players found</p>
        ) : (
          <>
            {selectableOptions.map((p, index) => {
              const isActive = index === activeIndex;
              const avg = participantMap ? getGradeAverageForUser(p, participantMap) : (p.average != null && Number(p.average) > 0 ? Number(p.average) : null);
              return (
                <button
                  key={p.id}
                  type="button"
                  data-active={isActive ? 'true' : undefined}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => pickPlayer(p.id)}
                  className={`w-full text-left px-3 py-2 text-[11px] font-semibold border-b border-border/20 last:border-0 transition-colors ${
                    isActive ? 'bg-amber-500/20 text-amber-100' : 'hover:bg-amber-500/10 text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 w-full min-w-0">
                    <span className="truncate font-bold">{playerLabel(p)}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {avg !== null ? (
                        <span className="font-mono text-[9px] font-extrabold text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20">
                          G.Avg {avg.toFixed(1)}
                        </span>
                      ) : null}
                      {p.target !== null && p.target !== undefined && Number(p.target) >= 0 ? (
                        Number(p.target) > 0 ? (
                          <span className="shrink-0 font-mono text-[9px] font-bold text-violet-400 bg-violet-500/10 px-1 py-0.5 rounded border border-violet-500/20">
                            Target {p.target}
                          </span>
                        ) : (
                          <span className="shrink-0 font-mono text-[9px] font-bold text-muted-foreground bg-muted/40 px-1 py-0.5 rounded border border-border/40">
                            No target
                          </span>
                        )
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
            {hasMoreMatches ? (
              <p className="px-3 py-1.5 text-[10px] text-center text-muted-foreground">Type more to narrow results</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  ) : null;

  const targetToDisplay =
    cellTarget !== null && cellTarget !== undefined && Number(cellTarget) >= 0
      ? cellTarget
      : selected?.target !== null && selected?.target !== undefined && Number(selected.target) >= 0
        ? Number(selected.target)
        : null;

  const gradeAvg = selected
    ? (participantMap
        ? getGradeAverageForUser(selected, participantMap)
        : (selected.average != null && Number(selected.average) > 0 ? Number(selected.average) : null))
    : null;

  return (
    <div ref={wrapRef} className="relative min-w-[140px]">
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={togglePicker}
        className={`w-full text-left rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
          selected
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
            : 'border-border/70 bg-background/80 text-muted-foreground hover:border-amber-500/40 hover:bg-amber-500/5'
        }`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <div className="truncate leading-tight font-bold text-foreground">
              {selected ? playerLabel(selected) : 'Select player…'}
            </div>
            {selected ? (
              <div className="flex items-center gap-1.5 flex-wrap mt-1 leading-tight">
                {gradeAvg !== null ? (
                  <span className="text-[9.5px] font-extrabold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30 font-mono">
                    G.Avg {gradeAvg.toFixed(1)}
                  </span>
                ) : (
                  <span className="text-[9.5px] font-medium text-muted-foreground">
                    No G.Avg
                  </span>
                )}
                {targetToDisplay !== null ? (
                  targetToDisplay > 0 ? (
                    <span className="text-[9.5px] font-bold text-violet-300">Target {targetToDisplay}</span>
                  ) : (
                    <span className="text-[9.5px] font-medium text-muted-foreground">No target</span>
                  )
                ) : null}
              </div>
            ) : null}
          </div>
          {selected ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
                setOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onClear();
                  setOpen(false);
                }
              }}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-rose-500/20 hover:text-rose-400"
              aria-label="Clear player"
            >
              <X className="h-3 w-3" />
            </span>
          ) : (
            <Search className="h-3 w-3 shrink-0 opacity-60" />
          )}
        </div>
      </button>

      {dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  );
}

export default function OrganizerGradingPanel({
  editionId,
  editionTitle,
  users,
  enrolledUserIds,
  participants,
}: {
  editionId: string | null;
  editionTitle?: string;
  users: PlayerLite[];
  enrolledUserIds?: string[];
  participants?: EnrolledParticipantLite[];
}) {
  const router = useRouter();
  const [grid, setGrid] = React.useState<GradingGrid | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [status, setStatus] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [autoGradeModal, setAutoGradeModal] = React.useState<{
    total: number;
    placedCount: number;
    capacity: number;
    cols: number;
    rows: number;
    leftovers: PlayerLite[];
  } | null>(null);
  const [exportingJpeg, setExportingJpeg] = React.useState(false);

  const participantMap = React.useMemo(() => {
    return new Map<string, EnrolledParticipantLite>((participants || []).map((p) => [p.userId, p]));
  }, [participants]);

  const gradableUsers = React.useMemo(() => {
    const enrolledSet = enrolledUserIds?.length ? new Set(enrolledUserIds) : null;
    return users.filter((u) => {
      const role = (u.role || 'PLAYER').toUpperCase();
      if (role !== 'PLAYER' && role !== 'CAPTAIN') return false;
      if (enrolledSet) return enrolledSet.has(u.id);
      return true;
    });
  }, [users, enrolledUserIds]);

  const sortedGradableUsers = React.useMemo(() => {
    return sortPlayersForGrading(gradableUsers, participantMap);
  }, [gradableUsers, participantMap]);

  const load = React.useCallback(async () => {
    if (!editionId) {
      setGrid(null);
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await getEditionGrading(editionId);
      if (res.success && res.grid) {
        setGrid(res.grid);
        setDirty(false);
      } else {
        setStatus({ type: 'error', text: res.error || 'Could not load grading.' });
      }
    } finally {
      setLoading(false);
    }
  }, [editionId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const assignedUserIds = React.useMemo(() => {
    if (!grid) return new Set<string>();
    return new Set(Object.values(grid.cells));
  }, [grid]);

  const stats = React.useMemo(() => {
    if (!grid) return { assigned: 0, capacity: 0, unassignedPool: gradableUsers.length, withTarget: 0 };
    const assigned = Object.keys(grid.cells).length;
    const capacity = grid.columns.length * grid.rowCount;
    let withTarget = 0;
    Object.entries(grid.cells).forEach(([key, userId]) => {
      const [colId, rowStr] = key.split(':');
      const col = grid.columns.find((c) => c.id === colId);
      if (!col) return;
      const rowIndex = parseInt(rowStr, 10);
      if (resolveTargetForCell(col, rowIndex) !== null) withTarget += 1;
    });
    return {
      assigned,
      capacity,
      unassignedPool: gradableUsers.filter((u) => !assignedUserIds.has(u.id)).length,
      withTarget,
    };
  }, [grid, gradableUsers, assignedUserIds]);

  const markDirty = () => {
    setDirty(true);
    setStatus(null);
  };

  const setCell = (columnId: string, rowIndex: number, userId: string | null) => {
    setGrid((prev) => {
      if (!prev) return prev;
      const key = cellKey(columnId, rowIndex);
      const nextCells = { ...prev.cells };
      if (!userId) {
        delete nextCells[key];
      } else {
        Object.keys(nextCells).forEach((k) => {
          if (nextCells[k] === userId) delete nextCells[k];
        });
        nextCells[key] = userId;
      }
      return sanitizeGradingGrid({ ...prev, cells: nextCells });
    });
    markDirty();
  };

  const setColumnTiers = (columnId: string, tiers: GradingTargetTier[]) => {
    setGrid((prev) => {
      if (!prev) return prev;
      return sanitizeGradingGrid({
        ...prev,
        columns: prev.columns.map((c) => (c.id === columnId ? { ...c, tiers } : c)),
      });
    });
    markDirty();
  };

  const addColumn = () => {
    setGrid((prev) => {
      if (!prev || prev.columns.length >= 20) return prev;
      const id = `g${Date.now()}`;
      return sanitizeGradingGrid({
        ...prev,
        columns: [...prev.columns, { id, label: nextGradeLabel(prev.columns), tiers: [] }],
      });
    });
    markDirty();
  };

  const removeColumn = () => {
    setGrid((prev) => {
      if (!prev || prev.columns.length <= 1) return prev;
      const removed = prev.columns[prev.columns.length - 1];
      const nextCells = { ...prev.cells };
      Object.keys(nextCells).forEach((k) => {
        if (k.startsWith(`${removed.id}:`)) delete nextCells[k];
      });
      return sanitizeGradingGrid({
        ...prev,
        columns: prev.columns.slice(0, -1),
        cells: nextCells,
      });
    });
    markDirty();
  };

  const addRow = () => {
    setGrid((prev) => {
      if (!prev || prev.rowCount >= 50) return prev;
      const oldRowCount = prev.rowCount;
      const newRowCount = oldRowCount + 1;
      const columns = prev.columns.map((col) => ({
        ...col,
        tiers: extendTiersWhenRowsAdded(col.tiers, oldRowCount, newRowCount),
      }));
      return sanitizeGradingGrid({ ...prev, rowCount: newRowCount, columns });
    });
    markDirty();
  };

  const removeRow = () => {
    setGrid((prev) => {
      if (!prev || prev.rowCount <= 1) return prev;
      const oldRowCount = prev.rowCount;
      const newCount = oldRowCount - 1;
      const nextCells = { ...prev.cells };
      Object.keys(nextCells).forEach((k) => {
        const row = parseInt(k.split(':')[1], 10);
        if (row === oldRowCount - 1) delete nextCells[k];
      });
      const columns = prev.columns.map((col) => ({
        ...col,
        tiers: shrinkTiersWhenRowsRemoved(col.tiers, oldRowCount, newCount),
      }));
      return sanitizeGradingGrid({ ...prev, rowCount: newCount, columns, cells: nextCells });
    });
    markDirty();
  };

  const renameColumn = (columnId: string, label: string) => {
    setGrid((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((c) => (c.id === columnId ? { ...c, label: label.trim() || c.label } : c)),
      };
    });
    markDirty();
  };

  const runAutoGrade = (targetGrid?: GradingGrid | null) => {
    const activeGrid = targetGrid || grid;
    if (!activeGrid || activeGrid.columns.length === 0 || activeGrid.rowCount === 0) return;
    if (sortedGradableUsers.length === 0) {
      setStatus({ type: 'error', text: 'No enrolled players found to auto grade.' });
      return;
    }

    const nextCells: Record<string, string> = {};
    let playerIndex = 0;

    for (let colIdx = 0; colIdx < activeGrid.columns.length; colIdx++) {
      const col = activeGrid.columns[colIdx];
      for (let rowIdx = 0; rowIdx < activeGrid.rowCount; rowIdx++) {
        if (playerIndex < sortedGradableUsers.length) {
          const player = sortedGradableUsers[playerIndex];
          const key = cellKey(col.id, rowIdx);
          nextCells[key] = player.id;
          playerIndex++;
        }
      }
    }

    const placedCount = playerIndex;
    const leftovers = sortedGradableUsers.slice(playerIndex);
    const capacity = activeGrid.columns.length * activeGrid.rowCount;

    const sanitized = sanitizeGradingGrid({ ...activeGrid, cells: nextCells });
    setGrid(sanitized);
    markDirty();

    if (leftovers.length > 0) {
      setAutoGradeModal({
        total: sortedGradableUsers.length,
        placedCount,
        capacity,
        cols: activeGrid.columns.length,
        rows: activeGrid.rowCount,
        leftovers,
      });
    } else {
      setStatus({
        type: 'success',
        text: `Auto graded all ${placedCount} player${placedCount === 1 ? '' : 's'} across ${activeGrid.columns.length} column${activeGrid.columns.length === 1 ? '' : 's'} (${activeGrid.rowCount} rows each).`,
      });
    }
  };

  const addRowAndAutoGrade = () => {
    if (!grid || grid.rowCount >= 50) return;
    const oldRowCount = grid.rowCount;
    const newRowCount = oldRowCount + 1;
    const columns = grid.columns.map((col) => ({
      ...col,
      tiers: extendTiersWhenRowsAdded(col.tiers, oldRowCount, newRowCount),
    }));
    const newGrid: GradingGrid = sanitizeGradingGrid({ ...grid, rowCount: newRowCount, columns });
    setGrid(newGrid);
    markDirty();
    runAutoGrade(newGrid);
  };

  const addColumnAndAutoGrade = () => {
    if (!grid || grid.columns.length >= 20) return;
    const id = `g${Date.now()}`;
    const newGrid: GradingGrid = sanitizeGradingGrid({
      ...grid,
      columns: [...grid.columns, { id, label: nextGradeLabel(grid.columns), tiers: [] }],
    });
    setGrid(newGrid);
    markDirty();
    runAutoGrade(newGrid);
  };

  const onSave = async () => {
    if (!editionId || !grid) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await saveEditionGrading(editionId, grid);
      if (res.success && res.grid) {
        setGrid(res.grid);
        setDirty(false);
        router.refresh();
        const parts: string[] = [];
        if (res.targetsUpdated && res.targetsUpdated > 0) {
          parts.push(`${res.targetsUpdated} target${res.targetsUpdated === 1 ? '' : 's'}`);
        }
        if (res.gradesUpdated && res.gradesUpdated > 0) {
          parts.push(`${res.gradesUpdated} grade${res.gradesUpdated === 1 ? '' : 's'}`);
        }
        setStatus({
          type: 'success',
          text:
            parts.length > 0
              ? `Saved. Updated player profiles: ${parts.join(', ')}.`
              : 'Saved. Grading and player profiles are up to date.',
        });
      } else {
        setStatus({ type: 'error', text: res.error || 'Save failed.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadGradingCsv = () => {
    if (!grid || !grid.columns.length) {
      alert('No grading data available to download.');
      return;
    }
    const byId = new Map(gradableUsers.map((u) => [u.id, u]));

    // Header Row: Row #, followed by each Grade as a Column header
    const headerRow: string[] = ['Row #', ...grid.columns.map((col) => col.label || col.id)];

    // Target Row: Target values for each Grade Column (if configured)
    const targetRow: string[] = [
      'Target',
      ...grid.columns.map((col) => {
        const t = resolveTargetForCell(col, 0);
        return t != null ? String(t) : '';
      }),
    ];

    const rows: string[][] = [headerRow, targetRow];

    // Data Rows: 1..rowCount containing players for each grade column
    for (let rIdx = 0; rIdx < grid.rowCount; rIdx += 1) {
      const rowData: string[] = [String(rIdx + 1)];

      grid.columns.forEach((col) => {
        const uId = grid.cells[cellKey(col.id, rIdx)];
        const p = uId ? byId.get(uId) : null;
        if (p) {
          const avg = getGradeAverageForUser(p, participantMap);
          const avgStr = avg != null ? ` (Avg: ${Number(avg).toFixed(2)})` : '';
          rowData.push(`${p.name || p.username} (@${p.username})${avgStr}`);
        } else if (uId) {
          rowData.push(`Unknown (${uId})`);
        } else {
          rowData.push('');
        }
      });

      rows.push(rowData);
    }

    // Summary counts by grade
    rows.push([]);
    rows.push(['--- GRADE SUMMARY ---']);
    rows.push(['Grade', 'Assigned Players', 'Configured Target']);
    grid.columns.forEach((col) => {
      let count = 0;
      for (let rIdx = 0; rIdx < grid.rowCount; rIdx += 1) {
        if (grid.cells[cellKey(col.id, rIdx)]) count++;
      }
      const t = resolveTargetForCell(col, 0);
      rows.push([col.label || col.id, String(count), t != null ? String(t) : '-']);
    });

    // Detailed Table with explicit Grading Average column
    rows.push([]);
    rows.push(['--- ALL PLAYERS BY GRADE (DETAILED TABLE) ---']);
    rows.push([
      'Grade',
      'Row #',
      'Player Name',
      'Username',
      'Grading Average',
      'Tier Target',
      'Profile Target',
      'Status',
    ]);
    grid.columns.forEach((col) => {
      for (let rIdx = 0; rIdx < grid.rowCount; rIdx += 1) {
        const uId = grid.cells[cellKey(col.id, rIdx)];
        const p = uId ? byId.get(uId) : null;
        if (!p && !uId) continue;
        const target = resolveTargetForCell(col, rIdx);
        const avg = p ? getGradeAverageForUser(p, participantMap) : null;
        rows.push([
          col.label || col.id,
          String(rIdx + 1),
          p?.name || (uId ? 'Unknown' : 'Unassigned'),
          p?.username || '',
          avg != null ? Number(avg).toFixed(2) : '',
          target != null ? String(target) : '',
          p?.target != null ? String(p.target) : '',
          uId ? 'ASSIGNED' : 'EMPTY',
        ]);
      }
    });

    // Unassigned players section
    const assignedIds = new Set(Object.values(grid.cells).filter(Boolean));
    const unassigned = gradableUsers.filter((u) => !assignedIds.has(u.id));
    if (unassigned.length > 0) {
      rows.push([]);
      rows.push(['--- UNASSIGNED PLAYERS ---']);
      rows.push(['Player Name', 'Username', 'Grading Average', 'Target']);
      unassigned.forEach((u) => {
        const avg = getGradeAverageForUser(u, participantMap);
        rows.push([
          u.name || u.username || 'Player',
          u.username || '',
          avg != null ? Number(avg).toFixed(2) : '',
          u.target != null ? String(u.target) : '',
        ]);
      });
    }


    const csvContent = rows
      .map((row) =>
        row
          .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanTitle = (editionTitle || 'Player_Grading').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `CBOT_Player_Grading_${cleanTitle}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const posterRef = React.useRef<HTMLDivElement>(null);

  const handleDownloadGradingJpeg = async () => {
    if (!posterRef.current || !grid || grid.columns.length === 0) {
      alert('Grading grid is not ready for image export.');
      return;
    }
    setExportingJpeg(true);
    try {
      // Small pause to ensure layout has painted
      await new Promise((r) => setTimeout(r, 150));
      const element = posterRef.current;
      const canvas = await html2canvas(element, {
        backgroundColor: '#07090e',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const a = document.createElement('a');
      a.href = imgData;
      const cleanTitle = (editionTitle || 'Player_Grading').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `CBOT_Player_Grading_${cleanTitle}_${new Date().toISOString().split('T')[0]}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export grading JPEG:', err);
      alert('Could not export JPEG image.');
    } finally {
      setExportingJpeg(false);
    }
  };



  if (!editionId) {
    return (
      <Card className="border-border">
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Select an edition to manage player grading.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-violet-500/25 overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-gradient-to-r from-violet-500/10 via-transparent to-amber-500/5 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-violet-400" />
              Player Grading
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Assign players and set targets per grade. Use <strong className="text-foreground">Save</strong> at the
              bottom to update player profile targets for target bonus.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="carrom" className="font-extrabold text-[10px] px-2.5 py-1">
              {stats.assigned} / {stats.capacity} cells filled
            </Badge>
            <Badge variant="outline" className="font-bold text-[10px] px-2.5 py-1 border-violet-500/30 text-violet-400">
              <Target className="h-3 w-3 mr-1 inline" />
              {stats.withTarget} with tier target
            </Badge>
            <Badge variant="outline" className="font-bold text-[10px] px-2.5 py-1 border-emerald-500/30 text-emerald-400">
              <Users className="h-3 w-3 mr-1 inline" />
              {stats.unassignedPool} unassigned
            </Badge>
          </div>
        </div>

        {dirty && !status ? (
          <p className="mt-3 text-[11px] font-semibold text-amber-400">You have unsaved changes.</p>
        ) : null}
      </CardHeader>

      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border/50 bg-muted/20">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mr-1">Grid</span>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs font-bold gap-1" onClick={addColumn}>
              <Plus className="h-3.5 w-3.5" /> Grade column
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold gap-1"
              onClick={removeColumn}
              disabled={!grid || grid.columns.length <= 1}
            >
              <Minus className="h-3.5 w-3.5" /> Column
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs font-bold gap-1" onClick={addRow}>
              <Plus className="h-3.5 w-3.5" /> Row
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold gap-1"
              onClick={removeRow}
              disabled={!grid || grid.rowCount <= 1}
            >
              <Minus className="h-3.5 w-3.5" /> Row
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold gap-1.5 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
              onClick={handleDownloadGradingJpeg}
              disabled={!grid || grid.columns.length === 0 || exportingJpeg}
              title="Download grading grid visual as JPEG"
            >
              {exportingJpeg ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5 text-emerald-400" />
              )}
              Download JPEG
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold gap-1.5 border-violet-500/30 text-violet-300 hover:bg-violet-500/10 cursor-pointer"
              onClick={handleDownloadGradingCsv}
              disabled={!grid || grid.columns.length === 0}
              title="Download grading sheet with assigned and unassigned players as CSV"
            >
              <Download className="h-3.5 w-3.5 text-violet-400" />
              Download CSV
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-8 text-xs font-bold gap-1.5 bg-gradient-to-r from-violet-600 to-amber-600 hover:from-violet-500 hover:to-amber-500 text-white shadow-sm border-0 cursor-pointer"
              onClick={() => runAutoGrade()}
              disabled={!grid || gradableUsers.length === 0}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Auto grade players
            </Button>
          </div>
        </div>

        {loading || !grid ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            Loading grading sheet…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-violet-600/20 to-amber-500/10">
                  <th className="sticky left-0 z-20 min-w-[52px] border-b border-r border-border/60 bg-card/95 px-3 py-3 text-left align-top">
                    <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                  </th>
                  {grid.columns.map((col) => {
                    const colAssignedPlayers = Array.from({ length: grid.rowCount }, (_, rIdx) => {
                      const uId = grid.cells[cellKey(col.id, rIdx)];
                      return uId ? gradableUsers.find((u) => u.id === uId) : null;
                    }).filter(Boolean) as PlayerLite[];

                    const colAverages = colAssignedPlayers
                      .map((p) => getGradeAverageForUser(p, participantMap))
                      .filter((a): a is number => a !== null);

                    const colAvg = colAverages.length > 0
                      ? (colAverages.reduce((sum, a) => sum + a, 0) / colAverages.length).toFixed(1)
                      : null;

                    return (
                      <th
                        key={col.id}
                        className="min-w-[200px] border-b border-r border-border/60 px-2 py-2 text-center align-top last:border-r-0"
                      >
                        <Input
                          value={col.label}
                          onChange={(e) => renameColumn(col.id, e.target.value)}
                          className="h-8 text-center text-xs font-black uppercase tracking-wide border-violet-500/30 bg-background/60"
                        />
                        {colAvg !== null ? (
                          <div className="text-[10px] font-black text-amber-400 font-mono my-1 bg-amber-500/10 py-0.5 rounded border border-amber-500/20">
                            G.Avg: {colAvg}
                          </div>
                        ) : null}
                        <ColumnTargetControl
                          column={col}
                          rowCount={grid.rowCount}
                          onChange={(tiers) => setColumnTiers(col.id, tiers)}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: grid.rowCount }, (_, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-background/40' : 'bg-muted/10'}>
                    <td className="sticky left-0 z-10 border-b border-r border-border/50 bg-card/90 px-2 py-2 text-center align-top">
                      <div className="text-[11px] font-black text-muted-foreground">{rowIndex + 1}</div>
                    </td>
                    {grid.columns.map((col) => {
                      const key = cellKey(col.id, rowIndex);
                      const userId = grid.cells[key] || null;
                      const assignedElsewhere = new Set(
                        Object.entries(grid.cells)
                          .filter(([k, uid]) => k !== key && uid)
                          .map(([, uid]) => uid),
                      );
                      const cellTarget = resolveTargetForCell(col, rowIndex);
                      return (
                        <td key={col.id} className="border-b border-r border-border/40 p-2 align-top last:border-r-0">
                          {!userId && cellTarget !== null ? (
                            <div className="mb-1 text-center text-[9px] font-bold text-violet-400/70">→ {cellTarget}</div>
                          ) : null}
                          <PlayerCellPicker
                            value={userId}
                            players={gradableUsers}
                            assignedElsewhere={assignedElsewhere}
                            cellTarget={cellTarget}
                            participantMap={participantMap}
                            onSelect={(id) => setCell(col.id, rowIndex, id)}
                            onClear={() => setCell(col.id, rowIndex, null)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <div className="border-t border-border/60 bg-gradient-to-r from-violet-500/5 to-amber-500/5 px-4 py-4">
        {status ? (
          <div
            className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
              status.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
            }`}
          >
            {status.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {status.text}
          </div>
        ) : null}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground max-w-xl">
            Saves the grading grid and updates each assigned player&apos;s profile <strong className="text-foreground">grade</strong> and{' '}
            <strong className="text-foreground">target</strong>.
          </p>
          <Button
            onClick={() => void onSave()}
            disabled={saving || loading || !dirty || !grid}
            className="h-10 px-6 text-sm font-bold gap-2 shrink-0"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save grading & targets
          </Button>
        </div>
      </div>

      {/* Auto Grade Notice / Leftover Dialog */}
      <Dialog open={Boolean(autoGradeModal)} onOpenChange={(open) => !open && setAutoGradeModal(null)}>
        {autoGradeModal && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                {autoGradeModal.leftovers.length > 0 ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                    Auto Grade · Grid Capacity Notice
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    Auto Grade Complete
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {autoGradeModal.leftovers.length > 0
                  ? `Assigned ${autoGradeModal.placedCount} of ${autoGradeModal.total} enrolled players by lowest grade average sequence. The current grid (${autoGradeModal.cols} column${autoGradeModal.cols === 1 ? '' : 's'} × ${autoGradeModal.rows} row${autoGradeModal.rows === 1 ? '' : 's'} = ${autoGradeModal.capacity} cells) is full.`
                  : `Successfully assigned all ${autoGradeModal.placedCount} player${autoGradeModal.placedCount === 1 ? '' : 's'} into ${autoGradeModal.cols} column${autoGradeModal.cols === 1 ? '' : 's'} (${autoGradeModal.rows} rows) in sequence of grade average.`}
              </DialogDescription>
            </DialogHeader>

            {autoGradeModal.leftovers.length > 0 ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                    {autoGradeModal.leftovers.length} player{autoGradeModal.leftovers.length === 1 ? '' : 's'} left unassigned:
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    You can keep the current placement, or add more rows / columns below to automatically re-grade with all players.
                  </p>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-2 space-y-1 text-xs">
                  {autoGradeModal.leftovers.map((p, idx) => {
                    const avg = getGradeAverageForUser(p, participantMap);
                    return (
                      <div key={p.id} className="flex items-center justify-between px-2.5 py-1.5 rounded bg-card/60 border border-border/40">
                        <span className="font-semibold text-foreground">
                          {autoGradeModal.placedCount + idx + 1}. {playerLabel(p)}
                        </span>
                        <span className="font-mono text-xs text-violet-400 font-bold">
                          {avg !== null ? `G.Avg ${avg.toFixed(2)}` : 'No G.Avg'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/60">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-bold gap-1"
                      onClick={addRowAndAutoGrade}
                    >
                      <Plus className="h-3 w-3" /> Add Row & Auto Grade
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-bold gap-1"
                      onClick={addColumnAndAutoGrade}
                    >
                      <Plus className="h-3 w-3" /> Add Column & Auto Grade
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-4 text-xs font-bold"
                    onClick={() => setAutoGradeModal(null)}
                  >
                    Keep Placement
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-4 text-xs font-bold"
                  onClick={() => setAutoGradeModal(null)}
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Hidden High-Definition Export Poster for clean JPEG generation */}
      {grid && (
        <GradingExportPoster
          editionTitle={editionTitle}
          grid={grid}
          gradableUsers={gradableUsers}
          participantMap={participantMap}
          stats={stats}
          posterRef={posterRef}
        />
      )}
    </Card>
  );
}

function GradingExportPoster({
  editionTitle,
  grid,
  gradableUsers,
  participantMap,
  stats,
  posterRef,
}: {
  editionTitle?: string;
  grid: GradingGrid;
  gradableUsers: PlayerLite[];
  participantMap: Map<string, EnrolledParticipantLite>;
  stats: { assigned: number; capacity: number; unassignedPool: number };
  posterRef: React.RefObject<HTMLDivElement | null>;
}) {
  const colWidth = 280;
  const totalCols = grid.columns.length;
  const minWidth = Math.max(1200, totalCols * colWidth + 100);

  return (
    <div
      style={{
        position: 'fixed',
        left: '-99999px',
        top: 0,
        zIndex: -1,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
      aria-hidden="true"
    >
      <div
        ref={posterRef}
        style={{
          width: `${minWidth}px`,
          backgroundColor: '#090d16',
          color: '#ffffff',
          padding: '36px 40px',
          boxSizing: 'border-box',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }}
      >
        {/* Header Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '28px',
            background: 'linear-gradient(90deg, #2e1065 0%, #1e1b4b 50%, #451a03 100%)',
            padding: '24px 32px',
            borderRadius: '16px',
            border: '2px solid rgba(168, 85, 247, 0.4)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: '900',
                letterSpacing: '0.2em',
                color: '#f59e0b',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}
            >
              CBOT TOURNAMENT • OFFICIAL PLAYER GRADING MATRIX
            </div>
            <div
              style={{
                fontSize: '32px',
                fontWeight: '900',
                color: '#ffffff',
                letterSpacing: '-0.02em',
              }}
            >
              {editionTitle || 'Player Grading'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                background: 'rgba(124, 58, 237, 0.35)',
                border: '1.5px solid rgba(168, 85, 247, 0.6)',
                borderRadius: '12px',
                padding: '10px 20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Grades
              </div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#ffffff', marginTop: '2px' }}>
                {totalCols}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(16, 185, 129, 0.3)',
                border: '1.5px solid rgba(52, 211, 153, 0.6)',
                borderRadius: '12px',
                padding: '10px 20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Filled Cells
              </div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#ffffff', marginTop: '2px' }}>
                {stats.assigned} / {stats.capacity}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(217, 119, 6, 0.3)',
                border: '1.5px solid rgba(251, 191, 36, 0.6)',
                borderRadius: '12px',
                padding: '10px 20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#fde68a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Unassigned
              </div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#ffffff', marginTop: '2px' }}>
                {stats.unassignedPool}
              </div>
            </div>
          </div>
        </div>

        {/* Grid Table */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: '10px',
            tableLayout: 'fixed',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  width: '54px',
                  padding: '14px 4px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '15px',
                  fontWeight: '900',
                  background: 'transparent',
                }}
              >
                #
              </th>
              {grid.columns.map((col) => {
                const colAssignedPlayers = Array.from({ length: grid.rowCount }, (_, rIdx) => {
                  const uId = grid.cells[cellKey(col.id, rIdx)];
                  return uId ? gradableUsers.find((u) => u.id === uId) : null;
                }).filter(Boolean) as PlayerLite[];

                const colAverages = colAssignedPlayers
                  .map((p) => getGradeAverageForUser(p, participantMap))
                  .filter((a): a is number => a !== null);

                const colAvg =
                  colAverages.length > 0
                    ? (colAverages.reduce((sum, a) => sum + a, 0) / colAverages.length).toFixed(1)
                    : null;

                const targetSummary = formatColumnTargetSummary(col, grid.rowCount);

                return (
                  <th
                    key={col.id}
                    style={{
                      width: `${colWidth}px`,
                      background: 'linear-gradient(180deg, #1e1b4b 0%, #111827 100%)',
                      border: '2px solid #6366f1',
                      borderRadius: '14px',
                      padding: '16px 12px',
                      textAlign: 'center',
                      verticalAlign: 'top',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '20px',
                        fontWeight: '900',
                        color: '#fbbf24',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {col.label}
                    </div>

                    {colAvg !== null ? (
                      <div
                        style={{
                          display: 'inline-block',
                          fontSize: '13px',
                          fontWeight: '900',
                          color: '#fef08a',
                          background: '#854d0e',
                          border: '1.5px solid #eab308',
                          borderRadius: '8px',
                          padding: '4px 12px',
                          marginTop: '8px',
                          fontFamily: 'monospace',
                        }}
                      >
                        G.Avg: {colAvg}
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>No Avg</div>
                    )}

                    {targetSummary ? (
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: '800',
                          color: '#e0e7ff',
                          background: '#4338ca',
                          border: '1.5px solid #818cf8',
                          borderRadius: '8px',
                          padding: '4px 10px',
                          marginTop: '8px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        Target: {targetSummary}
                      </div>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: grid.rowCount }, (_, rowIndex) => (
              <tr key={rowIndex}>
                <td
                  style={{
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    color: '#94a3b8',
                    fontSize: '16px',
                    fontWeight: '900',
                    fontFamily: 'monospace',
                  }}
                >
                  {rowIndex + 1}
                </td>
                {grid.columns.map((col) => {
                  const key = cellKey(col.id, rowIndex);
                  const userId = grid.cells[key] || null;
                  const player = userId ? gradableUsers.find((u) => u.id === userId) : null;
                  const cellTarget = resolveTargetForCell(col, rowIndex);
                  const targetToDisplay = cellTarget !== null ? cellTarget : player?.target ?? null;
                  const avg = player ? getGradeAverageForUser(player, participantMap) : null;

                  if (player) {
                    return (
                      <td
                        key={col.id}
                        style={{
                          background: '#111827',
                          border: '2px solid #374151',
                          borderRadius: '12px',
                          padding: '14px 14px',
                          verticalAlign: 'top',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '16.5px',
                            fontWeight: '900',
                            color: '#ffffff',
                            lineHeight: '1.35',
                            marginBottom: '4px',
                            wordBreak: 'break-word',
                            letterSpacing: '0.01em',
                          }}
                        >
                          {playerLabel(player)}
                        </div>
                        {player.username ? (
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#94a3b8',
                              marginBottom: '8px',
                              fontFamily: 'monospace',
                            }}
                          >
                            @{player.username}
                          </div>
                        ) : null}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {avg !== null ? (
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: '900',
                                color: '#fef08a',
                                background: '#854d0e',
                                border: '1.5px solid #eab308',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontFamily: 'monospace',
                              }}
                            >
                              G.Avg {avg.toFixed(1)}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#64748b' }}>No G.Avg</span>
                          )}

                          {targetToDisplay !== null && Number(targetToDisplay) > 0 ? (
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: '900',
                                color: '#e0e7ff',
                                background: '#4c1d95',
                                border: '1.5px solid #8b5cf6',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontFamily: 'monospace',
                              }}
                            >
                              Target {targetToDisplay}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td
                      key={col.id}
                      style={{
                        background: '#0a0e17',
                        border: '2px dashed #1e293b',
                        borderRadius: '12px',
                        padding: '14px 12px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                      }}
                    >
                      <span style={{ fontSize: '13px', color: '#475569', fontWeight: '700' }}>
                        {cellTarget !== null ? `→ Target ${cellTarget}` : '—'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '2px solid #1e293b',
            paddingTop: '16px',
            marginTop: '24px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#94a3b8',
          }}
        >
          <span>CBOT World • Official Player Grading Sheet</span>
          <span>Generated: {new Date().toLocaleString('en-GB')}</span>
        </div>
      </div>
    </div>
  );
}
