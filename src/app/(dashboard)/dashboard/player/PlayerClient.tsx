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
  UserCheck, Trophy, Target, Crown, Calendar, Video, CheckCircle2, Layers, Users, Lock, Send, PlayCircle, MapPin
} from 'lucide-react';
import { Match, BoardPattern, User } from '@/types';

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
  const personalSchedule = initialMatches.length > 0 ? initialMatches : MOCK_MATCHES;
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
          <div className="text-[11px] text-muted-foreground mt-1">Boards per match</div>
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

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-4 flex flex-wrap h-auto gap-2 p-1">
          <TabsTrigger value="profile"><UserCheck className="h-4 w-4 mr-2" /> Profile</TabsTrigger>
          <TabsTrigger value="team"><Users className="h-4 w-4 mr-2" /> My Team</TabsTrigger>
          <TabsTrigger value="schedule"><Calendar className="h-4 w-4 mr-2" /> Schedule</TabsTrigger>
          <TabsTrigger value="patterns"><Layers className="h-4 w-4 mr-2" /> Board Patterns</TabsTrigger>
          <TabsTrigger value="submit-score" className="text-amber-500 data-[state=active]:text-amber-600"><Send className="h-4 w-4 mr-2" /> Submit Score</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-amber-500" /> Player Profile
              </CardTitle>
              <CardDescription>Your personal details and edition history.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-bold text-muted-foreground">Bio</h3>
                            <p className="text-sm">{currentPlayer.bio || 'No bio provided.'}</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Location</h3>
                            <p className="text-sm">{currentPlayer.city || 'N/A'}, {currentPlayer.state || 'N/A'}, {currentPlayer.country || 'N/A'}</p>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-muted-foreground mb-2">Category History</h3>
                        {currentPlayer.rankingSnapshots && currentPlayer.rankingSnapshots.length > 0 ? (
                            <div className="space-y-2">
                                {currentPlayer.rankingSnapshots?.map((snapshot: any, idx: any) => (
                                    <div key={idx} className="flex justify-between items-center p-3 border border-border rounded-lg text-sm bg-muted/20">
                                        <div>
                                            <div className="font-bold">{new Date(snapshot.createdAt).toLocaleDateString()}</div>
                                            <div className="text-xs text-muted-foreground">ELO: {snapshot.rating}</div>
                                        </div>
                                        <Badge variant="outline">{snapshot.category}</Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground p-3 border border-border rounded-lg bg-muted/20 text-center">
                                No past ranking history available yet.
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
          </Card>
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
                            {teammates.map((mate: any) => (
                            <div key={mate.id} className="p-4 rounded-xl border border-border flex items-center gap-3">
                                <Avatar src={mate.image} fallback={mate.name} size="md" />
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-sm">{mate.name}</span>
                                        {mate.id === currentTeam.captainId && (
                                        <Badge variant="carrom" className="text-[9px] px-1.5">CAPTAIN</Badge>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted-foreground font-mono">@{mate.username}</span>
                                    <div className="text-xs font-semibold text-amber-500 mt-0.5">{mate.rating} ELO</div>
                                </div>
                            </div>
                            ))}
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
