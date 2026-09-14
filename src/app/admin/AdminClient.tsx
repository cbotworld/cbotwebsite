'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { MOCK_TOURNAMENTS, MOCK_MATCHES, MOCK_SCORE_REPORTS, MOCK_TEAMS, MOCK_USERS, MOCK_EDITIONS, MOCK_PATTERN_LIBRARY } from '@/lib/mock-data';
import { createEdition } from '@/lib/actions/tournamentActions';
import { verifyScoreReport } from '@/lib/actions/matchActions';
import { generateUserCredentials, resetUserPin, updatePlayer, togglePlayerActivation, deletePlayer } from '@/lib/actions/userActions';
import { calculatePlayerCategoriesForDraft, autoGenerateBalancedTeams, publishFinalizedTeams, updateTeamCaptain } from '@/lib/actions/teamManagementActions';
import { generateRoundRobinFixtures, calculateLeagueStandings, generatePlayoffFixtures, rescheduleFixture, saveScheduledMatches } from '@/lib/actions/schedulerActions';
import * as XLSX from 'xlsx';
import { lockMatchLineup, overrideMatchLineup } from '@/lib/actions/lineupActions';
import { getAdminLiveStreamsAction, expireLiveStreamAction } from '@/lib/actions/youtubeActions';
import {
  getYouTubeChannelsStatusAction,
  testYouTubeChannelConnectionAction,
  setYouTubeActiveModeAction,
  disconnectYouTubeChannelAction,
} from '@/lib/actions/youtubeChannelActions';
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
import { DEFAULT_WEBSITE_CMS } from '@/lib/website-cms';

export default function AdminPortalPage({
  editionLabel = DEFAULT_WEBSITE_CMS.site.editionLabel,
}: {
  editionLabel?: string;
}) {
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
  const [adminStreams, setAdminStreams] = React.useState<any[]>([]);

  // YouTube Multi-Channel Management
  const [ytChannelStatus, setYtChannelStatus] = React.useState<any>(null);
  const [ytLoading, setYtLoading] = React.useState(false);
  const [ytTestingCh1, setYtTestingCh1] = React.useState(false);
  const [ytTestingCh2, setYtTestingCh2] = React.useState(false);
  const [ytTestResult1, setYtTestResult1] = React.useState<{ success: boolean; message: string } | null>(null);
  const [ytTestResult2, setYtTestResult2] = React.useState<{ success: boolean; message: string } | null>(null);
  const [ytModeSaving, setYtModeSaving] = React.useState(false);

  const loadYtStatus = React.useCallback(async () => {
    setYtLoading(true);
    try {
      const res = await getYouTubeChannelsStatusAction();
      if (res.success) {
        setYtChannelStatus(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setYtLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (activeTab === 'streams') {
      getAdminLiveStreamsAction().then((res) => {
        if (res.success && res.streams) setAdminStreams(res.streams);
      });
      loadYtStatus();
    }
  }, [activeTab, loadYtStatus]);

  const handleTestChannel = async (channelIndex: 1 | 2) => {
    if (channelIndex === 1) {
      setYtTestingCh1(true);
      setYtTestResult1(null);
    } else {
      setYtTestingCh2(true);
      setYtTestResult2(null);
    }

    try {
      const res = await testYouTubeChannelConnectionAction(channelIndex);
      const result = res.success
        ? {
            success: true,
            message: `Connected! "${res.channelTitle}" (${res.videoCount || 0} videos, ${res.subscriberCount || 0} subs)`,
          }
        : {
            success: false,
            message: res.error || 'Connection test failed',
          };

      if (channelIndex === 1) setYtTestResult1(result);
      else setYtTestResult2(result);

      if (res.success) loadYtStatus();
    } catch (err: any) {
      const result = { success: false, message: err?.message || 'Error executing test' };
      if (channelIndex === 1) setYtTestResult1(result);
      else setYtTestResult2(result);
    } finally {
      if (channelIndex === 1) setYtTestingCh1(false);
      else setYtTestingCh2(false);
    }
  };

  const handleChangeYtMode = async (newMode: 'AUTO_FAILOVER' | 'CHANNEL_1_ONLY' | 'CHANNEL_2_ONLY') => {
    setYtModeSaving(true);
    try {
      await setYouTubeActiveModeAction(newMode);
      await loadYtStatus();
    } finally {
      setYtModeSaving(false);
    }
  };

  const handleDisconnectChannel = async (channelIndex: 1 | 2) => {
    if (!confirm(`Are you sure you want to disconnect Channel ${channelIndex}?`)) return;
    try {
      await disconnectYouTubeChannelAction(channelIndex);
      if (channelIndex === 1) setYtTestResult1(null);
      else setYtTestResult2(null);
      await loadYtStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExpireStream = async (streamId: string) => {
    const res = await expireLiveStreamAction(streamId);
    if (res.success) {
      setAdminStreams(adminStreams.map((s) => (s.id === streamId ? { ...s, status: 'EXPIRED' } : s)));
    }
  };

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

  // Scheduler state
  const [excelFile, setExcelFile] = React.useState<File | null>(null);
  const [manualMatch, setManualMatch] = React.useState({ day: '8', team1Id: '', team2Id: '', stage: 'LEAGUE' });
  
  const handleExcelUpload = async () => {
    if (!excelFile) return;
    setIsSubmitting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        
        // Map Excel columns to match structure (Day, Team 1, Team 2, Stage)
        const matchesData = json.map((row: any) => ({
          day: row['Day']?.toString() || '8',
          team1Id: row['Team 1'] || row['Team1'] || '',
          team2Id: row['Team 2'] || row['Team2'] || '',
          stage: row['Stage'] || 'LEAGUE'
        }));
        
        // Note: For a real app we'd map team names to IDs here, but for simplicity we'll pass it to backend
        // Assuming the admin selects an active edition from the list
        const activeEdition = editionsList[0]?.id;
        if (activeEdition) {
          const res = await saveScheduledMatches(activeEdition, matchesData);
          if (res.success) {
            alert(`Successfully scheduled ${res.count} matches from Excel!`);
          } else {
            alert(`Error: ${res.error}`);
          }
        }
      } catch (error) {
        console.error('Excel parse error:', error);
        alert('Failed to parse Excel file.');
      }
      setIsSubmitting(false);
    };
    reader.readAsBinaryString(excelFile);
  };

  const handleManualSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const activeEdition = editionsList[0]?.id;
    if (activeEdition && manualMatch.team1Id && manualMatch.team2Id) {
      const res = await saveScheduledMatches(activeEdition, [manualMatch]);
      if (res.success) {
        alert('Match successfully scheduled!');
        // Keep Day and Stage, reset teams
        setManualMatch({ ...manualMatch, team1Id: '', team2Id: '' });
      } else {
        alert(`Error: ${res.error}`);
      }
    }
    setIsSubmitting(false);
  };


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
          <TabsTrigger value="streams" className="text-xs font-bold gap-1.5 px-3 py-2 text-rose-400">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> Live Streams
          </TabsTrigger>
          <TabsTrigger value="scheduler" className="text-xs font-bold gap-1.5 px-3 py-2 text-emerald-400">
            <Calendar className="h-3.5 w-3.5" /> Match Scheduler
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

        {/* LIVE STREAMS AUDIT TAB */}
        <TabsContent value="streams" className="space-y-6">
          {/* YouTube Multi-Channel Pool & Quota Manager */}
          <Card className="border-amber-500/30 bg-card shadow-lg">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500 font-bold">
                      <Radio className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-foreground">
                        YouTube Live Multi-Channel & Quota Manager
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Dual-channel pool with automatic quota & broadcast limit failover for 24/7 uninterrupted match streaming.
                      </CardDescription>
                    </div>
                  </div>
                </div>

                {/* Mode Selector */}
                <div className="flex items-center gap-2 bg-muted/40 p-1.5 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-muted-foreground px-2">Failover Mode:</span>
                  <select
                    value={ytChannelStatus?.mode || 'AUTO_FAILOVER'}
                    disabled={ytModeSaving || ytLoading}
                    onChange={(e) => handleChangeYtMode(e.target.value as any)}
                    className="bg-card text-foreground text-xs font-bold border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="AUTO_FAILOVER">⚡ Auto Failover (Recommended)</option>
                    <option value="CHANNEL_1_ONLY">1️⃣ Channel 1 Only</option>
                    <option value="CHANNEL_2_ONLY">2️⃣ Channel 2 Only</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 text-xs text-blue-300 flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Seamless Player Experience:</strong> When daily quota or broadcast limits are reached on Channel 1, mobile Go-Live automatically switches to Channel 2. Both channels' match videos & replays appear unified in the mobile app.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Channel 1 (Primary) */}
                <div className="border border-border rounded-2xl p-5 bg-background/50 space-y-4 relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">Channel 1 (Primary)</span>
                      {ytChannelStatus?.channel1?.connected ? (
                        <Badge variant="success" className="text-[10px] uppercase font-mono">Connected</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px] uppercase font-mono">Not Linked</Badge>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">Default Pool #1</span>
                  </div>

                  <div className="bg-card/70 border border-border/80 rounded-xl p-3.5 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Channel Title:</span>
                      <span className="font-semibold text-foreground truncate max-w-[220px]">
                        {ytChannelStatus?.channel1?.title || 'Not Linked'}
                      </span>
                    </div>
                    {ytChannelStatus?.channel1?.channelId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Channel ID:</span>
                        <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[220px]">
                          {ytChannelStatus.channel1.channelId}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credential Source:</span>
                      <span className="font-mono text-[11px] text-amber-400">
                        {ytChannelStatus?.channel1?.source || 'NONE'}
                      </span>
                    </div>
                  </div>

                  {ytTestResult1 && (
                    <div
                      className={`text-xs p-3 rounded-xl border ${
                        ytTestResult1.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {ytTestResult1.success ? '✅ ' : '❌ '}
                      {ytTestResult1.message}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <a href="/api/auth/youtube/authorize?channel=1" className="flex-1 min-w-[140px]">
                      <Button
                        size="sm"
                        className="w-full text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black shadow"
                      >
                        <Zap className="h-3.5 w-3.5 mr-1.5" />
                        {ytChannelStatus?.channel1?.connected ? 'Re-Authorize Google' : 'Connect Channel 1'}
                      </Button>
                    </a>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={ytTestingCh1 || !ytChannelStatus?.channel1?.connected}
                      onClick={() => handleTestChannel(1)}
                      className="text-xs font-semibold"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${ytTestingCh1 ? 'animate-spin' : ''}`} />
                      {ytTestingCh1 ? 'Testing...' : 'Test Connection'}
                    </Button>

                    {ytChannelStatus?.channel1?.connected && ytChannelStatus?.channel1?.source === 'DATABASE' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnectChannel(1)}
                        className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                </div>

                {/* Channel 2 (Backup/Failover) */}
                <div className="border border-border rounded-2xl p-5 bg-background/50 space-y-4 relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">Channel 2 (Backup / Failover)</span>
                      {ytChannelStatus?.channel2?.connected ? (
                        <Badge variant="success" className="text-[10px] uppercase font-mono">Connected</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] uppercase font-mono">Not Linked</Badge>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">Failover Pool #2</span>
                  </div>

                  <div className="bg-card/70 border border-border/80 rounded-xl p-3.5 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Channel Title:</span>
                      <span className="font-semibold text-foreground truncate max-w-[220px]">
                        {ytChannelStatus?.channel2?.title || 'Not Linked'}
                      </span>
                    </div>
                    {ytChannelStatus?.channel2?.channelId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Channel ID:</span>
                        <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[220px]">
                          {ytChannelStatus.channel2.channelId}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credential Source:</span>
                      <span className="font-mono text-[11px] text-amber-400">
                        {ytChannelStatus?.channel2?.source || 'NONE'}
                      </span>
                    </div>
                  </div>

                  {ytTestResult2 && (
                    <div
                      className={`text-xs p-3 rounded-xl border ${
                        ytTestResult2.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {ytTestResult2.success ? '✅ ' : '❌ '}
                      {ytTestResult2.message}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <a href="/api/auth/youtube/authorize?channel=2" className="flex-1 min-w-[140px]">
                      <Button
                        size="sm"
                        className="w-full text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black shadow"
                      >
                        <Zap className="h-3.5 w-3.5 mr-1.5" />
                        {ytChannelStatus?.channel2?.connected ? 'Re-Authorize Google' : 'Connect Channel 2'}
                      </Button>
                    </a>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={ytTestingCh2 || !ytChannelStatus?.channel2?.connected}
                      onClick={() => handleTestChannel(2)}
                      className="text-xs font-semibold"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${ytTestingCh2 ? 'animate-spin' : ''}`} />
                      {ytTestingCh2 ? 'Testing...' : 'Test Connection'}
                    </Button>

                    {ytChannelStatus?.channel2?.connected && ytChannelStatus?.channel2?.source === 'DATABASE' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnectChannel(2)}
                        className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Radio className="h-5 w-5 text-rose-500 animate-pulse" /> Official CBOT Live Match Streams
                </CardTitle>
                <CardDescription>
                  Monitor real-time player broadcasts, watch live match streams, and manage 15-day video retention.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  getAdminLiveStreamsAction().then((res) => {
                    if (res.success && res.streams) setAdminStreams(res.streams);
                  });
                }}
                className="text-xs font-bold gap-1.5 border-amber-500/40 text-amber-500"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh Streams
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Match / Edition</TableHead>
                    <TableHead>Broadcasting Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Stream Status</TableHead>
                    <TableHead>Started / Ended</TableHead>
                    <TableHead>15-Day Expiry</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminStreams.map((st) => (
                    <TableRow key={st.id}>
                      <TableCell className="font-mono text-xs font-bold">
                        <div>Match #{st.match?.matchNumber || '1'}</div>
                        <div className="text-[10px] text-muted-foreground">{st.edition?.title || editionLabel}</div>
                      </TableCell>
                      <TableCell className="font-bold text-xs">
                        {st.player?.name || st.player?.username || 'Player'}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-amber-500">
                        {st.team?.name || 'Team'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            st.status === 'LIVE'
                              ? 'destructive'
                              : st.status === 'ARCHIVED'
                              ? 'success'
                              : st.status === 'EXPIRED'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="text-[10px]"
                        >
                          {st.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        <div>Start: {st.streamStartedAt ? new Date(st.streamStartedAt).toLocaleTimeString() : 'N/A'}</div>
                        <div>End: {st.streamEndedAt ? new Date(st.streamEndedAt).toLocaleTimeString() : 'N/A'}</div>
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">
                        {st.expiresAt ? new Date(st.expiresAt).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Link href={`/matches/${st.matchId}`} target="_blank">
                          <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold">
                            <Eye className="h-3 w-3 mr-1" /> View Match Page
                          </Button>
                        </Link>
                        {st.status !== 'EXPIRED' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleExpireStream(st.id)}
                            className="h-7 text-[10px] font-bold"
                          >
                            Expire Now
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {adminStreams.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                        No match live streams recorded in system yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MATCH SCHEDULER */}
        <TabsContent value="scheduler" className="space-y-6">
          <Card className="border-amber-500/30">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-xl font-black text-emerald-400 flex items-center gap-2">
                <Calendar className="h-5 w-5" /> Phase 2 Match Scheduler (Day 8+)
              </CardTitle>
              <CardDescription>
                Schedule upcoming matches by uploading an Excel file or manually adding match details.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Excel Upload Section */}
                <div className="p-4 border rounded-xl bg-card space-y-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-amber-500" />
                    <h3 className="font-bold text-sm">Bulk Excel Upload</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload an `.xlsx` file with columns: <strong>Day, Team 1, Team 2, Stage</strong>. Note: For bulk upload, Team 1 and Team 2 should exactly match the team ID.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                      className="text-xs"
                    />
                    <Button
                      onClick={handleExcelUpload}
                      disabled={!excelFile || isSubmitting}
                      className="text-xs font-bold gap-1.5"
                    >
                      <Download className="h-4 w-4" /> Upload
                    </Button>
                  </div>
                </div>

                {/* Manual Entry Section */}
                <div className="p-4 border rounded-xl bg-card space-y-4">
                  <div className="flex items-center gap-2">
                    <Edit className="h-5 w-5 text-amber-500" />
                    <h3 className="font-bold text-sm">Manual Match Entry</h3>
                  </div>
                  <form onSubmit={handleManualSchedule} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase mb-1 block">Day / Round</label>
                        <Input
                          type="number"
                          value={manualMatch.day}
                          onChange={(e) => setManualMatch({ ...manualMatch, day: e.target.value })}
                          required
                          min="1"
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase mb-1 block">Stage</label>
                        <Select
                          value={manualMatch.stage}
                          onChange={(e: any) => setManualMatch({ ...manualMatch, stage: e.target.value })}
                          className="h-8 text-xs bg-background"
                        >
                          <option value="LEAGUE">LEAGUE</option>
                          <option value="QUALIFIER_1">QUALIFIER 1</option>
                          <option value="QUALIFIER_2">QUALIFIER 2</option>
                          <option value="ELIMINATOR">ELIMINATOR</option>
                          <option value="SEMI_FINAL">SEMI FINAL</option>
                          <option value="FINAL">FINAL</option>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase mb-1 block text-emerald-400">Team 1</label>
                        <Select
                          value={manualMatch.team1Id}
                          onChange={(e: any) => setManualMatch({ ...manualMatch, team1Id: e.target.value })}
                          required
                          className="h-8 text-xs bg-background"
                        >
                          <option value="">Select Team...</option>
                          {teamsList.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase mb-1 block text-rose-400">Team 2</label>
                        <Select
                          value={manualMatch.team2Id}
                          onChange={(e: any) => setManualMatch({ ...manualMatch, team2Id: e.target.value })}
                          required
                          className="h-8 text-xs bg-background"
                        >
                          <option value="">Select Team...</option>
                          {teamsList.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting || !manualMatch.team1Id || !manualMatch.team2Id}
                      className="w-full text-xs font-bold gap-1.5 mt-2"
                      variant="carrom"
                    >
                      <Plus className="h-4 w-4" /> Add Match to Schedule
                    </Button>
                  </form>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Phase 1 Matches (Read-Only) */}
          <Card className="border-amber-500/30">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-xl font-black text-amber-500 flex items-center gap-2">
                <History className="h-5 w-5" /> Scheduled Matches
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day/Round</TableHead>
                    <TableHead>Match #</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Team 1</TableHead>
                    <TableHead>Team 2</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchesList.slice().sort((a, b) => a.matchNumber - b.matchNumber).map(match => (
                    <TableRow key={match.id}>
                      <TableCell className="font-mono font-bold text-xs">Day {match.round}</TableCell>
                      <TableCell className="text-xs">#{match.matchNumber}</TableCell>
                      <TableCell className="text-xs"><Badge variant="outline">{match.stage}</Badge></TableCell>
                      <TableCell className="font-bold text-emerald-400 text-xs">{match.team1?.name || match.team1Id || '-'}</TableCell>
                      <TableCell className="font-bold text-rose-400 text-xs">{match.team2?.name || match.team2Id || '-'}</TableCell>
                      <TableCell className="text-xs"><Badge>{match.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {matchesList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-xs text-muted-foreground">
                        No matches scheduled yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
