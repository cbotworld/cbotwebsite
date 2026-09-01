'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Flame, Trophy, Award, Hash, Calculator } from 'lucide-react';
import {
  MAX_DAY_BOARDS,
  aggregateBoards,
  draftToPayload,
  emptyBoardDraft,
  previewTargetBonus,
  type BoardDraft,
} from '@/lib/board-scores';

export function BoardScoreEditor({
  boards,
  onChange,
  disabled,
  target,
  compact,
}: {
  boards: BoardDraft[];
  onChange: (next: BoardDraft[]) => void;
  disabled?: boolean;
  target?: number | null;
  compact?: boolean;
}) {
  const parsed = draftToPayload(boards).map((b, i) => ({
    score: Number.isFinite(b.score) ? b.score : boards[i]?.score === '' ? null : NaN,
    slams: Number.isFinite(b.slams) ? b.slams : 0,
  }));
  const filled = parsed.filter((b) => b.score != null && Number.isFinite(b.score)) as Array<{ score: number; slams: number }>;
  const agg = aggregateBoards(filled);
  const bonus = previewTargetBonus(filled.length ? agg.score : null, target);
  const dayAvg = agg.boardCount > 0 ? Math.round((agg.score / agg.boardCount) * 100) / 100 : null;

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {boards.map((board, idx) => (
        <div
          key={idx}
          className={`p-3.5 rounded-2xl bg-card/80 border border-border/80 space-y-2.5 transition-all hover:border-amber-500/30 ${
            compact ? 'p-2.5 space-y-1.5' : ''
          }`}
        >
          {/* Header Row: Board Number + Remove Button */}
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Board {idx + 1}
            </span>

            {boards.length > 1 && !disabled && (
              <button
                type="button"
                onClick={() => onChange(boards.filter((_, i) => i !== idx))}
                className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors px-2 py-0.5 rounded-md hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>

          {/* Controls Grid: Score Stepper & Slam Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            {/* Score Stepper */}
            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-wider block mb-1 text-muted-foreground">
                Score
              </label>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={disabled}
                  onClick={() => {
                    const currentVal = parseInt(board.score, 10) || 0;
                    const nextVal = Math.max(0, currentVal - 1);
                    const next = [...boards];
                    next[idx] = { ...board, score: String(nextVal) };
                    onChange(next);
                  }}
                  className="h-10 w-10 text-lg font-black shrink-0 border-border hover:border-amber-500/50 hover:bg-amber-500/10 active:scale-95 transition-all"
                >
                  −
                </Button>
                <Input
                  type="number"
                  min={0}
                  disabled={disabled}
                  value={board.score}
                  onChange={(e) => {
                    const next = [...boards];
                    next[idx] = { ...board, score: e.target.value };
                    onChange(next);
                  }}
                  placeholder="0"
                  className="text-center font-mono font-black text-base h-10 flex-1 bg-background border-amber-500/30 focus-visible:ring-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={disabled}
                  onClick={() => {
                    const currentVal = parseInt(board.score, 10) || 0;
                    const nextVal = currentVal + 1;
                    const next = [...boards];
                    next[idx] = { ...board, score: String(nextVal) };
                    onChange(next);
                  }}
                  className="h-10 w-10 text-lg font-black shrink-0 border-border hover:border-amber-500/50 hover:bg-amber-500/10 active:scale-95 transition-all"
                >
                  +
                </Button>
              </div>
            </div>

            {/* Slam Toggle */}
            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-wider block mb-1 text-muted-foreground">
                Slam
              </label>
              <div className="flex items-center bg-background border border-border/80 rounded-xl p-1 gap-1 h-10">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const next = [...boards];
                    next[idx] = { ...board, slams: '1' };
                    onChange(next);
                  }}
                  className={`flex-1 h-full rounded-lg text-xs font-black transition-all uppercase flex items-center justify-center gap-1 ${
                    board.slams === '1'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-muted-foreground hover:text-foreground'
                  } ${disabled ? 'opacity-50' : ''}`}
                >
                  <Flame className={`h-3.5 w-3.5 ${board.slams === '1' ? 'fill-slate-950' : ''}`} /> YES
                </button>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const next = [...boards];
                    next[idx] = { ...board, slams: '0' };
                    onChange(next);
                  }}
                  className={`flex-1 h-full rounded-lg text-xs font-black transition-all uppercase ${
                    board.slams !== '1'
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  } ${disabled ? 'opacity-50' : ''}`}
                >
                  NO
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Add Board Button */}
      {!disabled && boards.length < MAX_DAY_BOARDS && (
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...boards, emptyBoardDraft()])}
          className="w-full border-dashed border-amber-500/40 hover:border-amber-500 font-bold text-xs gap-1.5 py-5 text-amber-400 hover:bg-amber-500/10"
        >
          <Plus className="h-4 w-4" /> Add Board ({boards.length}/{MAX_DAY_BOARDS})
        </Button>
      )}

      {/* ── Summary Stats Badges Grid ───────────────────────────────────── */}
      <div className="pt-2">
        <div className="p-3 rounded-2xl bg-card border border-border/80 space-y-2">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Calculator className="h-3.5 w-3.5 text-amber-500" /> Day Summary Preview
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <div className="text-[10px] text-amber-400/80 font-bold">Total Score</div>
              <div className="text-base font-black text-amber-400">{filled.length ? agg.score : '—'}</div>
            </div>

            <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center">
              <div className="text-[10px] text-orange-400/80 font-bold">Slams</div>
              <div className="text-base font-black text-orange-400 flex items-center justify-center gap-1">
                {filled.length ? agg.slams : '—'} {agg.slams > 0 && <Flame className="h-3.5 w-3.5 fill-orange-400" />}
              </div>
            </div>

            <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700 text-center">
              <div className="text-[10px] text-muted-foreground font-bold">Boards</div>
              <div className="text-base font-black text-slate-200">{agg.boardCount || '—'}</div>
            </div>

            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
              <div className="text-[10px] text-purple-400/80 font-bold">Average</div>
              <div className="text-base font-black text-purple-400">{dayAvg == null ? '—' : dayAvg}</div>
            </div>

            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center col-span-2 sm:col-span-2">
              <div className="text-[10px] text-blue-400/80 font-bold">Target ({target || 0}) Bonus</div>
              <div className={`text-xs font-black mt-0.5 ${bonus === true ? 'text-emerald-400' : 'text-slate-400'}`}>
                {filled.length === 0 ? '—' : bonus === true ? '🎉 Bonus Achieved!' : 'No Bonus'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
