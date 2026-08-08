'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { MOCK_TEAMS, MOCK_MATCHES, MOCK_PATTERN_LIBRARY, MOCK_USERS } from '@/lib/mock-data';
import { submitMatchLineup } from '@/lib/actions/lineupActions';
import { submitScoreReport } from '@/lib/actions/matchActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Avatar } from '@/components/ui/avatar';
import { Shield, Crown, Users, Trophy, Calendar, CheckCircle2, Clock, Layers, ArrowRight, Save, Send, AlertCircle } from 'lucide-react';
import { Match, BoardPattern, User, MatchLineupSlot } from '@/types';

export default function CaptainClient({ initialTeam, initialMembers }: { initialTeam: any, initialMembers: any[] }) {
  const { data: session } = useSession();
  
  // Default captain fallback
  const currentTeam = initialTeam || MOCK_TEAMS[0]; 
  const teamMembers = initialMembers.length > 0 ? initialMembers : (currentTeam.members?.map((m: any) => m.user) || [MOCK_USERS[1], MOCK_USERS[3]]);
  const upcomingMatches = MOCK_MATCHES;
  const boardPatterns = MOCK_PATTERN_LIBRARY.slice(0, 5);

  // Active Lineup State for Selected Match
  const [selectedMatch, setSelectedMatch] = React.useState<Match | null>(null);
  const [lineupModalOpen, setLineupModalOpen] = React.useState(false);

  // Lineup Slot Form States
  const [singlesPlayer, setSinglesPlayer] = React.useState(teamMembers[0]?.id || '');
  const [singlesPattern, setSinglesPattern] = React.useState(boardPatterns[0]?.id || '');

  const [doublesPlayer1, setDoublesPlayer1] = React.useState(teamMembers[0]?.id || '');
  const [doublesPlayer2, setDoublesPlayer2] = React.useState(teamMembers[1]?.id || teamMembers[0]?.id || '');
  const [doublesPattern, setDoublesPattern] = React.useState(boardPatterns[1]?.id || '');

  const [triplesPlayer1, setTriplesPlayer1] = React.useState(teamMembers[0]?.id || '');
  const [triplesPlayer2, setTriplesPlayer2] = React.useState(teamMembers[1]?.id || teamMembers[0]?.id || '');
  const [triplesPlayer3, setTriplesPlayer3] = React.useState(teamMembers[0]?.id || '');
  const [triplesPattern, setTriplesPattern] = React.useState(boardPatterns[2]?.id || '');

  const [lineupSubmitted, setLineupSubmitted] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Score Report State
  const [scoreModalOpen, setScoreModalOpen] = React.useState(false);
  const [reportSuccess, setReportSuccess] = React.useState('');

  const handleOpenLineupModal = (match: Match) => {
    setSelectedMatch(match);
    setLineupSubmitted(false);
    setLineupModalOpen(true);
  };

  const handleLineupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatch) return;
    setIsSubmitting(true);

    const sPlayerObj = teamMembers.find((m: any) => m.id === singlesPlayer) || teamMembers[0];
    const dPlayer1Obj = teamMembers.find((m: any) => m.id === doublesPlayer1) || teamMembers[0];
    const dPlayer2Obj = teamMembers.find((m: any) => m.id === doublesPlayer2) || teamMembers[1] || teamMembers[0];
    const tPlayer1Obj = teamMembers.find((m: any) => m.id === triplesPlayer1) || teamMembers[0];
    const tPlayer2Obj = teamMembers.find((m: any) => m.id === triplesPlayer2) || teamMembers[1] || teamMembers[0];
    const tPlayer3Obj = teamMembers.find((m: any) => m.id === triplesPlayer3) || teamMembers[0];

    const sPatObj = boardPatterns.find((p: any) => p.id === singlesPattern) || boardPatterns[0];
    const dPatObj = boardPatterns.find((p: any) => p.id === doublesPattern) || boardPatterns[1];
    const tPatObj = boardPatterns.find((p: any) => p.id === triplesPattern) || boardPatterns[2];

    const slots: MatchLineupSlot[] = [
      {
        id: `slot_s_${Date.now()}`,
        formatType: 'SINGLES',
        patternId: sPatObj.id,
        patternName: sPatObj.name,
        playerIds: [sPlayerObj.id],
        playerNames: [sPlayerObj.name],
      },
      {
        id: `slot_d_${Date.now()}`,
        formatType: 'DOUBLES',
        patternId: dPatObj.id,
        patternName: dPatObj.name,
        playerIds: [dPlayer1Obj.id, dPlayer2Obj.id],
        playerNames: [dPlayer1Obj.name, dPlayer2Obj.name],
      },
      {
        id: `slot_t_${Date.now()}`,
        formatType: 'TRIPLES',
        patternId: tPatObj.id,
        patternName: tPatObj.name,
        playerIds: [tPlayer1Obj.id, tPlayer2Obj.id, tPlayer3Obj.id],
        playerNames: [tPlayer1Obj.name, tPlayer2Obj.name, tPlayer3Obj.name],
      },
    ];

    const res = await submitMatchLineup({
      matchId: selectedMatch.id,
      teamId: currentTeam.id,
      teamName: currentTeam.name,
      captainId: currentTeam.captainId,
      slots,
    });

    if (res.success) {
      setLineupSubmitted(true);
      setTimeout(() => {
        setLineupModalOpen(false);
      }, 1500);
    }
    setIsSubmitting(false);
  };

  const handleScoreReportSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedMatch) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const res = await submitScoreReport({
      matchId: selectedMatch.id,
      captainUserId: currentTeam.captainId,
      team1Score: parseInt(formData.get('team1Score') as string, 10),
      team2Score: parseInt(formData.get('team2Score') as string, 10),
      queenStrikes1: parseInt(formData.get('queenStrikes1') as string, 10),
      queenStrikes2: parseInt(formData.get('queenStrikes2') as string, 10),
      proofNotes: formData.get('proofNotes') as string,
    });

    if (res.success) {
      setReportSuccess('Score report submitted for Organizer verification!');
      setTimeout(() => {
        setScoreModalOpen(false);
        setReportSuccess('');
      }, 1500);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/40 bg-card p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="carrom" className="font-extrabold px-3 py-1">
                <Crown className="h-3.5 w-3.5 mr-1 text-amber-400" /> Official Captain Hub
              </Badge>
              <Badge variant="outline" className="font-bold">{currentTeam.name} ({currentTeam.tag})</Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Captain Command Portal</h1>
            <p className="text-muted-foreground text-sm">
              Configure Singles, Doubles, and Triples match lineups for each assigned board pattern.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/fixtures">
              <Button variant="outline" className="font-bold text-xs border-amber-500/40 text-amber-500">
                <Calendar className="h-4 w-4 mr-1.5" /> Public Schedule
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Grid: Roster & Assigned Board Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Team Roster */}
        <Card className="lg:col-span-6 p-6 border-border space-y-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-500" /> Franchise Roster ({teamMembers.length} Competitors)
          </CardTitle>
          <div className="space-y-3">
            {teamMembers.map((member: any) => (
              <div key={member.id} className="p-3.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <Avatar src={member.image} fallback={member.name} size="sm" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-foreground">{member.name}</span>
                      {member.id === currentTeam.captainId && (
                        <Badge variant="carrom" className="text-[9px]">CAPTAIN</Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">@{member.username}</span>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <span className="font-bold text-amber-500">{member.rating} ELO</span>
                  <div className="text-[10px] text-muted-foreground">{member.wins}W / {member.losses}L</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Assigned Edition Board Patterns */}
        <Card className="lg:col-span-6 p-6 border-border space-y-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Layers className="h-5 w-5 text-amber-500" /> Assigned Board Patterns (Edition #205)
          </CardTitle>
          <div className="space-y-3">
            {boardPatterns.map((pat) => (
              <div key={pat.id} className="p-3.5 rounded-xl bg-muted/40 border border-border/50 space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-amber-500">{pat.name}</span>
                  <Badge variant="carrom" className="text-[9px]">{pat.difficulty}</Badge>
                </div>
                <p className="text-muted-foreground text-[11px]">{pat.objective}</p>
              </div>
            ))}
          </div>
        </Card>

      </div>

      {/* Upcoming Match Lineup Configurations */}
      <Card className="border-border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 gap-4">
          <div>
            <CardTitle className="text-xl font-bold">Upcoming Match Lineup Submissions</CardTitle>
            <CardDescription>Configure player assignments across Singles, Doubles, and Triples before deadline.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Match #</TableHead>
                <TableHead>Fixture</TableHead>
                <TableHead>Table #</TableHead>
                <TableHead>Scheduled Time</TableHead>
                <TableHead>Lineup Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingMatches.map((match) => {
                const existingLineup: any = undefined;

                return (
                  <TableRow key={match.id}>
                    <TableCell className="font-mono text-xs font-bold">#{match.matchNumber}</TableCell>
                    <TableCell className="font-bold text-xs">{match.team1?.name} vs {match.team2?.name}</TableCell>
                    <TableCell className="font-bold text-xs text-amber-500">Table #{match.tableNumber || 1}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {new Date(match.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={existingLineup?.status === 'LOCKED' ? 'success' : existingLineup ? 'carrom' : 'warning'}>
                        {existingLineup?.status || 'LINEUP PENDING'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenLineupModal(match)}
                          className="h-7 text-xs font-bold text-amber-500 hover:bg-amber-500/10"
                        >
                          <Send className="h-3.5 w-3.5 mr-1" /> Configure Lineup
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedMatch(match);
                            setScoreModalOpen(true);
                          }}
                          className="h-7 text-xs font-bold text-emerald-500 hover:bg-emerald-500/10"
                        >
                          Submit Score
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* CONFIGURE MATCH LINEUP MODAL */}
      {selectedMatch && (
        <Dialog open={lineupModalOpen} onOpenChange={setLineupModalOpen}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-amber-500" /> Match #{selectedMatch.matchNumber} Lineup Configuration
            </DialogTitle>
            <DialogDescription>
              Assign players to Singles (1), Doubles (2), and Triples (3) mapped to Edition Board Patterns.
            </DialogDescription>
          </DialogHeader>

          {lineupSubmitted ? (
            <div className="p-6 text-center space-y-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
              <CheckCircle2 className="h-10 w-10 text-amber-500 mx-auto" />
              <h3 className="font-extrabold text-base">Match Lineup Submitted!</h3>
              <p className="text-xs text-muted-foreground">Your lineup has been submitted to the Tournament Director for verification.</p>
            </div>
          ) : (
            <form onSubmit={handleLineupSubmit} className="space-y-6 py-2">
              
              {/* 1. SINGLES MATCH */}
              <div className="p-4 rounded-xl border bg-muted/40 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="carrom">Format 1: SINGLES MATCH (1 Player)</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold block mb-1">Select Player</label>
                    <select
                      value={singlesPlayer}
                      onChange={(e) => setSinglesPlayer(e.target.value)}
                      className="w-full bg-card border rounded p-2 text-xs font-bold"
                    >
                      {teamMembers.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Assigned Board Pattern</label>
                    <select
                      value={singlesPattern}
                      onChange={(e) => setSinglesPattern(e.target.value)}
                      className="w-full bg-card border rounded p-2 text-xs font-bold"
                    >
                      {boardPatterns.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. DOUBLES MATCH */}
              <div className="p-4 rounded-xl border bg-muted/40 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="success">Format 2: DOUBLES MATCH (2 Players)</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold block mb-1">Player 1</label>
                    <select
                      value={doublesPlayer1}
                      onChange={(e) => setDoublesPlayer1(e.target.value)}
                      className="w-full bg-card border rounded p-2 text-xs font-bold"
                    >
                      {teamMembers.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Player 2</label>
                    <select
                      value={doublesPlayer2}
                      onChange={(e) => setDoublesPlayer2(e.target.value)}
                      className="w-full bg-card border rounded p-2 text-xs font-bold"
                    >
                      {teamMembers.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Assigned Pattern</label>
                    <select
                      value={doublesPattern}
                      onChange={(e) => setDoublesPattern(e.target.value)}
                      className="w-full bg-card border rounded p-2 text-xs font-bold"
                    >
                      {boardPatterns.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. TRIPLES MATCH */}
              <div className="p-4 rounded-xl border bg-muted/40 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Format 3: TRIPLES MATCH (3 Players)</Badge>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-bold block mb-1">Player 1</label>
                    <select
                      value={triplesPlayer1}
                      onChange={(e) => setTriplesPlayer1(e.target.value)}
                      className="w-full bg-card border rounded p-1.5 text-xs font-bold"
                    >
                      {teamMembers.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block mb-1">Player 2</label>
                    <select
                      value={triplesPlayer2}
                      onChange={(e) => setTriplesPlayer2(e.target.value)}
                      className="w-full bg-card border rounded p-1.5 text-xs font-bold"
                    >
                      {teamMembers.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block mb-1">Player 3</label>
                    <select
                      value={triplesPlayer3}
                      onChange={(e) => setTriplesPlayer3(e.target.value)}
                      className="w-full bg-card border rounded p-1.5 text-xs font-bold"
                    >
                      {teamMembers.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold block mb-1">Pattern</label>
                    <select
                      value={triplesPattern}
                      onChange={(e) => setTriplesPattern(e.target.value)}
                      className="w-full bg-card border rounded p-1.5 text-xs font-bold"
                    >
                      {boardPatterns.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setLineupModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="carrom" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Match Lineup'}
                </Button>
              </div>
            </form>
          )}
        </Dialog>
      )}

      {/* SCORE REPORT MODAL */}
      {selectedMatch && (
        <Dialog open={scoreModalOpen} onOpenChange={setScoreModalOpen}>
          <DialogHeader>
            <DialogTitle>Submit Score Report - Match #{selectedMatch.matchNumber}</DialogTitle>
          </DialogHeader>
          {reportSuccess ? (
            <div className="p-4 text-center text-xs text-emerald-500 font-bold bg-emerald-500/10 rounded-xl">
              {reportSuccess}
            </div>
          ) : (
            <form onSubmit={handleScoreReportSubmit} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold block mb-1">{selectedMatch.team1?.name} Score</label>
                  <Input name="team1Score" type="number" defaultValue="14" required />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">{selectedMatch.team2?.name} Score</label>
                  <Input name="team2Score" type="number" defaultValue="16" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold block mb-1">{selectedMatch.team1?.name} Queens</label>
                  <Input name="queenStrikes1" type="number" defaultValue="2" />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">{selectedMatch.team2?.name} Queens</label>
                  <Input name="queenStrikes2" type="number" defaultValue="3" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Proof / Notes</label>
                <textarea name="proofNotes" rows={2} className="w-full rounded-lg border border-input bg-background p-2 text-xs" defaultValue="Live stream verified." />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setScoreModalOpen(false)}>Cancel</Button>
                <Button type="submit" variant="carrom" disabled={isSubmitting}>Submit Score</Button>
              </div>
            </form>
          )}
        </Dialog>
      )}

    </div>
  );
}
