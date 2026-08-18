'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { MOCK_TEAMS, MOCK_MATCHES } from '@/lib/mock-data';
import { submitScoreReport } from '@/lib/actions/matchActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  UserCheck, Trophy, Target, Crown, Calendar, Video, CheckCircle2, Layers, Users, Lock, Send, PlayCircle, MapPin, Radio, RotateCcw, AlertCircle, MessageSquare, Share2
} from 'lucide-react';
import { Match, BoardPattern, User } from '@/types';
import { monumentStatus } from '@/lib/bicentennial-monuments';
import { get200thEditionCombisData } from '@/lib/actions/combisActions';
import {
  buildOrganizerScheduleDays,
  type OrganizerScheduleDay,
} from '@/lib/organizer-schedule';
import { ProfileTab } from '@/components/player/ProfileTab';


export default function PlayerClient({ initialPlayer, initialTeam, initialTeammates, initialMatches, initialPatterns, initialStreams }: { initialPlayer: any, initialTeam: any, initialTeammates: any[], initialMatches: any[], initialPatterns: any[], initialStreams?: any[] }) {
  const { data: session } = useSession();

  const [copiedMatchId, setCopiedMatchId] = React.useState<string | null>(null);
  const handleCopyLink = (matchId: string) => {
    const shareUrl = `${window.location.origin}/matches/${matchId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedMatchId(matchId);
      setTimeout(() => setCopiedMatchId(null), 2000);
    });
  };

  // Always use the LOGGED-IN session user as primary identity source
  // initialPlayer provides DB stats — session provides the real name/username
  const sessionUser = (session?.user as any);
  const currentPlayer = React.useMemo(() => {
    if (!sessionUser) return initialPlayer;
    // Merge: session has the correct name/username, initialPlayer has the DB stats
    if (initialPlayer && (
      initialPlayer.id === sessionUser.id ||
      initialPlayer.username?.toLowerCase() === sessionUser.username?.toLowerCase()
    )) {
      return { ...initialPlayer, name: initialPlayer.name || sessionUser.name };
    }
    // If initialPlayer is from wrong user (race condition), use session as base
    return {
      id: sessionUser.id,
      name: sessionUser.name,
      username: sessionUser.username,
      role: sessionUser.role || 'PLAYER',
      rating: initialPlayer?.rating || 1200,
      wins: initialPlayer?.wins || 0,
      losses: initialPlayer?.losses || 0,
      queenStrikes: initialPlayer?.queenStrikes || 0,
      boardsWon: initialPlayer?.boardsWon || 0,
      average: initialPlayer?.average || 0,
      target: initialPlayer?.target || 0,
      rankingSnapshots: initialPlayer?.rankingSnapshots || [],
    };
  }, [sessionUser, initialPlayer]);

  const currentTeam = initialTeam || null;
  const teammates = initialTeammates.length > 0 ? initialTeammates : (currentTeam?.members?.map((m: any) => m.user) || []);
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [scheduleDays, setScheduleDays] = React.useState<OrganizerScheduleDay[]>(() => buildOrganizerScheduleDays());

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await get200thEditionCombisData();
        if (!res.success || cancelled) return;
        const teamsById = new Map((res.teams || []).map((t: any) => [t.id, t.name]));
        const pairings = ((res as any).stageConfig?.stages || []).flatMap((stage: any) =>
          (stage.matchPairings || []).map((p: any) => ({
            dayNumber: p.dayNumber,
            team1Name: p.team1Name || teamsById.get(p.team1Id) || '',
            team2Name: p.team2Name || teamsById.get(p.team2Id) || '',
          }))
        );
        let dayDates: Record<number, string> = {};
        if (res.edition?.dayDates) {
          try {
            dayDates = JSON.parse(res.edition.dayDates);
          } catch {}
        }
        setScheduleDays(
          buildOrganizerScheduleDays({
            totalDays: res.edition?.totalDays,
            dayDates,
            pairings,
            stages: (res as any).stageConfig?.stages || [],
          })
        );
        setNowMs(Date.now());
      } catch (e) {
        console.error('Failed to load organizer schedule for player matches:', e);
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Build this team's fixtures from the same organizer schedule used on Match Schedule.
  // Status / Go Live follow the 8pm–8pm day window, not leftover DB LIVE flags.
  const personalSchedule = React.useMemo(() => {
    if (!currentTeam?.name) return [];

    const teamNameUpper = currentTeam.name.toUpperCase().trim();

    const dbMatches = (initialMatches || []).filter(
      (m: any) =>
        m.team1Id === currentTeam?.id ||
        m.team2Id === currentTeam?.id ||
        m.team1?.name?.toUpperCase() === teamNameUpper ||
        m.team2?.name?.toUpperCase() === teamNameUpper
    );

    const teamLogos: Record<string, string> = {
      'PLYWOOD PIONEERS':  'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/plywood-pioneers.jpeg',
      'SUPERNOVA QUEEN':   'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/supernova-queen.jpeg',
      'POCKET DYNAMOS':    'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/pocket-dynamos.jpeg',
      'LUMEN PILLAR':      'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/lumen-pillar.jpeg',
      'VANILLA FALCONS':   'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/vanilla-falcons.jpeg',
      'VINTAGE STRIKERS':  'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/vintage-strikers.jpeg',
      'EBONY OVERLORDS':   'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/ebony-overlords.jpeg',
      'BORIC SPEEDSTERS':  'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/boric-speedsters.jpeg',
    };

    const usedDbIds = new Set<string>();

    return scheduleDays.map((day) => {
      const fix = day.matches.find(
        (f) => f.team1 === teamNameUpper || f.team2 === teamNameUpper
      );
      if (!fix) return null;
      const isT1 = fix.team1 === teamNameUpper;
      const oppName = isT1 ? fix.team2 : fix.team1;
      const startMs = new Date(day.startIso).getTime();
      const endMs = new Date(day.endIso).getTime();

      const dbMatch = dbMatches.find((db: any) => {
        if (usedDbIds.has(db.id)) return false;
        const t1 = db.team1?.name?.toUpperCase().trim();
        const t2 = db.team2?.name?.toUpperCase().trim();
        const namesMatch =
          (t1 === teamNameUpper && t2 === oppName) ||
          (t2 === teamNameUpper && t1 === oppName);
        if (!namesMatch) return false;
        const t = new Date(db.scheduledTime).getTime();
        const dbDate = new Date(db.scheduledTime).toISOString().slice(0, 10);
        return (t >= startMs && t < endMs) || dbDate === day.calendarDate || db.round === day.dayNumber;
      });
      if (dbMatch?.id) usedDbIds.add(dbMatch.id);

      const windowStatus = monumentStatus({ startIso: day.startIso, endIso: day.endIso }, nowMs);
      const computedStatus = windowStatus === 'completed' ? 'COMPLETED' : windowStatus === 'live' ? 'LIVE' : 'SCHEDULED';

      const t1Name = fix.team1;
      const t2Name = fix.team2;

      return {
        ...(dbMatch || {}),
        id: dbMatch?.id || `schedule_${day.dayNumber}_${teamNameUpper.replace(/\s+/g, '_')}`,
        matchNumber: day.dayNumber,
        scheduledTime: day.startIso,
        endIso: day.endIso,
        calendarDate: day.calendarDate,
        timeRange: day.timeRange,
        status: computedStatus,
        tableNumber: dbMatch?.tableNumber || 1,
        team1Id: isT1 ? currentTeam.id : dbMatch?.team1Id || `t_${t1Name.replace(/\s+/g, '_')}`,
        team1: {
          id: isT1 ? currentTeam.id : dbMatch?.team1?.id || `t_${t1Name.replace(/\s+/g, '_')}`,
          name: t1Name,
          logo: teamLogos[t1Name] || (isT1 ? currentTeam.logo : ''),
        },
        team2Id: !isT1 ? currentTeam.id : dbMatch?.team2Id || `t_${t2Name.replace(/\s+/g, '_')}`,
        team2: {
          id: !isT1 ? currentTeam.id : dbMatch?.team2?.id || `t_${t2Name.replace(/\s+/g, '_')}`,
          name: t2Name,
          logo: teamLogos[t2Name] || (!isT1 ? currentTeam.logo : ''),
        },
      };
    }).filter(Boolean);

  }, [initialMatches, currentTeam, scheduleDays, nowMs]);

  const assignedPatterns = initialPatterns.length > 0 ? initialPatterns : [];

  // ── GO LIVE — Sequential enforcement & replay comment state ──────────────
  // Build a Set of matchIds that already have at least one stream (for this player)
  const streamedMatchIds = React.useMemo(() => {
    const streams = initialStreams || [];
    return new Set<string>(streams.map((s: any) => s.matchId));
  }, [initialStreams]);

  // GoLive Comment Modal (for replays)
  const [goLiveModal, setGoLiveModal] = React.useState<{
    open: boolean;
    match: any;
    isReplay: boolean;
  }>({ open: false, match: null, isReplay: false });
  const [replayComment, setReplayComment] = React.useState('');
  const [replayCommentError, setReplayCommentError] = React.useState('');
  const [goLiveLoading, setGoLiveLoading] = React.useState<string | null>(null);

  // Helper: check if a match is in the past (yesterday or earlier)
  const isPastMatch = React.useCallback((match: any) => {
    if (!match) return false;
    const now = Date.now();
    const endMs = match.endIso ? new Date(match.endIso).getTime() : new Date(match.scheduledTime).getTime() + 24 * 60 * 60 * 1000;
    return now >= endMs;
  }, []);

  /**
   * Returns whether a player can go live on the match at the given sorted index.
   * Enforcement: Day N is unlocked only when all Days 1..N-1 are "done".
   * "Done" = match.status === 'COMPLETED' OR a liveStream record exists for this player+match.
   */
  const canGoLive = React.useCallback(
    (matchIndex: number, sortedMatches: any[]): { allowed: boolean; blockedByDay: number | null } => {
      const match = sortedMatches[matchIndex];
      if (isPastMatch(match)) {
        return { allowed: false, blockedByDay: null };
      }
      const windowStatus = monumentStatus(
        { startIso: match.scheduledTime, endIso: match.endIso },
        Date.now()
      );
      if (windowStatus !== 'live') {
        return { allowed: false, blockedByDay: null };
      }
      if (matchIndex === 0) return { allowed: true, blockedByDay: null };
      for (let i = 0; i < matchIndex; i++) {
        const prev = sortedMatches[i];
        const isDone = prev.status === 'COMPLETED' || streamedMatchIds.has(prev.id);
        if (!isDone) {
          return { allowed: false, blockedByDay: prev.matchNumber || i + 1 };
        }
      }
      return { allowed: true, blockedByDay: null };
    },
    [streamedMatchIds, isPastMatch]
  );

  /** Sorted schedule (ascending by matchNumber / scheduledTime) */
  const sortedSchedule = React.useMemo(
    () => [...personalSchedule].sort((a: any, b: any) => (a.matchNumber || 0) - (b.matchNumber || 0)),
    [personalSchedule]
  );

  /** Open the Cbot YouTube live app — live video is not stored in the website DB. */
  const openCbotLive = (match: any, dayNumber: number) => {
    const name = currentPlayer?.name || currentPlayer?.username || 'Player';
    const day = `Day ${dayNumber}`;
    const params = new URLSearchParams({ name, day });
    const team1 = match?.team1?.name || '';
    const team2 = match?.team2?.name || '';
    if (team1) params.set('teamName', team1);
    if (team2) params.set('opponentName', team2);
    const dayInfo = scheduleDays.find((d) => d.dayNumber === dayNumber);
    if (dayInfo?.stageName || dayInfo?.title) params.set('stage', dayInfo.stageName || dayInfo.title);
    if (dayInfo?.timeRange) params.set('timeRange', dayInfo.timeRange);
    if (dayInfo?.endIso) params.set('endIso', dayInfo.endIso);
    params.set('editionTitle', 'CBOT 200th Edition');
    window.location.href = `cbot://live?${params.toString()}`;
  };

  /** Main Go Live click handler — called from each row's button */
  const handleGoLiveClick = (match: any, matchIndex: number) => {
    const { allowed, blockedByDay } = canGoLive(matchIndex, sortedSchedule);
    if (!allowed) {
      if (blockedByDay) {
        alert(`Complete Day ${blockedByDay} first before going live on Day ${match.matchNumber || matchIndex + 1}.`);
      }
      return;
    }
    openCbotLive(match, match.matchNumber || matchIndex + 1);
  };

  const handleReplaySubmit = () => {
    if (!replayComment.trim()) {
      setReplayCommentError('Please enter a reason before going live again.');
      return;
    }
    setGoLiveLoading(goLiveModal.match?.id || 'loading');
    openCbotLive(goLiveModal.match, goLiveModal.match?.matchNumber || 1);
  };

  // Score & Live Stream Submission Modal State
  const [scoreModalOpen, setScoreModalOpen] = React.useState(false);
  const [selectedMatch, setSelectedMatch] = React.useState<Match | null>(null);

  // Submission Form States
  const [team1Score, setTeam1Score] = React.useState('');
  const [team2Score, setTeam2Score] = React.useState('');
  const [queenStrikes, setQueenStrikes] = React.useState('');
  const [missesCount, setMissesCount] = React.useState('');
  const [liveStreamUrl, setLiveStreamUrl] = React.useState('');
  const [recordingUrl, setRecordingUrl] = React.useState('');
  const [proofNotes, setProofNotes] = React.useState('');

  const [submissionSuccess, setSubmissionSuccess] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleOpenScoreModal = (match: Match) => {
    setSelectedMatch(match);
    setSubmissionSuccess('');
    setScoreModalOpen(true);
    setTeam1Score(match.score1 > 0 ? match.score1.toString() : '');
    setTeam2Score(match.score2 > 0 ? match.score2.toString() : '');
    setQueenStrikes('');
    setMissesCount('');
    setLiveStreamUrl('');
    setRecordingUrl('');
    setProofNotes('');
  };

  const handlePlayerScoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatch) return;
    setIsSubmitting(true);

    const res = await submitScoreReport({
      matchId: selectedMatch.id,
      captainUserId: currentPlayer.id,
      team1Score: parseInt(team1Score || '0', 10),
      team2Score: parseInt(team2Score || '0', 10),
      queenStrikes1: parseInt(queenStrikes || '0', 10),
      queenStrikes2: 0,
      proofNotes: `Player Notes: ${proofNotes} | Misses/Fouls: ${missesCount || 0} | Stream: ${liveStreamUrl} | Recording: ${recordingUrl}`,
      proofUrl: liveStreamUrl || recordingUrl,
    });

    if (res.success) {
      setSubmissionSuccess('Score, misses & live stream links submitted for Referee verification!');
      setTimeout(() => {
        setScoreModalOpen(false);
        setSubmissionSuccess('');
      }, 2000);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        <div className="absolute top-0 right-0 p-4">
            <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/40 bg-amber-500/10">
                <Lock className="h-3 w-3 mr-1" /> Combi & Schedule Read-Only
            </Badge>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Avatar fallback={currentPlayer.name} size="xl" className="border-2 border-amber-500/40 ring-4 ring-amber-500/20 shadow-xl" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-extrabold px-3 py-0.5">
                  <UserCheck className="h-3.5 w-3.5 mr-1" /> Player Portal
                </Badge>
                <Badge variant="carrom" className="font-bold">{currentTeam.name}</Badge>
              </div>
              <h1 className="text-3xl font-black tracking-tight">{currentPlayer.name}</h1>
              <p className="text-muted-foreground text-xs font-mono">
                @{currentPlayer.username} • PIN: ••••
              </p>
            </div>
          </div>
        </div>
      </div>



      {/* ── ALL MATCHES & GO LIVE LIST ────────────────────────────────────────── */}
      {currentTeam?.id && (
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-rose-500/10 shadow-lg shadow-amber-500/10">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />

          <div className="relative p-5 sm:p-7">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/30">
                  <Video className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-400/70">CBOT 200th Edition</div>
                  <div className="text-base font-black text-foreground leading-tight">
                    {currentTeam.name} — All Matches &amp; Go Live
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 font-bold border border-amber-500/20">
                  <Radio className="h-3 w-3" /> GO LIVE — First stream
                </span>
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-violet-500/15 text-violet-400 font-bold border border-violet-500/20">
                  <RotateCcw className="h-3 w-3" /> GO LIVE AGAIN — Replay
                </span>
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/40 text-muted-foreground font-bold border border-border">
                  <Lock className="h-3 w-3" /> Locked — complete prev day first
                </span>
              </div>
            </div>

            {/* Matches list */}
            <div className="space-y-3">
              {sortedSchedule.length === 0 ? (
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/50 border border-border backdrop-blur-sm">
                  {currentTeam?.logo ? (
                    <img src={currentTeam.logo} alt={currentTeam.name} className="w-12 h-12 rounded-xl object-contain border border-border bg-background" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-black text-amber-500">
                      {currentTeam.name?.[0]}
                    </div>
                  )}
                  <div>
                    <div className="font-black text-sm">{currentTeam.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      📅 No matches scheduled yet — check back on your match day.
                    </div>
                  </div>
                </div>
              ) : (
                sortedSchedule.map((match: any, idx: number) => {
                  const { allowed, blockedByDay } = canGoLive(idx, sortedSchedule);
                  const isReplay = streamedMatchIds.has(match.id);
                  const windowStatus = monumentStatus(
                    { startIso: match.scheduledTime, endIso: match.endIso },
                    nowMs
                  );
                  const isCurrentlyLive = windowStatus === 'live';
                  const isCompleted = windowStatus === 'completed';
                  const isUpcoming = windowStatus === 'upcoming';
                  const isMyTeam1 = match.team1Id === currentTeam.id ||
                    match.team1?.name?.toUpperCase() === currentTeam.name?.toUpperCase();
                  const myTeamName = isMyTeam1 ? (match.team1?.name || currentTeam.name) : (match.team2?.name || currentTeam.name);
                  const oppTeamName = isMyTeam1 ? (match.team2?.name || 'TBD') : (match.team1?.name || 'TBD');
                  const myTeamLogo = isMyTeam1 ? (match.team1?.logo || currentTeam.logo) : (match.team2?.logo || currentTeam.logo);
                  const oppTeamLogo = isMyTeam1 ? match.team2?.logo : match.team1?.logo;
                  const dayNum = match.matchNumber || idx + 1;
                  const matchStreams = (initialStreams || []).filter((s: any) => s.matchId === match.id);
                  const [, calMonth, calDay] = String(match.calendarDate || '').split('-');
                  const shortDate = calMonth
                    ? `${Number(calDay)} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(calMonth) - 1]}`
                    : new Date(match.scheduledTime).toLocaleDateString([], { month: 'short', day: 'numeric' });

                  return (
                    <div
                      key={match.id}
                      className={`p-4 rounded-2xl border backdrop-blur-sm transition-all space-y-3 ${
                        isCurrentlyLive
                          ? 'bg-red-500/5 border-red-500/30 shadow-md shadow-red-500/10'
                          : isCompleted
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : !allowed
                          ? 'bg-background/30 border-border/40 opacity-60'
                          : 'bg-background/50 border-border hover:border-amber-500/30'
                      }`}
                    >
                      {/* Main Match Row */}
                      <div className="grid grid-cols-[4.25rem_minmax(0,1fr)_11rem] sm:grid-cols-[4.25rem_minmax(0,1fr)_11.5rem] items-center gap-3">
                        {/* Day tag + status — fixed width so all days line up */}
                        <div className="w-[4.25rem] shrink-0 flex flex-col items-center justify-center">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Day</span>
                          <span className={`text-2xl font-black tabular-nums leading-none h-7 flex items-center ${
                            isCurrentlyLive ? 'text-red-400' : isCompleted ? 'text-emerald-400' : isUpcoming ? 'text-muted-foreground/50' : 'text-amber-400'
                          }`}>{dayNum}</span>
                          <div className="h-3.5 mt-1 flex items-center justify-center">
                            {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                            {isUpcoming && <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />}
                            {isCurrentlyLive && <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />}
                          </div>
                        </div>

                        {/* Teams + VS */}
                        <div className="grid grid-cols-[minmax(0,1fr)_3.25rem_minmax(0,1fr)] items-center gap-2 min-w-0">
                          <div className="flex flex-col items-center gap-1.5 min-w-0">
                            {myTeamLogo ? (
                              <img src={myTeamLogo} alt={myTeamName} className="w-10 h-10 rounded-lg object-contain border border-border shadow-sm bg-background" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-black text-amber-400 text-sm">
                                {myTeamName?.[0]}
                              </div>
                            )}
                            <span className="text-[10px] font-black text-amber-400 text-center leading-tight truncate w-full">{myTeamName}</span>
                            <Badge variant="carrom" className="text-[8px] px-1.5 py-0">YOU</Badge>
                          </div>

                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-lg font-black text-muted-foreground/40">VS</span>
                            <span className="text-[9px] text-muted-foreground/50 font-mono whitespace-nowrap">{shortDate}</span>
                            <span className="text-[9px] text-muted-foreground/40">Tbl #{match.tableNumber || 1}</span>
                          </div>

                          <div className="flex flex-col items-center gap-1.5 min-w-0">
                            {oppTeamLogo ? (
                              <img src={oppTeamLogo} alt={oppTeamName} className="w-10 h-10 rounded-lg object-contain border border-border shadow-sm bg-background" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-500/20 border border-slate-500/30 flex items-center justify-center font-black text-slate-400 text-sm">
                                {oppTeamName?.[0] || '?'}
                              </div>
                            )}
                            <span className="text-[10px] font-bold text-foreground text-center leading-tight truncate w-full">{oppTeamName}</span>
                            <Badge variant="outline" className="text-[8px] px-1.5 py-0 text-muted-foreground">OPP</Badge>
                          </div>
                        </div>

                        {/* Status + Go Live button */}
                        <div className="flex flex-col items-end gap-2 w-[11rem] sm:w-[11.5rem] shrink-0">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant={isCompleted ? 'success' : isCurrentlyLive ? 'warning' : 'outline'}
                              className="text-[9px]"
                            >
                              {isCurrentlyLive ? 'LIVE' : isCompleted ? 'COMPLETED' : 'SCHEDULED'}
                            </Badge>
                            {isReplay && (
                              <Badge className="text-[9px] bg-violet-500/20 text-violet-400 border-violet-500/20 border">
                                📹 Streamed
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 rounded-md p-0 flex items-center justify-center shrink-0"
                              title="Copy shareable live link"
                              onClick={() => handleCopyLink(match.id)}
                            >
                              {copiedMatchId === match.id ? (
                                <span className="text-[8px] font-black text-amber-400 animate-pulse">Copied!</span>
                              ) : (
                                <Share2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>

                          {isCompleted || isPastMatch(match) ? (
                            <Button
                              size="sm"
                              disabled
                              className="h-9 px-4 text-[11px] font-black gap-2 bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed w-full"
                            >
                              🔒 Closed
                            </Button>
                          ) : isUpcoming ? (
                            <Button
                              size="sm"
                              disabled
                              className="h-9 px-4 text-[11px] font-black gap-2 opacity-40 cursor-not-allowed w-full"
                            >
                              <Lock className="h-3.5 w-3.5" />
                              Opens Day {dayNum}
                            </Button>
                          ) : !allowed ? (
                            <Button
                              size="sm"
                              disabled
                              className="h-9 px-4 text-[11px] font-black gap-2 opacity-40 cursor-not-allowed w-full"
                              title={`Complete Day ${blockedByDay} first`}
                            >
                              <Lock className="h-3.5 w-3.5" />
                              Day {blockedByDay} First
                            </Button>
                          ) : isReplay ? (
                            <Button
                              size="sm"
                              className="h-9 px-4 text-[11px] font-black gap-2 bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/20 w-full"
                              onClick={() => handleGoLiveClick(match, idx)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              GO LIVE AGAIN
                            </Button>
                          ) : match.status === 'LIVE' && isReplay === false && false ? (
                            null
                          ) : (
                            <Button
                              variant={isCurrentlyLive ? undefined : 'carrom'}
                              size="sm"
                              className={
                                isCurrentlyLive
                                  ? 'h-9 px-4 text-[11px] font-black gap-2 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/30 w-full'
                                  : 'h-9 px-4 text-[11px] font-black gap-2 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] transition-all w-full'
                              }
                              onClick={() => handleGoLiveClick(match, idx)}
                            >
                              {isCurrentlyLive ? (
                                <>
                                  <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                                  GO LIVE
                                </>
                              ) : (
                                <>
                                  <Radio className="h-3.5 w-3.5 animate-pulse" />
                                  🔴 GO LIVE
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Streams list (Watch Replay) */}
                      {matchStreams.length > 0 && (
                        <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[10px]">
                          <span className="text-muted-foreground font-semibold uppercase tracking-wider mr-1">🎥 Match Replays:</span>
                          {matchStreams.map((stream: any, sIdx: number) => (
                            <Link
                              key={stream.id}
                              href={`/matches/${stream.matchId || match.id}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-border text-amber-400 font-bold hover:text-amber-300 transition-colors"
                            >
                              <PlayCircle className="h-3 w-3" /> Watch Match #{matchStreams.length - sIdx}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-4 flex flex-wrap h-auto gap-2 p-1">
          <TabsTrigger value="profile"><UserCheck className="h-4 w-4 mr-2" /> Profile</TabsTrigger>
          <TabsTrigger value="team"><Users className="h-4 w-4 mr-2" /> My Team</TabsTrigger>
          <TabsTrigger value="submit-score" className="text-amber-500 data-[state=active]:text-amber-600"><Send className="h-4 w-4 mr-2" /> Submit Score</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab currentPlayer={currentPlayer} currentTeam={currentTeam} />
        </TabsContent>


        <TabsContent value="team">
            <Card className="border-border">
                <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center justify-between">
                        <span className="flex items-center gap-2"><Users className="h-5 w-5 text-amber-500" /> My Team</span>
                    </CardTitle>
                    <CardDescription>Your team roster and current stats.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 border border-border rounded-xl bg-muted/10">
                        {currentTeam.logo ? (
                            <img src={currentTeam.logo} alt={currentTeam.name} className="w-20 h-20 rounded-full border border-border object-cover" />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center font-bold text-xl">{currentTeam.tag}</div>
                        )}
                        <div className="text-center sm:text-left">
                            <h2 className="text-xl font-black">{currentTeam.name}</h2>
                            <p className="text-sm text-muted-foreground max-w-xl">{currentTeam.description}</p>
                            {currentTeam.stats && (
                                <div className="flex flex-wrap items-center gap-3 mt-3 justify-center sm:justify-start">
                                    <Badge variant="secondary">Win Rate: {currentTeam.stats.winRate}%</Badge>
                                    <Badge variant="outline">{currentTeam.stats.wins}W - {currentTeam.stats.losses}L</Badge>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="text-base font-bold mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground"/> Teammates</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {teammates.map((mate: any) => {
                              // First two letters of name for avatar
                              const initials = (mate.name || '??')
                                .split(' ')
                                .map((w: string) => w[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase();
                              // Average: boardsWon / total matches (wins+losses), fallback to mate.average
                              const totalMatches = (mate.wins || 0) + (mate.losses || 0);
                              const avg = mate.average
                                ? Number(mate.average).toFixed(1)
                                : totalMatches > 0
                                  ? ((mate.boardsWon || 0) / totalMatches).toFixed(1)
                                  : '—';
                              return (
                              <div key={mate.id} className="p-4 rounded-xl border border-border flex items-center gap-3 hover:bg-muted/20 transition-colors">
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 border border-amber-500/30 flex items-center justify-center font-black text-amber-400 text-sm flex-shrink-0 shadow-inner">
                                  {initials}
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-sm">{mate.name}</span>
                                        {mate.id === currentTeam.captainId && (
                                        <Badge variant="carrom" className="text-[9px] px-1.5">CAPTAIN</Badge>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted-foreground font-mono">@{mate.username}</span>
                                    <div className="text-xs font-semibold text-emerald-400 mt-0.5">Avg {avg}</div>
                                </div>
                              </div>
                              );
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>


        <TabsContent value="submit-score">
            <Card className="border-amber-500/30">
                <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Send className="h-5 w-5 text-amber-500" /> Submit Match Score
                    </CardTitle>
                    <CardDescription>
                        Select a match to submit scores, fouls, and live stream links.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4 max-w-2xl">
                        <label className="text-sm font-bold">Select Match</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {personalSchedule.filter(m => m.status !== 'COMPLETED').map(match => (
                                <Button 
                                    key={match.id}
                                    variant="outline"
                                    className="justify-start h-auto py-3 px-4 text-left border-border bg-card hover:border-amber-500/50"
                                    onClick={() => handleOpenScoreModal(match)}
                                >
                                    <div className="flex flex-col gap-1 w-full">
                                        <div className="flex justify-between items-center w-full">
                                            <span className="font-mono text-xs text-amber-500">Match #{match.matchNumber}</span>
                                            <Badge variant="secondary" className="text-[9px]">{match.status}</Badge>
                                        </div>
                                        <div className="font-bold text-sm mt-1 text-wrap">
                                            {match.team1?.name} vs {match.team2?.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Table {match.tableNumber} • {new Date(match.scheduledTime).toLocaleDateString()}
                                        </div>
                                    </div>
                                </Button>
                            ))}
                            {personalSchedule.filter(m => m.status !== 'COMPLETED').length === 0 && (
                                <div className="text-sm text-muted-foreground p-4 bg-muted/20 rounded-lg text-center col-span-full">
                                    No pending matches available for score submission.
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

      </Tabs>

      {/* GO LIVE REPLAY COMMENT MODAL */}
      {goLiveModal.open && (
        <Dialog open={goLiveModal.open} onOpenChange={(open) => setGoLiveModal(prev => ({ ...prev, open }))}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-violet-400" /> Go Live Again (Replay)
            </DialogTitle>
            <DialogDescription>
              You are starting a new stream/recording for Day {goLiveModal.match?.matchNumber} vs {goLiveModal.match?.team1Id === currentTeam?.id ? goLiveModal.match?.team2?.name : goLiveModal.match?.team1?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 flex gap-2.5 items-start">
              <AlertCircle className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
              <div className="text-xs text-violet-300 leading-normal">
                <strong>Replay stream rules:</strong> Since this day has already been streamed, please provide a quick comment explaining why you are going live again (e.g. "technical lag/stream disconnected", "doubles match replay", "dispute board", etc.) so referees understand the split recordings.
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Replay Reason
              </label>
              <textarea
                value={replayComment}
                onChange={(e) => setReplayComment(e.target.value)}
                placeholder="Explain the reason for starting a new stream..."
                rows={3}
                className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
              {replayCommentError && (
                <p className="text-[10px] text-red-500 font-medium">{replayCommentError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-9 px-4 rounded-lg"
                onClick={() => setGoLiveModal(prev => ({ ...prev, open: false }))}
              >
                Cancel
              </Button>
              <Button
                variant="carrom"
                size="sm"
                className="text-xs h-9 px-5 rounded-lg font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-md"
                onClick={handleReplaySubmit}
                disabled={goLiveLoading !== null}
              >
                {goLiveLoading ? 'Starting...' : 'Go Live Again'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* PLAYER SCORE & LIVE STREAM SUBMISSION MODAL */}
      {selectedMatch && (
        <Dialog open={scoreModalOpen} onOpenChange={setScoreModalOpen}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-amber-500" /> Submit Match Details
            </DialogTitle>
            <DialogDescription>
              Match #{selectedMatch.matchNumber} ({selectedMatch.team1?.name} vs {selectedMatch.team2?.name})
            </DialogDescription>
          </DialogHeader>

          {submissionSuccess ? (
            <div className="p-6 text-center space-y-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 my-4">
              <CheckCircle2 className="h-10 w-10 text-amber-500 mx-auto" />
              <h3 className="font-extrabold text-base">{submissionSuccess}</h3>
            </div>
          ) : (
            <form onSubmit={handlePlayerScoreSubmit} className="space-y-4 py-2 overflow-y-auto max-h-[60vh] px-1">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold block mb-1">{selectedMatch.team1?.name} Score <span className="text-red-500">*</span></label>
                  <Input type="number" value={team1Score} onChange={(e) => setTeam1Score(e.target.value)} required placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">{selectedMatch.team2?.name} Score <span className="text-red-500">*</span></label>
                  <Input type="number" value={team2Score} onChange={(e) => setTeam2Score(e.target.value)} required placeholder="0" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold block mb-1">Queen Covers <span className="text-red-500">*</span></label>
                  <Input type="number" value={queenStrikes} onChange={(e) => setQueenStrikes(e.target.value)} required placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Fouls / Misses</label>
                  <Input type="number" value={missesCount} onChange={(e) => setMissesCount(e.target.value)} placeholder="0" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold mb-1 flex items-center gap-1">
                  <Video className="h-3.5 w-3.5 text-rose-500" /> Live Stream Link <span className="text-red-500">*</span>
                </label>
                <Input
                  type="url"
                  value={liveStreamUrl}
                  onChange={(e) => setLiveStreamUrl(e.target.value)}
                  placeholder="https://youtube.com/live/..."
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold mb-1 flex items-center gap-1">
                  <PlayCircle className="h-3.5 w-3.5 text-blue-500" /> Match Recording Link (Optional)
                </label>
                <Input
                  type="url"
                  value={recordingUrl}
                  onChange={(e) => setRecordingUrl(e.target.value)}
                  placeholder="https://facebook.com/watch/..."
                />
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Match Proof Notes</label>
                <textarea
                  rows={2}
                  value={proofNotes}
                  onChange={(e) => setProofNotes(e.target.value)}
                  placeholder="Additional context about the match, disputes, etc."
                  className="w-full rounded-lg border border-input bg-background p-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
                <Button type="button" variant="outline" onClick={() => setScoreModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="carrom" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </Button>
              </div>
            </form>
          )}
        </Dialog>
      )}

    </div>
  );
}
