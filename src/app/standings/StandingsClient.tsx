'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function StandingsClient({ payload }: { payload: any }) {
  const blocks = payload.blocks || [];
  const [tab, setTab] = React.useState<'teams' | 'players'>('teams');
  const [stageId, setStageId] = React.useState(blocks.find((b: any) => b.current)?.stageId || blocks[0]?.stageId || '');
  const stage = blocks.find((b: any) => b.stageId === stageId) || blocks[0];
  const players = payload.players || [];
  const placement = payload.placement || [];
  const rankingReady = players.some((row: any) => Number(row.daysCounted) > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Badge variant="carrom" className="mb-2">Standings</Badge>
        <h1 className="text-3xl font-black tracking-tight">{payload.edition?.title || 'Team Standings'}</h1>
        <p className="text-sm text-muted-foreground mt-1">One table per organiser stage. Points reset when a new stage starts.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setTab('teams')} className={`px-3 py-1.5 rounded-lg text-xs font-black border ${tab === 'teams' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'border-border'}`}>Teams</button>
        <button type="button" onClick={() => setTab('players')} className={`px-3 py-1.5 rounded-lg text-xs font-black border ${tab === 'players' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'border-border'}`}>Players</button>
      </div>

      {tab === 'players' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-black">Player ranking</CardTitle>
            <p className="text-xs text-muted-foreground">Lowest total score ranks first. Walkover counts as that day’s average + 1.</p>
          </CardHeader>
          <CardContent>
            {players.length === 0 || !rankingReady ? (
              <p className="text-sm text-muted-foreground">Publishes after the first 8:00pm IST score lock.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>WO</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map((row: any) => (
                    <TableRow key={row.userId}>
                      <TableCell className="font-black">{row.rank}</TableCell>
                      <TableCell className="font-semibold">{row.name}</TableCell>
                      <TableCell>{row.teamName}</TableCell>
                      <TableCell>{row.daysCounted}</TableCell>
                      <TableCell>{row.walkovers}</TableCell>
                      <TableCell className="font-mono font-bold">{row.totalScore}</TableCell>
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
                          <TableHead>Avg+</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Won</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(g.rows || []).map((row: any) => (
                          <TableRow key={row.teamId}>
                            <TableCell className="font-black">{row.rank}</TableCell>
                            <TableCell className="font-semibold">{row.teamName}</TableCell>
                            <TableCell>{row.eventPts}</TableCell>
                            <TableCell>{row.slamBonus}</TableCell>
                            <TableCell>{row.avgBonus}</TableCell>
                            <TableCell className="font-black">{row.total}</TableCell>
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
    </div>
  );
}
