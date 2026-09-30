'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { getMyDayScores, submitPlayerDayScore } from '@/lib/actions/playerScoreActions';
import { BoardScoreEditor } from '@/components/scores/BoardScoreEditor';
import { ScoreEditRules } from '@/components/scores/ScoreEditRules';
import { SCORE_EDIT_PLAYER_HELP } from '@/lib/score-edit-policy';
import { boardsToDraft, draftToPayload, emptyBoardDraft } from '@/lib/board-scores';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  UserCheck, Trophy, Target, Crown, Calendar, Video, CheckCircle2, Layers, Users, Lock, PlayCircle, MapPin, Share2, Sparkles
} from 'lucide-react';
import { monumentStatus } from '@/lib/bicentennial-monuments';
import {
  currentPlayDayNumber,
  isDayUnlockedByYoutubeSequence,
  playedDaysForUnlock,
  summarizePlayerDayStreams,
  tournamentPlayWindow,
  unlockPrerequisiteDay,
} from '@/lib/match-play-window';
import { getCurrentEditionCombisData } from '@/lib/actions/combisActions';
import { coherentMatchSides } from '@/lib/team-identity';
import {
  buildOrganizerScheduleDays,
  resolveOrganizerPairings,
  type OrganizerScheduleDay,
} from '@/lib/organizer-schedule';
import { ProfileTab } from '@/components/player/ProfileTab';
import { PlayerEnrollmentCard, type PlayerEnrollmentInfo } from '@/components/player/PlayerEnrollmentCard';
import { DEFAULT_WEBSITE_CMS } from '@/lib/website-cms';


export default function PlayerClient({
  initialPlayer,
  initialTeam,
  initialTeammates,
  initialMatches,
  initialPatterns,
  initialStreams,
  initialSpocTeam,
  initialSpocMembers = [],
  hasSpocCaptainDesk = false,
  initialEditionGrade = null,
  registrationEnrollment = null,
  currentEditionInfo = null,
  shortName = DEFAULT_WEBSITE_CMS.site.shortName,
  editionLabel = DEFAULT_WEBSITE_CMS.site.editionLabel,
}: {
  initialPlayer: any;
  initialTeam: any;
  initialTeammates: any[];
  initialMatches: any[];
  initialPatterns: any[];
  initialStreams?: any[];
  initialSpocTeam?: any;
  initialSpocMembers?: any[];
  hasSpocCaptainDesk?: boolean;
  initialEditionGrade?: string | null;
  registrationEnrollment?: PlayerEnrollmentInfo | null;
  currentEditionInfo?: { id: string; title: string; number: number; status: string } | null;
  shortName?: string;
  editionLabel?: string;
}) {
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

  const hasBothPlayerTeams = Boolean(initialTeam && initialSpocTeam);
  const [playerView, setPlayerView] = React.useState<'main' | 'spoc'>(
    initialTeam ? 'main' : initialSpocTeam ? 'spoc' : 'main',
  );
  const currentTeam =
    playerView === 'spoc' && initialSpocTeam ? initialSpocTeam : initialTeam || null;
  const teammates =
    playerView === 'spoc' && initialSpocMembers.length
      ? initialSpocMembers
      : initialTeammates.length > 0
        ? initialTeammates
        : currentTeam?.members?.map((m: any) => m.user) || [];
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [activeTournamentSlot, setActiveTournamentSlot] = React.useState<'A' | 'B'>('A');
  const [dayBoards, setDayBoards] = React.useState([emptyBoardDraft()]);
  const [dayScoreMsg, setDayScoreMsg] = React.useState<string | null>(null);
  const [dayScoreBusy, setDayScoreBusy] = React.useState(false);
  const [myDayInfo, setMyDayInfo] = React.useState<any>(null);
  const [selectedScoreDay, setSelectedScoreDay] = React.useState(1);

  React.useEffect(() => {
    getMyDayScores(undefined, activeTournamentSlot).then((res) => setMyDayInfo(res)).catch(() => {});
  }, [activeTournamentSlot]);

  React.useEffect(() => {
    if (myDayInfo?.eligibleDay) setSelectedScoreDay(myDayInfo.eligibleDay);
  }, [myDayInfo?.eligibleDay]);

  React.useEffect(() => {
    const existing = (myDayInfo?.scores || []).find((s: any) => s.dayNumber === selectedScoreDay);
    setDayBoards(boardsToDraft(existing?.boards, existing?.score, existing?.slams));
  }, [myDayInfo, selectedScoreDay]);
  const [scheduleDays, setScheduleDays] = React.useState<OrganizerScheduleDay[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await getCurrentEditionCombisData();
        if (!res.success || cancelled) return;
        const pairings = resolveOrganizerPairings((res as any).stageConfig?.stages || [], res.teams || []);
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
            teams: res.teams || [],
          })
        );
        setNowMs(Date.now());
      } catch (e) {
        console.error('Failed to load organizer schedule for player matches:', e);
      }
    };
    load();
    const id = setInterval(load, 60000);
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
      'PLYWOOD PIONEERS':  '/api/storage/teams/plywood-pioneers.jpeg',
      'SUPERNOVA QUEEN':   '/api/storage/teams/supernova-queen.jpeg',
      'POCKET DYNAMOS':    '/api/storage/teams/pocket-dynamos.jpeg',
      'LUMEN PILLAR':      '/api/storage/teams/lumen-pillar.jpeg',
      'VANILLA FALCONS':   '/api/storage/teams/vanilla-falcons.jpeg',
      'VINTAGE STRIKERS':  '/api/storage/teams/vintage-strikers.jpeg',
      'EBONY OVERLORDS':   '/api/storage/teams/ebony-overlords.jpeg',
      'BORIC SPEEDSTERS':  '/api/storage/teams/boric-speedsters.jpeg',
    };

    const usedDbIds = new Set<string>();

    return scheduleDays.map((day) => {
      const isSpocDay = Boolean(day.isSpocDay) || day.stageKind === 'SPOC_EXHIBITION';
      const hasMainMatches = day.matches.some((m) => !m.isSpocExhibition);
      const isSpocOnly = isSpocDay && !hasMainMatches;
      if (playerView === 'spoc') {
        if (!isSpocDay && !day.matches.some((m) => m.isSpocExhibition)) return null;
      } else if (isSpocOnly) {
        return null;
      }

      const fix = day.matches.find((f) => {
        const sides = coherentMatchSides(f);
        const tag = (currentTeam.tag || '').toUpperCase().trim();
        const nameHit =
          sides.team1.name === teamNameUpper ||
          sides.team2.name === teamNameUpper ||
          (!!tag && (sides.team1.tag === tag || sides.team2.tag === tag));
        if (!nameHit) return false;
        const spoc = Boolean(f.isSpocExhibition) || Boolean(day.isSpocDay) || day.stageKind === 'SPOC_EXHIBITION';
        return playerView === 'spoc' ? spoc : !spoc;
      });

      const windowStatus = monumentStatus({ startIso: day.startIso, endIso: day.endIso }, nowMs);
      const computedStatus = windowStatus === 'completed' ? 'COMPLETED' : windowStatus === 'live' ? 'LIVE' : 'SCHEDULED';

      if (!fix) {
        return {
          id: `schedule_${day.dayNumber}_TBD`,
          matchNumber: day.dayNumber,
          scheduledTime: day.startIso,
          endIso: day.endIso,
          calendarDate: day.calendarDate,
          timeRange: day.timeRange,
          status: computedStatus,
          tableNumber: 1,
          isTbd: true,
          team1Id: currentTeam.id,
          team1: {
            id: currentTeam.id,
            name: currentTeam.name,
            logo: currentTeam.logo || '',
          },
          team2Id: 'tbd',
          team2: {
            id: 'tbd',
            name: 'TBD / Open Play',
            logo: '',
          },
        };
      }

      const sides = coherentMatchSides(fix);
      const tag = (currentTeam.tag || '').toUpperCase().trim();
      const isT1 =
        sides.team1.name === teamNameUpper || (!!tag && sides.team1.tag === tag);
      const oppName = isT1 ? sides.team2.name : sides.team1.name;
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

      const t1Name = sides.team1.name;
      const t2Name = sides.team2.name;

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
        isTbd: false,
        team1Id: isT1 ? currentTeam.id : dbMatch?.team1Id || `t_${t1Name.replace(/\s+/g, '_')}`,
        team1: {
          id: isT1 ? currentTeam.id : dbMatch?.team1?.id || `t_${t1Name.replace(/\s+/g, '_')}`,
          name: t1Name,
          logo: sides.team1.logo || teamLogos[t1Name] || (isT1 ? currentTeam.logo : ''),
        },
        team2Id: !isT1 ? currentTeam.id : dbMatch?.team2Id || `t_${t2Name.replace(/\s+/g, '_')}`,
        team2: {
          id: !isT1 ? currentTeam.id : dbMatch?.team2?.id || `t_${t2Name.replace(/\s+/g, '_')}`,
          name: t2Name,
          logo: sides.team2.logo || teamLogos[t2Name] || (!isT1 ? currentTeam.logo : ''),
        },
      };
    }).filter(Boolean);

  }, [initialMatches, currentTeam, scheduleDays, nowMs, playerView]);

  const assignedPatterns = initialPatterns.length > 0 ? initialPatterns : [];

  // ── GO LIVE — sequential unlock by YouTube saves; re-live keeps latest link ─
  const streamSummary = React.useMemo(
    () => summarizePlayerDayStreams(initialStreams || []),
    [initialStreams],
  );
  const streamedMatchIds = React.useMemo(() => {
    const streams = initialStreams || [];
    return new Set<string>(streams.map((s: any) => s.matchId));
  }, [initialStreams]);
  const daysPlayed = React.useMemo(() => {
    const scoreDays = (myDayInfo?.scores || []).map((s: { dayNumber?: number }) => Number(s.dayNumber) || 0);
    return playedDaysForUnlock(streamSummary, scoreDays);
  }, [streamSummary, myDayInfo]);

  /** Sorted schedule (ascending by matchNumber / scheduledTime) */
  const sortedSchedule = React.useMemo(
    () => [...personalSchedule].sort((a: any, b: any) => (a.matchNumber || 0) - (b.matchNumber || 0)),
    [personalSchedule]
  );

  const scheduledDayNumbers = React.useMemo(
    () => sortedSchedule.map((m: any) => m.matchNumber || 0).filter((n: number) => n > 0),
    [sortedSchedule],
  );

  /**
   * Current calendar day is always open. Past days are ignored — skipping Day 8
   * does not block Day 9. Future days unlock after the previous remaining day
   * was played (go live or save a score). Opponent TBD does not block go-live.
   */
  const currentPlayDay = React.useMemo(() => {
    const fromSchedule = currentPlayDayNumber(
      sortedSchedule.map((m: any) => ({
        dayNumber: m.matchNumber || 0,
        status: monumentStatus({ startIso: m.scheduledTime, endIso: m.endIso }, nowMs),
      })),
    );
    if (sortedSchedule.length) return fromSchedule || 1;
    return Math.max(fromSchedule || 0, tournamentPlayWindow(nowMs).currentDay || 0, 1);
  }, [sortedSchedule, nowMs]);

  const canGoLive = React.useCallback(
    (match: any): { allowed: boolean; prerequisiteDay: number | null } => {
      const dayNum = match?.matchNumber || 0;
      const windowStatus = monumentStatus(
        { startIso: match?.scheduledTime, endIso: match?.endIso },
        nowMs,
      );
      if (windowStatus === 'live' || dayNum === currentPlayDay) {
        return { allowed: true, prerequisiteDay: null };
      }
      if (dayNum < currentPlayDay) {
        return { allowed: false, prerequisiteDay: null };
      }
      return {
        allowed: isDayUnlockedByYoutubeSequence(dayNum, scheduledDayNumbers, daysPlayed, currentPlayDay),
        prerequisiteDay: unlockPrerequisiteDay(dayNum, scheduledDayNumbers, currentPlayDay),
      };
    },
    [scheduledDayNumbers, daysPlayed, currentPlayDay, nowMs]
  );

  if (!currentPlayer) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading your player profile…</p>
      </div>
    );
  }

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
                {currentTeam?.name ? (
                  <Badge variant={playerView === 'spoc' ? 'outline' : 'carrom'} className={`font-bold ${playerView === 'spoc' ? 'text-violet-300 border-violet-500/40 bg-violet-500/10' : ''}`}>
                    {currentTeam.name}
                  </Badge>
                ) : null}
              </div>
              <h1 className="text-3xl font-black tracking-tight">{currentPlayer.name}</h1>
              <p className="text-muted-foreground text-xs font-mono">
                @{currentPlayer.username} • PIN: ••••
              </p>
              {hasBothPlayerTeams ? (
                <div className="mt-3 inline-flex rounded-xl border border-border bg-muted/30 p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setPlayerView('main')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
                      playerView === 'main'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Main team
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayerView('spoc')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
                      playerView === 'spoc'
                        ? 'bg-violet-500 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Spoc team
                  </button>
                </div>
              ) : null}
              {hasSpocCaptainDesk ? (
                <Link
                  href="/dashboard/captain?desk=spoc"
                  className="mt-3 inline-flex items-center h-8 rounded-md px-3 text-xs font-black bg-violet-600 hover:bg-violet-500 text-white"
                >
                  <Crown className="h-3.5 w-3.5 mr-1.5" />
                  Login as Spoc captain
                  <Sparkles className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>



      {/* ── CURRENT EDITION VS NEXT EDITION TOGGLE ─────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-muted/40 rounded-2xl border border-border/80 w-fit">
        <button
          type="button"
          onClick={() => setActiveTournamentSlot('A')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            activeTournamentSlot === 'A'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Trophy className="h-3.5 w-3.5" />
          <span>CURRENT EDITION {currentEditionInfo?.number ? `#${currentEditionInfo.number}` : ''}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTournamentSlot('B')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            activeTournamentSlot === 'B'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>NEXT EDITION (ADVANCE PLAY)</span>
          {registrationEnrollment ? (
            <Badge variant="outline" className="text-[9px] bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-1.5 py-0">
              ENROLLED
            </Badge>
          ) : null}
        </button>
      </div>

      {/* Slot B (Next Edition): Registration card & Advance play info */}
      {activeTournamentSlot === 'B' && (
        <div className="space-y-4">
          {registrationEnrollment ? (
            <>
              <PlayerEnrollmentCard enrollment={registrationEnrollment} />
              <div className="rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-5 sm:p-6 space-y-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-bold text-cyan-400 border-cyan-500/30 bg-cyan-500/15">
                    ✨ Advance Play Active
                  </Badge>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    Confirmed Enrolled
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-foreground">
                  {registrationEnrollment.edition.title} (#{registrationEnrollment.edition.number}) Advance Play
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You are registered for the upcoming tournament! You can start playing your matches in advance and enter your daily board scores in the <strong>Day Score</strong> tab below.
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-background to-card p-6 sm:p-7 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-bold text-cyan-400 border-cyan-500/30 bg-cyan-500/15">
                  ✨ Next Edition Advance Play
                </Badge>
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Enrollment Required
                </span>
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground">
                  Enroll to Access Next Edition Match Schedule & Advance Play
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl mt-1">
                  Advance play, daily match fixtures, live stream broadcasting, and day score submissions are available exclusively to officially enrolled players.
                </p>
              </div>
              <div>
                <a
                  href="/register"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Sparkles className="h-4 w-4" /> Enroll in Next Edition
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Slot A (Current Edition): Show only when viewing Slot A and not in a team */}
      {activeTournamentSlot === 'A' && !currentTeam?.id && (
        <div className="rounded-3xl border border-border bg-card/60 p-6 sm:p-7 space-y-2 shadow-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-bold text-amber-400 border-amber-500/30 bg-amber-500/10">
              Current Live Tournament {currentEditionInfo?.number ? `#${currentEditionInfo.number}` : ''}
            </Badge>
            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              {registrationEnrollment ? 'Enrolled for Next Edition' : 'Not Enrolled in Live Cup'}
            </span>
          </div>
          <h3 className="text-lg font-black text-foreground">
            {registrationEnrollment
              ? `Live Cup (${currentEditionInfo?.title || 'Edition #201'}) In Progress`
              : `Not Enrolled in Current Edition ${currentEditionInfo?.number ? '#' + currentEditionInfo.number : ''}`}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {registrationEnrollment
              ? `Matches for ${currentEditionInfo?.title || 'Current Edition'} are in progress. You are registered for the upcoming ${registrationEnrollment.edition.title} (#${registrationEnrollment.edition.number})! Click 'NEXT EDITION (ADVANCE PLAY)' above to access your advance play dashboard.`
              : `You are not assigned to an active team in Current Edition ${currentEditionInfo?.number || 201}. If you want to play the upcoming edition in advance, switch to 'NEXT EDITION (ADVANCE PLAY)' above!`}
          </p>
        </div>
      )}

      {/* ── ALL MATCHES & GO LIVE LIST ────────────────────────────────────────── */}
      {activeTournamentSlot === 'A' && currentTeam?.id && (
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
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-400/70">
                    {currentEditionInfo?.number ? `CBOT ${currentEditionInfo.number} EDITION` : `${shortName} ${editionLabel}`}
                  </div>
                  <div className="text-base font-black text-foreground leading-tight">
                    {currentTeam.name} — Match schedule
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 font-bold border border-amber-500/20">
                  <Video className="h-3 w-3" /> GO LIVE — CBOT mobile app only
                </span>
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/40 text-muted-foreground font-bold border border-border">
                  <Lock className="h-3 w-3" /> Next day unlocks after an app Go Live on the previous day
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
                  const { allowed, prerequisiteDay } = canGoLive(match);
                  const isReplay = streamedMatchIds.has(match.id) || Boolean(streamSummary.latestByDay[match.matchNumber || 0]);
                  const windowStatus = monumentStatus(
                    { startIso: match.scheduledTime, endIso: match.endIso },
                    nowMs
                  );
                  const isCurrentlyLive = windowStatus === 'live';
                  const isCompleted = windowStatus === 'completed';
                  const isMyTeam1 = match.team1Id === currentTeam.id ||
                    match.team1?.name?.toUpperCase() === currentTeam.name?.toUpperCase();
                  const myTeamName = isMyTeam1 ? (match.team1?.name || currentTeam.name) : (match.team2?.name || currentTeam.name);
                  const oppTeamName = isMyTeam1 ? (match.team2?.name || 'TBD') : (match.team1?.name || 'TBD');
                  const oppIsTbd = Boolean(match.isTbd) || /^tbd$/i.test(oppTeamName);
                  const myTeamLogo = isMyTeam1 ? (match.team1?.logo || currentTeam.logo) : (match.team2?.logo || currentTeam.logo);
                  const oppTeamLogo = isMyTeam1 ? match.team2?.logo : match.team1?.logo;
                  const dayNum = match.matchNumber || idx + 1;
                  const matchStreams = (initialStreams || []).filter((s: any) => s.matchId === match.id);
                  const latestDayLink = streamSummary.latestByDay[dayNum] || null;
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
                            isCurrentlyLive ? 'text-red-400' : isCompleted ? 'text-emerald-400' : allowed ? 'text-amber-400' : 'text-muted-foreground/50'
                          }`}>{dayNum}</span>
                          <div className="h-3.5 mt-1 flex items-center justify-center">
                            {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                            {!allowed && <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />}
                            {allowed && isCurrentlyLive && <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />}
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
                            <Badge variant="outline" className="text-[8px] px-1.5 py-0 text-muted-foreground">
                              {oppIsTbd ? 'TBD' : 'OPP'}
                            </Badge>
                          </div>
                        </div>

                        {/* Status + app-only go live note */}
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

                          {!allowed ? (
                            <div className="h-9 px-3 w-full rounded-lg border border-border bg-muted/30 flex items-center justify-center gap-1.5 text-[10px] font-black text-muted-foreground opacity-70">
                              <Lock className="h-3.5 w-3.5" />
                              {prerequisiteDay ? `Need Day ${prerequisiteDay} in app` : 'Locked'}
                            </div>
                          ) : (
                            <div className="h-auto min-h-9 px-3 py-1.5 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 text-center">
                              <div className="text-[10px] font-black text-amber-400 leading-tight">USE CBOT APP</div>
                              <div className="text-[8px] font-bold text-muted-foreground leading-tight mt-0.5">
                                {isReplay ? 'Go live again on mobile' : 'Go live on mobile only'}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Latest YouTube link for this day */}
                      {latestDayLink?.youtubeUrl ? (
                        <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[10px]">
                          <span className="text-muted-foreground font-semibold uppercase tracking-wider mr-1">
                            📺 Latest YouTube:
                          </span>
                          <a
                            href={latestDayLink.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 text-red-300 font-bold hover:text-red-200 transition-colors"
                          >
                            <PlayCircle className="h-3 w-3" /> Open latest stream
                          </a>
                          {(streamSummary.streamCountByDay[dayNum] || 0) > 1 ? (
                            <span className="text-muted-foreground font-medium">
                              {streamSummary.streamCountByDay[dayNum]} saves · showing newest
                            </span>
                          ) : null}
                        </div>
                      ) : null}

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
          <TabsTrigger value="day-score" className="text-amber-500 data-[state=active]:text-amber-600"><Target className="h-4 w-4 mr-2" /> Day Score</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab
            currentPlayer={currentPlayer}
            currentTeam={currentTeam}
            editionGrade={initialEditionGrade}
            shortName={shortName}
            editionLabel={editionLabel}
          />
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
                    {currentTeam ? (
                      <>
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 border border-border rounded-xl bg-muted/10">
                            {currentTeam.logo ? (
                                <img src={currentTeam.logo} alt={currentTeam.name} className="w-20 h-20 rounded-full border border-border object-cover" />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center font-bold text-xl">{currentTeam.tag || 'TEAM'}</div>
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
                      </>
                    ) : (
                      <div className="text-center py-10 space-y-2">
                        <Users className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                        <p className="text-sm font-bold text-foreground">No Team Assigned</p>
                        <p className="text-xs text-muted-foreground">You are not currently assigned to a team in this edition.</p>
                      </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="day-score">
          <Card className="border-amber-500/30">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/50">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Target className="h-5 w-5 text-amber-500" /> Submit Day Score
                </CardTitle>
                <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border border-border/60">
                  <button
                    type="button"
                    onClick={() => setActiveTournamentSlot('A')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                      activeTournamentSlot === 'A'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    🏆 Current Cup
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTournamentSlot('B')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                      activeTournamentSlot === 'B'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    🚀 Next Cup (Advance Play)
                  </button>
                </div>
              </div>
              <CardDescription className="pt-2">
                {activeTournamentSlot === 'B'
                  ? 'Play your advance matches day-by-day in sequence for the next edition. Scores will automatically align with your team once teams and combis are published.'
                  : 'Choose a day. If you already submitted boards, they load here so you can update them until 9:00pm IST.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              {activeTournamentSlot === 'B' && (
                <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 text-xs font-medium text-violet-200 flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-violet-300">Advance Match Play Enabled:</span> You are entering scores for{' '}
                    <strong className="text-white">{myDayInfo?.editionTitle || 'Next Tournament'}</strong>. Days unlock in sequence (Day 1..{myDayInfo?.maxDay || 10}).
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold block mb-1.5">Select Day ({myDayInfo?.editionTitle || 'Tournament'})</label>
                <select
                  className="w-full h-11 rounded-xl border border-amber-500/30 bg-background px-3 text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  value={selectedScoreDay}
                  onChange={(e) => setSelectedScoreDay(parseInt(e.target.value, 10) || 1)}
                >
                  {Array.from({ length: Math.max(1, Number(myDayInfo?.maxDay) || 1) }, (_, i) => i + 1).map((d) => {
                    const saved = (myDayInfo?.scores || []).find((s: any) => s.dayNumber === d);
                    const meta = (myDayInfo?.days || []).find((x: any) => x.dayNumber === d);
                    return (
                      <option key={d} value={d}>
                        Day {d}
                        {saved ? ' · entered' : ' · empty'}
                        {meta?.windowOpen === false ? ' · locked' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              {(myDayInfo?.scores || []).find((s: any) => s.dayNumber === selectedScoreDay) ? (
                <p className="text-xs font-semibold text-emerald-400">Your saved boards for Day {selectedScoreDay} are filled in below.</p>
              ) : (
                <p className="text-xs text-muted-foreground">No score yet for Day {selectedScoreDay}. Add boards and save.</p>
              )}
              <BoardScoreEditor
                boards={dayBoards}
                onChange={setDayBoards}
                disabled={(myDayInfo?.days || []).find((d: any) => d.dayNumber === selectedScoreDay)?.windowOpen === false}
                target={myDayInfo?.target ?? initialPlayer?.target ?? 0}
              />
              {(myDayInfo?.days || []).find((d: any) => d.dayNumber === selectedScoreDay)?.windowOpen === false ? (
                <p className="text-xs text-amber-400 font-semibold">
                  {(myDayInfo?.days || []).find((d: any) => d.dayNumber === selectedScoreDay)?.windowReason || SCORE_EDIT_PLAYER_HELP}
                </p>
              ) : null}
              {dayScoreMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold ${dayScoreMsg === 'Saved.' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                  {dayScoreMsg}
                </div>
              )}
              <Button
                variant="carrom"
                className="w-full font-black py-5 text-base justify-center shadow-lg shadow-amber-500/20"
                disabled={
                  dayScoreBusy ||
                  (myDayInfo?.days || []).find((d: any) => d.dayNumber === selectedScoreDay)?.windowOpen === false
                }
                onClick={async () => {
                  setDayScoreBusy(true);
                  setDayScoreMsg(null);
                  const res = await submitPlayerDayScore(
                    selectedScoreDay,
                    0,
                    0,
                    draftToPayload(dayBoards),
                    undefined,
                    activeTournamentSlot,
                  );
                  setDayScoreMsg(res.success ? 'Saved.' : res.error || 'Failed');
                  if (res.success) setMyDayInfo(await getMyDayScores(undefined, activeTournamentSlot));
                  setDayScoreBusy(false);
                }}
              >
                {dayScoreBusy
                  ? 'Saving…'
                  : (myDayInfo?.days || []).find((d: any) => d.dayNumber === selectedScoreDay)?.windowOpen === false
                    ? 'Window closed'
                    : `Save Day ${selectedScoreDay}`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

    </div>
  );
}
