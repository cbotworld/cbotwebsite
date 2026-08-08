'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Avatar } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Trophy, Crown, Download, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateRankingReportCSV } from '@/lib/actions/reportActions';

export default function LeaderboardClient({ players, teams }: { players: any[], teams: any[] }) {
  const [countryFilter, setCountryFilter] = React.useState('Global');
  const [isDownloading, setIsDownloading] = React.useState(false);

  const filteredPlayers = countryFilter === 'Global' 
    ? players 
    : players.filter(p => p.country === countryFilter);

  const handleDownload = async () => {
    setIsDownloading(true);
    const res = await generateRankingReportCSV(countryFilter);
    if (res.success && res.csvData) {
      const blob = new Blob([res.csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CBOT_Rankings_${countryFilter}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    setIsDownloading(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 max-w-7xl mx-auto border-b pb-6">
        <div className="text-left space-y-1">
          <Badge variant="carrom" className="px-4 py-1 font-bold">
            <Trophy className="h-3.5 w-3.5 mr-1 inline" /> Global Rankings
          </Badge>
          <h1 className="text-4xl font-black tracking-tight">Carrom Balu Champions</h1>
          <p className="text-muted-foreground text-sm">
            Official player ELO ratings, queen strike statistics, and team win-rate leaderboards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
            <Globe className="h-4 w-4 text-muted-foreground ml-2" />
            <select 
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer p-2"
            >
              <option value="Global">Global Rankings</option>
              <option value="India">India</option>
              <option value="USA">USA</option>
              <option value="UK">UK</option>
              <option value="UAE">UAE</option>
            </select>
          </div>
          <Button onClick={handleDownload} disabled={isDownloading} variant="outline" className="font-bold border-amber-500/30 text-amber-500">
            <Download className="h-4 w-4 mr-2" /> {isDownloading ? 'Generating...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Top 3 Podium Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredPlayers.slice(0, 3).map((player, idx) => {
          const podiumStyles = [
            'border-amber-500 bg-amber-500/10 shadow-xl shadow-amber-500/20 ring-2 ring-amber-500/50 order-1 md:order-2 scale-105',
            'border-slate-400 bg-slate-500/10 order-2 md:order-1',
            'border-amber-700 bg-amber-800/10 order-3 md:order-3',
          ];

          const medalColors = ['text-amber-400', 'text-slate-300', 'text-amber-700'];

          return (
            <Card key={player.id} className={`p-6 text-center space-y-4 rounded-3xl ${podiumStyles[idx]}`}>
              <div className="relative inline-block">
                <Avatar src={player.image} fallback={player.name} size="xl" className="mx-auto ring-4 ring-amber-500/40" />
                <div className={`absolute -top-3 -right-3 h-8 w-8 rounded-full bg-card border flex items-center justify-center font-black ${medalColors[idx]}`}>
                  #{idx + 1}
                </div>
              </div>

              <div>
                <h3 className="font-extrabold text-lg">{player.name}</h3>
                <Badge variant="carrom" className="mt-1 text-[11px]">{player.role}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-xs">
                <div>
                  <div className="text-muted-foreground">ELO Rating</div>
                  <div className="text-xl font-black text-amber-500">{player.rating}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Queens</div>
                  <div className="text-xl font-black text-pink-500">{player.queenStrikes}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Leaderboard Tabs */}
      <Tabs defaultValue="players" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="players">Player ELO Rankings</TabsTrigger>
          <TabsTrigger value="teams">Team Win-Rate Standings</TabsTrigger>
        </TabsList>

        {/* Players Table */}
        <TabsContent value="players">
          <Card className="border-border">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-xl font-bold">All Registered Players</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>ELO Rating</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Wins / Losses</TableHead>
                    <TableHead>Queen Strikes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlayers.map((player, index) => (
                    <TableRow key={player.id}>
                      <TableCell className="font-extrabold font-mono text-amber-500">#{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar src={player.image} fallback={player.name} size="sm" />
                          <div>
                            <span className="font-bold text-sm block">{player.name}</span>
                            <span className="text-[11px] text-muted-foreground">{player.username}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-xs">{player.country || 'Unknown'}</TableCell>
                      <TableCell className="font-bold font-mono text-base text-amber-500">{player.rating}</TableCell>
                      <TableCell>
                         <Badge variant="outline" className="font-bold">
                           {player.rankingSnapshots?.[0]?.category || 'NEW'}
                         </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="text-emerald-500 font-bold">{player.wins}W</span> / <span className="text-rose-500">{player.losses}L</span>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-pink-500">
                        <Crown className="h-3.5 w-3.5 inline mr-1" />
                        {player.queenStrikes}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teams Table */}
        <TabsContent value="teams">
          <Card className="border-border">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-xl font-bold">Latest Edition Team Standings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Captain</TableHead>
                    <TableHead>Played</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Win Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team, index) => {
                    const played = team.leagueStandings?.[0]?.played || 0;
                    const wins = team.leagueStandings?.[0]?.wins || 0;
                    const points = team.leagueStandings?.[0]?.points || 0;
                    const winRate = played > 0 ? ((wins / played) * 100).toFixed(1) : '0.0';

                    return (
                      <TableRow key={team.id}>
                        <TableCell className="font-extrabold font-mono text-amber-500">#{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar src={team.logo} fallback={team.tag} size="sm" />
                            <div>
                              <span className="font-bold text-sm block">{team.name}</span>
                              <Badge variant="carrom" className="text-[10px]">{team.tag}</Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-xs">{team.captain?.name}</TableCell>
                        <TableCell className="font-bold text-xs">{played}</TableCell>
                        <TableCell className="font-bold text-xs text-amber-500">{points} pts</TableCell>
                        <TableCell className="font-black text-emerald-500 text-base">{winRate}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
