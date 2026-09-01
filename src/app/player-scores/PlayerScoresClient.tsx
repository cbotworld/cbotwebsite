'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trophy, Shield, Activity, Users, Flame } from 'lucide-react';

export default function PlayerScoresClient({
  editionTitle,
  days,
  teams,
  scores,
}: {
  editionTitle: string;
  days?: Array<{ dayNumber: number; published: boolean; calendarDate: string }>;
  teams?: Array<{ id: string; name: string; tag: string; players: Array<{ id: string; name: string }> }>;
  scores?: Array<{ userId: string; dayNumber: number; score: number; slams: number }>;
}) {
  const dayList = Array.isArray(days) ? days : [];
  const teamList = Array.isArray(teams) ? teams : [];
  const scoreList = Array.isArray(scores) ? scores : [];

  const [day, setDay] = React.useState(1);

  const selected = dayList.find((d) => d.dayNumber === day) || dayList[0];
  const byUser = new Map(
    scoreList.filter((s) => s.dayNumber === day).map((s) => [s.userId, s]),
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="border-b border-border/60 pb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Badge variant="carrom" className="flex items-center gap-1">
            <Activity className="h-3 w-3 animate-pulse" /> Real-time Live Scores
          </Badge>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
          <Trophy className="h-7 w-7 text-amber-500" /> Player Scores
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          {editionTitle} — Day-wise and team-wise real-time score updates.
        </p>
      </div>

      {/* ── Day Selector Buttons ───────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto touch-scroll-x scrollbar-none pb-1.5">
        {dayList.map((d) => (
          <button
            key={d.dayNumber}
            type="button"
            onClick={() => setDay(d.dayNumber)}
            className={`px-4 py-2 rounded-xl text-xs font-black border whitespace-nowrap shrink-0 transition-all ${
              day === d.dayNumber
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 scale-[1.02]'
                : 'border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-amber-500/40'
            }`}
          >
            Day {d.dayNumber}
          </button>
        ))}
      </div>

      {/* ── Team-Wise Player Scores Grid ──────────────────────────────────── */}
      {dayList.length === 0 ? (
        <Card className="border-amber-500/30">
          <CardContent className="p-8 text-center text-sm font-semibold text-muted-foreground">
            Player scores will appear here once tournament days are scheduled.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {teamList.map((team) => {
            // Calculate total team score for this day
            let teamTotalPts = 0;
            let teamTotalSlams = 0;
            let submittedCount = 0;

            (team.players || []).forEach((player) => {
              const row = byUser.get(player.id);
              if (row) {
                teamTotalPts += row.score || 0;
                teamTotalSlams += row.slams || 0;
                submittedCount++;
              }
            });

            return (
              <Card key={team.id} className="border-border/80 bg-card/70 backdrop-blur-sm shadow-xl hover:border-amber-500/40 transition-all">
                <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-black flex items-center gap-2">
                      <Users className="h-4 w-4 text-amber-500" /> {team.name}
                    </CardTitle>
                    <CardDescription className="text-xs font-bold text-amber-400/90">{team.tag}</CardDescription>
                  </div>

                  <div className="text-right bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
                    <div className="text-[10px] uppercase font-bold text-amber-400/80">Day {day} Total</div>
                    <div className="text-sm font-black text-amber-400">
                      {teamTotalPts} <span className="text-xs font-semibold text-muted-foreground">pts</span>
                      {teamTotalSlams > 0 && (
                        <span className="ml-1.5 text-xs text-amber-300">({teamTotalSlams} 🔥)</span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-3 space-y-2">
                  {(team.players || []).length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-2">No players assigned to this team.</div>
                  ) : (
                    (team.players || []).map((player) => {
                      const row = byUser.get(player.id);
                      return (
                        <div
                          key={player.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 border border-border/40 hover:border-border transition-colors"
                        >
                          <span className="font-bold text-sm text-foreground flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-amber-500/70 shrink-0" />
                            {player.name}
                          </span>

                          {row ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="carrom" className="font-mono text-xs font-black px-2.5 py-0.5">
                                {row.score} pts
                              </Badge>
                              {row.slams > 0 && (
                                <span className="text-xs font-extrabold text-amber-400 flex items-center gap-0.5">
                                  <Flame className="h-3.5 w-3.5 fill-amber-400 text-amber-500" /> {row.slams}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-muted-foreground/60 italic">
                              — Pending
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
