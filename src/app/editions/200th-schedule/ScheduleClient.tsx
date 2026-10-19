'use client';

import * as React from 'react';
import Link from 'next/link';
import { Calendar, Search, Trophy, ArrowRight, Shield, Flame, CheckCircle2, Clock, Sparkles, Filter, Crown, ChevronRight, Info, Lock, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MatchVideoPlayer } from '@/components/video/MatchVideoPlayer';
import { monumentStatus } from '@/lib/bicentennial-monuments';
import { getCurrentEditionCombisData } from '@/lib/actions/combisActions';
import { resolveEffectiveTeamCombi } from '@/lib/combi-fallback';
import { scoreMatchDay } from '@/lib/combi-results';
import { isCombiSubmissionLocked } from '@/lib/combi-cutoff';
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
import { resolveDayWalkoversAndScores } from '@/lib/walkover-scoring';
import { toStorageProxyUrl } from '@/lib/supabase';

const TEAMS_INFO: Record<string, { logo: string; tag: string; color: string; border: string; bg: string }> = {
  'PLYWOOD PIONEERS': {
    logo: '/api/storage/teams/plywood-pioneers.jpeg',
    tag: 'PP',
    color: 'text-amber-400',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
  },
  'SUPERNOVA QUEEN': {
    logo: '/api/storage/teams/supernova-queen.jpeg',
    tag: 'SQ',
    color: 'text-pink-400',
    border: 'border-pink-500/40',
    bg: 'bg-pink-500/10',
  },
  'POCKET DYNAMOS': {
    logo: '/api/storage/teams/pocket-dynamos.jpeg',
    tag: 'PD',
    color: 'text-sky-400',
    border: 'border-sky-500/40',
    bg: 'bg-sky-500/10',
  },
  'LUMEN PILLAR': {
    logo: '/api/storage/teams/lumen-pillar.jpeg',
    tag: 'LP',
    color: 'text-yellow-400',
    border: 'border-yellow-500/40',
    bg: 'bg-yellow-500/10',
  },
  'VANILLA FALCONS': {
    logo: '/api/storage/teams/vanilla-falcons.jpeg',
    tag: 'VF',
    color: 'text-emerald-400',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
  },
  'VINTAGE STRIKERS': {
    logo: '/api/storage/teams/vintage-strikers.jpeg',
    tag: 'VS',
    color: 'text-orange-400',
    border: 'border-orange-500/40',
    bg: 'bg-orange-500/10',
  },
  'EBONY OVERLORDS': {
    logo: '/api/storage/teams/ebony-overlords.jpeg',
    tag: 'EO',
    color: 'text-purple-400',
    border: 'border-purple-500/40',
    bg: 'bg-purple-500/10',
  },
  'BORIC SPEEDSTERS': {
    logo: '/api/storage/teams/boric-speedsters.jpeg',
    tag: 'BS',
    color: 'text-cyan-400',
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-500/10',
  },
};

function findTeamByKey(teamKey: string, teamsList: any[]) {
  if (!teamKey) return undefined;
  const keyUpper = teamKey.trim().toUpperCase();
  return (teamsList || []).find((t: any) => {
    if (!t) return false;
    if (t.id && (t.id === teamKey || String(t.id).toUpperCase() === keyUpper)) return true;
    const nameUpper = (t.name || '').trim().toUpperCase();
    const tagUpper = (t.tag || '').trim().toUpperCase();
    return (
      nameUpper === keyUpper ||
      tagUpper === keyUpper ||
      (keyUpper.length >= 3 && nameUpper.startsWith(keyUpper)) ||
      (nameUpper.length >= 3 && keyUpper.startsWith(nameUpper))
    );
  });
}

function teamRoster(team: any) {
  if (!team) return [];
  const rows = team.members || [];
  const byId = new Map<string, { id: string; name?: string | null }>();
  if (team.captain?.id) {
    byId.set(team.captain.id, { id: team.captain.id, name: team.captain.name || team.captain.username });
  }
  for (const row of rows) {
    const user = row.user || row;
    if (!user?.id) continue;
    byId.set(user.id, { id: user.id, name: user.name || user.username });
  }
  return Array.from(byId.values());
}

function formatTeamsForWalkover(dbTeams: any[], userGradeMap: Record<string, string>) {
  return (dbTeams || []).map((t: any) => {
    const byId = new Map<string, { id: string; name?: string | null; grade?: string | null; target?: number | null }>();
    if (t.captain?.id) {
      byId.set(t.captain.id, {
        id: t.captain.id,
        name: t.captain.name || t.captain.username,
        grade: userGradeMap[t.captain.id] || null,
        target: typeof t.captain.target === 'number' ? t.captain.target : null,
      });
    }
    for (const row of t.members || []) {
      const user = row.user || row;
      if (!user?.id) continue;
      byId.set(user.id, {
        id: user.id,
        name: user.name || user.username,
        grade: userGradeMap[user.id] || null,
        target: typeof user.target === 'number' ? user.target : null,
      });
    }
    return {
      id: t.id,
      name: t.name,
      savedLineups: t.savedLineups,
      members: Array.from(byId.values()),
    };
  });
}

function buildUserTargetMap(dbTeams: any[]) {
  const targetMap = new Map<string, number>();
  for (const t of dbTeams || []) {
    if (t.captain?.id && typeof t.captain.target === 'number') {
      targetMap.set(t.captain.id, t.captain.target);
    }
    for (const row of t.members || []) {
      const user = row.user || row;
      if (user?.id && typeof user.target === 'number') {
        targetMap.set(user.id, user.target);
      }
    }
  }
  return targetMap;
}

function resolveEffectiveScoreMapForDay({
  dayNumber,
  dbTeams,
  dbScores,
  stages = [],
  userGradeMap = {},
}: {
  dayNumber: number;
  dbTeams: any[];
  dbScores: any[];
  stages?: any[];
  userGradeMap?: Record<string, string>;
}) {
  const formattedTeams = formatTeamsForWalkover(dbTeams, userGradeMap);
  const pairings = resolveOrganizerPairings(stages, dbTeams);
  const teamIdByName = new Map<string, string>();
  for (const t of dbTeams || []) {
    if (t.name && t.id) {
      teamIdByName.set(String(t.name).trim().toUpperCase(), String(t.id));
    }
  }

  const normalizedPairings = pairings.map((p) => {
    const t1Id = p.team1Id || teamIdByName.get((p.team1Name || '').trim().toUpperCase()) || '';
    const t2Id = p.team2Id || teamIdByName.get((p.team2Name || '').trim().toUpperCase()) || '';
    return {
      dayNumber: p.dayNumber,
      team1Id: t1Id,
      team2Id: t2Id,
    };
  });

  const gradeMap = new Map<string, string>(Object.entries(userGradeMap || {}));
  const targetMap = buildUserTargetMap(dbTeams);

  const { effectiveScores } = resolveDayWalkoversAndScores({
    dayNumber,
    teams: formattedTeams,
    pairings: normalizedPairings,
    existingScores: dbScores || [],
    userGradeMap: gradeMap,
    userTargetMap: targetMap,
  });

  const map: Record<string, { score: number; slams: number; isWalkover?: boolean }> = {};
  for (const row of effectiveScores) {
    if (row.dayNumber === dayNumber) {
      map[row.userId] = {
        score: row.score,
        slams: row.slams || 0,
        isWalkover: Boolean(row.isWalkover),
      };
    }
  }
  return map;
}

function getDetailedMatchCombiData({
  dayNumber,
  team1Name,
  team2Name,
  dbTeams,
  dbScores,
  stages = [],
  userGradeMap = {},
  revealed = false,
}: {
  dayNumber: number;
  team1Name: string;
  team2Name: string;
  dbTeams: any[];
  dbScores: any[];
  stages?: any[];
  userGradeMap?: Record<string, string>;
  revealed?: boolean;
}) {
  if (!revealed) return null;
  const t1 = findTeamByKey(team1Name, dbTeams);
  const t2 = findTeamByKey(team2Name, dbTeams);
  if (!t1 || !t2) return null;

  const roster1 = teamRoster(t1);
  const roster2 = teamRoster(t2);
  const rosterMap1 = new Map(roster1.map((p) => [p.id, p.name || 'Player']));
  const rosterMap2 = new Map(roster2.map((p) => [p.id, p.name || 'Player']));

  const combi1 = resolveEffectiveTeamCombi({ team: t1, dayNumber });
  const combi2 = resolveEffectiveTeamCombi({ team: t2, dayNumber });

  const scoreMap = resolveEffectiveScoreMapForDay({
    dayNumber,
    dbTeams,
    dbScores,
    stages,
    userGradeMap,
  });
  const matchResult = scoreMatchDay(combi1.rounds, combi2.rounds, roster1, roster2, scoreMap);

  const events = matchResult.events.map((ev, idx) => {
    const r1 = combi1.rounds?.[idx];
    const r2 = combi2.rounds?.[idx];

    const t1PlayerList = (ev.team1PlayerIds && ev.team1PlayerIds.length > 0 ? ev.team1PlayerIds : (r1?.playerIds || [])).map((id: any) => {
      const pId = String(id || '');
      const name = rosterMap1.get(pId) || (r1?.players && r1.players[0]) || 'Player';
      const scoreObj = scoreMap[pId];
      const isWO = Boolean(scoreObj?.isWalkover);
      return {
        id: pId,
        name,
        score: scoreObj?.score ?? null,
        slams: scoreObj?.slams ?? 0,
        isWalkover: isWO,
      };
    });

    const t2PlayerList = (ev.team2PlayerIds && ev.team2PlayerIds.length > 0 ? ev.team2PlayerIds : (r2?.playerIds || [])).map((id: any) => {
      const pId = String(id || '');
      const name = rosterMap2.get(pId) || (r2?.players && r2.players[0]) || 'Player';
      const scoreObj = scoreMap[pId];
      const isWO = Boolean(scoreObj?.isWalkover);
      return {
        id: pId,
        name,
        score: scoreObj?.score ?? null,
        slams: scoreObj?.slams ?? 0,
        isWalkover: isWO,
      };
    });

    const t1SumScore = t1PlayerList.reduce((sum, p) => sum + (p.score || 0), 0);
    const t2SumScore = t2PlayerList.reduce((sum, p) => sum + (p.score || 0), 0);
    const t1HasWO = t1PlayerList.length === 0 || t1PlayerList.some((p) => p.isWalkover);
    const t2HasWO = t2PlayerList.length === 0 || t2PlayerList.some((p) => p.isWalkover);

    let explanation = '';
    if (ev.reason === 'double-walkover') {
      explanation = 'Double Walkover (0 pts)';
    } else if (ev.reason === 'walkover') {
      if (ev.winnerTeam === 1) {
        explanation = `${t2.name} Walkover (${t1.name} +2 pts)`;
      } else {
        explanation = `${t1.name} Walkover (${t2.name} +2 pts)`;
      }
    } else if (ev.reason === 'tie') {
      explanation = `Tied score (${t1SumScore} vs ${t2SumScore}) · 1 pt each`;
    } else if (ev.winnerTeam === 1) {
      explanation = `${t1.name} won by lower score (${t1SumScore} vs ${t2SumScore}) · +2 pts`;
    } else if (ev.winnerTeam === 2) {
      explanation = `${t2.name} won by lower score (${t2SumScore} vs ${t1SumScore}) · +2 pts`;
    }

    return {
      name: ev.name,
      format: ev.format,
      winnerTeam: ev.winnerTeam,
      reason: ev.reason,
      team1Pts: ev.team1Pts,
      team2Pts: ev.team2Pts,
      team1PlayerList: t1PlayerList.length > 0 ? t1PlayerList : (r1?.players || []).map((name) => ({ name, score: null, isWalkover: false })),
      team2PlayerList: t2PlayerList.length > 0 ? t2PlayerList : (r2?.players || []).map((name) => ({ name, score: null, isWalkover: false })),
      team1SumScore: t1HasWO ? null : t1SumScore,
      team2SumScore: t2HasWO ? null : t2SumScore,
      t1HasWO,
      t2HasWO,
      explanation,
    };
  });

  return {
    t1,
    t2,
    matchResult,
    events,
  };
}

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
  const [dbTeams, setDbTeams] = React.useState<any[]>([]);
  const [dbScores, setDbScores] = React.useState<any[]>([]);
  const [userGradeMap, setUserGradeMap] = React.useState<Record<string, string>>({});
  const [dayDatesMap, setDayDatesMap] = React.useState<Record<number, string>>({});
  const [selectedMatch, setSelectedMatch] = React.useState<{
    dayNumber: number;
    stageLabel: string;
    calendarDate: string;
    title: string;
    matchLabel?: string;
    t1: any;
    t2: any;
    isSpoc?: boolean;
  } | null>(null);

  const isSelectedMatchRevealed = React.useMemo(() => {
    if (!selectedMatch) return false;
    return isCombiSubmissionLocked(selectedMatch.dayNumber, dayDatesMap, new Date(nowMs));
  }, [selectedMatch, dayDatesMap, nowMs]);

  const matchDetails = React.useMemo(() => {
    if (!selectedMatch || !isSelectedMatchRevealed) return null;
    return getDetailedMatchCombiData({
      dayNumber: selectedMatch.dayNumber,
      team1Name: selectedMatch.t1.name,
      team2Name: selectedMatch.t2.name,
      dbTeams,
      dbScores,
      stages,
      userGradeMap,
      revealed: isSelectedMatchRevealed,
    });
  }, [selectedMatch, isSelectedMatchRevealed, dbTeams, dbScores, stages, userGradeMap]);

  const [activeMatchVideoPlayer, setActiveMatchVideoPlayer] = React.useState<string | null>(null);

  const matchPlayers = React.useMemo(() => {
    const list: string[] = [];
    if (matchDetails?.events) {
      matchDetails.events.forEach((ev: any) => {
        ev.team1PlayerList?.forEach((p: any) => {
          if (p.name && !list.includes(p.name)) list.push(p.name);
        });
        ev.team2PlayerList?.forEach((p: any) => {
          if (p.name && !list.includes(p.name)) list.push(p.name);
        });
      });
    }
    if (list.length === 0 && selectedMatch) {
      const t1 = findTeamByKey(selectedMatch.t1.name, dbTeams);
      const t2 = findTeamByKey(selectedMatch.t2.name, dbTeams);
      t1?.players?.forEach((p: any) => {
        if (p.name && !list.includes(p.name)) list.push(p.name);
      });
      t2?.players?.forEach((p: any) => {
        if (p.name && !list.includes(p.name)) list.push(p.name);
      });
    }
    return list;
  }, [matchDetails, selectedMatch, dbTeams]);

  const liveDayNum = React.useMemo(
    () => scheduleDays.find((d) => monumentStatus(d, nowMs) === 'live')?.dayNumber ?? null,
    [scheduleDays, nowMs]
  );

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await getCurrentEditionCombisData();
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
        setDbTeams(res.teams || []);
        setDbScores(res.scores || []);
        setUserGradeMap((res as any).userGradeMap || {});
        setDayDatesMap(dayDates);
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
    const id = setInterval(load, 60000);
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

  const getMatchScoreResult = React.useCallback(
    (dayNum: number, team1Name: string, team2Name: string) => {
      const locked = isCombiSubmissionLocked(dayNum, dayDatesMap, new Date(nowMs));
      if (!locked) return null;
      const t1 = findTeamByKey(team1Name, dbTeams);
      const t2 = findTeamByKey(team2Name, dbTeams);
      if (!t1 || !t2) return null;
      const combi1 = resolveEffectiveTeamCombi({ team: t1, dayNumber: dayNum });
      const combi2 = resolveEffectiveTeamCombi({ team: t2, dayNumber: dayNum });
      const scoreMap = resolveEffectiveScoreMapForDay({
        dayNumber: dayNum,
        dbTeams,
        dbScores,
        stages,
        userGradeMap,
      });
      return scoreMatchDay(
        combi1.rounds,
        combi2.rounds,
        teamRoster(t1),
        teamRoster(t2),
        scoreMap
      );
    },
    [dayDatesMap, nowMs, dbTeams, dbScores, stages, userGradeMap]
  );

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
          <div
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
            className="flex items-center gap-1.5 overflow-x-auto touch-scroll-x desktop-slim-scrollbar pb-2 w-full md:flex-1 min-w-0"
          >
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
                    logo: toStorageProxyUrl(t1Face.logo),
                    color: t1Face.color || TEAMS_INFO[t1Face.name]?.color || 'text-foreground',
                    border: t1Face.border || TEAMS_INFO[t1Face.name]?.border || 'border-border',
                    bg: t1Face.bg || TEAMS_INFO[t1Face.name]?.bg || 'bg-muted',
                  };
                  const t2 = {
                    ...t2Face,
                    logo: toStorageProxyUrl(t2Face.logo),
                    color: t2Face.color || TEAMS_INFO[t2Face.name]?.color || 'text-foreground',
                    border: t2Face.border || TEAMS_INFO[t2Face.name]?.border || 'border-border',
                    bg: t2Face.bg || TEAMS_INFO[t2Face.name]?.bg || 'bg-muted',
                  };

                  const matchResult = !isSpoc ? getMatchScoreResult(d.dayNumber, t1.name, t2.name) : null;
                  const hasResult = matchResult !== null;
                  const isT1Winner = hasResult && matchResult.matchWinner === 1;
                  const isT2Winner = hasResult && matchResult.matchWinner === 2;
                  const isTie = hasResult && matchResult.matchWinner === 0;

                  const isMatchHighlighted = searchTerm.trim() && (
                    t1.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
                    t2.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
                  );

                  return (
                    <div
                      key={matchIdx}
                      onClick={() => {
                        setSelectedMatch({
                          dayNumber: d.dayNumber,
                          stageLabel: d.stageLabel,
                          calendarDate: d.calendarDate,
                          title: d.title,
                          matchLabel: match.matchLabel,
                          t1,
                          t2,
                          isSpoc,
                        });
                      }}
                      className={`p-3 sm:p-5 rounded-2xl border transition-all cursor-pointer group ${
                        isSpoc ? 'md:col-span-2' : ''
                      } ${
                        isMatchHighlighted
                          ? 'border-amber-400 bg-amber-500/15 shadow-md shadow-amber-500/20'
                          : isSpoc
                          ? 'border-violet-500/50 bg-violet-950/20 hover:border-violet-400/60'
                          : hasResult
                          ? 'border-border/80 bg-card/95 hover:border-amber-500/60 hover:shadow-lg shadow-sm'
                          : 'border-border/70 bg-card/90 hover:border-amber-500/40 hover:bg-card'
                      }`}
                    >
                      {isSpoc ? (
                        <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
                          <Badge variant="outline" className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest border-violet-500/50 text-violet-300 bg-violet-500/10 px-2.5 sm:px-3 py-0.5 sm:py-1">
                            <Sparkles className="h-3 w-3 mr-1 inline" />
                            Spoc Exhibition Match
                          </Badge>
                          {match.matchLabel && match.matchLabel !== 'Spoc Exhibition Match' ? (
                            <span className="text-[10px] font-bold text-violet-300/80">{match.matchLabel}</span>
                          ) : null}
                        </div>
                      ) : match.matchLabel ? (
                        <div className="flex items-center justify-center gap-2 mb-2.5 sm:mb-3">
                          <span className="text-[9.5px] sm:text-[10.5px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shadow-xs">
                            <Trophy className="h-3 w-3 text-amber-400 shrink-0" />
                            <span>{match.matchLabel}</span>
                          </span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-2 sm:gap-3">
                        {/* Team 1 */}
                        <div className={`flex items-center gap-2 sm:gap-3 flex-1 min-w-0 transition-opacity ${isT2Winner ? 'opacity-55' : 'opacity-100'}`}>
                          <div className={`relative ${isSpoc ? 'h-16 w-14 sm:h-32 sm:w-24' : 'h-11 w-11 min-[400px]:h-13 min-[400px]:w-13 sm:h-16 sm:w-16'} rounded-xl overflow-hidden bg-slate-950/90 p-0.5 border-2 ${isT1Winner ? 'border-emerald-400 ring-2 ring-emerald-500/40 shadow-emerald-500/20 shadow-lg' : t1.border} shrink-0 shadow-lg flex items-center justify-center`}>
                            <img
                              src={t1.logo}
                              alt={t1.name}
                              className={`h-full w-full ${isSpoc ? 'object-cover rounded-lg' : 'object-contain'}`}
                            />
                            {isT1Winner && (
                              <div className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 rounded-full p-0.5 shadow-md">
                                <Crown className="h-3 w-3 fill-current" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex flex-col items-start">
                            <span className={`text-[11px] sm:text-sm font-black truncate block w-full text-left ${isSpoc ? 'text-violet-200' : isT1Winner ? 'text-emerald-400 font-extrabold' : t1.color}`} title={t1.name}>
                              {t1.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase opacity-80">
                                {t1.tag}
                              </span>
                              {isT1Winner && (
                                <span className="inline-flex items-center gap-1 text-[8.5px] sm:text-[9.5px] font-black uppercase text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 rounded shadow-xs">
                                  <Crown className="h-2.5 w-2.5 text-emerald-400 inline" /> Winner
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* VS / Score Divider */}
                        {hasResult ? (
                          <div className="flex flex-col items-center justify-center shrink-0 px-1.5 sm:px-3">
                            <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl font-black text-xs sm:text-base bg-slate-950/90 border border-border/80 shadow-md">
                              <span className={isT1Winner ? 'text-emerald-400 font-extrabold text-sm sm:text-lg' : isT2Winner ? 'text-muted-foreground/70' : 'text-foreground'}>
                                {matchResult.team1EventPts}
                              </span>
                              <span className="text-muted-foreground/40 text-[10px] sm:text-xs font-normal">–</span>
                              <span className={isT2Winner ? 'text-emerald-400 font-extrabold text-sm sm:text-lg' : isT1Winner ? 'text-muted-foreground/70' : 'text-foreground'}>
                                {matchResult.team2EventPts}
                              </span>
                            </div>
                            <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground mt-0.5">
                              {isTie ? 'Tie / Draw' : 'Event Pts'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center shrink-0 px-1 sm:px-2">
                            <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg shadow-sm ${
                              isSpoc
                                ? 'text-violet-300 bg-violet-500/15 border border-violet-500/40'
                                : 'text-amber-500 bg-amber-500/10 border border-amber-500/30'
                            }`}>
                              VS
                            </span>
                          </div>
                        )}

                        {/* Team 2 */}
                        <div className={`flex items-center justify-end gap-2 sm:gap-3 flex-1 min-w-0 text-right transition-opacity ${isT1Winner ? 'opacity-55' : 'opacity-100'}`}>
                          <div className="min-w-0 flex flex-col items-end">
                            <span className={`text-[11px] sm:text-sm font-black truncate block w-full text-right ${isSpoc ? 'text-violet-200' : isT2Winner ? 'text-emerald-400 font-extrabold' : t2.color}`} title={t2.name}>
                              {t2.name}
                            </span>
                            <div className="flex items-center justify-end gap-1.5 mt-0.5 flex-wrap">
                              {isT2Winner && (
                                <span className="inline-flex items-center gap-1 text-[8.5px] sm:text-[9.5px] font-black uppercase text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 rounded shadow-xs">
                                  <Crown className="h-2.5 w-2.5 text-emerald-400 inline" /> Winner
                                </span>
                              )}
                              <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase opacity-80">
                                {t2.tag}
                              </span>
                            </div>
                          </div>
                          <div className={`relative ${isSpoc ? 'h-16 w-14 sm:h-32 sm:w-24' : 'h-11 w-11 min-[400px]:h-13 min-[400px]:w-13 sm:h-16 sm:w-16'} rounded-xl overflow-hidden bg-slate-950/90 p-0.5 border-2 ${isT2Winner ? 'border-emerald-400 ring-2 ring-emerald-500/40 shadow-emerald-500/20 shadow-lg' : t2.border} shrink-0 shadow-lg flex items-center justify-center`}>
                            <img
                              src={t2.logo}
                              alt={t2.name}
                              className={`h-full w-full ${isSpoc ? 'object-cover rounded-lg' : 'object-contain'}`}
                            />
                            {isT2Winner && (
                              <div className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 rounded-full p-0.5 shadow-md">
                                <Crown className="h-3 w-3 fill-current" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Click helper cue and Watch Video link */}
                      <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] font-bold text-muted-foreground transition-colors">
                        <span className="group-hover:text-amber-400 transition-colors">
                          {hasResult ? 'Click to view combi scores & event breakdown' : 'Click to view match fixture details'}
                        </span>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/videos?day=${d.dayNumber}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 transition-all shrink-0"
                            title={`Watch Day ${d.dayNumber} match videos`}
                          >
                            <Play className="h-2.5 w-2.5 fill-violet-400" /> Watch Videos
                          </Link>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-amber-400 transition-all" />
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

      {/* MATCH DETAIL & COMBI SCORECARD MODAL */}
      <Dialog
        open={Boolean(selectedMatch)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMatch(null);
            setActiveMatchVideoPlayer(null);
          }
        }}
        className="max-w-4xl w-[96vw]"
      >
        {selectedMatch && (
          <div className="space-y-5 text-left">
            <DialogHeader className="border-b border-border/60 pb-3 text-left">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="outline" className="text-[10px] font-bold border-amber-500/40 text-amber-400 bg-amber-500/10">
                  Day {selectedMatch.dayNumber} · {selectedMatch.stageLabel}
                </Badge>
                {selectedMatch.matchLabel && (
                  <Badge variant="secondary" className="text-[10px] font-bold">
                    {selectedMatch.matchLabel}
                  </Badge>
                )}
                <Link
                  href={`/videos?day=${selectedMatch.dayNumber}`}
                  className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 transition-all ml-auto"
                  title="Watch match videos"
                >
                  <Play className="h-2.5 w-2.5 fill-violet-400" /> Watch Day {selectedMatch.dayNumber} Videos
                </Link>
                <span className="text-xs text-muted-foreground">
                  {formatCalendarDate(selectedMatch.calendarDate)}
                </span>
              </div>
              <DialogTitle className="text-lg sm:text-xl font-black flex items-center justify-between gap-2">
                <span>{isSelectedMatchRevealed ? 'Match Breakdown & Scores' : 'Match Fixture Details'}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {isSelectedMatchRevealed
                  ? 'Lineup combis, individual player scores, event points, and match outcome breakdown.'
                  : 'Fixture details and team matchup. Lineup combis and match score insights unlock after 9:30 PM IST.'}
              </DialogDescription>
            </DialogHeader>

            {/* Match Score Banner */}
            {matchDetails?.matchResult ? (
              <div className="space-y-4">
                {/* Teams and Scorecard Banner */}
                <div className="rounded-2xl border border-border/80 bg-gradient-to-b from-card to-background p-4 shadow-inner">
                  <div className="flex items-center justify-between gap-2 sm:gap-4">
                    {/* Team 1 */}
                    <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                      <div className={`h-11 w-11 sm:h-14 sm:w-14 rounded-xl overflow-hidden bg-slate-950 p-1 border-2 ${matchDetails.matchResult.matchWinner === 1 ? 'border-emerald-400 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/20' : selectedMatch.t1.border} shrink-0 flex items-center justify-center`}>
                        <img src={selectedMatch.t1.logo} alt={selectedMatch.t1.name} className="h-full w-full object-contain" />
                      </div>
                      <div className="min-w-0 flex flex-col items-start">
                        <span className="text-xs sm:text-sm font-black truncate text-foreground block w-full text-left" title={selectedMatch.t1.name}>
                          {selectedMatch.t1.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{selectedMatch.t1.tag}</span>
                          {matchDetails.matchResult.matchWinner === 1 && (
                            <span className="inline-flex items-center gap-1 text-[8.5px] sm:text-[9.5px] font-black uppercase text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 rounded shadow-xs">
                              <Crown className="h-2.5 w-2.5 text-emerald-400" /> Winner
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Score Display */}
                    <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl bg-slate-950 border border-border shadow-inner shrink-0">
                      <div className="flex items-center gap-2 font-mono font-black text-base sm:text-2xl">
                        <span className={matchDetails.matchResult.matchWinner === 1 ? 'text-emerald-400 font-extrabold' : 'text-foreground'}>
                          {matchDetails.matchResult.team1EventPts}
                        </span>
                        <span className="text-muted-foreground/50 text-xs sm:text-sm">–</span>
                        <span className={matchDetails.matchResult.matchWinner === 2 ? 'text-emerald-400 font-extrabold' : 'text-foreground'}>
                          {matchDetails.matchResult.team2EventPts}
                        </span>
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-muted-foreground">Event Pts</span>
                    </div>

                    {/* Team 2 */}
                    <div className="flex items-center justify-end gap-2.5 sm:gap-3 flex-1 min-w-0 text-right">
                      <div className="min-w-0 flex flex-col items-end">
                        <span className="text-xs sm:text-sm font-black truncate text-foreground block w-full text-right" title={selectedMatch.t2.name}>
                          {selectedMatch.t2.name}
                        </span>
                        <div className="flex items-center justify-end gap-1.5 mt-0.5 flex-wrap">
                          {matchDetails.matchResult.matchWinner === 2 && (
                            <span className="inline-flex items-center gap-1 text-[8.5px] sm:text-[9.5px] font-black uppercase text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 rounded shadow-xs">
                              <Crown className="h-2.5 w-2.5 text-emerald-400" /> Winner
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{selectedMatch.t2.tag}</span>
                        </div>
                      </div>
                      <div className={`h-11 w-11 sm:h-14 sm:w-14 rounded-xl overflow-hidden bg-slate-950 p-1 border-2 ${matchDetails.matchResult.matchWinner === 2 ? 'border-emerald-400 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/20' : selectedMatch.t2.border} shrink-0 flex items-center justify-center`}>
                        <img src={selectedMatch.t2.logo} alt={selectedMatch.t2.name} className="h-full w-full object-contain" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Embedded Video Player for this match's players */}
                {matchPlayers.length > 0 && (
                  <div className="pt-1">
                    <MatchVideoPlayer
                      players={matchPlayers}
                      dayNumber={selectedMatch.dayNumber}
                      editionNumber={205}
                      matchTitle={`${selectedMatch.t1.name} vs ${selectedMatch.t2.name}`}
                      team1Name={selectedMatch.t1.name}
                      team2Name={selectedMatch.t2.name}
                      activePlayer={activeMatchVideoPlayer || undefined}
                      onSelectPlayer={(pName) => setActiveMatchVideoPlayer(pName)}
                    />
                  </div>
                )}

                {/* Winner Explanation Banner */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-400">
                    <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
                    <span>How this match was decided:</span>
                  </div>
                  <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                    {matchDetails.matchResult.matchWinner === 1 ? (
                      <>
                        <strong className="text-emerald-400 font-extrabold">{selectedMatch.t1.name}</strong> won the match by securing{' '}
                        <strong className="text-emerald-400 font-extrabold">{matchDetails.matchResult.team1EventPts} Event Points</strong> across the combi rounds compared to{' '}
                        <strong className="text-foreground">{selectedMatch.t2.name}</strong> ({matchDetails.matchResult.team2EventPts} pts).
                      </>
                    ) : matchDetails.matchResult.matchWinner === 2 ? (
                      <>
                        <strong className="text-emerald-400 font-extrabold">{selectedMatch.t2.name}</strong> won the match by securing{' '}
                        <strong className="text-emerald-400 font-extrabold">{matchDetails.matchResult.team2EventPts} Event Points</strong> across the combi rounds compared to{' '}
                        <strong className="text-foreground">{selectedMatch.t1.name}</strong> ({matchDetails.matchResult.team1EventPts} pts).
                      </>
                    ) : (
                      <>
                        The match concluded in a <strong className="text-amber-400 font-extrabold">DRAW / TIE</strong> with both teams securing{' '}
                        <strong className="text-amber-400 font-extrabold">{matchDetails.matchResult.team1EventPts} Event Points</strong> each.
                      </>
                    )}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground">
                    💡 <em>Rule:</em> Each event win awards 2 points (ties award 1 point; walkover awards 2 points to the opponent). The team with the highest total event points wins the match.
                  </p>
                </div>

                {/* Event by Event Combi Table */}
                <div className="space-y-2">
                  <div className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Combi Event Breakdown ({matchDetails.events.length} Events)</span>
                  </div>

                  <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
                    {matchDetails.events.map((ev: any, idx: number) => {
                      const isT1EvWin = ev.winnerTeam === 1;
                      const isT2EvWin = ev.winnerTeam === 2;
                      const isEvTie = ev.winnerTeam === 0;

                      return (
                        <div key={idx} className="rounded-xl border border-border/70 bg-card/80 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                {ev.format}
                              </span>
                              <span className="text-xs font-black text-foreground">{ev.name}</span>
                            </div>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                              isT1EvWin || isT2EvWin
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            }`}>
                              {ev.explanation}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                            {/* Left Team Combi */}
                            <div className={`p-2.5 rounded-lg border ${isT1EvWin ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-muted/30 border-border/50'}`}>
                              <div className="flex items-center justify-between font-bold text-[11px] mb-1.5">
                                <span className={selectedMatch.t1.color}>{selectedMatch.t1.name}</span>
                                <span className="font-mono text-emerald-400 font-black">+{ev.team1Pts} pts</span>
                              </div>
                              <div className="space-y-1">
                                {ev.team1PlayerList.map((p: any, pIdx: number) => (
                                  <div key={pIdx} className="flex items-center justify-between text-[11px] gap-1.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className={p.isWalkover ? 'text-amber-400 font-bold' : 'text-foreground font-medium'}>
                                        {p.name}
                                      </span>
                                      {p.name && (
                                        <button
                                          type="button"
                                          onClick={() => setActiveMatchVideoPlayer(p.name)}
                                          className={`inline-flex items-center gap-0.5 text-[8.5px] font-black px-1.5 py-0.5 rounded transition-all shrink-0 ${
                                            activeMatchVideoPlayer === p.name
                                              ? 'bg-amber-500 text-slate-950 font-black shadow-xs ring-1 ring-amber-400'
                                              : 'bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25'
                                          }`}
                                          title={`Watch ${p.name}'s video`}
                                        >
                                          <Play className={`h-2 w-2 ${activeMatchVideoPlayer === p.name ? 'fill-slate-950 text-slate-950' : 'fill-violet-400'}`} /> Watch
                                        </button>
                                      )}
                                    </div>
                                    {p.isWalkover ? (
                                      <div className="flex items-center gap-1.5">
                                        {p.score != null && (
                                          <span className="font-mono text-amber-400/90 font-bold">
                                            Score: {p.score}
                                          </span>
                                        )}
                                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0 bg-amber-500/20 text-amber-300 border-amber-500/40">
                                          Walkover
                                        </Badge>
                                      </div>
                                    ) : (
                                      <span className="font-mono text-muted-foreground font-bold">
                                        {p.score != null ? `Score: ${p.score}` : '—'}
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {ev.team1SumScore != null && (
                                  <div className="text-[10.5px] font-black text-muted-foreground text-right pt-1.5 border-t border-border/40">
                                    Total: <span className="text-foreground">{ev.team1SumScore}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right Team Combi */}
                            <div className={`p-2.5 rounded-lg border ${isT2EvWin ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-muted/30 border-border/50'}`}>
                              <div className="flex items-center justify-between font-bold text-[11px] mb-1.5">
                                <span className={selectedMatch.t2.color}>{selectedMatch.t2.name}</span>
                                <span className="font-mono text-emerald-400 font-black">+{ev.team2Pts} pts</span>
                              </div>
                              <div className="space-y-1">
                                {ev.team2PlayerList.map((p: any, pIdx: number) => (
                                  <div key={pIdx} className="flex items-center justify-between text-[11px] gap-1.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className={p.isWalkover ? 'text-amber-400 font-bold' : 'text-foreground font-medium'}>
                                        {p.name}
                                      </span>
                                      {p.name && (
                                        <button
                                          type="button"
                                          onClick={() => setActiveMatchVideoPlayer(p.name)}
                                          className={`inline-flex items-center gap-0.5 text-[8.5px] font-black px-1.5 py-0.5 rounded transition-all shrink-0 ${
                                            activeMatchVideoPlayer === p.name
                                              ? 'bg-amber-500 text-slate-950 font-black shadow-xs ring-1 ring-amber-400'
                                              : 'bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25'
                                          }`}
                                          title={`Watch ${p.name}'s video`}
                                        >
                                          <Play className={`h-2 w-2 ${activeMatchVideoPlayer === p.name ? 'fill-slate-950 text-slate-950' : 'fill-violet-400'}`} /> Watch
                                        </button>
                                      )}
                                    </div>
                                    {p.isWalkover ? (
                                      <div className="flex items-center gap-1.5">
                                        {p.score != null && (
                                          <span className="font-mono text-amber-400/90 font-bold">
                                            Score: {p.score}
                                          </span>
                                        )}
                                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0 bg-amber-500/20 text-amber-300 border-amber-500/40">
                                          Walkover
                                        </Badge>
                                      </div>
                                    ) : (
                                      <span className="font-mono text-muted-foreground font-bold">
                                        {p.score != null ? `Score: ${p.score}` : '—'}
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {ev.team2SumScore != null && (
                                  <div className="text-[10.5px] font-black text-muted-foreground text-right pt-1.5 border-t border-border/40">
                                    Total: <span className="text-foreground">{ev.team2SumScore}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Team Matchup Banner (Pre-lock / No scores revealed) */}
                <div className="rounded-2xl border border-border/80 bg-gradient-to-b from-card to-background p-4 shadow-inner">
                  <div className="flex items-center justify-between gap-2 sm:gap-4">
                    {/* Team 1 */}
                    <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                      <div className={`h-11 w-11 sm:h-14 sm:w-14 rounded-xl overflow-hidden bg-slate-950 p-1 border-2 ${selectedMatch.t1.border} shrink-0 flex items-center justify-center`}>
                        <img src={selectedMatch.t1.logo} alt={selectedMatch.t1.name} className="h-full w-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <span className={`text-xs sm:text-sm font-black truncate block ${selectedMatch.t1.color}`} title={selectedMatch.t1.name}>
                          {selectedMatch.t1.name}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{selectedMatch.t1.tag}</span>
                      </div>
                    </div>

                    {/* VS Badge */}
                    <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl bg-slate-950 border border-amber-500/30 shrink-0 shadow-inner">
                      <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-amber-400">VS</span>
                    </div>

                    {/* Team 2 */}
                    <div className="flex items-center justify-end gap-2.5 sm:gap-3 flex-1 min-w-0 text-right">
                      <div className="min-w-0">
                        <span className={`text-xs sm:text-sm font-black truncate block ${selectedMatch.t2.color}`} title={selectedMatch.t2.name}>
                          {selectedMatch.t2.name}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{selectedMatch.t2.tag}</span>
                      </div>
                      <div className={`h-11 w-11 sm:h-14 sm:w-14 rounded-xl overflow-hidden bg-slate-950 p-1 border-2 ${selectedMatch.t2.border} shrink-0 flex items-center justify-center`}>
                        <img src={selectedMatch.t2.logo} alt={selectedMatch.t2.name} className="h-full w-full object-contain" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Embedded Video Player for this match's players */}
                {matchPlayers.length > 0 && (
                  <div className="pt-1">
                    <MatchVideoPlayer
                      players={matchPlayers}
                      dayNumber={selectedMatch.dayNumber}
                      editionNumber={205}
                      matchTitle={`${selectedMatch.t1.name} vs ${selectedMatch.t2.name}`}
                      team1Name={selectedMatch.t1.name}
                      team2Name={selectedMatch.t2.name}
                      activePlayer={activeMatchVideoPlayer || undefined}
                      onSelectPlayer={(pName) => setActiveMatchVideoPlayer(pName)}
                    />
                  </div>
                )}

                {/* Locked Insight Notice Banner */}
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-3 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-amber-300">
                      Lineups & Match Breakdown Locked
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                      Team combi lineups, player scores, and match results are hidden for live and upcoming matches until the <strong>9:30 PM IST combi lock</strong> on match day.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/80 border border-amber-500/30 text-[11px] font-bold text-amber-400 shadow-sm">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Unlocks after 9:30 PM IST ({formatCalendarDate(selectedMatch.calendarDate)})</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>

    </div>
  );
}
