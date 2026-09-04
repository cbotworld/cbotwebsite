'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldAlert, Info, Flame, Trophy, Activity, Users } from 'lucide-react';

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

function constraintBadgeLabel(appliedConstraint?: string) {
  switch (appliedConstraint) {
    case 'EVENT_LOSS':
      return 'Event Loss (Opponents + 1)';
    case 'GRADE_WORST':
      return 'Grade Worst (Day Max + 1)';
    case 'TARGET_LOSS':
      return 'Target Loss (Target + 1)';
    default:
      return 'Calculated Penalty';
  }
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
  const [selectedPlayer, setSelectedPlayer] = React.useState<any | null>(null);

  const days = open?.row?.days || [];
  const targetBonusDays = open && (open.focus === 'avg' || open.focus === 'total') ? playerBonusCards(days, 'target') : [];
  const slamBonusDays = open && (open.focus === 'slams' || open.focus === 'total') ? playerBonusCards(days, 'slams') : [];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div>
        <Badge variant="carrom" className="mb-2">Standings</Badge>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{data.edition?.title || 'Team Standings'}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          One table per organiser stage. Position is total points, then matches won if points are tied, then slams. Tap Event, Slams, Target+ or Total for the day-wise breakdown after each day completes.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('teams')}
          className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${
            tab === 'teams' ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' : 'border-border bg-card/60 text-muted-foreground'
          }`}
        >
          Teams
        </button>
        <button
          type="button"
          onClick={() => setTab('players')}
          className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${
            tab === 'players' ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' : 'border-border bg-card/60 text-muted-foreground'
          }`}
        >
          Players
        </button>
      </div>

      {tab === 'players' ? (
        <Card className="border-border/80 bg-card/70 backdrop-blur-sm shadow-xl">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" /> Player Ranking
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Ranked by player average, lowest first (calculated as progressive (current average + day average) / 2 including walkovers from Day 1). Players with the same average share the same ranking.
            </p>
          </CardHeader>
          <CardContent className="pt-3">
            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players on the edition roster yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">Slams</TableHead>
                    <TableHead className="text-center">WO</TableHead>
                    <TableHead className="text-right">Avg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map((row: any) => (
                    <TableRow
                      key={row.userId}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setSelectedPlayer(row)}
                    >
                      <TableCell className="font-black text-amber-500">{row.rank}</TableCell>
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-2">
                          <span>{row.name}</span>
                          {row.grade && (
                            <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {row.grade}
                            </span>
                          )}
                          {row.target !== null && row.target !== undefined && Number(row.target) > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              T: {row.target}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{row.teamName}</TableCell>
                      <TableCell className="text-center">
                        {row.slams > 0 ? (
                          <span className="text-xs font-bold text-amber-400 flex items-center justify-center gap-0.5">
                            <Flame className="h-3 w-3 fill-amber-400 text-amber-500" /> {row.slams}
                          </span>
                        ) : (
                          '0'
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.walkovers > 0 ? (
                          <Badge variant="destructive" className="text-[10px] font-black px-1.5 py-0 bg-rose-500/20 text-rose-300 border-rose-500/40">
                            {row.walkovers} WO
                          </Badge>
                        ) : (
                          '0'
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-foreground">
                        {row.boardAverage == null ? '—' : Number(row.boardAverage).toFixed(2)}
                      </TableCell>
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
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black border transition-all ${
                  stageId === b.stageId ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' : 'border-border bg-card/60 text-muted-foreground'
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
                            <TableCell className="font-semibold">
                              <div className="flex items-center gap-2">
                                {row.teamLogo ? (
                                  <img src={row.teamLogo} alt={row.teamName} className="w-6 h-6 rounded-full object-cover bg-slate-900 border border-border" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-slate-800 border border-border flex items-center justify-center text-[10px] text-slate-400 font-bold">
                                    {row.teamName?.[0]}
                                  </div>
                                )}
                                <span>{row.teamName}</span>
                              </div>
                            </TableCell>
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

      {/* ── Team Day Points Dialog ──────────────────────────────────────────── */}
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
          <p className="text-sm text-muted-foreground">No completed days in this stage yet. Breakdown appears after 9:00pm IST (scores) and 9:30pm IST (event points).</p>
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

      {/* ── Player Score & Walkover Breakdown Dialog ────────────────────────── */}
      <Dialog open={Boolean(selectedPlayer)} onOpenChange={(next) => !next && setSelectedPlayer(null)}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              {selectedPlayer?.name}
            </DialogTitle>
            {selectedPlayer?.grade && (
              <Badge variant="carrom" className="text-xs font-black uppercase">
                {selectedPlayer.grade}
              </Badge>
            )}
          </div>
          <DialogDescription>
            {selectedPlayer?.teamName} · Overall Rank #{selectedPlayer?.rank} · Average: {selectedPlayer?.boardAverage == null ? '—' : Number(selectedPlayer?.boardAverage).toFixed(2)}
            {selectedPlayer?.target ? ` · Target: ${selectedPlayer.target}` : ''}
          </DialogDescription>
        </DialogHeader>

        {selectedPlayer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Rank</div>
                <div className="text-base font-black text-amber-400">#{selectedPlayer.rank}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Average</div>
                <div className="text-base font-black text-foreground">{selectedPlayer.boardAverage == null ? '—' : Number(selectedPlayer.boardAverage).toFixed(2)}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Matches Won</div>
                <div className="text-base font-black text-foreground">{selectedPlayer.matchesWon ?? 0}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Walkovers</div>
                <div className="text-base font-black text-rose-400">{selectedPlayer.walkovers ?? 0}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Day-by-Day Scores & Walkover Calculations
              </div>

              {(!selectedPlayer.dayScores || selectedPlayer.dayScores.length === 0) ? (
                <p className="text-xs text-muted-foreground italic py-3 text-center">No scores recorded yet for this player.</p>
              ) : (
                <div className="space-y-2">
                  {selectedPlayer.dayScores.map((ds: any) => {
                    const isWo = Boolean(ds.isWalkover);
                    const b = ds.breakdown;

                    return (
                      <div
                        key={ds.dayNumber}
                        className={`p-3 rounded-xl border text-xs space-y-2 ${
                          isWo
                            ? 'bg-rose-950/20 border-rose-500/40'
                            : 'bg-background/80 border-border/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold flex items-center gap-2">
                            <span>Day {ds.dayNumber}</span>
                            {ds.eventName && (
                              <span className="text-[10px] text-muted-foreground">({ds.eventName})</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {isWo ? (
                              <Badge variant="destructive" className="text-[10px] font-black px-2 py-0.5 bg-rose-500/20 text-rose-300 border-rose-500/50">
                                Walkover: {ds.score} pts
                              </Badge>
                            ) : (
                              <Badge variant="carrom" className="text-[10px] font-black px-2 py-0.5">
                                {ds.score} pts
                              </Badge>
                            )}

                            {ds.slams > 0 && (
                              <span className="text-amber-400 font-bold flex items-center gap-0.5">
                                <Flame className="h-3 w-3 fill-amber-400 text-amber-500" /> {ds.slams}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* If Walkover with breakdown */}
                        {isWo && b && (
                          <div className="p-2.5 rounded-lg bg-slate-950/70 border border-rose-500/30 text-[11px] space-y-1.5">
                            <div className="text-[10px] font-black text-rose-300 flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3 text-rose-400" />
                              Auto Walkover Calculation Breakdown
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px]">
                              <div className="p-1.5 rounded bg-card/60 border border-border/40">
                                <div className="text-muted-foreground">1. Event Loss</div>
                                <div className="font-bold text-foreground">{b.eventLossScore} pts</div>
                                <div className="text-[9px] text-muted-foreground/80">Opp({b.opponentsTotal})+1 - Tm({b.teammatesTotal})</div>
                              </div>
                              <div className="p-1.5 rounded bg-card/60 border border-border/40">
                                <div className="text-muted-foreground">2. Grade Worst</div>
                                <div className="font-bold text-foreground">{b.gradeWorstScore} pts</div>
                                <div className="text-[9px] text-muted-foreground/80">Grade Max({b.gradeMaxDayScore ?? 'N/A'})+1</div>
                              </div>
                              <div className="p-1.5 rounded bg-card/60 border border-border/40">
                                <div className="text-muted-foreground">3. Target Loss</div>
                                <div className="font-bold text-foreground">{b.targetLossScore > 0 ? `${b.targetLossScore} pts` : 'None'}</div>
                                <div className="text-[9px] text-muted-foreground/80">{selectedPlayer.target ? `Target(${selectedPlayer.target})+1` : 'No target'}</div>
                              </div>
                            </div>
                            <div className="text-[10px] text-rose-300 font-bold pt-1 border-t border-rose-500/20">
                              Result: max({b.eventLossScore}, {b.gradeWorstScore}, {b.targetLossScore || 0}) = <span className="text-amber-400">{ds.score} pts</span> ({constraintBadgeLabel(b.appliedConstraint)})
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
