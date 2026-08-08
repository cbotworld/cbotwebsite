'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MOCK_TOURNAMENTS, MOCK_MATCHES } from '@/lib/mock-data';
import { TournamentBracket } from '@/components/bracket/TournamentBracket';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Avatar } from '@/components/ui/avatar';
import { Trophy, Calendar, Users, ShieldCheck, Crown, ArrowLeft, Play, Info } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function TournamentDetailPage() {
  const params = useParams();
  const tournamentId = params?.id as string;

  const tournament = MOCK_TOURNAMENTS.find((t) => t.id === tournamentId) || MOCK_TOURNAMENTS[0];
  const matches = MOCK_MATCHES.filter((m) => m.tournamentId === tournament.id);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Back Button */}
      <Link href="/tournaments" className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-amber-500 transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to All Tournaments
      </Link>

      {/* Hero Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-card p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 h-64 w-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="carrom" className="font-bold">
                <Trophy className="h-3.5 w-3.5 mr-1" /> {tournament.format.replace('_', ' ')}
              </Badge>
              <Badge variant={tournament.status === 'IN_PROGRESS' ? 'warning' : 'success'} className="font-bold">
                {tournament.status.replace('_', ' ')}
              </Badge>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              {tournament.title}
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
              {tournament.description}
            </p>

            <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-amber-500" /> {formatDate(tournament.startDate)}</span>
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-emerald-500" /> {tournament.teams?.length || 0} Registered Teams</span>
              <span className="flex items-center gap-1.5"><Crown className="h-4 w-4 text-pink-500" /> Organizer: {tournament.organizer?.name}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[200px]">
            <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-center">
              <div className="text-xs text-amber-500 uppercase font-bold tracking-wider">Total Prize Pool</div>
              <div className="text-2xl font-black text-amber-400 mt-1">{tournament.prizePool}</div>
            </div>
            <Link href="/dashboard/captain">
              <Button variant="carrom" className="w-full font-bold text-xs">
                Register Team Now
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs defaultValue="bracket" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="bracket">Interactive Visual Bracket</TabsTrigger>
          <TabsTrigger value="fixtures">Fixtures & Live Scores</TabsTrigger>
          <TabsTrigger value="teams">Registered Teams ({tournament.teams?.length || 0})</TabsTrigger>
          <TabsTrigger value="rules">Rules & Guidelines</TabsTrigger>
        </TabsList>

        {/* Tab 1: Visual Bracket */}
        <TabsContent value="bracket">
          <Card className="border-border">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" /> Bracket Tree Visualization
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click any match card to open live score details and referee notes.
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono">Zoom/Scroll Supported</Badge>
            </CardHeader>
            <CardContent className="p-4 overflow-hidden">
              <TournamentBracket matches={matches} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Fixtures & Live Scores Table */}
        <TabsContent value="fixtures">
          <Card className="border-border">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-xl font-bold">Match Fixtures Log</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Round</TableHead>
                    <TableHead>Table #</TableHead>
                    <TableHead>Home Team</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Away Team</TableHead>
                    <TableHead>Queen Strikes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-bold">Round {m.round}</TableCell>
                      <TableCell>Table #{m.tableNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar src={m.team1?.logo} fallback={m.team1?.tag || 'T1'} size="sm" />
                          <span className="font-semibold">{m.team1?.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-black text-amber-500 text-base">
                        {m.score1} - {m.score2}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar src={m.team2?.logo} fallback={m.team2?.tag || 'T2'} size="sm" />
                          <span className="font-semibold">{m.team2?.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-pink-500 font-bold">
                        <Crown className="h-3.5 w-3.5 inline mr-1" />
                        {m.queenStrikes1 + m.queenStrikes2} Queens
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.status === 'LIVE' ? 'warning' : m.status === 'COMPLETED' ? 'success' : 'outline'}>
                          {m.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Registered Teams */}
        <TabsContent value="teams">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournament.teams?.map((tt) => (
              <Card key={tt.id} className="border-border p-5 hover:border-amber-500/40 transition-colors">
                <div className="flex items-center gap-4">
                  <Avatar src={tt.team.logo} fallback={tt.team.tag} size="lg" />
                  <div>
                    <h3 className="font-bold text-base">{tt.team.name}</h3>
                    <Badge variant="carrom" className="text-[10px] mt-1">Tag: {tt.team.tag}</Badge>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Captain:</span>
                    <span className="font-semibold text-foreground">{tt.team.captain?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Matches Win Rate:</span>
                    <span className="font-bold text-emerald-500">{tt.team.stats?.winRate}%</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 4: Rules & Guidelines */}
        <TabsContent value="rules">
          <Card className="border-border p-6 space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" /> Official Rules & Board Regulations
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {tournament.rules}
            </p>
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 space-y-2">
              <div className="font-bold">Score Dispute & Proof Submission:</div>
              <p>
                Captains must record or take screenshots of board final placements. All score reports submitted via the Captain Dashboard are audited by official CBOT referees before bracket advancement.
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}
