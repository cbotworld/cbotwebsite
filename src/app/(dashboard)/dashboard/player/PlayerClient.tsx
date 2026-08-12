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
  UserCheck, Trophy, Target, Crown, Calendar, Video, CheckCircle2, Layers, Users, Lock, Send, PlayCircle, MapPin, Radio
} from 'lucide-react';
import { Match, BoardPattern, User } from '@/types';
import { ProfileTab } from '@/components/player/ProfileTab';


export default function PlayerClient({ initialPlayer, initialTeam, initialTeammates, initialMatches, initialPatterns }: { initialPlayer: any, initialTeam: any, initialTeammates: any[], initialMatches: any[], initialPatterns: any[] }) {
  const { data: session } = useSession();

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
  
  // Build fallback 200th Edition Monument schedule for current player's team if DB matches are empty
  const personalSchedule = React.useMemo(() => {
    const dbMatches = (initialMatches || []).filter(
      (m: any) =>
        m.team1Id === currentTeam?.id ||
        m.team2Id === currentTeam?.id ||
        m.team1?.name?.toUpperCase() === currentTeam?.name?.toUpperCase() ||
        m.team2?.name?.toUpperCase() === currentTeam?.name?.toUpperCase()
    );
    if (dbMatches.length > 0) return dbMatches;

    if (!currentTeam?.name) return [];

    const teamNameUpper = currentTeam.name.toUpperCase().trim();
    const teamLogos: Record<string, string> = {
      'PLYWOOD PIONEERS': 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/plywood-pioneers.jpeg',
      'SUPERNOVA QUEEN': 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/supernova-queen.jpeg',
      'POCKET DYNAMOS': 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/pocket-dynamos.jpeg',
      'LUMEN PILLAR': 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/lumen-pillar.jpeg',
      'VANILLA FALCONS': 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/vanilla-falcons.jpeg',
      'VINTAGE STRIKERS': 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/vintage-strikers.jpeg',
      'EBONY OVERLORDS': 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/ebony-overlords.jpeg',
      'BORIC SPEEDSTERS': 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/boric-speedsters.jpeg',
    };

    const monuments = [
      { num: 1, startIso: '2026-08-09T21:00:00+05:30', matches: [{ t1: 'PLYWOOD PIONEERS', t2: 'SUPERNOVA QUEEN' }, { t1: 'POCKET DYNAMOS', t2: 'LUMEN PILLAR' }, { t1: 'VANILLA FALCONS', t2: 'VINTAGE STRIKERS' }, { t1: 'EBONY OVERLORDS', t2: 'BORIC SPEEDSTERS' }] },
      { num: 2, startIso: '2026-08-10T20:00:00+05:30', matches: [{ t1: 'PLYWOOD PIONEERS', t2: 'VINTAGE STRIKERS' }, { t1: 'LUMEN PILLAR', t2: 'BORIC SPEEDSTERS' }, { t1: 'SUPERNOVA QUEEN', t2: 'EBONY OVERLORDS' }, { t1: 'POCKET DYNAMOS', t2: 'VANILLA FALCONS' }] },
      { num: 3, startIso: '2026-08-11T20:00:00+05:30', matches: [{ t1: 'PLYWOOD PIONEERS', t2: 'EBONY OVERLORDS' }, { t1: 'BORIC SPEEDSTERS', t2: 'VANILLA FALCONS' }, { t1: 'VINTAGE STRIKERS', t2: 'POCKET DYNAMOS' }, { t1: 'LUMEN PILLAR', t2: 'SUPERNOVA QUEEN' }] },
      { num: 4, startIso: '2026-08-12T20:00:00+05:30', matches: [{ t1: 'PLYWOOD PIONEERS', t2: 'VANILLA FALCONS' }, { t1: 'EBONY OVERLORDS', t2: 'POCKET DYNAMOS' }, { t1: 'BORIC SPEEDSTERS', t2: 'SUPERNOVA QUEEN' }, { t1: 'VINTAGE STRIKERS', t2: 'LUMEN PILLAR' }] },
      { num: 5, startIso: '2026-08-13T20:00:00+05:30', matches: [{ t1: 'PLYWOOD PIONEERS', t2: 'LUMEN PILLAR' }, { t1: 'SUPERNOVA QUEEN', t2: 'VINTAGE STRIKERS' }, { t1: 'POCKET DYNAMOS', t2: 'BORIC SPEEDSTERS' }, { t1: 'EBONY OVERLORDS', t2: 'VANILLA FALCONS' }] },
      { num: 6, startIso: '2026-08-14T20:00:00+05:30', matches: [{ t1: 'PLYWOOD PIONEERS', t2: 'BORIC SPEEDSTERS' }, { t1: 'VANILLA FALCONS', t2: 'SUPERNOVA QUEEN' }, { t1: 'VINTAGE STRIKERS', t2: 'EBONY OVERLORDS' }, { t1: 'LUMEN PILLAR', t2: 'POCKET DYNAMOS' }] },
      { num: 7, startIso: '2026-08-15T20:00:00+05:30', matches: [{ t1: 'PLYWOOD PIONEERS', t2: 'POCKET DYNAMOS' }, { t1: 'EBONY OVERLORDS', t2: 'LUMEN PILLAR' }, { t1: 'BORIC SPEEDSTERS', t2: 'VINTAGE STRIKERS' }, { t1: 'SUPERNOVA QUEEN', t2: 'VANILLA FALCONS' }] },
    ];

    return monuments.map((m) => {
      const fix = m.matches.find(
        (f) => f.t1.toUpperCase() === teamNameUpper || f.t2.toUpperCase() === teamNameUpper
      );
      if (!fix) return null;
      const isCurrentActive = m.num === 4;
      const isPast = m.num < 4;
      const isT1 = fix.t1.toUpperCase() === teamNameUpper;
      return {
        id: `monument_${m.num}_${teamNameUpper.replace(/\s+/g, '_')}`,
        matchNumber: m.num,
        scheduledTime: m.startIso,
        status: isCurrentActive ? 'LIVE' : isPast ? 'COMPLETED' : 'SCHEDULED',
        tableNumber: 1,
        team1Id: isT1 ? currentTeam.id : `t_${fix.t1.replace(/\s+/g, '_')}`,
        team1: { id: isT1 ? currentTeam.id : `t_${fix.t1.replace(/\s+/g, '_')}`, name: fix.t1, logo: teamLogos[fix.t1] || currentTeam.logo },
        team2Id: !isT1 ? currentTeam.id : `t_${fix.t2.replace(/\s+/g, '_')}`,
        team2: { id: !isT1 ? currentTeam.id : `t_${fix.t2.replace(/\s+/g, '_')}`, name: fix.t2, logo: teamLogos[fix.t2] || '' },
      };
    }).filter(Boolean);
  }, [initialMatches, currentTeam]);

  const assignedPatterns = initialPatterns.length > 0 ? initialPatterns : [];

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

      {/* KPI Cards — Matches Played · Average · Bonus Won · Slams */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Matches Played */}
        <Card className="p-5 border-border bg-gradient-to-br from-amber-500/10 to-amber-500/5 hover:shadow-amber-500/10 hover:shadow-md transition-shadow">
          <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Matches Played
          </div>
          <div className="text-4xl font-black text-foreground mt-2">
            {(currentPlayer.wins || 0) + (currentPlayer.losses || 0)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {currentPlayer.wins || 0}W &nbsp;/&nbsp; {currentPlayer.losses || 0}L
          </div>
        </Card>

        {/* Average */}
        <Card className="p-5 border-border bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 hover:shadow-emerald-500/10 hover:shadow-md transition-shadow">
          <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" /> Average
          </div>
          <div className="text-4xl font-black text-foreground mt-2">
            {currentPlayer.average
              ? Number(currentPlayer.average).toFixed(1)
              : ((currentPlayer.wins || 0) + (currentPlayer.losses || 0)) > 0
                ? ((currentPlayer.boardsWon || 0) / ((currentPlayer.wins || 0) + (currentPlayer.losses || 0))).toFixed(1)
                : '0.0'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Player Average</div>
        </Card>

        {/* Bonus Won */}
        <Card className="p-5 border-border bg-gradient-to-br from-violet-500/10 to-violet-500/5 hover:shadow-violet-500/10 hover:shadow-md transition-shadow">
          <div className="text-[10px] font-black text-violet-400 uppercase tracking-widest flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Bonus Won
          </div>
          <div className="text-4xl font-black text-foreground mt-2">
            {currentPlayer.queenStrikes || 0}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Queen covers (bonus pts)</div>
        </Card>

        {/* Slams */}
        <Card className="p-5 border-border bg-gradient-to-br from-rose-500/10 to-rose-500/5 hover:shadow-rose-500/10 hover:shadow-md transition-shadow">
          <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
            <Crown className="h-3.5 w-3.5" /> Slams
          </div>
          <div className="text-4xl font-black text-foreground mt-2">
            {currentPlayer.boardsWon || 0}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Total boards won</div>
        </Card>
      </div>

      {/* ── TODAY'S MATCH — GO LIVE BANNER ────────────────────────────────────────── */}
      {currentTeam?.id && (() => {
        const today = new Date();
        const todayStr = today.toDateString();

        // Only matches that belong to this player's actual team (by team ID or team name)
        const myMatches = personalSchedule.filter((m: any) =>
          m.team1Id === currentTeam.id ||
          m.team2Id === currentTeam.id ||
          m.team1?.name?.toUpperCase() === currentTeam.name?.toUpperCase() ||
          m.team2?.name?.toUpperCase() === currentTeam.name?.toUpperCase()
        );

        // Priority: today's non-completed → any LIVE → next SCHEDULED
        const todayMatch =
          myMatches.find((m: any) => new Date(m.scheduledTime).toDateString() === todayStr && m.status !== 'COMPLETED') ||
          myMatches.find((m: any) => m.status === 'LIVE') ||
          myMatches.find((m: any) => m.status === 'SCHEDULED');

        // Match-specific details (only when a match is found)
        const isMyTeam1   = todayMatch ? todayMatch.team1Id === currentTeam.id : true;
        const myTeamName  = todayMatch ? (isMyTeam1 ? todayMatch.team1?.name : todayMatch.team2?.name) || currentTeam.name : currentTeam.name;
        const oppTeamName = todayMatch ? (isMyTeam1 ? todayMatch.team2?.name : todayMatch.team1?.name) || 'TBD' : null;
        const myTeamLogo  = todayMatch ? (isMyTeam1 ? todayMatch.team1?.logo : todayMatch.team2?.logo) : currentTeam?.logo;
        const oppTeamLogo = todayMatch ? (isMyTeam1 ? todayMatch.team2?.logo : todayMatch.team1?.logo) : null;
        const isLive      = todayMatch?.status === 'LIVE';

        const firstMatchDate = myMatches.length > 0
          ? new Date(myMatches.reduce((a: any, b: any) =>
              new Date(a.scheduledTime) < new Date(b.scheduledTime) ? a : b).scheduledTime)
          : today;
        const dayDiff = Math.max(1, Math.ceil((today.getTime() - firstMatchDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        return (
          <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-rose-500/10 shadow-lg shadow-amber-500/10">
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />

            <div className="relative p-5 sm:p-7">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/30">
                    <Video className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-amber-400/70">CBOT 200th Edition</div>
                    <div className="text-base font-black text-foreground leading-tight">
                      {todayMatch
                        ? `Tournament Day ${dayDiff} — Your Match Today`
                        : `Welcome, ${currentTeam.name} — Go Live Anytime`}
                    </div>
                  </div>
                </div>
                {isLive && (
                  <Badge variant="warning" className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-black">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse inline-block" />
                    MATCH IS LIVE
                  </Badge>
                )}
              </div>

              {/* Match card — when match exists */}
              {todayMatch ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-background/50 border border-border backdrop-blur-sm">
                  {/* My Team */}
                  <div className="flex flex-col items-center gap-2 min-w-[100px]">
                    {myTeamLogo ? (
                      <img src={myTeamLogo} alt={myTeamName} className="w-14 h-14 rounded-xl object-contain border border-border shadow-md bg-background" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-black text-amber-500 text-lg">
                        {myTeamName?.[0] || 'M'}
                      </div>
                    )}
                    <span className="text-xs font-black text-center leading-tight text-amber-400">{myTeamName}</span>
                    <Badge variant="carrom" className="text-[9px] px-2">YOUR TEAM</Badge>
                  </div>

                  {/* VS */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-2xl font-black text-muted-foreground/50">VS</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {new Date(todayMatch.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-[9px] text-muted-foreground/60">
                      Table #{(todayMatch as any).tableNumber || 1}
                    </div>
                  </div>

                  {/* Opponent */}
                  <div className="flex flex-col items-center gap-2 min-w-[100px]">
                    {oppTeamLogo ? (
                      <img src={oppTeamLogo} alt={oppTeamName!} className="w-14 h-14 rounded-xl object-contain border border-border shadow-md bg-background" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-slate-500/20 border border-slate-500/30 flex items-center justify-center font-black text-slate-400 text-lg">
                        {oppTeamName?.[0] || 'O'}
                      </div>
                    )}
                    <span className="text-xs font-black text-center leading-tight">{oppTeamName || 'TBD'}</span>
                    <Badge variant="outline" className="text-[9px] px-2 text-muted-foreground">OPPONENT</Badge>
                  </div>
                </div>
              ) : (
                /* No match yet — show team card with pending state */
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
                      📅 No match scheduled yet for today — check back on your match day.
                    </div>
                  </div>
                </div>
              )}

              {/* Go Live CTA — always visible */}
              <div className="mt-5 flex flex-col sm:flex-row items-center gap-3">
                <Link href={todayMatch ? `/player/matches/${todayMatch.id}/live` : `/player/matches/upcoming/live`} className="w-full sm:w-auto">
                  <Button
                    variant="carrom"
                    size="lg"
                    className="w-full sm:w-auto gap-2.5 font-black text-sm px-8 py-5 shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-200 hover:scale-[1.02]"
                  >
                    <Radio className="h-4 w-4 animate-pulse" />
                    🔴 GO LIVE — CBOT YouTube
                  </Button>
                </Link>
                <p className="text-[11px] text-muted-foreground text-center sm:text-left leading-relaxed">
                  Opens the live streaming studio with CBOT overlay — your name, team, day &amp; timestamp displayed on stream.
                </p>
              </div>
            </div>
          </div>
        );
      })()}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-4 flex flex-wrap h-auto gap-2 p-1">
          <TabsTrigger value="profile"><UserCheck className="h-4 w-4 mr-2" /> Profile</TabsTrigger>
          <TabsTrigger value="team"><Users className="h-4 w-4 mr-2" /> My Team</TabsTrigger>
          <TabsTrigger value="schedule"><Calendar className="h-4 w-4 mr-2" /> Schedule</TabsTrigger>
          <TabsTrigger value="patterns"><Layers className="h-4 w-4 mr-2" /> Board Patterns</TabsTrigger>
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

        <TabsContent value="schedule">
            <Card className="border-border">
                <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-amber-500" /> Match Schedule
                    </CardTitle>
                    <CardDescription>
                        View your team's upcoming fixtures.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Match #</TableHead>
                            <TableHead>Opponent Team</TableHead>
                            <TableHead>Assigned Table</TableHead>
                            <TableHead>Match Format</TableHead>
                            <TableHead>Scheduled Time</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Live Stream Studio</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {personalSchedule.map((match) => (
                            <TableRow key={match.id}>
                            <TableCell className="font-mono text-xs font-bold">#{match.matchNumber}</TableCell>
                            <TableCell className="font-bold text-xs">
                                {match.team1Id === currentTeam.id ? match.team2?.name : match.team1?.name}
                            </TableCell>
                            <TableCell className="font-bold text-xs text-amber-500">Table #{match.tableNumber || 1}</TableCell>
                            <TableCell>
                                <Badge variant="secondary" className="text-[10px]">
                                {match.matchNumber % 3 === 0 ? 'TRIPLES MATCH' : match.matchNumber % 2 === 0 ? 'DOUBLES MATCH' : 'SINGLES MATCH'}
                                </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                                {new Date(match.scheduledTime).toLocaleString()}
                            </TableCell>
                            <TableCell>
                                <Badge variant={match.status === 'COMPLETED' ? 'success' : match.status === 'LIVE' ? 'warning' : 'outline'} className="text-[10px]">
                                    {match.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Link href={`/player/matches/${match.id}/live`}>
                                <Button variant="carrom" size="sm" className="h-8 px-3 text-[11px] font-black gap-1.5 shadow-md">
                                  <Radio className="h-3 w-3 animate-pulse" /> START LIVE STREAM
                                </Button>
                              </Link>
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="patterns">
            <Card className="border-border">
                <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Layers className="h-5 w-5 text-amber-500" /> Board Patterns
                    </CardTitle>
                    <CardDescription>
                        Assigned board patterns for the active edition, and their match formats.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {assignedPatterns.map((pat, idx) => (
                        <div key={pat.id} className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row gap-4">
                            {pat.diagramUrl ? (
                                <img src={pat.diagramUrl} alt={pat.name} className="w-full sm:w-32 sm:h-32 object-cover rounded-lg border border-border" />
                            ) : (
                                <div className="w-full sm:w-32 sm:h-32 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Target className="h-8 w-8 text-muted-foreground" />
                                </div>
                            )}
                            <div className="flex-1 space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                    <h3 className="font-bold text-sm text-foreground">{pat.name}</h3>
                                    <Badge variant={pat.difficulty === 'EASY' ? 'success' : pat.difficulty === 'MASTER' ? 'destructive' : 'warning'} className="text-[9px]">
                                        {pat.difficulty}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{pat.objective}</p>
                                <div className="flex flex-wrap gap-2 text-[10px] font-mono mt-1">
                                    <Badge variant="outline" className="font-normal text-emerald-500 border-emerald-500/20">Base: +{pat.basePoints ?? pat.scoringRules?.basePoints ?? 0}</Badge>
                                    <Badge variant="outline" className="font-normal text-pink-500 border-pink-500/20">Queen: +{pat.queenBonus ?? pat.scoringRules?.queenBonus ?? 0}</Badge>
                                    {(pat.penaltyPoints ?? pat.scoringRules?.penaltyPoints ?? 0) > 0 && (
                                        <Badge variant="outline" className="font-normal text-red-500 border-red-500/20">Penalty: -{pat.penaltyPoints ?? pat.scoringRules?.penaltyPoints ?? 0}</Badge>
                                    )}
                                </div>
                                <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Format</span>
                                    <Badge variant="carrom" className="text-[9px]">
                                        {idx % 3 === 0 ? 'SINGLES' : idx % 3 === 1 ? 'DOUBLES' : 'TRIPLES'}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                        ))}
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
