'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldAlert, Info, Flame, Trophy, Activity, Users, Calculator, Search, X } from 'lucide-react';

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

  const [playerSearch, setPlayerSearch] = React.useState('');

  const filteredPlayers = React.useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p: any) => {
      const name = (p.name || '').toLowerCase();
      const team = (p.teamName || '').toLowerCase();
      const grade = (p.grade || '').toLowerCase();
      return name.includes(q) || team.includes(q) || grade.includes(q);
    });
  }, [players, playerSearch]);

  const days = open?.row?.days || [];
  const targetBonusDays = open && (open.focus === 'avg' || open.focus === 'total') ? playerBonusCards(days, 'target') : [];
  const slamBonusDays = open && (open.focus === 'slams' || open.focus === 'total') ? playerBonusCards(days, 'slams') : [];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div>
        <Badge variant="carrom" className="mb-2">Standings</Badge>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{data.edition?.title || 'Team Standings'}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          One table per organiser stage. Position is determined by <strong>Total Points</strong>. If points are tied between teams, <strong>Number of Match Wins</strong> is considered. If wins are also tied, <strong>Team Total Score</strong> (including walkover scores) determines the rank. Tap Event, Slams, Target+ or Total for the day-wise breakdown.
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" /> Player Ranking
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ranked by player average, lowest first. Players with the same average share the same ranking.
                </p>
              </div>

              {/* Player Search Input */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search player, team, grade..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="pl-9 pr-8 h-9 text-xs font-semibold bg-background/90 border-border shadow-xs focus-visible:ring-amber-500"
                />
                {playerSearch && (
                  <button
                    type="button"
                    onClick={() => setPlayerSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            {playerSearch && (
              <div className="text-[11px] text-muted-foreground font-medium pt-1">
                Showing <strong className="text-amber-400 font-bold">{filteredPlayers.length}</strong> of {players.length} players for &ldquo;{playerSearch}&rdquo;
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-3">
            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players on the edition roster yet.</p>
            ) : filteredPlayers.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs text-muted-foreground font-medium">No players found matching &ldquo;{playerSearch}&rdquo;</p>
                <button
                  type="button"
                  onClick={() => setPlayerSearch('')}
                  className="text-xs text-amber-400 font-bold underline hover:text-amber-300"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">Matches</TableHead>
                    <TableHead className="text-center">Slams</TableHead>
                    <TableHead className="text-center">WO</TableHead>
                    <TableHead className="text-right">Avg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlayers.map((row: any) => (
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
                      <TableCell className="text-center font-bold text-xs text-foreground">
                        {row.matches ?? row.daysCounted ?? 0}
                      </TableCell>
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
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead className="text-center">Total</TableHead>
                          <TableHead className="text-center">Won</TableHead>
                          <TableHead className="text-center font-bold text-foreground">Team Score</TableHead>
                          <TableHead className="text-center">Event</TableHead>
                          <TableHead className="text-center">Slams</TableHead>
                          <TableHead className="text-center">Target+</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(g.rows || []).map((row: any) => (
                          <TableRow key={row.teamId} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-black text-amber-500">{row.rank}</TableCell>
                            <TableCell className="font-semibold">
                              <div className="flex items-center gap-2">
                                {row.teamLogo ? (
                                  <img src={row.teamLogo} alt={row.teamName} className="w-6 h-6 rounded-full object-cover bg-slate-900 border border-border" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-slate-800 border border-border flex items-center justify-center text-[10px] text-slate-400 font-bold">
                                    {row.teamName?.[0]}
                                  </div>
                                )}
                                <span className="truncate">{row.teamName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-black">
                              <StatButton value={row.total} onClick={() => setOpen({ row, focus: 'total' })} className="font-black text-amber-400" />
                            </TableCell>
                            <TableCell className="text-center font-bold">{row.matchesWon}</TableCell>
                            <TableCell className="text-center font-mono font-bold text-foreground">
                              {row.teamScore ?? 0}
                            </TableCell>
                            <TableCell className="text-center">
                              <StatButton value={row.eventPts} onClick={() => setOpen({ row, focus: 'event' })} />
                            </TableCell>
                            <TableCell className="text-center">
                              <StatButton value={row.slamBonus} onClick={() => setOpen({ row, focus: 'slams' })} />
                            </TableCell>
                            <TableCell className="text-center">
                              <StatButton value={row.avgBonus} onClick={() => setOpen({ row, focus: 'avg' })} />
                            </TableCell>
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
                  <TableHead className={open?.focus === 'total' ? 'text-amber-400 font-black' : 'font-bold'}>Total Pts</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead className="font-bold text-foreground">Team Score</TableHead>
                  <TableHead className={open?.focus === 'event' ? 'text-amber-400' : ''}>Event</TableHead>
                  <TableHead className={open?.focus === 'slams' ? 'text-amber-400' : ''}>Slams</TableHead>
                  <TableHead className={open?.focus === 'avg' ? 'text-amber-400' : ''}>Target+</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map((d: any) => (
                  <TableRow key={d.dayNumber}>
                    <TableCell className="font-black">Day {d.dayNumber}</TableCell>
                    <TableCell>{d.opponentName || '—'}</TableCell>
                    <TableCell className={open?.focus === 'total' ? 'font-black text-amber-400' : 'font-black'}>{d.total}</TableCell>
                    <TableCell className="font-bold">{d.matchResult || '—'}</TableCell>
                    <TableCell className="font-mono font-bold text-foreground">{d.teamScore ?? '—'}</TableCell>
                    <TableCell className={open?.focus === 'event' ? 'font-black text-amber-400' : ''}>{d.eventPts}</TableCell>
                    <TableCell className={open?.focus === 'slams' ? 'font-black text-amber-400' : ''}>{d.slamBonus}</TableCell>
                    <TableCell className={open?.focus === 'avg' ? 'font-black text-amber-400' : ''}>{d.avgBonus}</TableCell>
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
                  {d.events.map((ev: any, i: number) => {
                    const isWin = String(ev.result || '').includes('Win');
                    const isLoss = String(ev.result || '').includes('Loss');
                    const isWO = String(ev.result || '').includes('WO') || ev.reason === 'walkover' || ev.reason === 'double-walkover';
                    return (
                      <div key={`${d.dayNumber}-${i}`} className="text-xs grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-border/60 pt-2.5">
                        <div className="flex flex-col gap-0.5">
                          <div className="font-bold flex items-center gap-1.5 flex-wrap">
                            <span>{ev.name}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                isWin
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : isLoss
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : isWO
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-muted text-muted-foreground border border-border'
                              }`}
                            >
                              {ev.result} · {ev.myPts}–{ev.oppPts}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <span className="font-bold text-sky-400">YOU</span>
                          <span className="text-muted-foreground"> · </span>
                          {ev.myPlayerList && ev.myPlayerList.length > 0 ? (
                            ev.myPlayerList.map((p: any, idx: number) => (
                              <span key={p.id || idx}>
                                {idx > 0 && ', '}
                                <span className={p.isWalkover ? 'text-amber-400 font-bold' : 'font-medium'}>
                                  {p.name}
                                  {p.score != null ? ` (${p.score})` : ''}
                                  {p.isWalkover && (
                                    <span className="ml-1 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">
                                      Walkover
                                    </span>
                                  )}
                                </span>
                              </span>
                            ))
                          ) : (
                            <span>{ev.myPlayers || '—'}</span>
                          )}
                          {ev.myScore != null && (
                            <span className="font-mono text-muted-foreground font-bold ml-1">
                              = {ev.myScore}
                            </span>
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <span className="font-bold text-rose-400">OPP</span>
                          <span className="text-muted-foreground"> · </span>
                          {ev.oppPlayerList && ev.oppPlayerList.length > 0 ? (
                            ev.oppPlayerList.map((p: any, idx: number) => (
                              <span key={p.id || idx}>
                                {idx > 0 && ', '}
                                <span className={p.isWalkover ? 'text-amber-400 font-bold' : 'font-medium'}>
                                  {p.name}
                                  {p.score != null ? ` (${p.score})` : ''}
                                  {p.isWalkover && (
                                    <span className="ml-1 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">
                                      Walkover
                                    </span>
                                  )}
                                </span>
                              </span>
                            ))
                          ) : (
                            <span>{ev.oppPlayers || '—'}</span>
                          )}
                          {ev.oppScore != null && (
                            <span className="font-mono text-muted-foreground font-bold ml-1">
                              = {ev.oppScore}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Rank</div>
                <div className="text-base font-black text-amber-400">#{selectedPlayer.rank}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Average</div>
                <div className="text-base font-black text-foreground">{selectedPlayer.boardAverage == null ? '—' : Number(selectedPlayer.boardAverage).toFixed(2)}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Matches</div>
                <div className="text-base font-black text-foreground">{selectedPlayer.matches ?? selectedPlayer.daysCounted ?? 0}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Slams</div>
                <div className="text-base font-black text-amber-400">{selectedPlayer.slams ?? 0}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Walkovers</div>
                <div className="text-base font-black text-rose-400">{selectedPlayer.walkovers ?? 0}</div>
              </div>
            </div>

            {/* Tournament Average Formula & Calculation Card */}
            {selectedPlayer.dayScores && selectedPlayer.dayScores.length > 0 && (() => {
              const dayItems = selectedPlayer.dayScores.map((ds: any) => {
                const bCount = ds.boardCount || 4;
                const dAvg = ds.dayAverage != null ? Number(ds.dayAverage) : Math.round((ds.score / bCount) * 100) / 100;
                return { ...ds, bCount, dAvg };
              });
              const sumDayAverages = dayItems.reduce((acc: number, curr: any) => acc + curr.dAvg, 0);
              const totalMatchesCount = dayItems.length;
              const computedAvg = totalMatchesCount > 0 ? (Math.round((sumDayAverages / totalMatchesCount) * 100) / 100).toFixed(2) : '0.00';

              return (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                  <div className="flex items-center justify-between font-black text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <Calculator className="h-4 w-4 text-amber-400" />
                      Tournament Average Calculation Breakdown
                    </span>
                    <Badge variant="carrom" className="text-xs font-black">
                      Avg: {computedAvg}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono leading-relaxed bg-background/80 p-2.5 rounded-lg border border-border/60 space-y-1">
                    <div>
                      <span className="text-amber-400 font-bold">Formula:</span> (Sum of Daily Match Averages) ÷ (Total Matches)
                    </div>
                    <div className="text-foreground/90">
                      <span className="text-amber-400 font-bold">Sum of Match Averages:</span> {dayItems.map((d: any) => d.dAvg.toFixed(2)).join(' + ')} = <span className="text-amber-400 font-bold">{sumDayAverages.toFixed(2)}</span>
                    </div>
                    <div className="text-foreground/90">
                      <span className="text-amber-400 font-bold">Calculation:</span> {sumDayAverages.toFixed(2)} ÷ {totalMatchesCount} matches = <span className="text-amber-400 font-black text-xs">{computedAvg}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">
              <div className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Day-by-Day Scores & Calculations
              </div>

              {(!selectedPlayer.dayScores || selectedPlayer.dayScores.length === 0) ? (
                <p className="text-xs text-muted-foreground italic py-3 text-center">No scores recorded yet for this player.</p>
              ) : (
                <div className="space-y-2">
                  {selectedPlayer.dayScores.map((ds: any) => {
                    const isWo = Boolean(ds.isWalkover);
                    const b = ds.breakdown;
                    const bCount = ds.boardCount || 4;
                    const dAvg = ds.dayAverage != null ? Number(ds.dayAverage) : Math.round((ds.score / bCount) * 100) / 100;

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

                        {/* Match Average Calculation Line */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px]">
                          <div className="text-muted-foreground font-medium">
                            Score: <strong className="text-foreground">{ds.score} pts</strong> across <strong className="text-foreground">{bCount} boards</strong>
                          </div>
                          <div className="font-mono font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                            Day Avg = {ds.score} ÷ {bCount} = {dAvg.toFixed(2)}
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
