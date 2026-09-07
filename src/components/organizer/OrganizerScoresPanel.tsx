'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, Search, User, X } from 'lucide-react';
import {
  organiserUpsertPlayerDayScore,
  getOrganiserScoreDesk,
  getAverageReviewPrompt,
} from '@/lib/actions/playerScoreActions';
import { BoardScoreEditor } from '@/components/scores/BoardScoreEditor';
import { ScoreEditRules } from '@/components/scores/ScoreEditRules';
import { SCORE_EDIT_ORGANISER_HELP } from '@/lib/score-edit-policy';
import { boardsToDraft, draftToPayload, emptyBoardDraft, type DayBoardScore } from '@/lib/board-scores';

type DeskDay = { dayNumber: number; calendarDate: string; published: boolean };
type DeskScore = {
  userId: string;
  dayNumber: number;
  score: number;
  slams: number;
  boards: DayBoardScore[];
  source: string;
  enteredByName?: string | null;
};

function SearchablePlayerSelect({
  users,
  value,
  onChange,
}: {
  users: Array<{ id: string; name?: string; username?: string; target?: number | null }>;
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedUser = users.find((u) => u.id === value);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.name || ''} ${u.username || ''}`.toLowerCase().includes(q)
    );
  }, [users, query]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold flex items-center justify-between gap-2 hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-colors text-left shadow-xs"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate text-foreground">
            {selectedUser ? (selectedUser.name || selectedUser.username) : 'Select a player...'}
          </span>
          {Number(selectedUser?.target) > 0 && (
            <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold shrink-0">
              tgt {selectedUser?.target}
            </span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-lg border border-border bg-popover shadow-2xl p-2 space-y-1.5 backdrop-blur-md">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by player name or username…"
              className="w-full h-8.5 rounded-md border border-input bg-background pl-8 pr-7 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-border/20 rounded-md">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No players found matching &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map((u) => {
                const isSelected = u.id === value;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onChange(u.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full px-2.5 py-2 text-left text-xs font-semibold flex items-center justify-between gap-2 rounded transition-colors ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-200'
                        : 'hover:bg-accent text-foreground'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{u.name || u.username}</div>
                      {u.username && u.name && (
                        <div className="text-[10px] text-muted-foreground truncate">@{u.username}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {Number(u.target) > 0 && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                          tgt {u.target}
                        </span>
                      )}
                      {isSelected && <Check className="h-3.5 w-3.5 text-amber-400" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrganizerScoresPanel({
  users,
  editionTitle,
  editionId,
}: {
  users: Array<{ id: string; name?: string; username?: string; target?: number | null }>;
  editionTitle?: string;
  editionId?: string;
}) {
  const [userId, setUserId] = React.useState(users[0]?.id || '');
  const [day, setDay] = React.useState(1);
  const [boards, setBoards] = React.useState([emptyBoardDraft()]);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [days, setDays] = React.useState<DeskDay[]>([]);
  const [scores, setScores] = React.useState<DeskScore[]>([]);
  const [review, setReview] = React.useState<{ finishedStageName: string; nextStageName: string | null } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const selected = users.find((u) => u.id === userId);
  const target = Number(selected?.target) || 0;
  const existing = scores.find((s) => s.userId === userId && s.dayNumber === day) || null;

  const loadDesk = React.useCallback(async () => {
    const desk = await getOrganiserScoreDesk(editionId);
    if (desk.success) {
      setDays(desk.days || []);
      setScores(desk.scores || []);
    }
    return desk;
  }, [editionId]);

  React.useEffect(() => {
    loadDesk()
      .then((desk) => {
        if (desk.success && desk.days?.length) {
          setDay((prev) => (desk.days.some((d) => d.dayNumber === prev) ? prev : desk.days[0].dayNumber));
        }
      })
      .catch(() => {});
    getAverageReviewPrompt(editionId).then(setReview).catch(() => {});
  }, [loadDesk, editionId]);

  React.useEffect(() => {
    if (!userId && users[0]?.id) setUserId(users[0].id);
  }, [users, userId]);

  React.useEffect(() => {
    setBoards(boardsToDraft(existing?.boards, existing?.score, existing?.slams));
  }, [userId, day, scores]);

  const dayOptions = days.length
    ? days
    : Array.from({ length: 15 }, (_, i) => ({ dayNumber: i + 1, calendarDate: '', published: false }));

  return (
    <Card className="border-amber-500/30">
      <CardHeader>
        <CardTitle className="text-xl font-black">Edit player scores</CardTitle>
        <CardDescription>
          {editionTitle ? (
            <>
              <strong className="text-amber-400">{editionTitle}</strong>
              {' · '}
            </>
          ) : null}
          Pick a player and day. If they or their captain already entered boards, those load here so you can fix them. If the day is empty, add the boards yourself.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-2xl">
        <ScoreEditRules note={SCORE_EDIT_ORGANISER_HELP} />
        {review ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
            {review.finishedStageName} just finished. Review player averages
            {review.nextStageName ? ` for ${review.nextStageName}` : ' for the next stage'}
            {' '}on each player’s edit form. Changes apply from tomorrow IST.
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold block mb-1">Player</label>
            <SearchablePlayerSelect users={users} value={userId} onChange={setUserId} />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">Day</label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm font-semibold"
              value={day}
              onChange={(e) => setDay(parseInt(e.target.value, 10) || 1)}
            >
              {dayOptions.map((d) => {
                const row = scores.find((s) => s.userId === userId && s.dayNumber === d.dayNumber);
                const status = row ? ` · ${row.source}` : ' · empty';
                return (
                  <option key={d.dayNumber} value={d.dayNumber}>
                    Day {d.dayNumber}
                    {d.calendarDate ? ` · ${d.calendarDate}` : ''}
                    {status}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {existing ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
            Day {day} already has scores from the {existing.source.toLowerCase()}
            {existing.enteredByName && existing.source !== 'Player' ? ` (${existing.enteredByName})` : ''}.
            {' '}Edit Total Score, Slams, and Boards below, or switch to Board-by-Board details, then save.
          </div>
        ) : (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs font-semibold text-muted-foreground">
            No score for this player on Day {day} yet. Enter Total Score, Slams, and No. of Boards below and save.
          </div>
        )}

        <BoardScoreEditor boards={boards} onChange={setBoards} target={target} defaultMode="summary" />
        {msg && <p className="text-xs font-semibold">{msg}</p>}
        <Button
          disabled={busy || !userId}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            const payload = draftToPayload(boards);
            const res = await organiserUpsertPlayerDayScore(userId, day, 0, 0, payload, editionId);
            setMsg(res.success ? 'Saved. Standings will use this score.' : res.error || 'Failed');
            if (res.success) await loadDesk();
            setBusy(false);
          }}
        >
          {busy ? 'Saving…' : existing ? `Update Day ${day}` : `Save Day ${day}`}
        </Button>
      </CardContent>
    </Card>
  );
}
