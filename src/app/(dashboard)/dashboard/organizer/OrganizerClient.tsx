'use client';

import * as React from 'react';
import Link from 'next/link';
import { MOCK_TOURNAMENTS, MOCK_MATCHES, MOCK_SCORE_REPORTS, MOCK_TEAMS, MOCK_USERS } from '@/lib/mock-data';
import { createEdition, addOrUpdateEditionTeam, updateEdition, updateTeamRosterAndCaptain } from '@/lib/actions/tournamentActions';
import { verifyScoreReport } from '@/lib/actions/matchActions';
import { finalizeEditionRankings } from '@/lib/actions/rankingActions';
import { generateUserCredentials, resetUserPin } from '@/lib/actions/userActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Shield, Trophy, AlertTriangle, Plus, Users, Crown, Check, X, KeyRound, Copy, CheckCircle2, UserPlus, Layers, Edit3, UserCheck } from 'lucide-react';

export default function OrganizerClient({ initialEditions, initialScoreReports, initialUsersList, initialTeams }: { initialEditions: any[], initialScoreReports: any[], initialUsersList: any[], initialTeams: any[] }) {
  const [editions, setEditions] = React.useState<any[]>(initialEditions);
  const [scoreReports, setScoreReports] = React.useState(initialScoreReports);
  const [usersList, setUsersList] = React.useState(initialUsersList);
  const [teamsList, setTeamsList] = React.useState<any[]>(initialTeams);

  // Edition Control Scope State
  const [selectedEditionId, setSelectedEditionId] = React.useState<string>(
    initialEditions[0]?.id || ''
  );

  // Modals
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [genCredentialsModalOpen, setGenCredentialsModalOpen] = React.useState(false);
  const [resetPinModalOpen, setResetPinModalOpen] = React.useState(false);
  const [addTeamModalOpen, setAddTeamModalOpen] = React.useState(false);
  const [editTeamModalOpen, setEditTeamModalOpen] = React.useState(false);

  // Theme Team State
  const [newTeamName, setNewTeamName] = React.useState('');
  const [newTeamTag, setNewTeamTag] = React.useState('');
  const [newTeamPlayerIds, setNewTeamPlayerIds] = React.useState<string[]>([]);
  const [newTeamCaptainId, setNewTeamCaptainId] = React.useState('');

  // Edit Team & Roster State
  const [editingTeamId, setEditingTeamId] = React.useState('');
  const [editTeamName, setEditTeamName] = React.useState('');
  const [editTeamTag, setEditTeamTag] = React.useState('');
  const [editCaptainId, setEditCaptainId] = React.useState('');
  const [selectedPlayerIds, setSelectedPlayerIds] = React.useState<string[]>([]);

  // Map players already assigned to teams in the selected edition
  const assignedTeamMap = React.useMemo(() => {
    const map: Record<string, { teamId: string; teamName: string }> = {};
    teamsList.forEach((team) => {
      if (team.editionId === selectedEditionId) {
        if (team.captainId) {
          map[team.captainId] = { teamId: team.id, teamName: team.name };
        }
        if (team.members && Array.isArray(team.members)) {
          team.members.forEach((m: any) => {
            const uId = m.userId || m.id;
            if (uId) {
              map[uId] = { teamId: team.id, teamName: team.name };
            }
          });
        }
      }
    });
    return map;
  }, [teamsList, selectedEditionId]);

  // Rule 2: Automatically restrict Captain selection to added roster players
  React.useEffect(() => {
    if (selectedPlayerIds.length > 0) {
      if (!selectedPlayerIds.includes(editCaptainId)) {
        setEditCaptainId(selectedPlayerIds[0]);
      }
    } else {
      setEditCaptainId('');
    }
  }, [selectedPlayerIds]);

  React.useEffect(() => {
    if (newTeamPlayerIds.length > 0) {
      if (!newTeamPlayerIds.includes(newTeamCaptainId)) {
        setNewTeamCaptainId(newTeamPlayerIds[0]);
      }
    } else {
      setNewTeamCaptainId('');
    }
  }, [newTeamPlayerIds]);

  // Credential Generator State
  const [genName, setGenName] = React.useState('');
  const [genRole, setGenRole] = React.useState<'PLAYER' | 'CAPTAIN' | 'ORGANIZER'>('PLAYER');
  const [createdCreds, setCreatedCreds] = React.useState<{ username: string; pin: string; name: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  // PIN Reset State
  const [targetUsername, setTargetUsername] = React.useState('');
  const [newPin, setNewPin] = React.useState('');
  const [resetStatus, setResetStatus] = React.useState('');

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Multi-Format Round & Custom Rules State
  const [roundCount, setRoundCount] = React.useState<number>(4);
  const [roundFormats, setRoundFormats] = React.useState<string[]>([
    'SINGLES', // Round 1
    'DOUBLES', // Round 2
    'TRIPLES', // Round 3
    'SINGLES', // Round 4
  ]);
  const [roundRules, setRoundRules] = React.useState<string[]>([
    'Standard Singles match (Direct pockets only)',
    'Doubles partner alternate shots (Queen cover mandatory)',
    'Triples 3-player rotation (Penalty -1 on foul)',
    'Grand final singles rules (Best of 3 boards)',
  ]);

  const handleRoundCountChange = (count: number) => {
    setRoundCount(count);
    const updatedFormats = [...roundFormats];
    const updatedRules = [...roundRules];
    const defaultCycle = ['SINGLES', 'DOUBLES', 'TRIPLES', 'SINGLES', 'DOUBLES', 'TRIPLES'];
    if (count > updatedFormats.length) {
      while (updatedFormats.length < count) {
        const nextIdx = updatedFormats.length;
        updatedFormats.push(defaultCycle[nextIdx % defaultCycle.length]);
        updatedRules.push(`Round ${nextIdx + 1} specific match rules`);
      }
    } else {
      updatedFormats.length = count;
      updatedRules.length = count;
    }
    setRoundFormats(updatedFormats);
    setRoundRules(updatedRules);
  };

  const selectedEdition = editions.find((e) => e.id === selectedEditionId) || editions[0];
  const selectedEditionTeams = teamsList.filter((t) => t.editionId === selectedEditionId || (!t.editionId && selectedEditionId === editions[0]?.id));

  const activeEditions = editions.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'REGISTRATION_OPEN');
  const pendingReports = scoreReports.filter((r) => r.status === 'PENDING');

  const handleAddTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setIsSubmitting(true);
    const res = await addOrUpdateEditionTeam({
      editionId: selectedEditionId || editions[0]?.id,
      name: newTeamName.trim(),
      tag: newTeamTag.trim() || newTeamName.substring(0, 3).toUpperCase(),
      captainId: newTeamCaptainId,
      playerUserIds: newTeamPlayerIds,
    });
    if (res.success && res.team) {
      setTeamsList([res.team, ...teamsList]);
      setAddTeamModalOpen(false);
      setNewTeamName('');
      setNewTeamTag('');
      setNewTeamPlayerIds([]);
    }
    setIsSubmitting(false);
  };

  const handleOpenEditTeamModal = (team: any) => {
    setEditingTeamId(team.id);
    setEditTeamName(team.name || '');
    setEditTeamTag(team.tag || '');
    setEditCaptainId(team.captainId || usersList.find(u => u.role === 'CAPTAIN')?.id || usersList[0]?.id || '');
    const currentMemberUserIds = team.members ? team.members.map((m: any) => m.userId) : [];
    setSelectedPlayerIds(currentMemberUserIds);
    setEditTeamModalOpen(true);
  };

  const handleSaveEditTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeamId || !editTeamName.trim()) return;
    setIsSubmitting(true);
    const res = await updateTeamRosterAndCaptain({
      teamId: editingTeamId,
      name: editTeamName.trim(),
      tag: editTeamTag.trim() || editTeamName.substring(0, 3).toUpperCase(),
      captainId: editCaptainId,
      playerUserIds: selectedPlayerIds,
    });
    if (res.success && res.team) {
      setTeamsList(teamsList.map((t) => (t.id === res.team.id ? { ...t, ...res.team } : t)));
      setEditTeamModalOpen(false);
    }
    setIsSubmitting(false);
  };

  const handleCreateEdition = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.append('roundFormats', JSON.stringify(roundFormats));
    formData.append('roundRules', JSON.stringify(roundRules));
    const res = await createEdition(formData, 'usr_organizer_1');
    if (res.success && res.edition) {
      setEditions([res.edition, ...editions]);
      setCreateModalOpen(false);
    }
    setIsSubmitting(false);
  };

  const handleEditEditionSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEditionId) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.append('roundFormats', JSON.stringify(roundFormats));
    formData.append('roundRules', JSON.stringify(roundRules));
    const res = await updateEdition(selectedEditionId, formData);
    if (res.success && res.edition) {
      setEditions(editions.map((ed) => (ed.id === res.edition.id ? res.edition : ed)));
      setEditModalOpen(false);
    }
    setIsSubmitting(false);
  };

  const handleGenerateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await generateUserCredentials({ name: genName, role: genRole });
    if (res.success && res.credentials) {
      setCreatedCreds(res.credentials);
    }
    setIsSubmitting(false);
  };

  const handleResetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await resetUserPin(targetUsername, newPin);
    if (res.success) {
      setResetStatus(res.message || 'PIN updated');
      setTimeout(() => {
        setResetPinModalOpen(false);
        setResetStatus('');
      }, 1500);
    }
  };

  const handleVerifyReport = async (reportId: string, action: 'APPROVE' | 'REJECT') => {
    const res = await verifyScoreReport(reportId, action);
    if (res.success) {
      setScoreReports(
        scoreReports.map((r) => (r.id === reportId ? { ...r, status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' } : r))
      );
    }
  };

  const handleFinalizeEdition = async () => {
    if (activeEditions.length === 0) {
      alert("No active editions to finalize.");
      return;
    }
    if (!confirm("Are you sure you want to finalize the active edition? This will calculate final standings, update player ELO ratings, and close the tournament.")) return;

    setIsSubmitting(true);
    const res = await finalizeEditionRankings(activeEditions[0].id);
    if (res.success) {
      alert("Edition finalized successfully! All rankings and player stats have been processed.");
      setEditions(editions.map(e => e.id === activeEditions[0].id ? { ...e, status: 'COMPLETED' } : e));
    } else {
      alert("Failed to finalize edition: " + (res.error || "Unknown error"));
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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="carrom" className="font-bold">
              <Shield className="h-3.5 w-3.5 mr-1" /> Organizer Control Panel
            </Badge>
          </div>
          <h1 className="text-3xl font-black">Tournament Director Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Manage CBOT cups, generate player credentials, reset PINs, and audit match score reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setGenCredentialsModalOpen(true)} className="font-bold text-xs border-amber-500/40 text-amber-500">
            <UserPlus className="h-4 w-4 mr-1.5" /> Generate User & PIN
          </Button>
          <Button variant="carrom" onClick={() => setCreateModalOpen(true)} className="font-bold text-xs">
            <Plus className="h-4 w-4 mr-1.5" /> Create New Tournament
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleFinalizeEdition} 
            disabled={isSubmitting || activeEditions.length === 0} 
            className="font-bold text-xs ml-2"
          >
            <Trophy className="h-4 w-4 mr-1.5" /> Finalize Active Edition
          </Button>
        </div>
      </div>

      {/* Edition-Wise Control Selector Banner */}
      <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="carrom" className="text-xs font-black uppercase tracking-wider">
              <Trophy className="h-3.5 w-3.5 mr-1" /> Edition Control Scope
            </Badge>
            <Badge variant={selectedEdition?.status === 'IN_PROGRESS' ? 'warning' : 'success'}>
              {selectedEdition?.status || 'ACTIVE'}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-amber-500">
              {selectedEdition?.title || `Edition #${selectedEdition?.number}`}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(true)}
              className="h-7 text-xs font-extrabold border-amber-500/40 text-amber-500 hover:bg-amber-500/20"
            >
              <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit Edition
            </Button>
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            <strong className="text-foreground">Theme:</strong> {selectedEdition?.theme || selectedEdition?.themeDescription || 'Standard Carrom Theme'}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-full sm:w-72">
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Switch View Edition</label>
            <Select
              value={selectedEditionId}
              onChange={(e: any) => setSelectedEditionId(e.target.value)}
              className="text-xs font-bold bg-background h-10 border-amber-500/40"
            >
              {editions.map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.title || ed.name} ({ed.theme || 'Theme'})
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <Card className="p-5 border-amber-500/30 bg-amber-500/5">
          <div className="text-xs font-bold text-amber-500 uppercase">Active Edition</div>
          <div className="text-xl font-black text-foreground mt-1 truncate">{selectedEdition?.title || 'Edition'}</div>
        </Card>

        <Card className="p-5 border-emerald-500/30 bg-emerald-500/5">
          <div className="text-xs font-bold text-emerald-500 uppercase">Theme Teams (In Edition)</div>
          <div className="text-3xl font-black text-foreground mt-1">{selectedEditionTeams.length}</div>
        </Card>

        <Card className="p-5 border-pink-500/30 bg-pink-500/5">
          <div className="text-xs font-bold text-pink-500 uppercase">Pending Score Audits</div>
          <div className="text-3xl font-black text-pink-500 mt-1">{pendingReports.length}</div>
        </Card>

        <Card className="p-5 border-blue-500/30 bg-blue-500/5">
          <div className="text-xs font-bold text-blue-500 uppercase">Registered Users</div>
          <div className="text-3xl font-black text-foreground mt-1">{usersList.length}</div>
        </Card>
      </div>

      {/* Organizer Theme-Based Teams Registry for Selected Edition */}
      <Card className="border-amber-500/40">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border pb-4 gap-2">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" /> Theme Teams for {selectedEdition?.title || selectedEdition?.name || 'Selected Edition'}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Organizers decide team names according to Edition Theme: <strong className="text-amber-400">"{selectedEdition?.theme || 'Standard Theme'}"</strong>
            </p>
          </div>
          <Button variant="carrom" size="sm" onClick={() => setAddTeamModalOpen(true)} className="text-xs font-bold">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Theme Team
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Theme Team Name</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Assigned Captain</TableHead>
                <TableHead>Roster Players</TableHead>
                <TableHead>Edition Theme</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedEditionTeams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-bold text-xs flex items-center gap-2">
                    <span className="h-7 w-7 rounded-full bg-amber-500/20 text-amber-500 font-black text-xs flex items-center justify-center border border-amber-500/30">
                      {team.tag || 'CB'}
                    </span>
                    {team.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-amber-500 font-bold">{team.tag || 'CB'}</TableCell>
                  <TableCell className="text-xs font-semibold text-foreground">
                    {team.captain?.name || usersList.find(u => u.id === team.captainId)?.name || 'Assigned Captain'}
                  </TableCell>
                  <TableCell className="text-xs font-medium text-muted-foreground">
                    <span className="font-bold text-amber-400">{team.members ? team.members.length : 0} Players</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-medium">
                    {selectedEdition?.theme || 'Edition Theme'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="success">THEME DECIDED</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEditTeamModal(team)}
                      className="h-7 text-xs font-bold border-amber-500/40 text-amber-500 hover:bg-amber-500/20"
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit Team
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {selectedEditionTeams.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs font-medium">
                    No theme teams defined for {selectedEdition?.title || selectedEdition?.name || 'this edition'} yet. Click <strong className="text-amber-400">"+ Add Theme Team"</strong> to set team names matching the theme <em>"{selectedEdition?.theme}"</em>.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Credentials & PIN Management Table */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" /> User Credentials & 4-Digit PIN Registry
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              View unique usernames, active PINs, and reset player credentials.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setGenCredentialsModalOpen(true)} className="text-xs font-bold">
            + Generate Credentials
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competitor Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>4-Digit PIN</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersList.map((usr) => (
                <TableRow key={usr.id}>
                  <TableCell className="font-bold text-xs">{usr.name}</TableCell>
                  <TableCell className="font-mono text-xs text-amber-500 font-bold">{usr.username}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{usr.role}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold">
                    {usr.pin || '••••'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={usr.isActivated ? 'success' : 'warning'}>
                      {usr.isActivated ? 'ACTIVATED' : 'PENDING ACTIVATION'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setTargetUsername(usr.username);
                        setResetPinModalOpen(true);
                      }}
                      className="h-7 text-xs text-amber-500 hover:bg-amber-500/10 font-bold"
                    >
                      Reset PIN
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Score Verification Queue */}
      <Card className="border-amber-500/40">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Pending Match Score Audit Queue
            </CardTitle>
          </div>
          <Badge variant="warning">{pendingReports.length} Pending</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Submitted By</TableHead>
                <TableHead>Match ID</TableHead>
                <TableHead>Reported Score</TableHead>
                <TableHead>Queens</TableHead>
                <TableHead>Proof / Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scoreReports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-semibold text-xs">
                    {report.submittedBy?.name || 'Captain'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{report.matchId}</TableCell>
                  <TableCell className="font-mono font-bold text-amber-500">
                    {report.team1Score} - {report.team2Score}
                  </TableCell>
                  <TableCell className="text-pink-500 font-bold text-xs">
                    <Crown className="h-3 w-3 inline mr-1" />
                    {report.queenStrikes1 + report.queenStrikes2}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {report.proofNotes}
                  </TableCell>
                  <TableCell>
                    {report.status === 'PENDING' ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleVerifyReport(report.id, 'APPROVE')}
                          className="h-8 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-xs font-bold"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleVerifyReport(report.id, 'REJECT')}
                          className="h-8 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-xs font-bold"
                        >
                          <X className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <Badge variant={report.status === 'APPROVED' ? 'success' : 'destructive'}>
                        {report.status}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Generate Credentials Modal */}
      <Dialog open={genCredentialsModalOpen} onOpenChange={setGenCredentialsModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-500" /> Generate Unique Username & 4-Digit PIN
          </DialogTitle>
          <DialogDescription>
            Create new player or captain credentials for CBOT online tournaments.
          </DialogDescription>
        </DialogHeader>

        {createdCreds ? (
          <div className="p-6 space-y-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
            <CheckCircle2 className="h-10 w-10 text-amber-500 mx-auto" />
            <h3 className="font-bold text-base">Credentials Generated for {createdCreds.name}!</h3>
            <div className="p-4 rounded-xl bg-card border font-mono text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unique Username:</span>
                <span className="font-black text-amber-500">{createdCreds.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Generated 4-Digit PIN:</span>
                <span className="font-black text-emerald-500 text-base">{createdCreds.pin}</span>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <Button variant="carrom" onClick={copyCredentials} className="text-xs font-bold">
                <Copy className="h-3.5 w-3.5 mr-1" /> {copied ? 'Copied to Clipboard!' : 'Copy Username & PIN'}
              </Button>
              <Button variant="outline" onClick={() => setCreatedCreds(null)}>
                Generate Another
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleGenerateCredentials} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold block mb-1">Full Name</label>
              <Input value={genName} onChange={(e) => setGenName(e.target.value)} required placeholder="e.g. Ramesh V" />
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">Assigned Role</label>
              <Select value={genRole} onChange={(e: any) => setGenRole(e.target.value)}>
                <option value="PLAYER">Player (Competitor)</option>
                <option value="CAPTAIN">Captain (Team Manager)</option>
                <option value="ORGANIZER">Co-Organizer</option>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setGenCredentialsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="carrom" disabled={isSubmitting}>
                {isSubmitting ? 'Generating...' : 'Generate Username & PIN'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Reset PIN Modal */}
      <Dialog open={resetPinModalOpen} onOpenChange={setResetPinModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-500" /> Reset Player 4-Digit PIN
          </DialogTitle>
          <DialogDescription>
            Assign a new 4-digit PIN for {targetUsername}.
          </DialogDescription>
        </DialogHeader>

        {resetStatus ? (
          <div className="p-4 text-center text-xs text-emerald-500 font-bold bg-emerald-500/10 rounded-xl">
            {resetStatus}
          </div>
        ) : (
          <form onSubmit={handleResetPinSubmit} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold block mb-1">Target Username</label>
              <Input value={targetUsername} readOnly className="font-mono bg-muted" />
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">New 4-Digit PIN</label>
              <Input
                type="password"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 7777"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setResetPinModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="carrom">
                Update 4-Digit PIN
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Create Tournament Dialog */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" /> Create New CBOT Tournament
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreateEdition} className="space-y-4 py-2">
          <div>
            <label className="text-xs font-bold block mb-1">Edition Title</label>
            <Input name="title" required placeholder="e.g. CBOT Edition #206" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold block mb-1">Edition Theme</label>
              <Input name="theme" defaultValue="CBOT Championship Theme" placeholder="e.g. Balu Master Special / Weekend Blitz" />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Max Teams</label>
              <Input name="maxTeams" type="number" defaultValue="16" min="4" max="64" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold block mb-1">Prize Pool</label>
              <Input name="prizePool" defaultValue="₹1,00,000 INR" />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Number of Rounds</label>
              <Select value={roundCount.toString()} onChange={(e: any) => handleRoundCountChange(parseInt(e.target.value, 10))}>
                <option value="3">3 Rounds</option>
                <option value="4">4 Rounds</option>
                <option value="5">5 Rounds</option>
                <option value="6">6 Rounds</option>
              </Select>
            </div>
          </div>

          {/* Multi-Format Round & Rules Breakdown */}
          <div className="space-y-4 p-4 bg-muted/40 rounded-2xl border border-amber-500/25">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="space-y-0.5">
                <label className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-amber-400" /> Per-Round Directives & Match Rules
                </label>
                <p className="text-[11px] text-muted-foreground font-medium">Configure format and dedicated rule list for every tournament round.</p>
              </div>
              <Badge variant="carrom" className="text-[10px] font-extrabold px-2.5 py-0.5 uppercase tracking-wider">
                {roundCount} Rounds Configured
              </Badge>
            </div>

            <div className="space-y-3 pt-1">
              {roundFormats.map((format, idx) => (
                <div key={idx} className="bg-card p-4 rounded-xl border border-border/80 shadow-md space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                    <span className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                      👑 Round {idx + 1} Configuration
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Stage {idx + 1}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-1">
                      <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                        Match Format
                      </label>
                      <Select
                        value={format}
                        onChange={(e: any) => {
                          const copy = [...roundFormats];
                          copy[idx] = e.target.value;
                          setRoundFormats(copy);
                        }}
                        className="text-xs h-9 font-bold bg-background"
                      >
                        <option value="SINGLES">Singles (1v1)</option>
                        <option value="DOUBLES">Doubles (2v2)</option>
                        <option value="TRIPLES">Triples (3v3)</option>
                        <option value="QUADRUPLES">Quadruples (4v4)</option>
                      </Select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                        Round Rule List / Directives
                      </label>
                      <Input
                        value={roundRules[idx] || ''}
                        onChange={(e) => {
                          const copy = [...roundRules];
                          copy[idx] = e.target.value;
                          setRoundRules(copy);
                        }}
                        placeholder={`e.g. Round ${idx + 1} specific rules, foul penalties, board targets...`}
                        className="text-xs h-9 font-medium bg-background border-border/80 focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold block mb-1">Description</label>
            <Input name="description" required placeholder="Brief description of tournament stakes..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="carrom" disabled={isSubmitting}>
              {isSubmitting ? 'Publishing...' : 'Publish Tournament'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Tournament Edition Dialog */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-amber-500" /> Edit Edition: {selectedEdition?.title || selectedEdition?.name || 'Selected Edition'}
          </DialogTitle>
          <DialogDescription>
            Update edition title, theme, prize pool, team limits, and per-round directives.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleEditEditionSubmit} className="space-y-4 py-2">
          <div>
            <label className="text-xs font-bold block mb-1">Edition Title</label>
            <Input name="title" defaultValue={selectedEdition?.title || selectedEdition?.name || ''} required placeholder="e.g. CBOT Edition #205" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold block mb-1">Edition Theme</label>
              <Input name="theme" defaultValue={selectedEdition?.theme || 'CBOT Championship Theme'} placeholder="e.g. Balu Master Special / Weekend Blitz" />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Max Teams</label>
              <Input name="maxTeams" type="number" defaultValue={selectedEdition?.maxTeams || 16} min="4" max="64" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold block mb-1">Prize Pool</label>
              <Input name="prizePool" defaultValue={selectedEdition?.prizePool || '₹1,00,000 INR'} />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Number of Rounds</label>
              <Select value={roundCount.toString()} onChange={(e: any) => handleRoundCountChange(parseInt(e.target.value, 10))}>
                <option value="3">3 Rounds</option>
                <option value="4">4 Rounds</option>
                <option value="5">5 Rounds</option>
                <option value="6">6 Rounds</option>
              </Select>
            </div>
          </div>

          {/* Multi-Format Round & Rules Breakdown */}
          <div className="space-y-4 p-4 bg-muted/40 rounded-2xl border border-amber-500/25">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="space-y-0.5">
                <label className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-amber-400" /> Per-Round Directives & Match Rules
                </label>
                <p className="text-[11px] text-muted-foreground font-medium">Configure format and dedicated rule list for every tournament round.</p>
              </div>
              <Badge variant="carrom" className="text-[10px] font-extrabold px-2.5 py-0.5 uppercase tracking-wider">
                {roundCount} Rounds Configured
              </Badge>
            </div>

            <div className="space-y-3 pt-1">
              {roundFormats.map((format, idx) => (
                <div key={idx} className="bg-card p-4 rounded-xl border border-border/80 shadow-md space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                    <span className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                      👑 Round {idx + 1} Configuration
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Stage {idx + 1}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-1">
                      <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                        Match Format
                      </label>
                      <Select
                        value={format}
                        onChange={(e: any) => {
                          const copy = [...roundFormats];
                          copy[idx] = e.target.value;
                          setRoundFormats(copy);
                        }}
                        className="text-xs h-9 font-bold bg-background"
                      >
                        <option value="SINGLES">Singles (1v1)</option>
                        <option value="DOUBLES">Doubles (2v2)</option>
                        <option value="TRIPLES">Triples (3v3)</option>
                        <option value="QUADRUPLES">Quadruples (4v4)</option>
                      </Select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                        Round Rule List / Directives
                      </label>
                      <Input
                        value={roundRules[idx] || ''}
                        onChange={(e) => {
                          const copy = [...roundRules];
                          copy[idx] = e.target.value;
                          setRoundRules(copy);
                        }}
                        placeholder={`e.g. Round ${idx + 1} specific rules, foul penalties, board targets...`}
                        className="text-xs h-9 font-medium bg-background border-border/80 focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold block mb-1">Description</label>
            <Input name="description" defaultValue={selectedEdition?.themeDescription || ''} placeholder="Brief description of tournament stakes..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="carrom" disabled={isSubmitting}>
              {isSubmitting ? 'Saving Changes...' : 'Save Edition Changes'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add Theme-Based Team Modal */}
      <Dialog open={addTeamModalOpen} onOpenChange={setAddTeamModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-500" /> Create Theme-Based Team
          </DialogTitle>
          <DialogDescription>
            Decide team name for <strong className="text-amber-500">{selectedEdition?.title || selectedEdition?.name || 'Selected Edition'}</strong> matching theme <strong>"{selectedEdition?.theme || 'Standard Theme'}"</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAddTeamSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold block mb-1">Edition Theme</label>
              <Input value={selectedEdition?.theme || 'Standard Theme'} disabled className="bg-muted text-muted-foreground font-semibold" />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Team Tag (3-4 Letters)</label>
              <Input
                value={newTeamTag}
                onChange={(e) => setNewTeamTag(e.target.value.toUpperCase())}
                placeholder="e.g. AVN / STR"
                maxLength={5}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold block mb-1">Theme Team Name</label>
            <Input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              required
              placeholder="e.g. Avenger Strikers / Striker Kings / Queen Chargers"
            />
          </div>

          {/* Step 1: Select Registered Players for Team Roster */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-amber-400" /> 1. Select Registered Players for Team Roster
              </label>
              <Badge variant="carrom" className="text-[10px] font-extrabold px-2.5 py-0.5">
                {newTeamPlayerIds.length} Players Selected
              </Badge>
            </div>
            <div className="border border-amber-500/30 rounded-xl p-3 max-h-48 overflow-y-auto bg-muted/30 space-y-1.5">
              {usersList.map((usr) => {
                const isSelected = newTeamPlayerIds.includes(usr.id);
                const assignedToOtherTeam = !!assignedTeamMap[usr.id];
                const otherTeamName = assignedToOtherTeam ? assignedTeamMap[usr.id].teamName : '';

                return (
                  <label
                    key={usr.id}
                    className={`flex items-center justify-between p-2 rounded-lg transition-colors text-xs ${
                      assignedToOtherTeam
                        ? 'opacity-40 cursor-not-allowed bg-muted/20 border border-transparent'
                        : isSelected
                        ? 'bg-amber-500/15 border border-amber-500/40 font-bold cursor-pointer'
                        : 'hover:bg-muted/60 border border-transparent cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        disabled={assignedToOtherTeam}
                        checked={isSelected}
                        onChange={(e) => {
                          if (assignedToOtherTeam) return;
                          if (e.target.checked) {
                            setNewTeamPlayerIds([...newTeamPlayerIds, usr.id]);
                          } else {
                            setNewTeamPlayerIds(newTeamPlayerIds.filter((id) => id !== usr.id));
                          }
                        }}
                        className="accent-amber-500 h-4 w-4 rounded cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="text-foreground font-semibold">{usr.name}</span>
                      <span className="text-muted-foreground font-mono text-[11px]">(@{usr.username})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {assignedToOtherTeam && (
                        <Badge variant="outline" className="text-[9px] text-amber-500/70 border-amber-500/30">
                          In {otherTeamName}
                        </Badge>
                      )}
                      <Badge variant={usr.role === 'CAPTAIN' ? 'warning' : 'outline'} className="text-[9px]">
                        {usr.role}
                      </Badge>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Step 2: Assign Team Captain (From Selected Roster) */}
          <div className="pt-1">
            <label className="text-xs font-black text-amber-500 flex items-center gap-1.5 mb-1">
              👑 2. Assign Team Captain (From Selected Roster)
            </label>
            <Select
              value={newTeamCaptainId}
              onChange={(e: any) => setNewTeamCaptainId(e.target.value)}
              disabled={newTeamPlayerIds.length === 0}
              className="border-amber-500/40 focus:border-amber-500 font-bold text-xs"
            >
              {newTeamPlayerIds.length === 0 ? (
                <option value="">Select team players above first...</option>
              ) : (
                usersList
                  .filter((usr) => newTeamPlayerIds.includes(usr.id))
                  .map((usr) => (
                    <option key={usr.id} value={usr.id}>
                      👑 {usr.name} (@{usr.username})
                    </option>
                  ))
              )}
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setAddTeamModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="carrom" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Confirm Theme Team'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Theme Team Roster Modal */}
      <Dialog open={editTeamModalOpen} onOpenChange={setEditTeamModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-amber-500" /> Edit Team Details & Roster
          </DialogTitle>
          <DialogDescription>
            Modify team name, tag, manage roster members, and assign team captain from selected roster.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSaveEditTeamSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold block mb-1">Theme Team Name</label>
              <Input
                value={editTeamName}
                onChange={(e) => setEditTeamName(e.target.value)}
                required
                placeholder="e.g. Avenger Strikers / Striker Kings"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Team Tag (3-4 Letters)</label>
              <Input
                value={editTeamTag}
                onChange={(e) => setEditTeamTag(e.target.value.toUpperCase())}
                placeholder="e.g. AVN / STR"
                maxLength={5}
              />
            </div>
          </div>

          {/* Step 1: Add Multiple Registered Players Roster Selector */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-amber-400" /> 1. Select Registered Players for Team Roster
              </label>
              <Badge variant="carrom" className="text-[10px] font-extrabold px-2.5 py-0.5">
                {selectedPlayerIds.length} Players Selected
              </Badge>
            </div>
            <div className="border border-amber-500/30 rounded-xl p-3 max-h-52 overflow-y-auto bg-muted/30 space-y-1.5">
              {usersList.map((usr) => {
                const isSelected = selectedPlayerIds.includes(usr.id);
                const assignedToOtherTeam = assignedTeamMap[usr.id] && assignedTeamMap[usr.id].teamId !== editingTeamId;
                const otherTeamName = assignedToOtherTeam ? assignedTeamMap[usr.id].teamName : '';

                return (
                  <label
                    key={usr.id}
                    className={`flex items-center justify-between p-2 rounded-lg transition-colors text-xs ${
                      assignedToOtherTeam
                        ? 'opacity-40 cursor-not-allowed bg-muted/20 border border-transparent'
                        : isSelected
                        ? 'bg-amber-500/15 border border-amber-500/40 font-bold cursor-pointer'
                        : 'hover:bg-muted/60 border border-transparent cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        disabled={assignedToOtherTeam}
                        checked={isSelected}
                        onChange={(e) => {
                          if (assignedToOtherTeam) return;
                          if (e.target.checked) {
                            setSelectedPlayerIds([...selectedPlayerIds, usr.id]);
                          } else {
                            setSelectedPlayerIds(selectedPlayerIds.filter((id) => id !== usr.id));
                          }
                        }}
                        className="accent-amber-500 h-4 w-4 rounded cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="text-foreground font-semibold">{usr.name}</span>
                      <span className="text-muted-foreground font-mono text-[11px]">(@{usr.username})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {assignedToOtherTeam && (
                        <Badge variant="outline" className="text-[9px] text-amber-500/70 border-amber-500/30">
                          In {otherTeamName}
                        </Badge>
                      )}
                      <Badge variant={usr.role === 'CAPTAIN' ? 'warning' : 'outline'} className="text-[9px]">
                        {usr.role}
                      </Badge>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Step 2: Assign Team Captain (From Selected Roster) */}
          <div className="pt-1">
            <label className="text-xs font-black text-amber-500 flex items-center gap-1.5 mb-1">
              👑 2. Assign Team Captain (From Selected Roster)
            </label>
            <Select
              value={editCaptainId}
              onChange={(e: any) => setEditCaptainId(e.target.value)}
              disabled={selectedPlayerIds.length === 0}
              className="border-amber-500/40 focus:border-amber-500 font-bold text-xs"
            >
              {selectedPlayerIds.length === 0 ? (
                <option value="">Select team players above first...</option>
              ) : (
                usersList
                  .filter((usr) => selectedPlayerIds.includes(usr.id))
                  .map((usr) => (
                    <option key={usr.id} value={usr.id}>
                      👑 {usr.name} (@{usr.username})
                    </option>
                  ))
              )}
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditTeamModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="carrom" disabled={isSubmitting}>
              {isSubmitting ? 'Saving Team Roster...' : 'Save Team Changes'}
            </Button>
          </div>
        </form>
      </Dialog>

    </div>
  );
}
