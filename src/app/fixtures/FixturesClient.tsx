'use client';

import * as React from 'react';
import Link from 'next/link';
import { MOCK_TEAMS } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Calendar, Clock, MapPin, Trophy, Shield, Filter, Search, ArrowRight, Video, Flame } from 'lucide-react';
import { Match, MatchStage } from '@/types';

export default function FixturesClient({ initialMatches }: { initialMatches: any[] }) {
  const [stageFilter, setStageFilter] = React.useState<string>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');

  const matchesList: Match[] = initialMatches;

  const filteredMatches = matchesList.filter((m) => {
    const matchesStage = stageFilter === 'ALL' || m.stage === stageFilter;
    const matchesSearch =
      m.team1?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.team2?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.matchNumber.toString().includes(searchQuery);
    return matchesStage && matchesSearch;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/40 bg-card p-6 sm:p-10 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="CBOT Logo" className="h-10 w-10 object-contain drop-shadow-md" />
              <Badge variant="carrom" className="font-extrabold px-3 py-1">
                <Calendar className="h-3.5 w-3.5 mr-1" /> Official Fixtures & Public Schedule
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight">CBOT Edition #205 Live Schedule</h1>
            <p className="text-muted-foreground text-sm max-w-2xl">
              Inspect upcoming round-robin league matches, carrom table numbers, scheduled time slots, and playoff brackets.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/live">
              <Button variant="carrom" className="font-bold text-xs shadow-lg w-full sm:w-auto">
                <Video className="h-4 w-4 mr-1.5" /> Watch Live Streams
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 border-border flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Search className="h-4 w-4 text-amber-500 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter team or match #..."
            className="bg-transparent border-none text-xs font-semibold text-foreground focus:outline-none w-full sm:w-64"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-muted-foreground mr-1">Stage:</span>
          {['ALL', 'ROUND_ROBIN', 'QUALIFIER_1', 'QUALIFIER_2', 'GRAND_FINAL'].map((stg) => (
            <Button
              key={stg}
              size="sm"
              variant={stageFilter === stg ? 'carrom' : 'ghost'}
              onClick={() => setStageFilter(stg)}
              className="text-xs font-bold px-3 h-8"
            >
              {stg.replace('_', ' ')}
            </Button>
          ))}
        </div>
      </Card>

      {/* Fixtures Schedule Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMatches.map((m) => {
          const isLive = m.status === 'LIVE';
          const isCompleted = m.status === 'COMPLETED';

          return (
            <Card
              key={m.id}
              className={`p-6 border transition-all space-y-4 shadow-xl ${
                isLive ? 'border-pink-500/80 bg-pink-500/5 shadow-pink-500/10' : 'border-border hover:border-amber-500/50'
              }`}
            >
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <Badge variant={isLive ? 'warning' : isCompleted ? 'success' : 'outline'} className="text-[10px] font-bold">
                  {isLive ? (
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-pink-500 animate-ping" /> LIVE MATCH
                    </span>
                  ) : (
                    m.status
                  )}
                </Badge>
                <span className="text-xs font-mono text-muted-foreground font-bold">
                  Table #{m.tableNumber || 1}
                </span>
              </div>

              {/* Match Stage & Title */}
              <div>
                <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                  {m.stage ? m.stage.replace('_', ' ') : 'Round-Robin League'} • Match #{m.matchNumber}
                </div>
                <h3 className="font-extrabold text-base mt-0.5">{m.team1?.name} vs {m.team2?.name}</h3>
              </div>

              {/* Score Display */}
              <div className="p-4 rounded-2xl bg-card border font-mono flex items-center justify-around text-center">
                <div>
                  <span className="font-bold text-xs text-muted-foreground block">{m.team1?.tag}</span>
                  <span className="text-2xl font-black text-foreground">{m.score1}</span>
                  <span className="text-[10px] text-pink-500 block font-semibold">{m.queenStrikes1} Queens</span>
                </div>
                <span className="text-xs text-muted-foreground font-bold">VS</span>
                <div>
                  <span className="font-bold text-xs text-muted-foreground block">{m.team2?.tag}</span>
                  <span className="text-2xl font-black text-foreground">{m.score2}</span>
                  <span className="text-[10px] text-pink-500 block font-semibold">{m.queenStrikes2} Queens</span>
                </div>
              </div>

              {/* Footer Date & Link */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                <div className="flex items-center gap-1 font-semibold">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  {new Date(m.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>

                <Link href={`/editions/${(m as any).editionId || m.tournamentId}`}>
                  <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-amber-500 hover:bg-amber-500/10">
                    Bracket <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

    </div>
  );
}
