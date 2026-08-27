'use client';

import * as React from 'react';
import Link from 'next/link';
import { Calendar, Search, Trophy, ArrowRight, Shield, Flame, CheckCircle2, Clock, Sparkles, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { monumentStatus } from '@/lib/bicentennial-monuments';
import { get200thEditionCombisData } from '@/lib/actions/combisActions';
import {
  buildOrganizerScheduleDays,
  formatCalendarDate,
  liveFixtureTitle,
  liveStageSummary,
  pathSummary,
  resolveOrganizerPairings,
  type OrganizerScheduleDay,
} from '@/lib/organizer-schedule';
import { coherentMatchSides } from '@/lib/team-identity';
import { DEFAULT_WEBSITE_CMS, type WebsitePageHeading } from '@/lib/website-cms';

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

export function ScheduleClient({
  pageCms = DEFAULT_WEBSITE_CMS.pages.schedule,
}: {
  pageCms?: WebsitePageHeading;
}) {
  const [selectedDay, setSelectedDay] = React.useState<number | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [scheduleDays, setScheduleDays] = React.useState<OrganizerScheduleDay[]>([]);
  const [stages, setStages] = React.useState<Array<{ order?: number; kind?: string; name?: string; startDay?: number; durationDays?: number }>>([]);

  const liveDayNum = React.useMemo(
    () => scheduleDays.find((d) => monumentStatus(d, nowMs) === 'live')?.dayNumber ?? null,
    [scheduleDays, nowMs]
  );

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await get200thEditionCombisData();
        if (!res.success || cancelled) return;
        const nextStages = (res as any).stageConfig?.stages || [];
        const pairings = resolveOrganizerPairings(nextStages, res.teams || []);
        let dayDates: Record<number, string> = {};
        if (res.edition?.dayDates) {
          try {
            dayDates = JSON.parse(res.edition.dayDates);
          } catch {}
        }
        setStages(nextStages);
        setScheduleDays(
          buildOrganizerScheduleDays({
            totalDays: res.edition?.totalDays,
            dayDates,
            pairings,
            stages: nextStages,
            teams: res.teams || [],
          })
        );
        setNowMs(Date.now());
      } catch (e) {
        console.error('Failed to load organizer schedule:', e);
      }
    };
    load();
    const id = setInterval(load, 15000);
    const onFocus = () => {
      void load();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  const filteredDays = scheduleDays.filter((d) => {
    if (selectedDay !== 'ALL' && d.dayNumber !== selectedDay) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const matchesTitle = d.title.toLowerCase().includes(term) || d.stageLabel.toLowerCase().includes(term);
      const matchesTeams = d.matches.some(
        (match) =>
          match.team1.toLowerCase().includes(term) ||
          match.team2.toLowerCase().includes(term) ||
          (match.team1Tag || '').toLowerCase().includes(term) ||
          (match.team2Tag || '').toLowerCase().includes(term)
      );
      return matchesTitle || matchesTeams;
    }
    return true;
  });

  const headerStageLine = liveStageSummary(scheduleDays, stages, nowMs);
  const headerPath = pathSummary(stages);
  const headerTitle = liveFixtureTitle(scheduleDays, stages, nowMs);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-10">

      {/* HEADER CREST & TITLE */}
      <div className="relative rounded-3xl overflow-hidden border border-amber-500/40 bg-gradient-to-b from-amber-950/40 via-card to-background p-6 sm:p-10 shadow-2xl space-y-6">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-emerald-500/5 to-amber-500/10 pointer-events-none blur-3xl" />
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-b border-amber-500/20 pb-6 relative z-10">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Carrom Balu Logo" className="h-14 sm:h-16 w-auto object-contain drop-shadow-xl animate-pulse" />
            <div>
              <div className="text-xs font-black text-amber-500 uppercase tracking-widest">{pageCms.subtitle}</div>
              <div className="text-lg sm:text-xl font-black text-foreground">{pageCms.title}</div>
              <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mt-0.5">{headerStageLine}</div>
            </div>
          </div>

          <div className="text-center sm:text-right">
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
              {headerTitle}
            </h1>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1">{headerPath}</p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="carrom" className="px-3.5 py-1.5 font-black text-xs uppercase tracking-wider shadow-lg">
              {pageCms.badge}
            </Badge>
          </div>
        </div>

        {/* SEARCH & DAY FILTER TABS */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 pt-1 sm:pt-2 relative z-10">
          {/* Day Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto touch-scroll-x scrollbar-none pb-1.5 w-full md:flex-1">
            <button
              onClick={() => setSelectedDay('ALL')}
              className={`px-3 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition-all shrink-0 ${
                selectedDay === 'ALL'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-card/80 text-muted-foreground hover:text-foreground border border-border/50'
              }`}
            >
              All Days
            </button>
            {scheduleDays.map((d) => {
              const isActive = liveDayNum === d.dayNumber;
              const isSelected = selectedDay === d.dayNumber;
              const status = monumentStatus(d, nowMs);
              return (
                <button
                  key={d.dayNumber}
                  onClick={() => setSelectedDay(d.dayNumber)}
                  className={`relative px-3 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : isActive
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : status === 'completed'
                      ? 'bg-card/80 text-muted-foreground hover:text-foreground border border-border/50'
                      : 'bg-muted/40 text-muted-foreground hover:text-foreground border border-border/40'
                  }`}
                >
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />}
                  Day {d.dayNumber}
                </button>
              );
            })}
          </div>

          {/* Search Filter */}
          <div className="relative w-full md:w-72 shrink-0">
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
      <div className="space-y-6 sm:space-y-8">
        {filteredDays.length === 0 && (
          <div className="rounded-2xl border border-border/80 bg-card/80 px-6 py-12 text-center text-sm font-bold text-muted-foreground">
            No fixtures match this filter.
          </div>
        )}
        {filteredDays.map((d) => {
          const status = monumentStatus(d, nowMs);
          const isActiveDay = status === 'live';
          const isCompleted = status === 'completed';
          const isUpcoming = status === 'upcoming';

          return (
            <div
              key={d.dayNumber}
              className={`rounded-2xl border transition-all duration-300 overflow-hidden shadow-lg ${
                isActiveDay
                  ? 'border-emerald-500/70 bg-emerald-950/10 shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                  : 'border-border/80 bg-card/80 hover:border-amber-500/30'
              }`}
            >
              {/* MONUMENT DAY HEADER */}
              <div
                className={`px-3.5 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b ${
                  isActiveDay
                    ? 'bg-emerald-500/15 border-emerald-500/30'
                    : 'bg-muted/40 border-border/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center border shadow-md shrink-0 ${
                      isActiveDay
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-lg font-black tracking-tight text-foreground flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      {d.title}
                      <span className="text-[9px] sm:text-[9.5px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                        {d.stageLabel}
                      </span>
                      {isActiveDay && (
                        <span className="text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 flex items-center gap-1 animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" /> Live Active Day
                        </span>
                      )}
                      {isCompleted && (
                        <span className="text-[9px] sm:text-[9.5px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                          ✓ Completed
                        </span>
                      )}
                      {isUpcoming && !d.isSpocDay && (
                        <span className="text-[9px] sm:text-[9.5px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                          Day {d.dayNumber}
                        </span>
                      )}
                      {d.isSpocDay && (
                        <span className="text-[9px] sm:text-[9.5px] font-bold text-violet-300 bg-violet-500/15 px-2 py-0.5 rounded-full border border-violet-500/40">
                          ✨ Spoc Exhibition
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] sm:text-xs font-bold text-muted-foreground flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <Clock className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-amber-500" /> {d.timeRange}
                      <span className="text-muted-foreground/70">· Calendar {formatCalendarDate(d.calendarDate)}</span>
                    </p>
                  </div>
                </div>

                <Badge variant="outline" className="font-mono text-[10px] sm:text-xs border-amber-500/30 text-amber-400 shrink-0">
                  {d.matches.length} {d.matches.length === 1 ? 'Match' : 'Matches'} Scheduled
                </Badge>
              </div>

              {/* MATCH FIXTURES LIST */}
              <div className="p-3 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {d.matches.length === 0 && (
                  <div className="md:col-span-2 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-xs font-bold text-muted-foreground">
                    Fixtures will appear here when the organizer publishes this day's pairings.
                  </div>
                )}
                {d.matches.map((match, matchIdx) => {
                  const isSpoc = !!match.isSpocExhibition;
                  const { team1: t1Face, team2: t2Face } = coherentMatchSides(match);
                  const t1 = {
                    ...t1Face,
                    color: t1Face.color || TEAMS_INFO[t1Face.name]?.color || 'text-foreground',
                    border: t1Face.border || TEAMS_INFO[t1Face.name]?.border || 'border-border',
                    bg: t1Face.bg || TEAMS_INFO[t1Face.name]?.bg || 'bg-muted',
                  };
                  const t2 = {
                    ...t2Face,
                    color: t2Face.color || TEAMS_INFO[t2Face.name]?.color || 'text-foreground',
                    border: t2Face.border || TEAMS_INFO[t2Face.name]?.border || 'border-border',
                    bg: t2Face.bg || TEAMS_INFO[t2Face.name]?.bg || 'bg-muted',
                  };

                  const isMatchHighlighted = searchTerm.trim() && (
                    t1.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
                    t2.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
                  );

                  return (
                    <div
                      key={matchIdx}
                      className={`p-3 sm:p-5 rounded-2xl border transition-all ${
                        isSpoc ? 'md:col-span-2' : ''
                      } ${
                        isMatchHighlighted
                          ? 'border-amber-400 bg-amber-500/15 shadow-md shadow-amber-500/20'
                          : isSpoc
                          ? 'border-violet-500/50 bg-violet-950/20 hover:border-violet-400/60'
                          : 'border-border/70 bg-card/90 hover:border-amber-500/40 hover:bg-card'
                      }`}
                    >
                      {isSpoc && (
                        <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
                          <Badge variant="outline" className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest border-violet-500/50 text-violet-300 bg-violet-500/10 px-2.5 sm:px-3 py-0.5 sm:py-1">
                            <Sparkles className="h-3 w-3 mr-1 inline" />
                            Spoc Exhibition Match
                          </Badge>
                          {match.matchLabel && match.matchLabel !== 'Spoc Exhibition Match' ? (
                            <span className="text-[10px] font-bold text-violet-300/80">{match.matchLabel}</span>
                          ) : null}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 sm:gap-3">
                      {/* Team 1 */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className={`${isSpoc ? 'h-16 w-14 sm:h-32 sm:w-24' : 'h-11 w-11 min-[400px]:h-13 min-[400px]:w-13 sm:h-16 sm:w-16'} rounded-xl overflow-hidden bg-slate-950/90 p-0.5 border-2 ${t1.border} shrink-0 shadow-lg flex items-center justify-center`}>
                          <img
                            src={t1.logo}
                            alt={t1.name}
                            className={`h-full w-full ${isSpoc ? 'object-cover rounded-lg' : 'object-contain'}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <span className={`text-[11px] sm:text-sm font-black truncate block ${isSpoc ? 'text-violet-200' : t1.color}`} title={t1.name}>
                            {t1.name}
                          </span>
                          <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase opacity-80">
                            {t1.tag}
                          </span>
                        </div>
                      </div>

                      {/* VS Divider */}
                      <div className="flex flex-col items-center justify-center shrink-0 px-1 sm:px-2">
                        <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg shadow-sm ${
                          isSpoc
                            ? 'text-violet-300 bg-violet-500/15 border border-violet-500/40'
                            : 'text-amber-500 bg-amber-500/10 border border-amber-500/30'
                        }`}>
                          VS
                        </span>
                      </div>

                      {/* Team 2 */}
                      <div className="flex items-center justify-end gap-2 sm:gap-3 flex-1 min-w-0 text-right">
                        <div className="min-w-0">
                          <span className={`text-[11px] sm:text-sm font-black truncate block ${isSpoc ? 'text-violet-200' : t2.color}`} title={t2.name}>
                            {t2.name}
                          </span>
                          <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase opacity-80">
                            {t2.tag}
                          </span>
                        </div>
                        <div className={`${isSpoc ? 'h-16 w-14 sm:h-32 sm:w-24' : 'h-11 w-11 min-[400px]:h-13 min-[400px]:w-13 sm:h-16 sm:w-16'} rounded-xl overflow-hidden bg-slate-950/90 p-0.5 border-2 ${t2.border} shrink-0 shadow-lg flex items-center justify-center`}>
                          <img
                            src={t2.logo}
                            alt={t2.name}
                            className={`h-full w-full ${isSpoc ? 'object-cover rounded-lg' : 'object-contain'}`}
                          />
                        </div>
                      </div>
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
