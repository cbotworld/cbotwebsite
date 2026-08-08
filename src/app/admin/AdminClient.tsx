'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { MOCK_TOURNAMENTS, MOCK_MATCHES, MOCK_SCORE_REPORTS, MOCK_TEAMS, MOCK_USERS, MOCK_EDITIONS, MOCK_PATTERN_LIBRARY } from '@/lib/mock-data';
import { createEdition } from '@/lib/actions/tournamentActions';
import { verifyScoreReport } from '@/lib/actions/matchActions';
import { generateUserCredentials, resetUserPin, updatePlayer, togglePlayerActivation, deletePlayer } from '@/lib/actions/userActions';
import { calculatePlayerCategoriesForDraft, autoGenerateBalancedTeams, publishFinalizedTeams, updateTeamCaptain } from '@/lib/actions/teamManagementActions';
import { generateRoundRobinFixtures, calculateLeagueStandings, generatePlayoffFixtures, rescheduleFixture } from '@/lib/actions/schedulerActions';
import { lockMatchLineup, overrideMatchLineup } from '@/lib/actions/lineupActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar } from '@/components/ui/avatar';
import {
  Shield, Trophy, AlertTriangle, Plus, Users, Crown, Check, X, KeyRound, Copy,
  CheckCircle2, UserPlus, BarChart3, Settings, FileText, Calendar, Layers, Target,
  Radio, Lock, Download, RefreshCw, Activity, ArrowRight, ShieldAlert, Sparkles, Zap, Edit, Trash2, Power, Globe, Phone, MapPin, History, Eye, ArrowRightLeft, Send, Clock
} from 'lucide-react';
import { Tournament, User, UserRole, BoardPattern, Edition, Match, StandingRow, MatchLineup } from '@/types';

export default function AdminPortalPage() {
  const { data: session } = useSession();
  const currentRole: UserRole = (session?.user as any)?.role || 'ORGANIZER';

  const [activeTab, setActiveTab] = React.useState('dashboard');

  // Datasets
  const [tournaments, setTournaments] = React.useState<Tournament[]>(MOCK_TOURNAMENTS);
  const [scoreReports, setScoreReports] = React.useState(MOCK_SCORE_REPORTS);
  const [usersList, setUsersList] = React.useState<User[]>(MOCK_USERS);
  const [editionsList, setEditionsList] = React.useState<Edition[]>(MOCK_EDITIONS);
  const [matchesList, setMatchesList] = React.useState<Match[]>(MOCK_MATCHES);
  const [lineupsList, setLineupsList] = React.useState<MatchLineup[]>([]);
  const [standingsList, setStandingsList] = React.useState<StandingRow[]>([]);

  // Modals
  const [rescheduleModalOpen, setRescheduleModalOpen] = React.useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = React.useState(false);
  const [genCredentialsModalOpen, setGenCredentialsModalOpen] = React.useState(false);

  const [selectedMatch, setSelectedMatch] = React.useState<Match | null>(null);
  const [selectedLineup, setSelectedLineup] = React.useState<MatchLineup | null>(null);
  const [overrideNotes, setOverrideNotes] = React.useState('');

  const [rescheduledTime, setRescheduledTime] = React.useState('');
  const [rescheduledTable, setRescheduledTable] = React.useState(1);

  // Form States
  const [genName, setGenName] = React.useState('');
  const [genRole, setGenRole] = React.useState<UserRole>('PLAYER');
  const [createdCreds, setCreatedCreds] = React.useState<{ username: string; pin: string; name: string } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Team captain management
  const [teamsList, setTeamsList] = React.useState<any[]>(MOCK_TEAMS);
  const [captainSelections, setCaptainSelections] = React.useState<Record<string, string>>({});
  const [captainSaving, setCaptainSaving] = React.useState<Record<string, boolean>>({});
  const [captainSaved, setCaptainSaved] = React.useState<Record<string, boolean>>({});

  if (currentRole !== 'ORGANIZER') {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center space-y-6">
        <div className="h-16 w-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/30">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-black">Organizer Access Required</h1>
        <p className="text-muted-foreground text-sm">Access restricted to official Tournament Directors.</p>
        <Link href="/login">
          <Button variant="carrom">Log In as Balu Master (Organizer)</Button>
        </Link>
      </div>
    );
  }

  // LINEUP ACTIONS
  const handleLockLineup = async (lineupId: string) => {
    const res = await lockMatchLineup(lineupId);
    if (res.success && res.lineup) {
      setLineupsList(lineupsList.map((l) => (l.id === lineupId ? (res.lineup as any) : l)));
    }
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLineup) return;
    setIsSubmitting(true);

    const res = await overrideMatchLineup(selectedLineup.id, selectedLineup.slots, overrideNotes);
    if (res.success && res.lineup) {
      setLineupsList(lineupsList.map((l) => (l.id === selectedLineup.id ? (res.lineup as any) : l)));
      setOverrideModalOpen(false);
    }
    setIsSubmitting(false);
  };

  const handleGenerateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await generateUserCredentials({ name: genName, role: genRole });
    if (res.success && res.credentials) {
      setCreatedCreds(res.credentials);
      if (res.credentials.user) setUsersList([(res.credentials.user as any), ...usersList]);
    }
    setIsSubmitting(false);
  };

  const copyCredentials = () => {
    if (!createdCreds) return;
    navigator.clipboard.writeText(`Username: ${createdCreds.username}\n4-Digit PIN: ${createdCreds.pin}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/40 bg-card p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="CBOT Logo" className="h-10 w-10 object-contain drop-shadow-md" />
              <Badge variant="carrom" className="font-extrabold px-3 py-1">
                <Shield className="h-3.5 w-3.5 mr-1" /> Official Admin Portal
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Captain Lineups & Audit Engine</h1>
            <p className="text-muted-foreground text-sm">
              Review submitted Captain lineups for Singles, Doubles, and Triples, lock rosters, or perform Organizer overrides.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard/captain">
              <Button variant="outline" className="font-bold text-xs border-amber-500/40 text-amber-500">
                <Crown className="h-4 w-4 mr-1.5" /> Captain Portal Preview
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Admin Module Navigation Tabs */}
      <Tabs defaultValue="lineups" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto p-1.5 bg-card border border-border rounded-2xl gap-1 overflow-x-auto scrollbar-none mb-8">
          <TabsTrigger value="dashboard" className="text-xs font-bold gap-1.5 px-3 py-2">
            <BarChart3 className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="lineups" className="text-xs font-bold gap-1.5 px-3 py-2">
            <Send className="h-3.5 w-3.5 text-amber-500" /> Captain Lineup Audit
          </TabsTrigger>
          <TabsTrigger value="editions" className="text-xs font-bold gap-1.5 px-3 py-2">
            <Trophy className="h-3.5 w-3.5" /> Editions (200+)
          </TabsTrigger>
          <TabsTrigger value="patterns" className="text-xs font-bold gap-1.5 px-3 py-2">
            <Layers className="h-3.5 w-3.5" /> Board Patterns
          </TabsTrigger>
          <TabsTrigger value="players" className="text-xs font-bold gap-1.5 px-3 py-2">
            <Users className="h-3.5 w-3.5" /> Players & PINs
          </TabsTrigger>
          <TabsTrigger value="scores" className="text-xs font-bold gap-1.5 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Scores Audit
          </TabsTrigger>
          <TabsTrigger value="captains" className="text-xs font-bold gap-1.5 px-3 py-2">
            <Crown className="h-3.5 w-3.5 text-amber-400" /> Team Captains
          </TabsTrigger>
        </TabsList>

        {/* 1. OVERVIEW DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            <Card className="p-5 border-amber-500/30 bg-amber-500/5">
              <div className="text-xs font-bold text-amber-500 uppercase">Submitted Lineups</div>
              <div className="text-3xl font-black text-foreground mt-2">{lineupsList.length} Lineups</div>
            </Card>
            <Card className="p-5 border-emerald-500/30 bg-emerald-500/5">
              <div className="text-xs font-bold text-emerald-500 uppercase">Locked Lineups</div>
              <div className="text-3xl font-black text-foreground mt-2">{lineupsList.filter(l => l.status === 'LOCKED').length} Locked</div>
            </Card>
            <Card className="p-5 border-pink-500/30 bg-pink-500/5">
              <div className="text-xs font-bold text-pink-500 uppercase">Match Formats</div>
              <div className="text-lg font-black text-pink-500 mt-2">Singles, Doubles, Triples</div>
            </Card>
            <Card className="p-5 border-blue-500/30 bg-blue-500/5">
              <div className="text-xs font-bold text-blue-500 uppercase">Organizer Overrides</div>
              <div className="text-3xl font-black text-foreground mt-2">{lineupsList.filter(l => l.status === 'OVERRIDDEN').length} Active</div>
            </Card>
          </div>
        </TabsContent>

        {/* 2. CAPTAIN LINEUP AUDIT MODULE */}
        <TabsContent value="lineups" className="space-y-6">
          <Card className="border-border">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-xl font-bold">Captain Submitted Lineup Audit</CardTitle>
              <CardDescription>Review player assignments across Singles, Doubles, and Triples for each board pattern. Lock or Override lineups.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {lineupsList.map((lineup) => (
                <Card key={lineup.id} className="p-6 border-amber-500/30 bg-card space-y-4 shadow-xl">
                  
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-3 gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xl font-black">{lineup.teamName}</h4>
                        <Badge variant={lineup.status === 'LOCKED' ? 'success' : lineup.status === 'OVERRIDDEN' ? 'destructive' : 'carrom'}>
                          {lineup.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">Match ID: {lineup.matchId} • Submitted by Captain</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {lineup.status !== 'LOCKED' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleLockLineup(lineup.id)}
                          className="h-8 text-xs font-bold text-emerald-500 hover:bg-emerald-500/10"
                        >
                          <Lock className="h-3.5 w-3.5 mr-1" /> Lock Lineup
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedLineup(lineup);
                          setOverrideModalOpen(true);
                        }}
                        className="h-8 text-xs font-bold text-amber-500 hover:bg-amber-500/10"
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" /> Override Lineup
                      </Button>
                    </div>
                  </div>

                  {/* Lineup Formats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {lineup.slots.map((slot) => (
                      <div key={slot.id} className="p-4 rounded-xl border bg-muted/40 space-y-2 text-xs">
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-amber-500">{slot.formatType} MATCH</span>
                        </div>
                        <div className="font-semibold text-foreground">{slot.patternName}</div>
                        <div className="pt-2 border-t border-border/50 text-[11px] space-y-1">
                          <span className="text-muted-foreground block">Assigned Players:</span>
                          {slot.playerNames.map((pName, idx) => (
                            <Badge key={idx} variant="outline" className="mr-1 text-[9px] font-bold">
                              {pName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {lineup.overrideNotes && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 font-semibold">
                      Organizer Override Notes: {lineup.overrideNotes}
                    </div>
                  )}

                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. EDITIONS MODULE */}
        <TabsContent value="editions">
          <Card className="border-border p-6 space-y-4">
            <h3 className="text-lg font-bold">Editions Archive</h3>
          </Card>
        </TabsContent>

        {/* 4. PATTERNS MODULE */}
        <TabsContent value="patterns">
          <Card className="border-border p-6 space-y-4">
            <h3 className="text-lg font-bold">Board Patterns Library</h3>
          </Card>
        </TabsContent>

        {/* 5. PLAYERS MODULE */}
        <TabsContent value="players">
          <Card className="border-border p-6 space-y-4">
            <h3 className="text-lg font-bold">Player Registry</h3>
          </Card>
        </TabsContent>

        {/* 6. SCORES MODULE */}
        <TabsContent value="scores">
          <Card className="border-border p-6 space-y-4">
            <h3 className="text-lg font-bold">Score Audit Queue</h3>
          </Card>
        </TabsContent>

        {/* 7. TEAM CAPTAINS MODULE */}
        <TabsContent value="captains" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black">Team Captain Management</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Reassign captains for any team. Changes take effect immediately.
              </p>
            </div>
            <Badge variant="carrom" className="px-4 py-2 font-bold">
              <Crown className="h-3.5 w-3.5 mr-1.5" /> Organizer Only
            </Badge>
          </div>

          {teamsList.length === 0 ? (
            <Card className="border-border p-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground font-semibold">No teams found.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {teamsList.map((team) => {
                const members = team.members || [];
                const currentCaptainId = team.captainId;
                const selectedCaptainId = captainSelections[team.id] ?? currentCaptainId ?? '';
                const isSaving = captainSaving[team.id];
                const justSaved = captainSaved[team.id];

                const handleSaveCaptain = async () => {
                  if (!selectedCaptainId || selectedCaptainId === currentCaptainId) return;
                  setCaptainSaving((p) => ({ ...p, [team.id]: true }));
                  const res = await updateTeamCaptain(team.id, selectedCaptainId);
                  if (res.success) {
                    setTeamsList((prev) =>
                      prev.map((t) =>
                        t.id === team.id
                          ? { ...t, captainId: selectedCaptainId, captain: members.find((m: any) => m.userId === selectedCaptainId)?.user }
                          : t
                      )
                    );
                    setCaptainSaved((p) => ({ ...p, [team.id]: true }));
                    setTimeout(() => setCaptainSaved((p) => ({ ...p, [team.id]: false })), 2500);
                  }
                  setCaptainSaving((p) => ({ ...p, [team.id]: false }));
                };

                return (
                  <Card
                    key={team.id}
                    className="border border-amber-500/20 bg-card rounded-2xl overflow-hidden shadow-lg"
                  >
                    {/* Team Header */}
                    <div className="bg-gradient-to-br from-amber-950 via-zinc-900 to-black px-4 py-3 border-b border-amber-500/20 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center flex-shrink-0">
                        {team.logo ? (
                          <img src={team.logo} alt={team.name} className="h-full w-full object-cover rounded-full" />
                        ) : (
                          <span className="text-amber-400 font-black text-xs">{team.tag}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-black text-white text-sm">{team.name}</p>
                        <p className="text-amber-400/70 text-[11px]">{members.length} players</p>
                      </div>
                    </div>

                    <CardContent className="p-4 space-y-4">
                      {/* Player list */}
                      <ul className="space-y-1.5">
                        {members.map((member: any) => {
                          const user = member.user || member;
                          const uid = member.userId || member.id;
                          const isCap = uid === currentCaptainId;
                          return (
                            <li key={uid} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl ${isCap ? 'bg-amber-500/10 border border-amber-500/25' : 'bg-muted/30'}`}>
                              <Avatar src={user?.image} fallback={user?.name || '?'} size="sm" className="flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-bold truncate ${isCap ? 'text-amber-400' : ''}`}>{user?.name}</p>
                                <p className="text-[10px] text-muted-foreground">{user?.username}</p>
                              </div>
                              {isCap && (
                                <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border border-amber-500/30 flex-shrink-0">
                                  <Crown className="h-2.5 w-2.5" /> C
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>

                      {/* Captain reassign */}
                      {members.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-border/50">
                          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                            Reassign Captain
                          </label>
                          <div className="flex gap-2">
                            <select
                              value={selectedCaptainId}
                              onChange={(e) => setCaptainSelections((p) => ({ ...p, [team.id]: e.target.value }))}
                              className="flex-1 text-xs font-semibold bg-muted border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            >
                              {members.map((member: any) => {
                                const user = member.user || member;
                                const uid = member.userId || member.id;
                                return (
                                  <option key={uid} value={uid}>
                                    {user?.name}{uid === currentCaptainId ? ' (Current C)' : ''}
                                  </option>
                                );
                              })}
                            </select>
                            <Button
                              size="sm"
                              variant={justSaved ? 'outline' : 'carrom'}
                              onClick={handleSaveCaptain}
                              disabled={isSaving || selectedCaptainId === currentCaptainId}
                              className="flex-shrink-0 font-bold text-xs px-3"
                            >
                              {isSaving ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : justSaved ? (
                                <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mr-1" /> Saved</>
                              ) : (
                                'Save'
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* OVERRIDE LINEUP MODAL */}
      {selectedLineup && (
        <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" /> Organizer Override Lineup - {selectedLineup.teamName}
            </DialogTitle>
            <DialogDescription>Manually update player assignments for Singles, Doubles, or Triples.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleOverrideSubmit} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold block mb-1">Organizer Override Rationale / Notes</label>
              <textarea
                rows={2}
                value={overrideNotes}
                onChange={(e) => setOverrideNotes(e.target.value)}
                required
                className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                placeholder="e.g. Substituted player due to medical emergency."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOverrideModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="carrom">
                Confirm & Override Lineup
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Generate Credentials Modal */}
      <Dialog open={genCredentialsModalOpen} onOpenChange={setGenCredentialsModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-amber-500" /> Create Player & Auto-Generate PIN
          </DialogTitle>
        </DialogHeader>

        {createdCreds ? (
          <div className="p-6 space-y-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
            <CheckCircle2 className="h-10 w-10 text-amber-500 mx-auto" />
            <h3 className="font-bold text-base">Credentials Generated for {createdCreds.name}!</h3>
            <div className="p-4 rounded-xl bg-card border font-mono text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Username:</span>
                <span className="font-black text-amber-500">{createdCreds.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">4-Digit PIN:</span>
                <span className="font-black text-emerald-500 text-base">{createdCreds.pin}</span>
              </div>
            </div>
            <Button variant="carrom" onClick={copyCredentials} className="text-xs font-bold">
              <Copy className="h-3.5 w-3.5 mr-1" /> {copied ? 'Copied!' : 'Copy Credentials'}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleGenerateCredentials} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold block mb-1">Full Name</label>
              <Input value={genName} onChange={(e) => setGenName(e.target.value)} required placeholder="Ramesh V" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setGenCredentialsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="carrom" disabled={isSubmitting}>Generate PIN</Button>
            </div>
          </form>
        )}
      </Dialog>

    </div>
  );
}
