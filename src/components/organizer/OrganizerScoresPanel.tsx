'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  organiserUpsertPlayerDayScore,
  getPublicScoreboard,
  getAverageReviewPrompt,
} from '@/lib/actions/playerScoreActions';

export default function OrganizerScoresPanel({ users }: { users: Array<{ id: string; name?: string; username?: string }> }) {
  const [day, setDay] = React.useState(1);
  const [userId, setUserId] = React.useState(users[0]?.id || '');
  const [score, setScore] = React.useState('');
  const [slams, setSlams] = React.useState('0');
  const [msg, setMsg] = React.useState<string | null>(null);
  const [board, setBoard] = React.useState<any>(null);
  const [review, setReview] = React.useState<{ finishedStageName: string; nextStageName: string | null } | null>(null);

  React.useEffect(() => {
    getPublicScoreboard().then(setBoard).catch(() => {});
    getAverageReviewPrompt().then(setReview).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!userId && users[0]?.id) setUserId(users[0].id);
  }, [users, userId]);

  React.useEffect(() => {
    if (!board || !userId) return;
    const row = (board.scores || []).find((s: any) => s.userId === userId && s.dayNumber === day);
    setScore(row ? String(row.score) : '');
    setSlams(row ? String(row.slams) : '0');
  }, [board, userId, day]);

  return (
    <Card className="border-amber-500/30">
      <CardHeader>
        <CardTitle className="text-xl font-black">Edit player scores</CardTitle>
        <CardDescription>
          Full access after 8pm and after combis. Team points, slams, average bonuses, and player rank recompute immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
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
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.username}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">Day</label>
            <Input type="number" min={1} value={day} onChange={(e) => setDay(parseInt(e.target.value, 10) || 1)} />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">Score</label>
            <Input type="number" min={0} value={score} onChange={(e) => setScore(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">Slams</label>
            <Input type="number" min={0} value={slams} onChange={(e) => setSlams(e.target.value)} />
          </div>
        </div>
        {msg && <p className="text-xs font-semibold">{msg}</p>}
        <Button
          onClick={async () => {
            const res = await organiserUpsertPlayerDayScore(userId, day, parseInt(score, 10), parseInt(slams || '0', 10));
            setMsg(res.success ? 'Saved. Standings will use this score.' : res.error || 'Failed');
            if (res.success) setBoard(await getPublicScoreboard());
          }}
        >
          Save score
        </Button>
        {board?.days?.length ? (
          <p className="text-[11px] text-muted-foreground">
            Latest published day: {board.days.filter((d: any) => d.published).pop()?.dayNumber || 'none yet'}. Average changes still use the existing player edit form — they apply from tomorrow.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
