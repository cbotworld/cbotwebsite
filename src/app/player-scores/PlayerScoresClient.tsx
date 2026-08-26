'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function PlayerScoresClient({
  editionTitle,
  days,
  teams,
  scores,
}: {
  editionTitle: string;
  days: Array<{ dayNumber: number; published: boolean; calendarDate: string }>;
  teams: Array<{ id: string; name: string; tag: string; players: Array<{ id: string; name: string }> }>;
  scores: Array<{ userId: string; dayNumber: number; score: number; slams: number }>;
}) {
  const latestPublished = [...days].reverse().find((d) => d.published)?.dayNumber || days[0]?.dayNumber || 1;
  const [day, setDay] = React.useState(latestPublished);
  const selected = days.find((d) => d.dayNumber === day) || days[0];
  const byUser = new Map(
    scores.filter((s) => s.dayNumber === day).map((s) => [s.userId, s]),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Badge variant="carrom" className="mb-2">Day-wise scores</Badge>
        <h1 className="text-3xl font-black tracking-tight">Player Scores</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {editionTitle} — published at 8:00pm IST so captains can set combis.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {days.map((d) => (
          <button
            key={d.dayNumber}
            type="button"
            onClick={() => setDay(d.dayNumber)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black border ${
              day === d.dayNumber ? 'bg-amber-500 text-slate-950 border-amber-400' : 'border-border text-muted-foreground'
            }`}
          >
            Day {d.dayNumber}
          </button>
        ))}
      </div>
      {!selected?.published ? (
        <Card className="border-amber-500/30">
          <CardContent className="p-6 text-sm font-semibold text-muted-foreground">
            Day {day} publishes at 8:00pm IST on {selected?.calendarDate}. Scores stay hidden until then.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map((team) => (
            <Card key={team.id} className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-black">{team.name}</CardTitle>
                <CardDescription>{team.tag}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {team.players.map((player) => {
                  const row = byUser.get(player.id);
                  return (
                    <div key={player.id} className="flex items-center justify-between text-sm border-b border-border/40 pb-1.5 last:border-0">
                      <span className="font-semibold">{player.name}</span>
                      {row ? (
                        <span className="font-mono text-xs font-bold">
                          {row.score} <span className="text-muted-foreground">({row.slams} slams)</span>
                        </span>
                      ) : (
                        <span className="text-xs font-black text-rose-400 uppercase">Walkover</span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
