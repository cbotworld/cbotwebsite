'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type FocusCol = 'event' | 'slams' | 'avg' | 'total';

function playerBonusCards(days: any[], kind: 'target' | 'slams') {
  return days
    .map((d: any) => {
      const players = kind === 'target' ? d.targetBonusPlayers || [] : d.slamPlayers || [];
      return { day: d, players };
    })
    .filter((x: { players: any[] }) => x.players.length > 0);
}

function StatButton({
  value,
  onClick,
  className,
}: {
  value: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`underline decoration-dotted decoration-amber-500/70 underline-offset-4 hover:text-amber-400 cursor-pointer ${className || ''}`}
    >
      {value}
    </button>
  );
}

export default function StandingsClient({ payload }: { payload: any }) {
  const data = payload || {};
  const blocks = Array.isArray(data.blocks) ? data.blocks : [];
  const [tab, setTab] = React.useState<'teams' | 'players'>('teams');
  const [stageId, setStageId] = React.useState(blocks.find((b: any) => b.current)?.stageId || blocks[0]?.stageId || '');
  const stage = blocks.find((b: any) => b.stageId === stageId) || blocks[0];
  const players = Array.isArray(data.players) ? data.players : [];
  const placement = Array.isArray(data.placement) ? data.placement : [];
  const [open, setOpen] = React.useState<{ row: any; focus: FocusCol } | null>(null);
  const days = open?.row?.days || [];
  const targetBonusDays = open && (open.focus === 'avg' || open.focus === 'total') ? playerBonusCards(days, 'target') : [];
  const slamBonusDays = open && (open.focus === 'slams' || open.focus === 'total') ? playerBonusCards(days, 'slams') : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Badge variant="carrom" className="mb-2">Standings</Badge>
        <h1 className="text-3xl font-black tracking-tight">{data.edition?.title || 'Team Standings'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          One table per organiser stage. Position is total points, then matches won if points are tied, then slams. Tap Event, Slams, Target+ or Total for the day-wise breakdown after each day completes.
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setTab('teams')} className={`px-3 py-1.5 rounded-lg text-xs font-black border ${tab === 'teams' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'border-border'}`}>Teams</button>
        <button type="button" onClick={() => setTab('players')} className={`px-3 py-1.5 rounded-lg text-xs font-black border ${tab === 'players' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'border-border'}`}>Players</button>
      </div>

      {tab === 'players' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-black">Player ranking</CardTitle>
            <p className="text-xs text-muted-foreground">Ranked by current average, lowest first. If averages are equal, more matches won ranks higher, then more slams.</p>
          </CardHeader>
          <CardContent>
            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players on the edition roster yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Boards</TableHead>
                    <TableHead>WO</TableHead>
                    <TableHead>Avg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map((row: any) => (
                    <TableRow key={row.userId}>
                      <TableCell className="font-black">{row.rank}</TableCell>
                      <TableCell className="font-semibold">{row.name}</TableCell>
                      <TableCell>{row.teamName}</TableCell>
                      <TableCell>{row.boardCount}</TableCell>
                      <TableCell>{row.walkovers}</TableCell>
                      <TableCell className="font-mono font-bold">{row.boardAverage == null ? '—' : Number(row.boardAverage).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stages configured yet.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {blocks.map((b: any) => (
              <button
                key={b.stageId}
                type="button"
                onClick={() => setStageId(b.stageId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black border ${
                  stageId === b.stageId ? 'bg-amber-500 text-slate-950 border-amber-400' : 'border-border'
                }`}
              >
                {b.name}{b.current ? ' • now' : ''}
              </button>
            ))}
          </div>
          {!stage ? (
            <p className="text-sm text-muted-foreground">No stages configured yet.</p>
          ) : stage.knockout?.length ? (
            <div className="space-y-3">
              {stage.knockout.map((m: any, i: number) => (
                <Card key={`${m.label}-${i}`}>
                  <CardContent className="p-4 flex items-center justify-between gap-3 text-sm">
                    <div>
                      <div className="text-[10px] font-black uppercase text-muted-foreground">{m.label}</div>
                      <div className="font-bold">{m.team1Name} vs {m.team2Name}</div>
                    </div>
                    <div className="font-mono text-xs">
                      {m.team1EventPts == null ? 'After 9:30pm' : `${m.team1EventPts} – ${m.team2EventPts}`}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {placement.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-lg font-black">Final ranking 1–8</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {placement.map((p: any) => (
                      <div key={p.place} className="flex justify-between text-sm">
                        <span className="font-black">{p.place}.</span>
                        <span className="font-semibold">{p.teamName}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {stage.kind === 'LEAGUE' ? (
                <p className="text-xs text-muted-foreground">Groups from Round Robin positions</p>
              ) : null}
              {(stage.groups || []).map((g: any) => (
                <Card key={g.key}>
                  <CardHeader>
                    <CardTitle className="text-lg font-black">{g.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead>Event</TableHead>
                          <TableHead>Slams</TableHead>
                          <TableHead>Target+</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Won</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(g.rows || []).map((row: any) => (
                          <TableRow key={row.teamId}>
                            <TableCell className="font-black">{row.rank}</TableCell>
                            <TableCell className="font-semibold">{row.teamName}</TableCell>
                            <TableCell>
                              <StatButton value={row.eventPts} onClick={() => setOpen({ row, focus: 'event' })} />
                            </TableCell>
                            <TableCell>
                              <StatButton value={row.slamBonus} onClick={() => setOpen({ row, focus: 'slams' })} />
                            </TableCell>
                            <TableCell>
                              <StatButton value={row.avgBonus} onClick={() => setOpen({ row, focus: 'avg' })} />
                            </TableCell>
                            <TableCell className="font-black">
                              <StatButton value={row.total} onClick={() => setOpen({ row, focus: 'total' })} className="font-black" />
                            </TableCell>
                            <TableCell>{row.matchesWon}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogHeader>
          <DialogTitle>{open?.row?.teamName} · day-wise points</DialogTitle>
          <DialogDescription>
            {open?.focus === 'event'
              ? 'Event points from each completed combi day (after 9:30pm IST).'
              : open?.focus === 'slams'
                ? 'Slam bonus · +1 per published slam. Players who scored slams are listed by day.'
                : open?.focus === 'avg'
                  ? 'Target bonus · +1 when a published day’s score is strictly below that day’s target. Players who earned it are listed by day.'
                  : 'Event + slams + target bonus, day by day after the day completes.'}
          </DialogDescription>
        </DialogHeader>
        {!days.length ? (
          <p className="text-sm text-muted-foreground">No completed days in this stage yet. Breakdown appears after 8:00pm IST (scores) and 9:30pm IST (event points).</p>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Vs</TableHead>
                  <TableHead className={open?.focus === 'event' ? 'text-amber-400' : ''}>Event</TableHead>
                  <TableHead className={open?.focus === 'slams' ? 'text-amber-400' : ''}>Slams</TableHead>
                  <TableHead className={open?.focus === 'avg' ? 'text-amber-400' : ''}>Target+</TableHead>
                  <TableHead className={open?.focus === 'total' ? 'text-amber-400' : ''}>Total</TableHead>
                  <TableHead>Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map((d: any) => (
                  <TableRow key={d.dayNumber}>
                    <TableCell className="font-black">Day {d.dayNumber}</TableCell>
                    <TableCell>{d.opponentName || '—'}</TableCell>
                    <TableCell className={open?.focus === 'event' ? 'font-black text-amber-400' : ''}>{d.eventPts}</TableCell>
                    <TableCell className={open?.focus === 'slams' ? 'font-black text-amber-400' : ''}>{d.slamBonus}</TableCell>
                    <TableCell className={open?.focus === 'avg' ? 'font-black text-amber-400' : ''}>{d.avgBonus}</TableCell>
                    <TableCell className={open?.focus === 'total' ? 'font-black text-amber-400' : 'font-black'}>{d.total}</TableCell>
                    <TableCell>{d.matchResult || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {days.map((d: any) =>
              (open?.focus === 'event' || open?.focus === 'total') && d.events?.length ? (
                <div key={`ev-${d.dayNumber}`} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wide text-amber-500">
                    Day {d.dayNumber} combis {d.opponentName ? `vs ${d.opponentName}` : ''}
                  </div>
                  {d.events.map((ev: any, i: number) => (
                    <div key={`${d.dayNumber}-${i}`} className="text-xs grid grid-cols-1 sm:grid-cols-3 gap-1 border-t border-border/60 pt-2">
                      <div className="font-bold">{ev.name} · {ev.result} · {ev.myPts}–{ev.oppPts}</div>
                      <div>YOU · {ev.myPlayers || '—'}{ev.myScore != null ? ` (${ev.myScore})` : ''}</div>
                      <div>OPP · {ev.oppPlayers || '—'}{ev.oppScore != null ? ` (${ev.oppScore})` : ''}</div>
                    </div>
                  ))}
                </div>
              ) : null,
            )}
            {(open?.focus === 'avg' || open?.focus === 'total') && (
              targetBonusDays.length === 0 ? (
                open?.focus === 'avg' ? (
                  <p className="text-sm text-muted-foreground">No player scored under target on a published day yet.</p>
                ) : null
              ) : (
                targetBonusDays.map(({ day, players }) => (
                  <div key={`tgt-${day.dayNumber}`} className="rounded-xl border border-border p-3 space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-wide text-amber-500">
                      Day {day.dayNumber} target bonus {day.opponentName ? `vs ${day.opponentName}` : ''} · +{day.avgBonus}
                    </div>
                    {players.map((p: any) => (
                      <div key={`${day.dayNumber}-${p.userId}`} className="text-xs flex flex-wrap justify-between gap-2 border-t border-border/60 pt-2">
                        <span className="font-bold">{p.name}</span>
                        <span className="font-mono text-muted-foreground">
                          {p.score} (target {p.target ?? '—'}) · +1
                        </span>
                      </div>
                    ))}
                  </div>
                ))
              )
            )}
            {slamBonusDays.map(({ day, players }) => (
                <div key={`slm-${day.dayNumber}`} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wide text-amber-500">
                    Day {day.dayNumber} slams {day.opponentName ? `vs ${day.opponentName}` : ''} · +{day.slamBonus}
                  </div>
                  {players.map((p: any) => (
                    <div key={`${day.dayNumber}-${p.userId}`} className="text-xs flex flex-wrap justify-between gap-2 border-t border-border/60 pt-2">
                      <span className="font-bold">{p.name}</span>
                      <span className="font-mono text-muted-foreground">{p.slams} slam{p.slams === 1 ? '' : 's'} · +{p.slams}</span>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </Dialog>
    </div>
  );
}
