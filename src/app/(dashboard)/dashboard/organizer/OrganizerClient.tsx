'use client';

import * as React from 'react';
import Link from 'next/link';
import { MOCK_TOURNAMENTS, MOCK_MATCHES, MOCK_SCORE_REPORTS, MOCK_TEAMS, MOCK_USERS } from '@/lib/mock-data';
import { createEdition, addOrUpdateEditionTeam, updateEdition, updateTeamRosterAndCaptain, deleteTeam } from '@/lib/actions/tournamentActions';
import { verifyScoreReport } from '@/lib/actions/matchActions';
import { finalizeEditionRankings } from '@/lib/actions/rankingActions';
import { generateUserCredentials, resetUserPin, updatePlayerProfileDetails, deletePlayer } from '@/lib/actions/userActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ImageUploader } from '@/components/ui/image-uploader';
import { Shield, Trophy, AlertTriangle, Plus, Users, Crown, Check, X, KeyRound, Copy, CheckCircle2, UserPlus, Layers, Edit3, UserCheck, Trash2, Calendar, Clock } from 'lucide-react';

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
  const [addTeamModalOpen, setAddTeamModalOpen] = React.useState(false);
  const [editTeamModalOpen, setEditTeamModalOpen] = React.useState(false);

  // Theme Team State
  const [newTeamName, setNewTeamName] = React.useState('');
  const [newTeamTag, setNewTeamTag] = React.useState('');
  const [newTeamLogo, setNewTeamLogo] = React.useState('');
  const [newTeamPlayerIds, setNewTeamPlayerIds] = React.useState<string[]>([]);
  const [newTeamCaptainId, setNewTeamCaptainId] = React.useState('');

  // Edit Team & Roster State
  const [editingTeamId, setEditingTeamId] = React.useState('');
  const [editTeamName, setEditTeamName] = React.useState('');
  const [editTeamTag, setEditTeamTag] = React.useState('');
  const [editCaptainId, setEditCaptainId] = React.useState('');
  const [selectedPlayerIds, setSelectedPlayerIds] = React.useState<string[]>([]);

  // Map players already assigned to teams in the selected edition (only if team actually has roster members)
  const assignedTeamMap = React.useMemo(() => {
    const map: Record<string, { teamId: string; teamName: string }> = {};
    teamsList.forEach((team) => {
      if (team.members && Array.isArray(team.members) && team.members.length > 0) {
        team.members.forEach((m: any) => {
          const uId = m.userId || (m.user && m.user.id) || m.id;
          if (uId) {
            map[uId] = { teamId: team.id, teamName: team.name };
          }
        });
        if (team.captainId) {
          map[team.captainId] = { teamId: team.id, teamName: team.name };
        }
      }
    });
    return map;
  }, [teamsList]);

  // Sort roster selector checklist: Checked/Selected players first on TOP, then unassigned, then assigned
  const sortedUsersForNewTeam = React.useMemo(() => {
    return [...usersList].sort((a, b) => {
      const aSelected = newTeamPlayerIds.includes(a.id);
      const bSelected = newTeamPlayerIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;

      const aAssigned = !!assignedTeamMap[a.id];
      const bAssigned = !!assignedTeamMap[b.id];
      if (!aAssigned && bAssigned) return -1;
      if (aAssigned && !bAssigned) return 1;

      return (a.name || '').localeCompare(b.name || '');
    });
  }, [usersList, newTeamPlayerIds, assignedTeamMap]);

  const sortedUsersForEditTeam = React.useMemo(() => {
    return [...usersList].sort((a, b) => {
      const aSelected = selectedPlayerIds.includes(a.id);
      const bSelected = selectedPlayerIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;

      const aAssigned = assignedTeamMap[a.id] && assignedTeamMap[a.id].teamId !== editingTeamId;
      const bAssigned = assignedTeamMap[b.id] && assignedTeamMap[b.id].teamId !== editingTeamId;
      if (!aAssigned && bAssigned) return -1;
      if (aAssigned && !bAssigned) return 1;

      return (a.name || '').localeCompare(b.name || '');
    });
  }, [usersList, selectedPlayerIds, editingTeamId, assignedTeamMap]);

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
  // Credential Generator & Profile Edit State
  const [userSearchQuery, setUserSearchQuery] = React.useState('');
  const [rosterSearchQuery, setRosterSearchQuery] = React.useState('');
  const [genName, setGenName] = React.useState('');
  const [genUsername, setGenUsername] = React.useState('');
  const [genRole, setGenRole] = React.useState<'PLAYER' | 'CAPTAIN' | 'ORGANIZER'>('PLAYER');
  const [genAverage, setGenAverage] = React.useState('');
  const [genTarget, setGenTarget] = React.useState('');
  const [genWhatsApp, setGenWhatsApp] = React.useState('');
  const [genEmail, setGenEmail] = React.useState('');
  const [genAge, setGenAge] = React.useState('');
  const [genGender, setGenGender] = React.useState('Male');
  const [createdCreds, setCreatedCreds] = React.useState<{ username: string; pin: string; name: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Edit User Profile State
  const [editUserModalOpen, setEditUserModalOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<any>(null);
  const [editUserName, setEditUserName] = React.useState('');
  const [editUserUsername, setEditUserUsername] = React.useState('');
  const [editUserAverage, setEditUserAverage] = React.useState('');
  const [editUserTarget, setEditUserTarget] = React.useState('');
  const [editUserWhatsApp, setEditUserWhatsApp] = React.useState('');
  const [editUserEmail, setEditUserEmail] = React.useState('');
  const [editUserAge, setEditUserAge] = React.useState('');
  const [editUserGender, setEditUserGender] = React.useState('Male');

  // PIN Reset State
  const [resetPinModalOpen, setResetPinModalOpen] = React.useState(false);
  const [targetUser, setTargetUser] = React.useState<any>(null);
  const [targetUsername, setTargetUsername] = React.useState('');
  const [newPin, setNewPin] = React.useState('');
  const [resetStatus, setResetStatus] = React.useState('');
  const [resetCredsResult, setResetCredsResult] = React.useState<{ name: string; username: string; pin: string } | null>(null);
  const [copiedResetCreds, setCopiedResetCreds] = React.useState(false);

  // Delete Player & Delete Team Confirmation State
  const [deletePlayerModalOpen, setDeletePlayerModalOpen] = React.useState(false);
  const [deletingUser, setDeletingUser] = React.useState<any>(null);
  const [deleteUserConfirmText, setDeleteUserConfirmText] = React.useState('');

  const [deleteTeamModalOpen, setDeleteTeamModalOpen] = React.useState(false);
  const [deletingTeam, setDeletingTeam] = React.useState<any>(null);
  const [deleteTeamConfirmText, setDeleteTeamConfirmText] = React.useState('');
  const [activePinMap, setActivePinMap] = React.useState<Record<string, string>>({
    balumaster: '9999',
    striker_vikram: '1234',
    queen_ananya: '5678',
    rajesh_cbot: '1111',
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Tournament Stage Schedule Dates & Round Robin Matrix State
  const [stageSchedule, setStageSchedule] = React.useState({
    roundRobin: '2026-08-12T10:00',
    qualifier1: '2026-08-14T14:00',
    qualifier2: '2026-08-15T14:00',
    finals: '2026-08-16T18:00',
  });
  const [activeModalTab, setActiveModalTab] = React.useState<'RULES' | 'SCHEDULE'>('SCHEDULE');
  const [scheduleViewMode, setScheduleViewMode] = React.useState<'STAGES' | 'FIXTURES'>('STAGES');
  const [generatedSchedule, setGeneratedSchedule] = React.useState<any[]>([]);

  // Function to generate standard Round Robin pairings for current edition teams (Online Event: Per-Day Date Selection & 9:30 PM IST Deadline)
  const handleGenerateRoundRobin = () => {
    if (selectedEditionTeams.length < 2) {
      alert('You need at least 2 teams created in this edition to generate a round-robin schedule.');
      return;
    }

    let list = [...selectedEditionTeams];
    const isOdd = list.length % 2 !== 0;
    if (isOdd) {
      list.push({ id: 'bye', name: 'BYE / REST' });
    }

    const numTeams = list.length;
    const numRounds = numTeams - 1;
    const matchesPerRound = numTeams / 2;
    const schedule = [];

    const baseDate = new Date(stageSchedule.roundRobin || Date.now());

    for (let r = 0; r < numRounds; r++) {
      const roundMatches = [];
      const roundDay = new Date(baseDate.getTime() + r * 24 * 60 * 60 * 1000);
      const dateStr = roundDay.toISOString().slice(0, 10);

      for (let i = 0; i < matchesPerRound; i++) {
        const home = list[i];
        const away = list[numTeams - 1 - i];

        if (home.id !== 'bye' && away.id !== 'bye') {
          roundMatches.push({
            id: `rr_r${r + 1}_m${i + 1}`,
            roundNumber: r + 1,
            homeTeam: home,
            awayTeam: away,
          });
        }
      }

      schedule.push({
        roundNumber: r + 1,
        roundTitle: `Day ${r + 1}`,
        roundDate: dateStr,
        deadlineTime: '21:30',
        matches: roundMatches,
      });

      list = [list[0], list[list.length - 1], ...list.slice(1, list.length - 1)];
    }

    setGeneratedSchedule(schedule);
    setScheduleViewMode('FIXTURES');
  };

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
      logo: newTeamLogo.trim() || undefined,
    });
    if (res.success && res.team) {
      setTeamsList([res.team, ...teamsList]);
      setAddTeamModalOpen(false);
      setNewTeamName('');
      setNewTeamTag('');
      setNewTeamLogo('');
      setNewTeamPlayerIds([]);
    }
    setIsSubmitting(false);
  };

  const [editTeamLogo, setEditTeamLogo] = React.useState('');

  const handleOpenEditTeamModal = (team: any) => {
    setEditingTeamId(team.id);
    setEditTeamName(team.name || '');
    setEditTeamTag(team.tag || '');
    setEditTeamLogo(team.logo || '');
    
    // Resolve members against usersList (handling m_ prefix cleanly)
    const currentMemberUserIds: string[] = [];
    if (team.members && Array.isArray(team.members)) {
      team.members.forEach((m: any) => {
        const rawId = m.userId || (typeof m.id === 'string' && m.id.startsWith('m_') ? m.id.replace(/^m_/, '') : m.id);
        const rawUsername = m.user?.username;
        const rawName = m.user?.name;

        const match = usersList.find(
          (u) =>
            u.id === rawId ||
            u.username?.toLowerCase() === String(rawId).toLowerCase() ||
            (rawUsername && u.username?.toLowerCase() === rawUsername.toLowerCase()) ||
            (rawName && u.name?.toLowerCase() === rawName.toLowerCase())
        );
        if (match && !currentMemberUserIds.includes(match.id)) {
          currentMemberUserIds.push(match.id);
        }
      });
    }

    // Resolve captain against usersList & ensure inclusion in roster
    let captId = '';
    if (team.captainId || team.captain) {
      const captUser = usersList.find(
        (u) =>
          u.id === team.captainId ||
          (team.captain?.id && u.id === team.captain.id) ||
          (team.captain?.username && u.username?.toLowerCase() === team.captain.username.toLowerCase()) ||
          (team.captain?.name && u.name?.toLowerCase() === team.captain.name.toLowerCase())
      );
      if (captUser) {
        captId = captUser.id;
        if (!currentMemberUserIds.includes(captUser.id)) {
          currentMemberUserIds.push(captUser.id);
        }
      }
    }

    setEditCaptainId(captId);
    setSelectedPlayerIds(currentMemberUserIds);
    setEditTeamModalOpen(true);
  };

  const handleSaveEditTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeamId || !editTeamName.trim()) return;
    setIsSubmitting(true);

    const updatedMembers = selectedPlayerIds.map((pId) => {
      const foundUser = usersList.find((u) => u.id === pId);
      return { id: `m_${pId}`, userId: pId, user: foundUser };
    });

    const updatedCaptain = usersList.find((u) => u.id === editCaptainId);

    // 1. Instantly update UI state
    setTeamsList((prev) =>
      prev.map((t) =>
        t.id === editingTeamId || t.name === editTeamName.trim()
          ? {
              ...t,
              name: editTeamName.trim(),
              tag: editTeamTag.trim() || editTeamName.substring(0, 3).toUpperCase(),
              logo: editTeamLogo.trim() || t.logo,
              captainId: editCaptainId,
              captain: updatedCaptain || t.captain,
              members: updatedMembers,
            }
          : t
      )
    );
    setEditTeamModalOpen(false);

    // 2. Persist to server backend
    const res = await updateTeamRosterAndCaptain({
      teamId: editingTeamId,
      name: editTeamName.trim(),
      tag: editTeamTag.trim() || editTeamName.substring(0, 3).toUpperCase(),
      captainId: editCaptainId,
      playerUserIds: selectedPlayerIds,
      logo: editTeamLogo.trim() || undefined,
    });

    if (res.team) {
      setTeamsList((prev) =>
        prev.map((t) => (t.id === editingTeamId || (res.team && t.name === res.team.name) ? { ...t, ...res.team } : t))
      );
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
    const parsedAvg = genAverage ? parseFloat(genAverage) : 0;
    const parsedTgt = genTarget ? parseInt(genTarget, 10) : 0;
    const parsedAge = genAge ? parseInt(genAge, 10) : undefined;

    const res = await generateUserCredentials({
      name: genName,
      username: genUsername.trim() || undefined,
      role: genRole,
      average: parsedAvg,
      target: parsedTgt,
      whatsApp: genWhatsApp.trim() || undefined,
      email: genEmail.trim() || undefined,
      age: parsedAge,
      gender: genGender || undefined,
    });
    if (res.success && res.credentials) {
      setCreatedCreds(res.credentials);
      if (res.credentials.user) {
        setUsersList([res.credentials.user, ...usersList]);
      }
    }
    setIsSubmitting(false);
  };

  const handleOpenEditUser = (usr: any) => {
    setEditingUser(usr);
    setEditUserName(usr.name || '');
    setEditUserUsername(usr.username || '');
    setEditUserAverage((usr.average ?? (usr.rating ? (usr.rating / 100).toFixed(2) : '12.00')).toString());
    setEditUserTarget((usr.target ?? Math.round((usr.rating || 1200) / 80)).toString());
    setEditUserWhatsApp(usr.whatsApp || '');
    setEditUserEmail(usr.email || '');
    setEditUserAge(usr.age ? usr.age.toString() : '');
    setEditUserGender(usr.gender || 'Male');
    setEditUserModalOpen(true);
  };

  const handleSaveEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editUserName.trim() || !editUserUsername.trim()) return;
    setIsSubmitting(true);
    const parsedAvg = parseFloat(editUserAverage) || 0;
    const parsedTgt = parseInt(editUserTarget, 10) || 0;
    const parsedAge = editUserAge ? parseInt(editUserAge, 10) : undefined;
    const updatedName = editUserName.trim();
    const updatedUsername = editUserUsername.trim().toLowerCase();

    // 1. Instantly update UI state
    setUsersList((prev) =>
      prev.map((u) =>
        u.id === editingUser.id || u.username.toLowerCase() === editingUser.username.toLowerCase()
          ? {
              ...u,
              name: updatedName,
              username: updatedUsername,
              average: parsedAvg,
              target: parsedTgt,
              whatsApp: editUserWhatsApp.trim() || undefined,
              email: editUserEmail.trim() || undefined,
              age: parsedAge,
              gender: editUserGender || undefined,
            }
          : u
      )
    );
    setEditUserModalOpen(false);

    // 2. Persist to server backend
    const res = await updatePlayerProfileDetails(editingUser.id, {
      name: updatedName,
      username: updatedUsername,
      average: parsedAvg,
      target: parsedTgt,
      whatsApp: editUserWhatsApp.trim() || undefined,
      email: editUserEmail.trim() || undefined,
      age: parsedAge,
      gender: editUserGender || undefined,
    });

    if (res.user) {
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === editingUser.id || u.username.toLowerCase() === updatedUsername
            ? { ...u, ...res.user }
            : u
        )
      );
    }
    setIsSubmitting(false);
  };

  const handleOpenResetPin = (usr: any) => {
    setTargetUser(usr);
    setTargetUsername(usr.username || '');
    setNewPin('');
    setResetStatus('');
    setResetCredsResult(null);
    setCopiedResetCreds(false);
    setResetPinModalOpen(true);
  };

  const handleOpenDeletePlayer = (usr: any) => {
    setDeletingUser(usr);
    setDeleteUserConfirmText('');
    setDeletePlayerModalOpen(true);
  };

  const handleConfirmDeletePlayer = async () => {
    if (!deletingUser) return;
    setIsSubmitting(true);

    // 1. Instantly update UI state
    setUsersList((prev) => prev.filter((u) => u.id !== deletingUser.id && u.username !== deletingUser.username));
    setDeletePlayerModalOpen(false);

    // 2. Persist to server backend
    await deletePlayer(deletingUser.id);
    setIsSubmitting(false);
  };

  const handleOpenDeleteTeam = (team: any) => {
    setDeletingTeam(team);
    setDeleteTeamConfirmText('');
    setDeleteTeamModalOpen(true);
  };

  const handleConfirmDeleteTeam = async () => {
    if (!deletingTeam) return;
    setIsSubmitting(true);

    // 1. Instantly update UI state
    setTeamsList((prev) => prev.filter((t) => t.id !== deletingTeam.id && t.name !== deletingTeam.name));
    setDeleteTeamModalOpen(false);

    // 2. Persist to server backend
    await deleteTeam(deletingTeam.id);
    setIsSubmitting(false);
  };

  const handleResetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername || !newPin) return;
    setIsSubmitting(true);
    const res = await resetUserPin(targetUsername, newPin);
    if (res.success) {
      const freshPin = newPin;
      setActivePinMap((prev) => ({ ...prev, [targetUsername.toLowerCase()]: freshPin }));
      setResetCredsResult({
        name: targetUser?.name || targetUsername,
        username: targetUsername,
        pin: freshPin,
      });
    }
    setIsSubmitting(false);
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
    const shareText = `🏆 CBOT Player Login Credentials\nPlayer: ${createdCreds.name}\nUsername: ${createdCreds.username}\n4-Digit PIN: ${createdCreds.pin}\nLogin URL: www.cbotworld.com/login`;
    navigator.clipboard.writeText(shareText);
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
          <Button variant="carrom" onClick={() => setCreateModalOpen(true)} className="font-bold text-xs">
            <Plus className="h-4 w-4 mr-1.5" /> Create New Tournament
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
                  {ed.title || ed.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-5 border-amber-500/30 bg-amber-500/5">
          <div className="text-xs font-bold text-amber-500 uppercase">Active Edition</div>
          <div className="text-xl font-black text-foreground mt-1 truncate">{selectedEdition?.title || 'Edition'}</div>
        </Card>

        <Card className="p-5 border-emerald-500/30 bg-emerald-500/5">
          <div className="text-xs font-bold text-emerald-500 uppercase">Theme Teams (In Edition)</div>
          <div className="text-3xl font-black text-foreground mt-1">{selectedEditionTeams.length}</div>
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
                  <TableCell className="font-bold text-xs flex items-center gap-2.5">
                    {team.logo ? (
                      <img src={team.logo} alt={team.name} className="h-8 w-8 rounded-full object-cover border border-amber-500/40 shadow-sm" />
                    ) : (
                      <span className="h-8 w-8 rounded-full bg-amber-500/20 text-amber-500 font-black text-xs flex items-center justify-center border border-amber-500/30">
                        {team.tag || 'CB'}
                      </span>
                    )}
                    <span>{team.name}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-amber-500 font-bold">{team.tag || 'CB'}</TableCell>
                  <TableCell className="text-xs font-semibold text-foreground">
                    {(() => {
                      const captainUser = usersList.find(
                        (u) =>
                          u.id === team.captainId ||
                          (team.captain?.id && u.id === team.captain.id) ||
                          (team.captain?.username && u.username?.toLowerCase() === team.captain.username?.toLowerCase()) ||
                          (team.captain?.name && u.name?.toLowerCase() === team.captain.name?.toLowerCase())
                      );

                      if (captainUser) {
                        return (
                          <span className="font-bold text-amber-400 flex items-center gap-1">
                            👑 {captainUser.name || captainUser.username}
                          </span>
                        );
                      }
                      return <span className="text-muted-foreground/60 italic text-[11px]">Unassigned</span>;
                    })()}
                  </TableCell>
                  <TableCell className="text-xs font-medium text-muted-foreground">
                    {(() => {
                      const count = team.members ? team.members.length : 0;
                      return <span className="font-bold text-amber-400">{count} Players</span>;
                    })()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-medium">
                    {selectedEdition?.theme || 'Edition Theme'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="success">THEME DECIDED</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEditTeamModal(team)}
                        className="h-7 text-xs font-bold border-amber-500/40 text-amber-500 hover:bg-amber-500/20"
                      >
                        <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit Team
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleOpenDeleteTeam(team)}
                        className="h-7 px-2 text-xs font-bold bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30"
                        title="Delete Team"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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

      {/* Tournament Stage Schedule & Date Selection Card */}
      <Card className="border-amber-500/40 bg-card">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border pb-4 gap-3">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-500" /> Tournament Stage Schedule & Date Manager
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set stage start dates and generate full Round-Robin match pairings for all <strong className="text-amber-400">{selectedEditionTeams.length} created teams</strong>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={scheduleViewMode === 'STAGES' ? 'carrom' : 'outline'}
              size="sm"
              onClick={() => setScheduleViewMode('STAGES')}
              className="text-xs font-bold"
            >
              📅 Stage Dates
            </Button>
            <Button
              variant={scheduleViewMode === 'FIXTURES' ? 'carrom' : 'outline'}
              size="sm"
              onClick={() => {
                if (generatedSchedule.length === 0) handleGenerateRoundRobin();
                else setScheduleViewMode('FIXTURES');
              }}
              className="text-xs font-bold"
            >
              📋 Full Round-Robin Fixtures {generatedSchedule.length > 0 ? `(${generatedSchedule.length} Rounds)` : ''}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateRoundRobin}
              className="text-xs font-bold border-amber-500/40 text-amber-400 hover:bg-amber-500/20"
            >
              ⚡ Auto-Generate Schedule
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {scheduleViewMode === 'STAGES' ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Round Robin */}
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      🏆 Round Robin
                    </span>
                    <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300 font-bold">Stage 1</Badge>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Scheduled Date & Time</label>
                    <Input
                      type="datetime-local"
                      value={stageSchedule.roundRobin}
                      onChange={(e) => setStageSchedule({ ...stageSchedule, roundRobin: e.target.value })}
                      className="text-xs font-mono font-bold bg-background border-amber-500/40 focus:border-amber-500"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">All teams compete in group matches</p>
                </div>

                {/* Qualifier 1 */}
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      ⚔️ Qualifier 1
                    </span>
                    <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-300 font-bold">Stage 2</Badge>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Scheduled Date & Time</label>
                    <Input
                      type="datetime-local"
                      value={stageSchedule.qualifier1}
                      onChange={(e) => setStageSchedule({ ...stageSchedule, qualifier1: e.target.value })}
                      className="text-xs font-mono font-bold bg-background border-blue-500/40 focus:border-blue-500"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">Top seed playoff match</p>
                </div>

                {/* Qualifier 2 */}
                <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                      🔥 Qualifier 2
                    </span>
                    <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-300 font-bold">Stage 3</Badge>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Scheduled Date & Time</label>
                    <Input
                      type="datetime-local"
                      value={stageSchedule.qualifier2}
                      onChange={(e) => setStageSchedule({ ...stageSchedule, qualifier2: e.target.value })}
                      className="text-xs font-mono font-bold bg-background border-purple-500/40 focus:border-purple-500"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">Eliminator winner vs Q1 runner-up</p>
                </div>

                {/* Grand Finals */}
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      👑 Grand Finals
                    </span>
                    <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-300 font-bold">Final Stage</Badge>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Scheduled Date & Time</label>
                    <Input
                      type="datetime-local"
                      value={stageSchedule.finals}
                      onChange={(e) => setStageSchedule({ ...stageSchedule, finals: e.target.value })}
                      className="text-xs font-mono font-bold bg-background border-emerald-500/40 focus:border-emerald-500"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">Championship Decider Match</p>
                </div>
              </div>

              <div className="flex justify-end mt-4 pt-4 border-t border-border gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateRoundRobin}
                  className="text-xs font-bold border-amber-500/40 text-amber-400"
                >
                  ⚡ Generate Full Round-Robin Schedule
                </Button>
                <Button
                  variant="carrom"
                  size="sm"
                  onClick={() => alert("Tournament stage dates updated and saved!")}
                  className="text-xs font-bold flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" /> Save Schedule Dates
                </Button>
              </div>
            </div>
          ) : (
            /* Full Round Robin Schedule Fixtures View (TournamentScheduler algorithm) */
            <div>
              {generatedSchedule.length === 0 ? (
                <div className="p-8 text-center space-y-3 bg-muted/20 rounded-2xl border border-dashed border-amber-500/30">
                  <Trophy className="h-10 w-10 text-amber-500 mx-auto opacity-80" />
                  <h3 className="font-bold text-base">No Round-Robin Fixtures Generated Yet</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Click below to generate an automatic Round-Robin tournament matrix for all <strong className="text-amber-400">{selectedEditionTeams.length} teams</strong> created in this edition.
                  </p>
                  <Button variant="carrom" onClick={handleGenerateRoundRobin} className="font-bold text-xs">
                    ⚡ Auto-Generate Full Round-Robin Schedule
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 gap-2">
                    <div className="text-xs font-bold">
                      Generated <strong className="text-amber-400">{generatedSchedule.length} Rounds</strong> & <strong className="text-amber-400">{generatedSchedule.reduce((acc, r) => acc + r.matches.length, 0)} Total Matches</strong> for {selectedEditionTeams.length} teams.
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => alert("Full Round-Robin schedule saved successfully!")}
                        className="text-xs font-bold border-amber-500/40 text-amber-400"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> Save Schedule Matrix
                      </Button>
                      <Button
                        size="sm"
                        variant="carrom"
                        onClick={() => window.print()}
                        className="text-xs font-bold"
                      >
                        🖨️ Print / Export Schedule
                      </Button>
                    </div>
                  </div>

                  {/* Captain & Player Daily Directives Banner */}
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-400 flex items-center gap-2">
                        <Trophy className="h-4 w-4" /> Captain Lineup & Score Submission Directives
                      </span>
                      <Badge variant="carrom" className="text-[10px] font-extrabold">DAILY 9:30 PM IST DEADLINE</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                      💡 <strong className="text-foreground">Captains:</strong> You can set and update player lineup combinations for Day 1, Day 2, Day 3, etc. anytime starting from the Tournament Start Day.<br />
                      ⏰ <strong className="text-foreground">Daily Deadline:</strong> All match score submissions and team combinations for each scheduled day must be completed by <strong className="text-amber-400">9:30 PM IST</strong> on that day.
                    </p>
                  </div>

                  <div className="space-y-5">
                    {generatedSchedule.map((round, rIdx) => (
                      <div key={round.roundNumber} className="p-4 rounded-2xl bg-muted/30 border border-amber-500/25 space-y-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-border/40 gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                              👑 Day {round.roundNumber}
                            </span>
                            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300 font-bold">
                              {round.matches.length} Matches
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                            <div className="flex items-center gap-1.5">
                              <label className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">📅 Scheduled Date:</label>
                              <Input
                                type="date"
                                value={round.roundDate}
                                onChange={(e) => {
                                  const copy = [...generatedSchedule];
                                  copy[rIdx].roundDate = e.target.value;
                                  setGeneratedSchedule(copy);
                                }}
                                className="text-xs h-8 font-mono font-bold bg-background border-amber-500/40 focus:border-amber-500 w-36"
                              />
                            </div>

                            <Badge variant="carrom" className="text-[10px] font-bold px-2.5 py-1 text-emerald-400 border-emerald-500/30">
                              🔴 Deadline: 9:30 PM IST
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                          {round.matches.map((m: any) => (
                            <div key={m.id} className="p-3.5 rounded-xl bg-card border border-border/80 space-y-2.5 shadow-sm hover:border-amber-500/40 transition-colors">
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-amber-400 font-extrabold truncate max-w-[42%]">{m.homeTeam.name}</span>
                                <span className="text-muted-foreground font-black text-[10px] px-2 py-0.5 bg-muted rounded border border-amber-500/20">VS</span>
                                <span className="text-amber-400 font-extrabold truncate max-w-[42%] text-right">{m.awayTeam.name}</span>
                              </div>

                              <div className="flex items-center justify-end pt-1.5 border-t border-border/40">
                                <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 font-bold">
                                  OPEN
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Credentials & PIN Management Table */}
      <Card className="border-border">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border pb-4 gap-3">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" /> User Credentials & 4-Digit PIN Registry
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              View unique usernames, active PINs, and edit player credentials. <strong className="text-amber-400">({usersList.length} Competitors Registered)</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Input
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="🔍 Search competitor by name..."
                className="h-9 text-xs font-semibold bg-background border-amber-500/40 focus:border-amber-500 pr-7"
              />
              {userSearchQuery && (
                <button
                  type="button"
                  onClick={() => setUserSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground font-bold"
                >
                  ✕
                </button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setGenCredentialsModalOpen(true)} className="h-9 text-xs font-bold whitespace-nowrap">
              + Add Competitor
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competitor Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Average (Avg)</TableHead>
                <TableHead>Target (Tgt)</TableHead>
                <TableHead>4-Digit PIN</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersList
                .filter((usr) => {
                  if (!userSearchQuery.trim()) return true;
                  const q = userSearchQuery.toLowerCase();
                  return (
                    usr.name?.toLowerCase().includes(q) ||
                    usr.username?.toLowerCase().includes(q)
                  );
                })
                .map((usr) => {
                const avgVal = usr.average !== undefined && usr.average !== null && usr.average > 0 ? Number(usr.average).toFixed(2) : '-';
                const tgtVal = usr.target !== undefined && usr.target !== null && usr.target > 0 ? usr.target : '-';
                const displayPin = activePinMap[usr.username.toLowerCase()] || (usr.pin && usr.pin.length === 4 ? usr.pin : '••••');

                return (
                  <TableRow key={usr.id}>
                    <TableCell className="font-bold text-xs">{usr.name}</TableCell>
                    <TableCell className="font-mono text-xs text-amber-500 font-bold">@{usr.username}</TableCell>
                    <TableCell className="font-mono text-xs font-black text-emerald-400">
                      {avgVal}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-black text-amber-400">
                      {tgtVal !== '-' ? `${tgtVal} pts` : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold">
                      <span className="bg-black/40 px-2 py-1 rounded border border-amber-500/30 text-amber-300">
                        {displayPin}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={usr.isActivated ? 'success' : 'warning'}>
                        {usr.isActivated ? 'ACTIVATED' : 'PENDING ACTIVATION'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEditUser(usr)}
                          className="h-7 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/20 font-bold flex items-center gap-1"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit Profile
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenResetPin(usr)}
                          className="h-7 text-xs text-amber-500 hover:bg-amber-500/10 font-bold flex items-center gap-1"
                        >
                          <KeyRound className="h-3.5 w-3.5" /> Reset PIN & Share
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleOpenDeletePlayer(usr)}
                          className="h-7 px-2 text-xs font-bold bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30"
                          title="Delete Player"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
          <form onSubmit={handleGenerateCredentials} className="space-y-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">Full Name</label>
                <Input value={genName} onChange={(e) => setGenName(e.target.value)} required placeholder="e.g. ANAS AHMED" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Custom Username (Optional)</label>
                <Input value={genUsername} onChange={(e) => setGenUsername(e.target.value)} placeholder="Auto-generated if empty" className="font-mono text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">Average Score (Avg)</label>
                <Input type="number" step="0.01" value={genAverage} onChange={(e) => setGenAverage(e.target.value)} placeholder="e.g. 4.23" className="font-mono text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Target Score (Tgt)</label>
                <Input type="number" value={genTarget} onChange={(e) => setGenTarget(e.target.value)} placeholder="e.g. 21" className="font-mono text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">WhatsApp Phone Number (Optional)</label>
                <Input value={genWhatsApp} onChange={(e) => setGenWhatsApp(e.target.value)} placeholder="e.g. +91 98765 43210" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Email Address (Optional)</label>
                <Input type="email" value={genEmail} onChange={(e) => setGenEmail(e.target.value)} placeholder="e.g. competitor@cbot.gg" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">Age (Optional)</label>
                <Input type="number" value={genAge} onChange={(e) => setGenAge(e.target.value)} placeholder="e.g. 28" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Gender (Optional)</label>
                <Select value={genGender} onChange={(e: any) => setGenGender(e.target.value)}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </Select>
              </div>
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

      {/* Reset PIN & Share Modal */}
      <Dialog open={resetPinModalOpen} onOpenChange={setResetPinModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-500" /> Reset & Share Player Credentials
          </DialogTitle>
          <DialogDescription>
            Assign a 4-digit PIN for {targetUser?.name || targetUsername} to log in as a player.
          </DialogDescription>
        </DialogHeader>

        {resetCredsResult ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>4-Digit PIN Reset Successfully!</span>
              </div>
              
              <div className="space-y-1.5 font-mono text-xs bg-black/40 p-3 rounded-lg border border-emerald-500/20">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Player Name:</span>
                  <span className="font-bold text-foreground">{resetCredsResult.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Username:</span>
                  <span className="font-bold text-amber-400">@{resetCredsResult.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">4-Digit PIN:</span>
                  <span className="font-bold text-emerald-400 text-sm">{resetCredsResult.pin}</span>
                </div>
              </div>

              <Button
                type="button"
                variant="carrom"
                className="w-full text-xs font-bold flex items-center justify-center gap-2"
                onClick={() => {
                  const shareText = `🏆 CBOT Player Login Credentials\nPlayer: ${resetCredsResult.name}\nUsername: ${resetCredsResult.username}\n4-Digit PIN: ${resetCredsResult.pin}\nLogin URL: www.cbotworld.com/login`;
                  navigator.clipboard.writeText(shareText);
                  setCopiedResetCreds(true);
                  setTimeout(() => setCopiedResetCreds(false), 3000);
                }}
              >
                {copiedResetCreds ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-950" /> Copied Credentials to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy Credentials for Player Login
                  </>
                )}
              </Button>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setResetPinModalOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResetPinSubmit} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold block mb-1">Target Player</label>
              <Input value={`${targetUser?.name || targetUsername} (@${targetUsername})`} readOnly className="font-bold bg-muted" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold block">New 4-Digit PIN</label>
                <button
                  type="button"
                  onClick={() => setNewPin(Math.floor(1000 + Math.random() * 9000).toString())}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline"
                >
                  Generate Random PIN
                </button>
              </div>
              <Input
                type="text"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 4829"
                className="font-mono text-center text-lg font-black tracking-widest border-amber-500/40 focus:border-amber-500"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setResetPinModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="carrom" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Reset & Generate Shareable PIN'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Edit Competitor Profile Modal */}
      <Dialog open={editUserModalOpen} onOpenChange={setEditUserModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-amber-500" /> Edit Competitor Profile & Stats
          </DialogTitle>
          <DialogDescription>
            Modify name, username, average, target, and optional contact info for {editingUser?.name || 'player'}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSaveEditUserSubmit} className="space-y-3 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold block mb-1">Full Name</label>
              <Input
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
                required
                placeholder="e.g. ANAS AHMED"
                className="font-bold text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Username</label>
              <Input
                value={editUserUsername}
                onChange={(e) => setEditUserUsername(e.target.value.toLowerCase())}
                required
                placeholder="e.g. anas_ahmed"
                className="font-mono text-xs text-amber-400 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-emerald-400 block mb-1">Average Score (Avg)</label>
              <Input
                type="number"
                step="0.01"
                value={editUserAverage}
                onChange={(e) => setEditUserAverage(e.target.value)}
                required
                placeholder="e.g. 4.23"
                className="font-mono text-xs font-black text-emerald-400 border-emerald-500/40"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-amber-400 block mb-1">Target Score (Tgt)</label>
              <Input
                type="number"
                value={editUserTarget}
                onChange={(e) => setEditUserTarget(e.target.value)}
                required
                placeholder="e.g. 21"
                className="font-mono text-xs font-black text-amber-400 border-amber-500/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold block mb-1">WhatsApp Phone Number (Optional)</label>
              <Input
                value={editUserWhatsApp}
                onChange={(e) => setEditUserWhatsApp(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Email Address (Optional)</label>
              <Input
                type="email"
                value={editUserEmail}
                onChange={(e) => setEditUserEmail(e.target.value)}
                placeholder="e.g. competitor@cbot.gg"
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold block mb-1">Age (Optional)</label>
              <Input
                type="number"
                value={editUserAge}
                onChange={(e) => setEditUserAge(e.target.value)}
                placeholder="e.g. 28"
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Gender (Optional)</label>
              <Select
                value={editUserGender}
                onChange={(e: any) => setEditUserGender(e.target.value)}
                className="text-xs font-bold"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditUserModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="carrom" disabled={isSubmitting}>
              {isSubmitting ? 'Saving Profile...' : 'Save Profile Changes'}
            </Button>
          </div>
        </form>
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

          {/* Tab Switcher inside Edit Edition Modal */}
          <div className="flex border-b border-border gap-2 pb-1">
            <button
              type="button"
              onClick={() => setActiveModalTab('SCHEDULE')}
              className={`py-2 px-3 text-xs font-bold rounded-t-lg flex items-center gap-1.5 transition-colors ${
                activeModalTab === 'SCHEDULE'
                  ? 'bg-amber-500/20 text-amber-400 border border-b-0 border-amber-500/40 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" /> 📅 Stage Schedule & Dates
            </button>
            <button
              type="button"
              onClick={() => setActiveModalTab('RULES')}
              className={`py-2 px-3 text-xs font-bold rounded-t-lg flex items-center gap-1.5 transition-colors ${
                activeModalTab === 'RULES'
                  ? 'bg-amber-500/20 text-amber-400 border border-b-0 border-amber-500/40 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Trophy className="h-3.5 w-3.5" /> 👑 Per-Round Rules
            </button>
          </div>

          {activeModalTab === 'SCHEDULE' ? (
            /* Stage Schedule Dates Section */
            <div className="space-y-4 p-4 bg-muted/40 rounded-2xl border border-amber-500/25">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="space-y-0.5">
                  <label className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-amber-400" /> Prepare Tournament Stage Schedule
                  </label>
                  <p className="text-[11px] text-muted-foreground font-medium">Select or change scheduled dates & start times for each stage.</p>
                </div>
                <Badge variant="carrom" className="text-[10px] font-extrabold px-2.5 py-0.5 uppercase tracking-wider">
                  4 Stages Configured
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-card p-3 rounded-xl border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1">🏆 Round Robin Stage</span>
                    <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">Stage 1</span>
                  </div>
                  <Input
                    type="datetime-local"
                    value={stageSchedule.roundRobin}
                    onChange={(e) => setStageSchedule({ ...stageSchedule, roundRobin: e.target.value })}
                    className="text-xs font-mono font-bold bg-background h-9 border-amber-500/40 focus:border-amber-500"
                  />
                  <p className="text-[10px] text-muted-foreground italic">All teams compete in group matches</p>
                </div>

                <div className="bg-card p-3 rounded-xl border border-blue-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1">⚔️ Qualifier 1 (Q1)</span>
                    <span className="text-[9px] font-mono bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold">Stage 2</span>
                  </div>
                  <Input
                    type="datetime-local"
                    value={stageSchedule.qualifier1}
                    onChange={(e) => setStageSchedule({ ...stageSchedule, qualifier1: e.target.value })}
                    className="text-xs font-mono font-bold bg-background h-9 border-blue-500/40 focus:border-blue-500"
                  />
                  <p className="text-[10px] text-muted-foreground italic">Top 4 seeded teams knockout match</p>
                </div>

                <div className="bg-card p-3 rounded-xl border border-purple-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-400 flex items-center gap-1">🔥 Qualifier 2 (Q2)</span>
                    <span className="text-[9px] font-mono bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold">Stage 3</span>
                  </div>
                  <Input
                    type="datetime-local"
                    value={stageSchedule.qualifier2}
                    onChange={(e) => setStageSchedule({ ...stageSchedule, qualifier2: e.target.value })}
                    className="text-xs font-mono font-bold bg-background h-9 border-purple-500/40 focus:border-purple-500"
                  />
                  <p className="text-[10px] text-muted-foreground italic">Eliminator winner vs Q1 runner-up</p>
                </div>

                <div className="bg-card p-3 rounded-xl border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">👑 Grand Finals</span>
                    <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">Final Stage</span>
                  </div>
                  <Input
                    type="datetime-local"
                    value={stageSchedule.finals}
                    onChange={(e) => setStageSchedule({ ...stageSchedule, finals: e.target.value })}
                    className="text-xs font-mono font-bold bg-background h-9 border-emerald-500/40 focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-muted-foreground italic">Championship Decider Match</p>
                </div>
              </div>
            </div>
          ) : (
            /* Multi-Format Round & Rules Breakdown */
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
          )}

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

          <ImageUploader
            value={newTeamLogo}
            onChange={setNewTeamLogo}
            label="Team Poster Image"
            bucket="teams"
            placeholder="Upload team poster image or paste URL"
          />

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

            {/* Roster Search Bar */}
            <div className="relative">
              <Input
                value={rosterSearchQuery}
                onChange={(e) => setRosterSearchQuery(e.target.value)}
                placeholder="🔍 Search registered players by name or @username..."
                className="h-8 text-xs font-semibold bg-background border-amber-500/40 focus:border-amber-500 pr-7"
              />
              {rosterSearchQuery && (
                <button
                  type="button"
                  onClick={() => setRosterSearchQuery('')}
                  className="absolute right-2.5 top-2 text-xs text-muted-foreground hover:text-foreground font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="border border-amber-500/30 rounded-xl p-3 max-h-48 overflow-y-auto bg-muted/30 space-y-1.5">
              {sortedUsersForNewTeam
                .filter((usr) => {
                  if (!rosterSearchQuery.trim()) return true;
                  const q = rosterSearchQuery.toLowerCase();
                  return (
                    usr.name?.toLowerCase().includes(q) ||
                    usr.username?.toLowerCase().includes(q)
                  );
                })
                .map((usr) => {
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
                      {(() => {
                        const isCaptain = teamsList.some(
                          (t) => t.captainId === usr.id && t.members && t.members.length > 0
                        );
                        return (
                          <Badge variant={isCaptain ? 'warning' : 'outline'} className="text-[9px]">
                            {isCaptain ? 'CAPTAIN' : 'PLAYER'}
                          </Badge>
                        );
                      })()}
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
                placeholder="e.g. Vintage Strikers / Boric Speedsters"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Team Tag (3-4 Letters)</label>
              <Input
                value={editTeamTag}
                onChange={(e) => setEditTeamTag(e.target.value.toUpperCase())}
                placeholder="e.g. VS / BS"
                maxLength={5}
              />
            </div>
          </div>

          <ImageUploader
            value={editTeamLogo}
            onChange={setEditTeamLogo}
            label="Team Poster Image"
            bucket="teams"
            placeholder="Upload team poster image or paste URL"
          />

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

            {/* Roster Search Bar */}
            <div className="relative">
              <Input
                value={rosterSearchQuery}
                onChange={(e) => setRosterSearchQuery(e.target.value)}
                placeholder="🔍 Search registered players by name or @username..."
                className="h-8 text-xs font-semibold bg-background border-amber-500/40 focus:border-amber-500 pr-7"
              />
              {rosterSearchQuery && (
                <button
                  type="button"
                  onClick={() => setRosterSearchQuery('')}
                  className="absolute right-2.5 top-2 text-xs text-muted-foreground hover:text-foreground font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="border border-amber-500/30 rounded-xl p-3 max-h-52 overflow-y-auto bg-muted/30 space-y-1.5">
              {sortedUsersForEditTeam
                .filter((usr) => {
                  if (!rosterSearchQuery.trim()) return true;
                  const q = rosterSearchQuery.toLowerCase();
                  return (
                    usr.name?.toLowerCase().includes(q) ||
                    usr.username?.toLowerCase().includes(q)
                  );
                })
                .map((usr) => {
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
                      {usr.average ? (
                        <span className="text-emerald-400 font-mono font-bold text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          Avg: {Number(usr.average).toFixed(2)}
                        </span>
                      ) : null}
                      {usr.target ? (
                        <span className="text-amber-400 font-mono font-bold text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          Tgt: {usr.target}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {assignedToOtherTeam && (
                        <Badge variant="outline" className="text-[9px] text-amber-500/70 border-amber-500/30">
                          In {otherTeamName}
                        </Badge>
                      )}
                      {(() => {
                        const isCaptain = teamsList.some(
                          (t) => t.captainId === usr.id && t.members && t.members.length > 0
                        );
                        return (
                          <Badge variant={isCaptain ? 'warning' : 'outline'} className="text-[9px]">
                            {isCaptain ? 'CAPTAIN' : 'PLAYER'}
                          </Badge>
                        );
                      })()}
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

      {/* Delete Player Confirmation Modal */}
      <Dialog open={deletePlayerModalOpen} onOpenChange={setDeletePlayerModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-500">
            <AlertTriangle className="h-5 w-5 text-rose-500" /> Confirm Player Deletion
          </DialogTitle>
          <DialogDescription>
            This action is permanent and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs space-y-1">
            <p className="font-bold text-rose-400 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Danger Zone Warning
            </p>
            <p className="text-muted-foreground">
              Deleting <strong className="text-foreground">{deletingUser?.name}</strong> (@{deletingUser?.username}) will permanently remove them from the tournament registration list.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold block mb-1">
              To confirm deletion, type <strong className="text-rose-400">{deletingUser?.name}</strong> below:
            </label>
            <Input
              value={deleteUserConfirmText}
              onChange={(e) => setDeleteUserConfirmText(e.target.value)}
              placeholder={`Type "${deletingUser?.name || ''}"`}
              className="text-xs font-bold border-rose-500/40 focus:border-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeletePlayerModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                isSubmitting ||
                deleteUserConfirmText.trim().toLowerCase() !== (deletingUser?.name || '').trim().toLowerCase()
              }
              onClick={handleConfirmDeletePlayer}
              className="font-bold text-xs bg-rose-600 hover:bg-rose-700"
            >
              {isSubmitting ? 'Deleting...' : 'Confirm & Delete Player'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Team Confirmation Modal */}
      <Dialog open={deleteTeamModalOpen} onOpenChange={setDeleteTeamModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-500">
            <AlertTriangle className="h-5 w-5 text-rose-500" /> Confirm Team Deletion
          </DialogTitle>
          <DialogDescription>
            This action is permanent and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs space-y-1">
            <p className="font-bold text-rose-400 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Danger Zone Warning
            </p>
            <p className="text-muted-foreground">
              Deleting team <strong className="text-foreground">{deletingTeam?.name}</strong> will unassign all its roster members and remove it from this edition.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold block mb-1">
              To confirm deletion, type <strong className="text-rose-400">{deletingTeam?.name}</strong> below:
            </label>
            <Input
              value={deleteTeamConfirmText}
              onChange={(e) => setDeleteTeamConfirmText(e.target.value)}
              placeholder={`Type "${deletingTeam?.name || ''}"`}
              className="text-xs font-bold border-rose-500/40 focus:border-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTeamModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                isSubmitting ||
                deleteTeamConfirmText.trim().toLowerCase() !== (deletingTeam?.name || '').trim().toLowerCase()
              }
              onClick={handleConfirmDeleteTeam}
              className="font-bold text-xs bg-rose-600 hover:bg-rose-700"
            >
              {isSubmitting ? 'Deleting...' : 'Confirm & Delete Team'}
            </Button>
          </div>
        </div>
      </Dialog>

    </div>
  );
}
