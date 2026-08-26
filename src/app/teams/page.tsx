import * as React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';

export const revalidate = 3600; // Cache teams directory for up to 1 hour; revalidated on-demand via actions

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({
    include: {
      captain: true,
      members: {
        include: {
          user: true
        }
      },
      leagueStandings: true
    }
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <Badge variant="carrom" className="mb-2">CBOT Rosters</Badge>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Registered Teams Directory</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Official team franchises competing across CBOT editions.
          </p>
        </div>
        <Link href="/teams-and-players">
          <Button variant="carrom" className="font-bold text-xs">
            View Teams &amp; Players
          </Button>
        </Link>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {teams.map((team) => {
          const played = team.leagueStandings?.[0]?.played || 0;
          const wins = team.leagueStandings?.[0]?.wins || 0;
          const winRate = played > 0 ? ((wins / played) * 100).toFixed(1) : '0.0';

          return (
            <Card key={team.id} className="p-6 border-border hover:border-amber-500/50 hover:shadow-xl transition-all space-y-4">
              <div className="flex items-center gap-5">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden bg-slate-950 p-1.5 border-2 border-amber-500/40 shadow-xl flex items-center justify-center shrink-0">
                  <img src={team.logo || '/logo.png'} alt={team.name} className="h-full w-full object-contain" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black">{team.name}</h2>
                    <Badge variant="carrom">{team.tag}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Captain: {team.captain?.name}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">{team.description}</p>

              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-muted/50 border text-center text-xs">
                <div>
                  <div className="text-muted-foreground">Matches Played</div>
                  <div className="font-extrabold text-foreground mt-0.5">{played}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Wins</div>
                  <div className="font-extrabold text-emerald-500 mt-0.5">{wins} W</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Win Ratio</div>
                  <div className="font-black text-amber-500 mt-0.5">{winRate}%</div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/50">
                <div className="text-xs font-bold mb-2">Starting Roster Members:</div>
                <div className="flex flex-wrap gap-2">
                  {team.members?.map((mem) => (
                    <Badge key={mem.id} variant="outline" className="text-xs py-1 px-2.5 gap-1.5">
                      <Avatar fallback={mem.user.name || 'P'} size="sm" className="h-5 w-5" />
                      {mem.user.name} ({mem.user.id === team.captainId ? 'CAPTAIN' : 'PLAYER'})
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
