'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export default function OrganizerScoresPanel({
  users,
}: {
  users: Array<{ id: string; name?: string; username?: string; target?: number | null }>;
}) {
  const [userId, setUserId] = React.useState(users[0]?.id || '');
  const [day, setDay] = React.useState(1);
  const [playerQuery, setPlayerQuery] = React.useState('');
  const [boards, setBoards] = React.useState([emptyBoardDraft()]);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [days, setDays] = React.useState<DeskDay[]>([]);
  const [scores, setScores] = React.useState<DeskScore[]>([]);
  const [review, setReview] = React.useState<{ finishedStageName: string; nextStageName: string | null } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const selected = users.find((u) => u.id === userId);
  const target = Number(selected?.target) || 0;
  const existing = scores.find((s) => s.userId === userId && s.dayNumber === day) || null;
  const filteredUsers = React.useMemo(() => {
    const q = playerQuery.trim().toLowerCase();
    const matches = q
      ? users.filter((u) => `${u.name || ''} ${u.username || ''}`.toLowerCase().includes(q))
      : users;
    if (userId && !matches.some((u) => u.id === userId)) {
      const keep = users.find((u) => u.id === userId);
      return keep ? [keep, ...matches] : matches;
    }
    return matches;
  }, [users, playerQuery, userId]);

  const loadDesk = React.useCallback(async () => {
    const desk = await getOrganiserScoreDesk();
    if (desk.success) {
      setDays(desk.days || []);
      setScores(desk.scores || []);
    }
    return desk;
  }, []);

  React.useEffect(() => {
    loadDesk()
      .then((desk) => {
        if (desk.success && desk.days?.length) {
          setDay((prev) => (desk.days.some((d) => d.dayNumber === prev) ? prev : desk.days[0].dayNumber));
        }
      })
      .catch(() => {});
    getAverageReviewPrompt().then(setReview).catch(() => {});
  }, [loadDesk]);

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

        <div>
          <label className="text-xs font-bold block mb-1">Find player</label>
          <Input
            value={playerQuery}
            onChange={(e) => setPlayerQuery(e.target.value)}
            placeholder="Type a name…"
            className="h-9 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold block mb-1">Player</label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm font-semibold"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              {(filteredUsers.length ? filteredUsers : users).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.username}
                  {Number(u.target) > 0 ? ` · tgt ${u.target}` : ''}
                </option>
              ))}
            </select>
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
            Day {day} already has boards from the {existing.source.toLowerCase()}
            {existing.enteredByName && existing.source !== 'Player' ? ` (${existing.enteredByName})` : ''}.
            {' '}They are filled in below — edit if needed, then save.
          </div>
        ) : (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs font-semibold text-muted-foreground">
            No score for this player on Day {day} yet. Enter boards below and save.
          </div>
        )}

        <BoardScoreEditor boards={boards} onChange={setBoards} target={target} />
        {msg && <p className="text-xs font-semibold">{msg}</p>}
        <Button
          disabled={busy || !userId}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            const payload = draftToPayload(boards);
            const res = await organiserUpsertPlayerDayScore(userId, day, 0, 0, payload);
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
