'use client';

import * as React from 'react';
import Link from 'next/link';
import { MOCK_TOURNAMENTS, MOCK_MATCHES, MOCK_SCORE_REPORTS, MOCK_TEAMS, MOCK_USERS } from '@/lib/mock-data';
import { createEdition, addOrUpdateEditionTeam, updateEdition, updateTeamRosterAndCaptain, deleteTeam, sendPlayerCredentialsEmailAction } from '@/lib/actions/tournamentActions';
import { sendFinalDailyLineupSummaryAction } from '@/lib/actions/lineupActions';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Shield, Trophy, AlertTriangle, Plus, Users, Crown, Check, X, KeyRound, Copy, CheckCircle2, UserPlus, Layers, Edit3, UserCheck, Trash2, Calendar, Clock, Mail, ArrowLeft, AlertCircle, Loader2, GitBranch, Globe } from 'lucide-react';
import TournamentStageDesigner from '@/components/organizer/TournamentStageDesigner';
import SpocExhibitionTeamsPanel from '@/components/organizer/SpocExhibitionTeamsPanel';
import WebsiteCmsPanel from '@/components/organizer/WebsiteCmsPanel';
import { isCalendarDayCompleted } from '@/lib/tournament-stages';
import { filterMainTeams, filterSpocTeams, isMainTournamentTeam } from '@/lib/spoc-teams';
import type { WebsiteCmsContent } from '@/lib/website-cms';

export default function OrganizerClient({ initialEditions, initialScoreReports, initialUsersList, initialTeams, initialWebsiteCms }: { initialEditions: any[], initialScoreReports: any[], initialUsersList: any[], initialTeams: any[], initialWebsiteCms: WebsiteCmsContent }) {
  const [editions, setEditions] = React.useState<any[]>(initialEditions);
  const [scoreReports, setScoreReports] = React.useState(initialScoreReports);
  const [usersList, setUsersList] = React.useState(initialUsersList);
  const [teamsList, setTeamsList] = React.useState<any[]>(initialTeams);

  // Sync state with server props to seamlessly reflect DB changes
  React.useEffect(() => {
    setEditions(initialEditions);
  }, [initialEditions]);

  React.useEffect(() => {
    setScoreReports(initialScoreReports);
  }, [initialScoreReports]);

  React.useEffect(() => {
    setUsersList(initialUsersList);
  }, [initialUsersList]);

  React.useEffect(() => {
    setTeamsList(initialTeams);
  }, [initialTeams]);

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
      if (!isMainTournamentTeam(team)) return;
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
  const [createdCreds, setCreatedCreds] = React.useState<{ username: string; pin: string; name: string; email?: string; user?: any } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [emailSending, setEmailSending] = React.useState(false);
  const [emailModalState, setEmailModalState] = React.useState<'IDLE' | 'SUCCESS' | 'NO_EMAIL'>('IDLE');
  const [sentEmailAddress, setSentEmailAddress] = React.useState('');
  const [genCredsError, setGenCredsError] = React.useState('');

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
  const [editUserCity, setEditUserCity] = React.useState('');
  const [editUserState, setEditUserState] = React.useState('');
  const [editUserCountry, setEditUserCountry] = React.useState('');

  // PIN Reset State
  const [resetPinModalOpen, setResetPinModalOpen] = React.useState(false);
  const [targetUser, setTargetUser] = React.useState<any>(null);
  const [targetUsername, setTargetUsername] = React.useState('');
  const [newPin, setNewPin] = React.useState('');
  const [resetStatus, setResetStatus] = React.useState('');
  const [resetCredsResult, setResetCredsResult] = React.useState<{ name: string; username: string; pin: string; email?: string } | null>(null);
  const [copiedResetCreds, setCopiedResetCreds] = React.useState(false);
  const [resetEmailSending, setResetEmailSending] = React.useState(false);
  const [resetEmailModalState, setResetEmailModalState] = React.useState<'IDLE' | 'SUCCESS' | 'NO_EMAIL'>('IDLE');
  const [sentResetEmailAddress, setSentResetEmailAddress] = React.useState('');

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

  const [totalDays, setTotalDays] = React.useState<number>(15);
  const [startDate, setStartDate] = React.useState<string>('2026-08-10');
  const [dayDatesMap, setDayDatesMap] = React.useState<Record<number, string>>({});

  const generateDefaultDayDates = (startStr: string, numDays: number, existingMap: Record<number, string> = {}) => {
    const map: Record<number, string> = { ...existingMap };
    const baseDate = startStr && !isNaN(new Date(startStr).getTime()) ? new Date(startStr) : new Date('2026-08-10');
    
    for (let i = 1; i <= numDays; i++) {
      if (!map[i]) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + (i - 1));
        map[i] = d.toISOString().split('T')[0];
      }
    }
    return map;
  };

  const handleDaysNeeded = React.useCallback((days: number) => {
    if (days < 1) return;
    setTotalDays((prev) => (days === prev ? prev : days));
    setDayDatesMap((map) => {
      const filled = generateDefaultDayDates(startDate, days, map);
      const sameLen = Object.keys(filled).length === Object.keys(map).length;
      const same = sameLen && Object.keys(filled).every((k) => filled[Number(k)] === map[Number(k)]);
      return same ? map : filled;
    });
  }, [startDate]);

  const handleStartDateChange = React.useCallback((date: string) => {
    setStartDate(date);
    setDayDatesMap((map) => {
      const preserved: Record<number, string> = {};
      Object.entries(map).forEach(([k, v]) => {
        const day = Number(k);
        if (isCalendarDayCompleted(day, map)) preserved[day] = v;
      });
      return generateDefaultDayDates(date, totalDays, preserved);
    });
  }, [totalDays]);

  const selectedEdition = editions.find((e) => e.id === selectedEditionId) || editions[0];

  React.useEffect(() => {
    if (selectedEdition) {
      const savedFormats = selectedEdition.patterns?.map((p: any) => p.matchFormat) || [];
      if (savedFormats.length > 0) {
        setRoundCount(savedFormats.length);
        setRoundFormats(savedFormats);
        setRoundRules(
          savedFormats.map((fmt: string, idx: number) => {
            return selectedEdition.patterns?.[idx]?.pattern?.objective || `Round ${idx + 1} specific match rules`;
          })
        );
      } else {
        setRoundCount(4);
        setRoundFormats(['SINGLES', 'DOUBLES', 'TRIPLES', 'SINGLES']);
        setRoundRules([
          'Standard Singles match (Direct pockets only)',
          'Doubles partner alternate shots (Queen cover mandatory)',
          'Triples 3-player rotation (Penalty -1 on foul)',
          'Grand final singles rules (Best of 3 boards)',
        ]);
      }

      const numDays = selectedEdition.totalDays || 15;
      setTotalDays(numDays);

      let loadedMap: Record<number, string> = {};
      if (selectedEdition.dayDates) {
        try {
          loadedMap = JSON.parse(selectedEdition.dayDates);
        } catch (e) {}
      }
      
      const firstDate = loadedMap[1] || (selectedEdition.tournamentStartDate ? new Date(selectedEdition.tournamentStartDate).toISOString().split('T')[0] : '2026-08-10');
      setStartDate(firstDate);
      setDayDatesMap(generateDefaultDayDates(firstDate, numDays, loadedMap));
    }
  }, [selectedEditionId, editions]);

  const handleSaveRoundsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditionId) return;
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('title', selectedEdition?.title || selectedEdition?.name || '');
    formData.append('theme', selectedEdition?.theme || 'Standard Theme');
    formData.append('description', selectedEdition?.themeDescription || '');
    formData.append('prizePool', selectedEdition?.prizePool || '₹1,00,000 INR');
    formData.append('maxTeams', (selectedEdition?.maxTeams || 16).toString());
    formData.append('roundFormats', JSON.stringify(roundFormats));
    formData.append('roundRules', JSON.stringify(roundRules));
    formData.append('totalDays', totalDays.toString());
    formData.append('dayDates', JSON.stringify(dayDatesMap));

    const res = await updateEdition(selectedEditionId, formData);
    if (res.success && res.edition) {
      setEditions(editions.map((ed) => (ed.id === res.edition!.id ? res.edition : ed)));
      alert('🏆 Tournament schedule & rounds configuration saved successfully to the database!');
    } else {
      alert('⚠️ Failed to save configuration: ' + (res.error || 'Unknown error'));
    }
    setIsSubmitting(false);
  };

  const selectedEditionTeams = filterMainTeams(
    teamsList.filter((t) => t.editionId === selectedEditionId || (!t.editionId && selectedEditionId === editions[0]?.id))
  );
  const selectedEditionSpocTeams = filterSpocTeams(
    teamsList.filter((t) => t.editionId === selectedEditionId || (!t.editionId && selectedEditionId === editions[0]?.id))
  );

  const activeEditions = editions.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'REGISTRATION_OPEN');
  const pendingReports = scoreReports.filter((r) => r.status === 'PENDING');

  const handleAddTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setIsSubmitting(true);
    const updatedMembers = newTeamPlayerIds.map((pId) => {
      const foundUser = usersList.find((u) => u.id === pId);
      return { id: `m_${pId}`, userId: pId, user: foundUser };
    });
    const updatedCaptain = usersList.find((u) => u.id === newTeamCaptainId);

    const res = await addOrUpdateEditionTeam({
      editionId: selectedEditionId || editions[0]?.id,
      name: newTeamName.trim(),
      tag: newTeamTag.trim() || newTeamName.substring(0, 3).toUpperCase(),
      captainId: newTeamCaptainId,
      playerUserIds: newTeamPlayerIds,
      logo: newTeamLogo.trim() || undefined,
    });
    if (res.success && res.team) {
      const teamWithMembers = {
        ...res.team,
        members: (res.team.members && res.team.members.length > 0) ? res.team.members : updatedMembers,
        captain: res.team.captain || updatedCaptain,
      };
      setTeamsList([teamWithMembers, ...teamsList]);
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
      const savedTeam = res.team;
      setTeamsList((prev) =>
        prev.map((t) =>
          t.id === editingTeamId || t.name === savedTeam.name
            ? {
                ...t,
                ...savedTeam,
                members: (savedTeam.members && savedTeam.members.length > 0) ? savedTeam.members : updatedMembers,
                captain: savedTeam.captain || updatedCaptain,
              }
            : t
        )
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

    // Optimistic update — close modal immediately
    const optimisticTitle = (formData.get('title') as string) || selectedEdition?.title;
    const optimisticTheme = (formData.get('theme') as string) || selectedEdition?.theme;
    const optimisticDescription = (formData.get('description') as string) || selectedEdition?.themeDescription;
    const optimisticPrizePool = (formData.get('prizePool') as string) || selectedEdition?.prizePool;
    const optimisticMaxTeams = parseInt((formData.get('maxTeams') as string) || '16', 10);
    setEditions(editions.map((ed) =>
      ed.id === selectedEditionId
        ? { ...ed, title: optimisticTitle, theme: optimisticTheme, themeDescription: optimisticDescription, prizePool: optimisticPrizePool, maxTeams: optimisticMaxTeams }
        : ed
    ));
    setEditModalOpen(false);
    setIsSubmitting(false);

    // Persist in background
    const res = await updateEdition(selectedEditionId, formData);
    if (res.success && res.edition) {
      setEditions(editions.map((ed) => (ed.id === res.edition!.id ? res.edition : ed)));
    } else if (!res.success) {
      alert('⚠️ Failed to save edition changes: ' + (res.error || 'Unknown error. Please try again.'));
    }
  };

  const handleGenerateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setEmailModalState('IDLE');
    setGenCredsError('');
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
      setCreatedCreds({
        name: res.credentials.name || genName || 'Player',
        username: res.credentials.username,
        pin: res.credentials.pin,
        email: genEmail.trim() || (res.credentials as any).email || res.credentials.user?.email || undefined,
        user: res.credentials.user,
      });
      if (res.credentials.user) {
        const newUserObj = res.credentials.user;
        setUsersList((prev) => {
          const exists = prev.some((u) => u.id === newUserObj.id || u.username?.toLowerCase() === newUserObj.username?.toLowerCase());
          if (exists) {
            return prev.map((u) => (u.id === newUserObj.id || u.username?.toLowerCase() === newUserObj.username?.toLowerCase() ? { ...u, ...newUserObj } : u));
          }
          return [newUserObj, ...prev];
        });
      }
    } else {
      setGenCredsError(res.error || 'Failed to generate credentials. Please try again.');
    }
    setIsSubmitting(false);
  };

  const handleSendToPlayerEmail = async () => {
    if (!createdCreds) return;

    const foundUser = usersList.find(
      (u) =>
        u.username?.toLowerCase() === createdCreds.username?.toLowerCase() ||
        u.name?.toLowerCase() === createdCreds.name?.toLowerCase()
    );
    const targetEmail = createdCreds.email || genEmail.trim() || foundUser?.email;

    if (!targetEmail || !targetEmail.trim()) {
      setEmailModalState('NO_EMAIL');
      return;
    }

    setEmailSending(true);
    const res = await sendPlayerCredentialsEmailAction({
      name: createdCreds.name,
      username: createdCreds.username,
      pin: createdCreds.pin,
      email: targetEmail.trim(),
    });
    setEmailSending(false);

    if (res.success) {
      setSentEmailAddress(targetEmail.trim());
      setEmailModalState('SUCCESS');
    } else {
      alert('⚠️ Failed to send credentials email: ' + (res.error || 'Unknown error'));
    }
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
    setEditUserCity(usr.city || '');
    setEditUserState(usr.state || '');
    setEditUserCountry(usr.country || '');
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
              city: editUserCity.trim() || undefined,
              state: editUserState.trim() || undefined,
              country: editUserCountry.trim() || undefined,
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
      city: editUserCity.trim() || undefined,
      state: editUserState.trim() || undefined,
      country: editUserCountry.trim() || undefined,
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
    setResetEmailModalState('IDLE');
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
    setResetEmailModalState('IDLE');
    const res = await resetUserPin(targetUsername, newPin);
    if (res.success) {
      const freshPin = newPin;
      setActivePinMap((prev) => ({ ...prev, [targetUsername.toLowerCase()]: freshPin }));
      setResetCredsResult({
        name: targetUser?.name || targetUsername,
        username: targetUsername,
        pin: freshPin,
        email: targetUser?.email || undefined,
      });
    }
    setIsSubmitting(false);
  };

  const handleSendResetToPlayerEmail = async () => {
    if (!resetCredsResult) return;
    const playerEmail = targetUser?.email || resetCredsResult.email;

    if (!playerEmail || !playerEmail.trim()) {
      setResetEmailModalState('NO_EMAIL');
      return;
    }

    setResetEmailSending(true);
    const res = await sendPlayerCredentialsEmailAction({
      name: resetCredsResult.name,
      username: resetCredsResult.username,
      pin: resetCredsResult.pin,
      email: playerEmail.trim(),
    });
    setResetEmailSending(false);

    if (res.success) {
      setSentResetEmailAddress(playerEmail.trim());
      setResetEmailModalState('SUCCESS');
    } else {
      alert('⚠️ Failed to send credentials email: ' + (res.error || 'Unknown error'));
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

        <Card className="p-5 border-violet-500/30 bg-violet-500/5">
          <div className="text-xs font-bold text-violet-400 uppercase">Teams</div>
          <div className="text-3xl font-black text-foreground mt-1">{selectedEditionTeams.length}</div>
        </Card>

        <Card className="p-5 border-emerald-500/30 bg-emerald-500/5">
          <div className="text-xs font-bold text-emerald-500 uppercase">Registered Players</div>
          <div className="text-3xl font-black text-foreground mt-1">{usersList.length}</div>
        </Card>
      </div>

      <Tabs defaultValue="players" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto w-full gap-1 p-1.5 bg-card border border-border rounded-2xl">
          <TabsTrigger value="players" className="text-xs font-bold gap-1.5 px-3 py-2">
            <KeyRound className="h-3.5 w-3.5" /> Players
          </TabsTrigger>
          <TabsTrigger value="teams" className="text-xs font-bold gap-1.5 px-3 py-2">
            <Users className="h-3.5 w-3.5" /> Teams
          </TabsTrigger>
          <TabsTrigger value="stages" className="text-xs font-bold gap-1.5 px-3 py-2">
            <GitBranch className="h-3.5 w-3.5" /> Stage Designer
          </TabsTrigger>
          <TabsTrigger value="schedule" className="text-xs font-bold gap-1.5 px-3 py-2">
            <Layers className="h-3.5 w-3.5" /> Days & Formats
          </TabsTrigger>
          <TabsTrigger value="website-cms" className="text-xs font-bold gap-1.5 px-3 py-2">
            <Globe className="h-3.5 w-3.5" /> Website CMS
          </TabsTrigger>
        </TabsList>

      <TabsContent value="schedule" forceMount className="mt-4">
      {/* Rounds & Match Schedule Configuration Card */}
      <Card className="border-amber-500/30">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Layers className="h-5 w-5 text-amber-500 animate-pulse" /> Tournament Days, Schedule &amp; Match Formats
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assign calendar dates for each event day and configure per-round match formats for <strong className="text-amber-500">{selectedEdition?.title || 'Active Edition'}</strong>. Start date and length come from the Stage Designer.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="carrom" className="font-extrabold text-xs px-3 py-1">
                {totalDays} Days Event
              </Badge>
              <Badge variant="carrom" className="font-extrabold text-xs px-3 py-1">
                {roundCount} Events / Day
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <form onSubmit={handleSaveRoundsConfig} className="space-y-6">
            
            {/* Control Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-border/50">
              <div>
                <label className="text-xs font-bold block mb-1">Events per Day</label>
                <Select value={roundCount.toString()} onChange={(e: any) => handleRoundCountChange(parseInt(e.target.value, 10))} className="text-xs font-bold">
                  <option value="3">3 Events / Day</option>
                  <option value="4">4 Events / Day</option>
                  <option value="5">5 Events / Day</option>
                  <option value="6">6 Events / Day</option>
                  <option value="7">7 Events / Day</option>
                  <option value="8">8 Events / Day</option>
                  <option value="9">9 Events / Day</option>
                  <option value="10">10 Events / Day</option>
                </Select>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-[11px] text-muted-foreground font-medium">
                  Day 1 starts {startDate || '—'} · {totalDays} days from the stage path.
                </p>
              </div>
            </div>

            {/* Daily Calendar Dates Schedule */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-border/40">
                <span className="text-xs font-black text-amber-500 flex items-center gap-1.5 uppercase tracking-wider">
                  📅 Daily Event Calendar Dates ({totalDays} Days)
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold">Organiser Scheduled Match Dates</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: totalDays }, (_, i) => i + 1).map((dayNum) => {
                  const completed = isCalendarDayCompleted(dayNum, dayDatesMap);
                  return (
                  <div key={dayNum} className={`bg-card p-3 rounded-xl border shadow-sm space-y-1.5 ${completed ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border/70'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-foreground">
                        Day {dayNum}{dayNum <= 7 ? ' · RR' : dayNum >= 8 && dayNum <= 10 ? ' · League' : ''}
                      </span>
                      {completed ? (
                        <span className="text-[9.5px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">Completed</span>
                      ) : (
                        <span className="text-[9.5px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                          {roundCount} Events
                        </span>
                      )}
                    </div>
                    <Input
                      type="date"
                      value={dayDatesMap[dayNum] || ''}
                      onChange={(e: any) => {
                        if (completed) return;
                        setDayDatesMap({ ...dayDatesMap, [dayNum]: e.target.value });
                      }}
                      disabled={completed}
                      className="text-xs font-bold font-mono h-8 bg-background disabled:opacity-60"
                    />
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Per-Round Formats */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-border/40">
                <span className="text-xs font-black text-amber-500 flex items-center gap-1.5 uppercase tracking-wider">
                  👑 Per-Event Match Formats ({roundCount} Events)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {roundFormats.map((format, idx) => (
                  <div key={idx} className="bg-card p-4 rounded-xl border border-border shadow-md space-y-3">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                      <span className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                        👑 Event {idx + 1}
                      </span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        Stage {idx + 1}
                      </span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                        Match Format
                      </label>
                      <Select
                        value={format}
                        onChange={(e: any) => {
                          const copy = [...roundFormats];
                          copy[idx] = e.target.value;
                          setRoundFormats(copy);
                        }}
                        className="text-xs h-9 font-bold bg-background animate-fade-in"
                      >
                        <option value="SINGLES">Singles (1v1)</option>
                        <option value="DOUBLES">Doubles (2v2)</option>
                        <option value="TRIPLES">Triples (3v3)</option>
                        <option value="QUADRUPLES">Quadruples (4v4)</option>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="carrom" className="font-bold text-xs" disabled={isSubmitting}>
                {isSubmitting ? 'Saving Configuration...' : 'Save Schedule & Events Configuration'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="stages" forceMount className="mt-4">
      <TournamentStageDesigner
        editionId={selectedEditionId}
        editionTitle={selectedEdition?.title || selectedEdition?.name || 'Active Edition'}
        spocTeams={selectedEditionSpocTeams.map((t: any) => ({
          id: t.id,
          name: t.name,
          tag: t.tag,
        }))}
        teams={(selectedEditionTeams.length ? selectedEditionTeams : filterMainTeams(teamsList)).map((t: any) => ({
          id: t.id,
          name: t.name,
          tag: t.tag,
        }))}
        eventsPerDay={roundCount}
        dayDates={dayDatesMap}
        totalDays={totalDays}
        startDate={startDate}
        onStartDateChange={handleStartDateChange}
        onDaysNeededChange={handleDaysNeeded}
      />
      </TabsContent>

      <TabsContent value="teams" forceMount className="mt-4">
      {/* Teams Management */}
      <Card className="border-amber-500/30">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border pb-4 gap-2">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" /> Teams — Cornerstones of Carrom
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage teams, assign captains and roster players for this edition.
            </p>
          </div>
          <Button variant="carrom" size="sm" onClick={() => setAddTeamModalOpen(true)} className="text-xs font-bold">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Team
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Name</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Captain</TableHead>
                <TableHead>Roster</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedEditionTeams.map((team) => {
                const captain = usersList.find(
                  (u) =>
                    u.id === team.captainId ||
                    (team.captain?.id && u.id === team.captain.id)
                );
                const memberCount = team.members ? team.members.length : 0;
                return (
                  <TableRow key={team.id}>
                    <TableCell className="font-bold text-xs flex items-center gap-2.5">
                      {team.logo ? (
                        <img src={team.logo} alt={team.name} className="h-7 w-7 rounded-full object-cover border border-amber-500/40" />
                      ) : (
                        <span className="h-7 w-7 rounded-full bg-amber-500/20 text-amber-500 font-black text-[10px] flex items-center justify-center border border-amber-500/30">
                          {(team.tag || 'CB').slice(0, 2)}
                        </span>
                      )}
                      {team.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-amber-500 font-bold">{team.tag || '—'}</TableCell>
                    <TableCell className="text-xs font-semibold">
                      {captain ? (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <Crown className="h-3 w-3" /> {captain.name || captain.username}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60 italic text-[11px]">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-amber-400">{memberCount} Players</TableCell>
                    <TableCell>
                      <Badge variant="success" className="text-[10px]">ACTIVE</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEditTeamModal(team)}
                          className="h-7 text-xs font-bold border-amber-500/40 text-amber-500 hover:bg-amber-500/20"
                        >
                          <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleOpenDeleteTeam(team)}
                          className="h-7 px-2 text-xs font-bold bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {selectedEditionTeams.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs font-medium">
                    No main tournament teams yet for this edition. Click <strong className="text-amber-400">"+ Add Team"</strong> to create the first team.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SpocExhibitionTeamsPanel
        editionId={selectedEditionId}
        teams={selectedEditionSpocTeams}
        allTeams={teamsList}
        usersList={usersList}
        onTeamsChange={setTeamsList}
      />
      </TabsContent>

      <TabsContent value="players" forceMount className="mt-4">
      {/* User Credentials Section */}

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
                  const q = userSearchQuery.toLowerCase().trim();
                  const qClean = q.startsWith('@') ? q.substring(1) : q;
                  const displayPin = activePinMap[usr.username?.toLowerCase() || ''] || (usr.pin && usr.pin.length === 4 ? usr.pin : '••••');
                  return (
                    (usr.name || '').toLowerCase().includes(q) ||
                    (usr.username || '').toLowerCase().includes(qClean) ||
                    displayPin.includes(q) ||
                    (usr.average !== undefined && usr.average !== null && String(usr.average).includes(q)) ||
                    (usr.target !== undefined && usr.target !== null && String(usr.target).includes(q)) ||
                    (usr.role || '').toLowerCase().includes(q)
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
      </TabsContent>

      <TabsContent value="website-cms" className="mt-4">
        <WebsiteCmsPanel
          initialCms={initialWebsiteCms}
          currentEditionId={selectedEditionId || initialEditions[0]?.id}
        />
      </TabsContent>
      </Tabs>

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
          emailModalState === 'SUCCESS' ? (
            <div className="p-6 space-y-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center animate-in fade-in duration-200">
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
              <h3 className="font-extrabold text-base text-emerald-300">Credentials Emailed Successfully!</h3>
              <p className="text-xs text-muted-foreground">
                Official tournament login credentials for <strong className="text-foreground">{createdCreds.name}</strong> have been sent to:
              </p>
              <div className="p-3 rounded-xl bg-card border border-emerald-500/30 font-mono text-center text-xs font-bold text-emerald-400">
                ✉️ {sentEmailAddress}
              </div>
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => setEmailModalState('IDLE')}
                  className="text-xs font-bold gap-1.5 border-emerald-500/30 hover:bg-emerald-500/10"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Credentials
                </Button>
              </div>
            </div>
          ) : emailModalState === 'NO_EMAIL' ? (
            <div className="p-6 space-y-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center animate-in fade-in duration-200">
              <AlertCircle className="h-12 w-12 text-amber-400 mx-auto" />
              <h3 className="font-extrabold text-base text-amber-400">Email Address Needed</h3>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">{createdCreds.name}</strong> does not have an email address added to their profile. Please add an email address to send credentials via email.
              </p>
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs text-amber-300 font-medium">
                ⚠️ Email ID is missing for player @{createdCreds.username}.
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setEmailModalState('IDLE')}
                  className="text-xs font-bold gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
                {createdCreds.user && (
                  <Button
                    variant="carrom"
                    onClick={() => {
                      setEmailModalState('IDLE');
                      setGenCredentialsModalOpen(false);
                      handleOpenEditUser(createdCreds.user);
                    }}
                    className="text-xs font-bold gap-1.5"
                  >
                    <Mail className="h-3.5 w-3.5" /> Add Email Now
                  </Button>
                )}
              </div>
            </div>
          ) : (
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <Button variant="carrom" onClick={copyCredentials} className="text-xs font-bold">
                  <Copy className="h-3.5 w-3.5 mr-1" /> {copied ? 'Copied!' : 'Copy Username & PIN'}
                </Button>
                <Button
                  variant="outline"
                  disabled={emailSending}
                  onClick={handleSendToPlayerEmail}
                  className="text-xs font-bold border-amber-500/40 text-amber-400 hover:bg-amber-500/20 gap-1.5"
                >
                  {emailSending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      <Mail className="h-3.5 w-3.5 text-amber-400" /> Send to Player Email
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setCreatedCreds(null)} className="text-xs font-bold">
                  Generate Another
                </Button>
              </div>
            </div>
          )
        ) : (
          <form onSubmit={handleGenerateCredentials} className="space-y-3 py-2">
            {genCredsError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-400 text-xs font-bold flex items-start gap-2.5 animate-in fade-in duration-150 shadow-lg shadow-rose-950/20">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{genCredsError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">Full Name</label>
                <Input value={genName} onChange={(e) => { setGenCredsError(''); setGenName(e.target.value); }} required placeholder="e.g. ANAS AHMED" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Custom Username (Optional)</label>
                <Input
                  value={genUsername}
                  onChange={(e) => { setGenCredsError(''); setGenUsername(e.target.value); }}
                  placeholder="Auto-generated if empty"
                  className={`font-mono text-xs ${genCredsError.toLowerCase().includes('username') ? 'border-rose-500/70 ring-2 ring-rose-500/20 bg-rose-500/5' : ''}`}
                />
                {genCredsError.toLowerCase().includes('username') && (
                  <p className="text-[11px] font-bold text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0 text-rose-400" /> Username already taken
                  </p>
                )}
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
                <Input
                  type="email"
                  value={genEmail}
                  onChange={(e) => { setGenCredsError(''); setGenEmail(e.target.value); }}
                  placeholder="e.g. competitor@cbot.gg"
                  className={genCredsError.toLowerCase().includes('email') ? 'border-rose-500/70 ring-2 ring-rose-500/20 bg-rose-500/5' : ''}
                />
                {genCredsError.toLowerCase().includes('email') && (
                  <p className="text-[11px] font-bold text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0 text-rose-400" /> Duplicate Email ID detected
                  </p>
                )}
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
          resetEmailModalState === 'SUCCESS' ? (
            <div className="p-6 space-y-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center animate-in fade-in duration-200">
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
              <h3 className="font-extrabold text-base text-emerald-300">New Credentials Emailed!</h3>
              <p className="text-xs text-muted-foreground">
                Updated login credentials for <strong className="text-foreground">{resetCredsResult.name}</strong> have been sent to:
              </p>
              <div className="p-3 rounded-xl bg-card border border-emerald-500/30 font-mono text-center text-xs font-bold text-emerald-400">
                ✉️ {sentResetEmailAddress}
              </div>
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => setResetEmailModalState('IDLE')}
                  className="text-xs font-bold gap-1.5 border-emerald-500/30 hover:bg-emerald-500/10"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Reset Details
                </Button>
              </div>
            </div>
          ) : resetEmailModalState === 'NO_EMAIL' ? (
            <div className="p-6 space-y-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center animate-in fade-in duration-200">
              <AlertCircle className="h-12 w-12 text-amber-400 mx-auto" />
              <h3 className="font-extrabold text-base text-amber-400">Email Address Needed</h3>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">{resetCredsResult.name}</strong> does not have an email address added to their profile. Please add an email address to send new PIN & credentials via email.
              </p>
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs text-amber-300 font-medium">
                ⚠️ Email ID is missing for player @{resetCredsResult.username}.
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setResetEmailModalState('IDLE')}
                  className="text-xs font-bold gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
                {targetUser && (
                  <Button
                    variant="carrom"
                    onClick={() => {
                      setResetEmailModalState('IDLE');
                      setResetPinModalOpen(false);
                      handleOpenEditUser(targetUser);
                    }}
                    className="text-xs font-bold gap-1.5"
                  >
                    <Mail className="h-3.5 w-3.5" /> Add Email Now
                  </Button>
                )}
              </div>
            </div>
          ) : (
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="carrom"
                    className="w-full text-xs font-bold flex items-center justify-center gap-1.5"
                    onClick={() => {
                      const shareText = `🏆 CBOT Player Login Credentials\nPlayer: ${resetCredsResult.name}\nUsername: ${resetCredsResult.username}\n4-Digit PIN: ${resetCredsResult.pin}\nLogin URL: www.cbotworld.com/login`;
                      navigator.clipboard.writeText(shareText);
                      setCopiedResetCreds(true);
                      setTimeout(() => setCopiedResetCreds(false), 3000);
                    }}
                  >
                    {copiedResetCreds ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-950" /> Copied Credentials!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> Copy Credentials
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={resetEmailSending}
                    onClick={handleSendResetToPlayerEmail}
                    className="w-full text-xs font-bold border-amber-500/40 text-amber-400 hover:bg-amber-500/20 flex items-center justify-center gap-1.5"
                  >
                    {resetEmailSending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…
                      </>
                    ) : (
                      <>
                        <Mail className="h-3.5 w-3.5 text-amber-400" /> Send to Player Email
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setResetPinModalOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          )
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

          {/* Location Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold block mb-1">City (Optional)</label>
              <Input
                value={editUserCity}
                onChange={(e) => setEditUserCity(e.target.value)}
                placeholder="e.g. Chennai"
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">State (Optional)</label>
              <Input
                value={editUserState}
                onChange={(e) => setEditUserState(e.target.value)}
                placeholder="e.g. Tamil Nadu"
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Country (Optional)</label>
              <Input
                value={editUserCountry}
                onChange={(e) => setEditUserCountry(e.target.value)}
                placeholder="e.g. India"
                className="text-xs"
              />
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
                <option value="7">7 Rounds</option>
                <option value="8">8 Rounds</option>
                <option value="9">9 Rounds</option>
                <option value="10">10 Rounds</option>
              </Select>
            </div>
          </div>

          {/* Multi-Format Round & Rules Breakdown */}
          <div className="space-y-4 p-4 bg-muted/40 rounded-2xl border border-amber-500/25">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="space-y-0.5">
                <label className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-amber-400" /> Per-Round Match Format
                </label>
                <p className="text-[11px] text-muted-foreground font-medium">Set the match format for each round.</p>
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

                  <div className="grid grid-cols-1 gap-3">
                    <div>
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
                <option value="7">7 Rounds</option>
                <option value="8">8 Rounds</option>
                <option value="9">9 Rounds</option>
                <option value="10">10 Rounds</option>
              </Select>
            </div>
          </div>

          {/* Per-Round Match Format — direct, no tabs */}
          <div className="space-y-4 p-4 bg-muted/40 rounded-2xl border border-amber-500/25">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="space-y-0.5">
                  <label className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                    <Trophy className="h-4 w-4 text-amber-400" /> Per-Round Match Format
                  </label>
                  <p className="text-[11px] text-muted-foreground font-medium">Set the match format for each round.</p>
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

                    <div className="grid grid-cols-1 gap-3">
                      <div>
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
                  const q = rosterSearchQuery.toLowerCase().trim();
                  const qClean = q.startsWith('@') ? q.substring(1) : q;
                  return (
                    (usr.name || '').toLowerCase().includes(q) ||
                    (usr.username || '').toLowerCase().includes(qClean) ||
                    (usr.average !== undefined && usr.average !== null && String(usr.average).includes(q)) ||
                    (usr.target !== undefined && usr.target !== null && String(usr.target).includes(q))
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
                  const q = rosterSearchQuery.toLowerCase().trim();
                  const qClean = q.startsWith('@') ? q.substring(1) : q;
                  return (
                    (usr.name || '').toLowerCase().includes(q) ||
                    (usr.username || '').toLowerCase().includes(qClean) ||
                    (usr.average !== undefined && usr.average !== null && String(usr.average).includes(q)) ||
                    (usr.target !== undefined && usr.target !== null && String(usr.target).includes(q))
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
            <Button type="submit" variant="carrom">
              Save Team
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
