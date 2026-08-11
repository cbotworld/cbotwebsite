'use client';

import * as React from 'react';
import Link from 'next/link';
import { Calendar, Search, Trophy, ArrowRight, Shield, Flame, CheckCircle2, Clock, Sparkles, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TEAMS_INFO: Record<string, { logo: string; tag: string; color: string; border: string; bg: string }> = {
  'PLYWOOD PIONEERS': {
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/plywood-pioneers.jpeg',
    tag: 'PP',
    color: 'text-amber-400',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
  },
  'SUPERNOVA QUEEN': {
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/supernova-queen.jpeg',
    tag: 'SQ',
    color: 'text-pink-400',
    border: 'border-pink-500/40',
    bg: 'bg-pink-500/10',
  },
  'POCKET DYNAMOS': {
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/pocket-dynamos.jpeg',
    tag: 'PD',
    color: 'text-sky-400',
    border: 'border-sky-500/40',
    bg: 'bg-sky-500/10',
  },
  'LUMEN PILLAR': {
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/lumen-pillar.jpeg',
    tag: 'LP',
    color: 'text-yellow-400',
    border: 'border-yellow-500/40',
    bg: 'bg-yellow-500/10',
  },
  'VANILLA FALCONS': {
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/vanilla-falcons.jpeg',
    tag: 'VF',
    color: 'text-emerald-400',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
  },
  'VINTAGE STRIKERS': {
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/vintage-strikers.jpeg',
    tag: 'VS',
    color: 'text-orange-400',
    border: 'border-orange-500/40',
    bg: 'bg-orange-500/10',
  },
  'EBONY OVERLORDS': {
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/ebony-overlords.jpeg',
    tag: 'EO',
    color: 'text-purple-400',
    border: 'border-purple-500/40',
    bg: 'bg-purple-500/10',
  },
  'BORIC SPEEDSTERS': {
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/boric-speedsters.jpeg',
    tag: 'BS',
    color: 'text-cyan-400',
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-500/10',
  },
};

interface MonumentFixture {
  monumentNumber: number;
  title: string;
  timeRange: string;
  startIso: string;
  endIso: string;
  matches: Array<{ team1: string; team2: string }>;
}

const MONUMENTS_DATA: MonumentFixture[] = [
  {
    monumentNumber: 1,
    title: 'BICENTENNIAL MONUMENT 1',
    timeRange: '9TH AUG 9 PM TO 10TH AUG 8 PM',
    startIso: '2026-08-09T21:00:00+05:30',
    endIso: '2026-08-10T20:00:00+05:30',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'SUPERNOVA QUEEN' },
      { team1: 'POCKET DYNAMOS', team2: 'LUMEN PILLAR' },
      { team1: 'VANILLA FALCONS', team2: 'VINTAGE STRIKERS' },
      { team1: 'EBONY OVERLORDS', team2: 'BORIC SPEEDSTERS' },
    ],
  },
  {
    monumentNumber: 2,
    title: 'BICENTENNIAL MONUMENT 2',
    timeRange: '10TH AUG 8 PM TO 11TH AUG 8 PM',
    startIso: '2026-08-10T20:00:00+05:30',
    endIso: '2026-08-11T20:00:00+05:30',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'VINTAGE STRIKERS' },
      { team1: 'LUMEN PILLAR', team2: 'BORIC SPEEDSTERS' },
      { team1: 'SUPERNOVA QUEEN', team2: 'EBONY OVERLORDS' },
      { team1: 'POCKET DYNAMOS', team2: 'VANILLA FALCONS' },
    ],
  },
  {
    monumentNumber: 3,
    title: 'BICENTENNIAL MONUMENT 3',
    timeRange: '11TH AUG 8 PM TO 12TH AUG 8 PM',
    startIso: '2026-08-11T20:00:00+05:30',
    endIso: '2026-08-12T20:00:00+05:30',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'EBONY OVERLORDS' },
      { team1: 'BORIC SPEEDSTERS', team2: 'VANILLA FALCONS' },
      { team1: 'VINTAGE STRIKERS', team2: 'POCKET DYNAMOS' },
      { team1: 'LUMEN PILLAR', team2: 'SUPERNOVA QUEEN' },
    ],
  },
  {
    monumentNumber: 4,
    title: 'BICENTENNIAL MONUMENT 4',
    timeRange: '12TH AUG 8 PM TO 13TH AUG 8 PM',
    startIso: '2026-08-12T20:00:00+05:30',
    endIso: '2026-08-13T20:00:00+05:30',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'VANILLA FALCONS' },
      { team1: 'EBONY OVERLORDS', team2: 'POCKET DYNAMOS' },
      { team1: 'BORIC SPEEDSTERS', team2: 'SUPERNOVA QUEEN' },
      { team1: 'VINTAGE STRIKERS', team2: 'LUMEN PILLAR' },
    ],
  },
  {
    monumentNumber: 5,
    title: 'BICENTENNIAL MONUMENT 5',
    timeRange: '13TH AUG 8 PM TO 14TH AUG 8 PM',
    startIso: '2026-08-13T20:00:00+05:30',
    endIso: '2026-08-14T20:00:00+05:30',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'LUMEN PILLAR' },
      { team1: 'SUPERNOVA QUEEN', team2: 'VINTAGE STRIKERS' },
      { team1: 'POCKET DYNAMOS', team2: 'BORIC SPEEDSTERS' },
      { team1: 'VANILLA FALCONS', team2: 'EBONY OVERLORDS' },
    ],
  },
  {
    monumentNumber: 6,
    title: 'BICENTENNIAL MONUMENT 6',
    timeRange: '14TH AUG 8 PM TO 15TH AUG 8 PM',
    startIso: '2026-08-14T20:00:00+05:30',
    endIso: '2026-08-15T20:00:00+05:30',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'BORIC SPEEDSTERS' },
      { team1: 'VINTAGE STRIKERS', team2: 'EBONY OVERLORDS' },
      { team1: 'LUMEN PILLAR', team2: 'VANILLA FALCONS' },
      { team1: 'SUPERNOVA QUEEN', team2: 'POCKET DYNAMOS' },
    ],
  },
  {
    monumentNumber: 7,
    title: 'BICENTENNIAL MONUMENT 7',
    timeRange: '15TH AUG 8 PM TO 16TH AUG 8 PM',
    startIso: '2026-08-15T20:00:00+05:30',
    endIso: '2026-08-16T20:00:00+05:30',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'POCKET DYNAMOS' },
      { team1: 'VANILLA FALCONS', team2: 'SUPERNOVA QUEEN' },
      { team1: 'EBONY OVERLORDS', team2: 'LUMEN PILLAR' },
      { team1: 'BORIC SPEEDSTERS', team2: 'VINTAGE STRIKERS' },
    ],
  },
];

export default function BicentennialSchedulePage() {
  const [selectedDay, setSelectedDay] = React.useState<number | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = React.useState('');

  const nowMs = new Date().getTime();

  // Find active monument day
  const activeMonumentNum = React.useMemo(() => {
    for (const m of MONUMENTS_DATA) {
      const s = new Date(m.startIso).getTime();
      const e = new Date(m.endIso).getTime();
      if (nowMs >= s && nowMs < e) {
        return m.monumentNumber;
      }
    }
    return 2; // Default to Day 2
  }, [nowMs]);

  const filteredMonuments = MONUMENTS_DATA.filter((m) => {
    if (selectedDay !== 'ALL' && m.monumentNumber !== selectedDay) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const matchesTitle = m.title.toLowerCase().includes(term);
      const matchesTeams = m.matches.some(
        (match) => match.team1.toLowerCase().includes(term) || match.team2.toLowerCase().includes(term)
      );
      return matchesTitle || matchesTeams;
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-10">

      {/* HEADER CREST & TITLE */}
      <div className="relative rounded-3xl overflow-hidden border border-amber-500/40 bg-gradient-to-b from-amber-950/40 via-card to-background p-6 sm:p-10 shadow-2xl space-y-6">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-emerald-500/5 to-amber-500/10 pointer-events-none blur-3xl" />
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-b border-amber-500/20 pb-6 relative z-10">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Carrom Balu Logo" className="h-14 sm:h-16 w-auto object-contain drop-shadow-xl animate-pulse" />
            <div>
              <div className="text-xs font-black text-amber-500 uppercase tracking-widest">Carrom Balu Online Tournament</div>
              <div className="text-lg sm:text-xl font-black text-foreground">Official Match Fixtures</div>
            </div>
          </div>

          <div className="text-center sm:text-right">
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
              BICENTENNIAL MONUMENTS FIXTURE
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="carrom" className="px-3.5 py-1.5 font-black text-xs uppercase tracking-wider shadow-lg">
              ✨ 200th Edition
            </Badge>
          </div>
        </div>

        {/* SEARCH & DAY FILTER TABS */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2 relative z-10">
          {/* Day Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedDay('ALL')}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all ${
                selectedDay === 'ALL'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-card/80 text-muted-foreground hover:text-foreground border border-border/50'
              }`}
            >
              All Monuments
            </button>
            {MONUMENTS_DATA.map((m) => {
              const isActive = activeMonumentNum === m.monumentNumber;
              const isSelected = selectedDay === m.monumentNumber;
              return (
                <button
                  key={m.monumentNumber}
                  onClick={() => setSelectedDay(m.monumentNumber)}
                  className={`relative px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : isActive
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-card/80 text-muted-foreground hover:text-foreground border border-border/50'
                  }`}
                >
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />}
                  Day {m.monumentNumber}
                </button>
              );
            })}
          </div>

          {/* Search Filter */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by team (e.g. Pioneers)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs font-bold bg-background border-border/60"
            />
          </div>
        </div>
      </div>

      {/* SCHEDULE DAYS GRID */}
      <div className="space-y-8">
        {filteredMonuments.map((m) => {
          const isActiveDay = activeMonumentNum === m.monumentNumber;
          const startMs = new Date(m.startIso).getTime();
          const endMs = new Date(m.endIso).getTime();
          const isCompleted = nowMs >= endMs;
          const isUpcoming = nowMs < startMs;

          return (
            <div
              key={m.monumentNumber}
              className={`rounded-2xl border transition-all duration-300 overflow-hidden shadow-lg ${
                isActiveDay
                  ? 'border-emerald-500/70 bg-emerald-950/10 shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                  : 'border-border/80 bg-card/80 hover:border-amber-500/30'
              }`}
            >
              {/* MONUMENT DAY HEADER */}
              <div
                className={`px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b ${
                  isActiveDay
                    ? 'bg-emerald-500/15 border-emerald-500/30'
                    : 'bg-muted/40 border-border/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center border shadow-md ${
                      isActiveDay
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                      {m.title}
                      {isActiveDay && (
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 flex items-center gap-1 animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" /> Live Active Day
                        </span>
                      )}
                      {isCompleted && (
                        <span className="text-[9.5px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                          ✓ Completed
                        </span>
                      )}
                      {isUpcoming && (
                        <span className="text-[9.5px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                          Upcoming
                        </span>
                      )}
                    </h3>
                    <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Clock className="h-3.5 w-3.5 text-amber-500" /> {m.timeRange}
                    </p>
                  </div>
                </div>

                <Badge variant="outline" className="font-mono text-xs border-amber-500/30 text-amber-400">
                  4 Matches Scheduled
                </Badge>
              </div>

              {/* MATCH FIXTURES LIST */}
              <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {m.matches.map((match, matchIdx) => {
                  const t1 = TEAMS_INFO[match.team1] || { logo: '/logo.png', tag: 'T1', color: 'text-foreground', border: 'border-border', bg: 'bg-muted' };
                  const t2 = TEAMS_INFO[match.team2] || { logo: '/logo.png', tag: 'T2', color: 'text-foreground', border: 'border-border', bg: 'bg-muted' };

                  const isMatchHighlighted = searchTerm.trim() && (
                    match.team1.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
                    match.team2.toLowerCase().includes(searchTerm.toLowerCase().trim())
                  );

                  return (
                    <div
                      key={matchIdx}
                      className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isMatchHighlighted
                          ? 'border-amber-400 bg-amber-500/15 shadow-md shadow-amber-500/20'
                          : 'border-border/60 bg-background/50 hover:border-amber-500/40 hover:bg-card'
                      }`}
                    >
                      {/* Team 1 */}
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <img
                          src={t1.logo}
                          alt={match.team1}
                          className={`h-9 w-9 rounded-full object-cover border ${t1.border} shrink-0 shadow-md`}
                        />
                        <span className={`text-xs font-black truncate ${t1.color}`} title={match.team1}>
                          {match.team1}
                        </span>
                      </div>

                      {/* VS Divider */}
                      <div className="flex flex-col items-center justify-center shrink-0 px-2">
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                          WILL PLAY
                        </span>
                      </div>

                      {/* Team 2 */}
                      <div className="flex items-center justify-end gap-2.5 flex-1 min-w-0 text-right">
                        <span className={`text-xs font-black truncate ${t2.color}`} title={match.team2}>
                          {match.team2}
                        </span>
                        <img
                          src={t2.logo}
                          alt={match.team2}
                          className={`h-9 w-9 rounded-full object-cover border ${t2.border} shrink-0 shadow-md`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
