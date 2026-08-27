'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {boards.map((board, idx) => (
        <div key={idx} className={`grid gap-2 items-end ${compact ? 'grid-cols-[4.5rem_1fr_6rem_auto]' : 'grid-cols-[5.5rem_1fr_6.5rem_auto]'}`}>
          <div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground pb-2">
            Board {idx + 1}
          </div>
          <div>
            {!compact && idx === 0 ? <label className="text-[10px] font-bold block mb-1">Score</label> : null}
            <div className="flex items-center gap-1">
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
                className={`h-10 w-10 shrink-0 ${compact ? 'h-8 w-8 text-xs' : ''}`}
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
                placeholder="score"
                className={`text-center ${compact ? 'h-8 text-xs' : ''}`}
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
                className={`h-10 w-10 shrink-0 ${compact ? 'h-8 w-8 text-xs' : ''}`}
              >
                +
              </Button>
            </div>
          </div>
          <div>
            {!compact && idx === 0 ? <label className="text-[10px] font-bold block mb-1">Slam</label> : null}
            <div className={`flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5 gap-0.5 ${compact ? 'h-8' : 'h-10'}`}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  const next = [...boards];
                  next[idx] = { ...board, slams: '1' };
                  onChange(next);
                }}
                className={`flex-1 h-full rounded text-[10px] font-bold transition-all uppercase ${
                  board.slams === '1'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-slate-200'
                } ${disabled ? 'opacity-50' : ''}`}
              >
                Yes
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  const next = [...boards];
                  next[idx] = { ...board, slams: '0' };
                  onChange(next);
                }}
                className={`flex-1 h-full rounded text-[10px] font-bold transition-all uppercase ${
                  board.slams !== '1'
                    ? 'bg-slate-800 text-slate-200 font-extrabold'
                    : 'text-slate-500 hover:text-slate-400'
                } ${disabled ? 'opacity-50' : ''}`}
              >
                No
              </button>
            </div>
          </div>
          <div className="pb-0.5">
            {boards.length > 1 && !disabled ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[10px] text-rose-400"
                onClick={() => onChange(boards.filter((_, i) => i !== idx))}
              >
                Remove
              </Button>
            ) : (
              <span className="inline-block w-12" />
            )}
          </div>
        </div>
      ))}
      {!disabled && boards.length < MAX_DAY_BOARDS ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-[11px] font-bold"
          onClick={() => onChange([...boards, emptyBoardDraft()])}
        >
          Add board ({boards.length}/{MAX_DAY_BOARDS})
        </Button>
      ) : null}
      <div className={`flex flex-wrap gap-x-3 gap-y-1 ${compact ? 'text-[10px]' : 'text-xs'} font-semibold text-muted-foreground`}>
        <span>Total {filled.length ? agg.score : '—'}</span>
        <span>Slams {filled.length ? agg.slams : '—'}</span>
        <span>Boards {agg.boardCount || '—'}</span>
        <span>Avg {dayAvg == null ? '—' : dayAvg}</span>
        <span>Target {target && target > 0 ? target : '0 (no bonus)'}</span>
        <span className={bonus === true ? 'text-emerald-400 font-black' : ''}>
          Target bonus {filled.length === 0 ? '—' : bonus === true ? 'Yes' : 'No'}
        </span>
      </div>
    </div>
  );
}
