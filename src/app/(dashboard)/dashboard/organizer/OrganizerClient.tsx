'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MOCK_TOURNAMENTS, MOCK_MATCHES, MOCK_SCORE_REPORTS, MOCK_TEAMS, MOCK_USERS } from '@/lib/mock-data';
import { addOrUpdateEditionTeam, updateEdition, updateTeamRosterAndCaptain, deleteTeam, sendPlayerCredentialsEmailAction, autoAssignPlayersToTeams } from '@/lib/actions/tournamentActions';
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
import { Shield, Trophy, AlertTriangle, Plus, Users, Crown, Check, X, KeyRound, Copy, CheckCircle2, UserPlus, Layers, Edit3, UserCheck, Trash2, Calendar, Clock, Mail, ArrowLeft, AlertCircle, Loader2, GitBranch, Globe, Bell, GraduationCap, Award } from 'lucide-react';
import { PushNotificationTab } from '@/components/organizer/PushNotificationTab';
import OrganizerGradingPanel from '@/components/organizer/OrganizerGradingPanel';
import EnrolledPlayersPanel from '@/components/organizer/EnrolledPlayersPanel';
import {
  exportEditionArchive,
  emptyEditionTournamentData,
} from '@/lib/actions/editionArchiveActions';
import {
  ensureTournamentSlots,
  openRegistration,
  closeRegistration,
  publishTournament,
  getPublishStatus,
  syncUnlockedGradeAverages,
} from '@/lib/actions/tournamentSlotActions';
import {
  editionBySlot,
  resolveOrganizerLiveEdition,
  resolveOrganizerDraftEdition,
  statusLabel,
  canPublishDraft,
  formatEnrollmentFee,
  type TournamentSlot,
} from '@/lib/tournament-slots';
import { InlineStatCell, type InlineStatField } from '@/components/organizer/InlineStatCell';
import AverageHistoryGraph from '@/components/player/AverageHistoryGraph';
import TournamentStageDesigner from '@/components/organizer/TournamentStageDesigner';
import OrganizerScoresPanel from '@/components/organizer/OrganizerScoresPanel';
import { getEditionProfileStatsForUser } from '@/lib/actions/playerScoreActions';
import SpocExhibitionTeamsPanel from '@/components/organizer/SpocExhibitionTeamsPanel';
import WebsiteCmsPanel from '@/components/organizer/WebsiteCmsPanel';
import { isCalendarDayCompleted } from '@/lib/tournament-stages';
import {
  defaultDay1Calendar,
  buildDayDatesMap,
  normalizeDayDates,
  toCalendarDate,
} from '@/lib/combi-cutoff';
import { filterMainTeams, filterSpocTeams, isMainTournamentTeam } from '@/lib/spoc-teams';
import type { WebsiteCmsContent } from '@/lib/website-cms';

type PlayerStatSort = 'none' | 'asc' | 'desc';

function isEnrolledParticipant(p: { status?: string; enrolledAt?: unknown; paymentStatus?: unknown }) {
  if (!p) return false;
  const status = String(p.status || '').toUpperCase();
  if (status === 'CANCELLED' || status === 'DROPPED' || status === 'REJECTED') return false;
  return true;
}

function getPlayerStatValue(usr: any, field: InlineStatField): number | null {
  const value = field === 'average' ? usr.average : usr.target;
  if (value === undefined || value === null || Number(value) <= 0) return null;
  return Number(value);
}

function sortPlayersByStat(users: any[], field: InlineStatField, direction: 'asc' | 'desc') {
  return [...users].sort((a, b) => {
    const aVal = getPlayerStatValue(a, field);
    const bVal = getPlayerStatValue(b, field);
    const aMissing = aVal === null;
    const bMissing = bVal === null;
    if (aMissing && bMissing) return (a.name || '').localeCompare(b.name || '');
    if (aMissing) return 1;
    if (bMissing) return -1;
    if (aVal === bVal) return (a.name || '').localeCompare(b.name || '');
    return direction === 'asc' ? aVal - bVal : bVal - aVal;
  });
}

export default function OrganizerClient({ initialEditions, initialScoreReports, initialUsersList, initialTeams, initialWebsiteCms }: { initialEditions: any[], initialScoreReports: any[], initialUsersList: any[], initialTeams: any[], initialWebsiteCms: WebsiteCmsContent }) {
  const router = useRouter();
  const [editions, setEditions] = React.useState<any[]>(initialEditions);
  const [tournamentSlot, setTournamentSlot] = React.useState<TournamentSlot>('A');
  const [ensuringSlots, setEnsuringSlots] = React.useState(false);
  const [slotActionBusy, setSlotActionBusy] = React.useState<string | null>(null);
  const [publishGuard, setPublishGuard] = React.useState<{ canPublish: boolean; reason: string | null }>({
    canPublish: false,
    reason: null,
  });
  const [clearDialogOpen, setClearDialogOpen] = React.useState(false);
  const [clearConfirmNumber, setClearConfirmNumber] = React.useState('');
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

  // Modals
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [editPaymentQrUrl, setEditPaymentQrUrl] = React.useState('');
  const [editIntlPaymentQrUrl, setEditIntlPaymentQrUrl] = React.useState('');
  const [editEnrollmentFee, setEditEnrollmentFee] = React.useState(0);
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
  const [avgSort, setAvgSort] = React.useState<PlayerStatSort>('none');
  const [tgtSort, setTgtSort] = React.useState<PlayerStatSort>('none');
  const [inlineStatEdit, setInlineStatEdit] = React.useState<{
    userId: string;
    field: InlineStatField;
    value: string;
  } | null>(null);
  const [inlineStatSaving, setInlineStatSaving] = React.useState<string | null>(null);
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
  const [editUserAddress, setEditUserAddress] = React.useState('');
  const [editUserPincode, setEditUserPincode] = React.useState('');
  const [editUserState, setEditUserState] = React.useState('');
  const [editUserCountry, setEditUserCountry] = React.useState('');
  const [editUserAvgHistory, setEditUserAvgHistory] = React.useState<Array<{ effectiveFrom: string; average: number }>>([]);

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

  const filteredPlayers = React.useMemo(() => {
    return usersList.filter((usr) => {
      if (!userSearchQuery.trim()) return true;
      const q = userSearchQuery.toLowerCase().trim();
      const qClean = q.startsWith('@') ? q.substring(1) : q;
      const displayPin =
        activePinMap[usr.username?.toLowerCase() || ''] || (usr.pin && usr.pin.length === 4 ? usr.pin : '••••');
      return (
        (usr.name || '').toLowerCase().includes(q) ||
        (usr.username || '').toLowerCase().includes(qClean) ||
        displayPin.includes(q) ||
        (usr.average !== undefined && usr.average !== null && String(usr.average).includes(q)) ||
        (usr.target !== undefined && usr.target !== null && String(usr.target).includes(q)) ||
        (usr.role || '').toLowerCase().includes(q)
      );
    });
  }, [usersList, userSearchQuery, activePinMap]);

  const displayedPlayers = React.useMemo(() => {
    if (avgSort !== 'none') return sortPlayersByStat(filteredPlayers, 'average', avgSort);
    if (tgtSort !== 'none') return sortPlayersByStat(filteredPlayers, 'target', tgtSort);
    return filteredPlayers;
  }, [filteredPlayers, avgSort, tgtSort]);

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
  const [startDate, setStartDate] = React.useState<string>('');
  const [dayDatesMap, setDayDatesMap] = React.useState<Record<number, string>>({});
  const startDateRef = React.useRef(startDate);
  const calendarSeedRef = React.useRef<{ editionId: string; start: string } | null>(null);
  startDateRef.current = startDate;

  /** Consecutive days from the chosen start, with any already-set days kept as they are. */
  const generateDefaultDayDates = (startStr: string, numDays: number, existingMap: Record<number, string> = {}) => {
    const start = toCalendarDate(startStr) || defaultDay1Calendar();
    const map = buildDayDatesMap(numDays, start);
    Object.entries(existingMap).forEach(([key, value]) => {
      const day = Number(key);
      const date = toCalendarDate(value);
      if (day >= 1 && day <= numDays && date) map[day] = date;
    });
    return map;
  };

  const slotAEdition = React.useMemo(() => {
    const live = resolveOrganizerLiveEdition(editions);
    if (!live) return null;
    return editions.find((e) => e.id === live.id) || live;
  }, [editions]);
  const slotBEdition = React.useMemo(() => {
    const draft = resolveOrganizerDraftEdition(editions);
    if (!draft) return null;
    return editions.find((e) => e.id === draft.id) || draft;
  }, [editions]);
  const liveTournament = slotAEdition;
  const draftTournament = slotBEdition;

  const selectedEdition = tournamentSlot === 'A' ? slotAEdition : slotBEdition;
  const selectedEditionId = selectedEdition?.id || '';
  const liveEditionId = slotAEdition?.id || '';
  const isLiveSlotA = tournamentSlot === 'A';
  const viewingDraftSlot = tournamentSlot === 'B';
  const selectedEditionParticipants = selectedEdition?.participants || [];
  const enrolledParticipants = React.useMemo(() => {
    if (viewingDraftSlot) {
      return selectedEditionParticipants.filter(isEnrolledParticipant);
    }
    // Tournament A is free — roster / edition participants are the enrolled pool (no UPI).
    return selectedEditionParticipants.filter(
      (p: { status?: string; enrolledAt?: unknown; teamId?: string | null; team?: unknown }) =>
        isEnrolledParticipant(p) || Boolean(p.teamId || p.team)
    );
  }, [selectedEditionParticipants, viewingDraftSlot]);
  const slotAEnrolledCount = React.useMemo(() => {
    const parts = slotAEdition?.participants || [];
    return parts.filter((p: any) => isEnrolledParticipant(p) || Boolean(p.teamId || p.team)).length;
  }, [slotAEdition]);

  const slotBEnrolledCount = React.useMemo(() => {
    const parts = slotBEdition?.participants || [];
    return parts.filter(isEnrolledParticipant).length;
  }, [slotBEdition]);

  const enrolledCount = enrolledParticipants.length;
  const tournamentInProgress = String(selectedEdition?.status || '').toUpperCase() === 'IN_PROGRESS';

  const hasTournamentPayload = React.useMemo(() => {
    if (!selectedEditionId) return false;
    const teamCount = teamsList.filter((t) => t.editionId === selectedEditionId).length;
    const participantCount = selectedEdition?.participants?.length || 0;
    return teamCount > 0 || participantCount > 0;
  }, [selectedEditionId, teamsList, selectedEdition]);

  const canClearEdition = React.useMemo(() => {
    if (!selectedEdition || !hasTournamentPayload) return false;
    const isLiveCup =
      selectedEdition.slot === 'A' &&
      String(selectedEdition.status || '').toUpperCase() === 'IN_PROGRESS';
    return !isLiveCup;
  }, [selectedEdition, hasTournamentPayload]);

  const mergeSlotEditions = React.useCallback((slotA: any, slotB: any) => {
    setEditions((prev) => {
      const next = [...prev];
      [slotA, slotB].forEach((edition) => {
        if (!edition) return;
        const idx = next.findIndex((e) => e.id === edition.id);
        if (idx >= 0) next[idx] = edition;
        else next.unshift(edition);
      });
      return next;
    });
  }, []);

  const refreshSlots = React.useCallback(async () => {
    setEnsuringSlots(true);
    const res = await ensureTournamentSlots();
    if (res.success) {
      mergeSlotEditions(res.slotA, res.slotB);
    }
    setEnsuringSlots(false);
    return res;
  }, [mergeSlotEditions]);

  // Slots are read from the server-loaded editions list. We do NOT auto-write on page load
  // so the live IN_PROGRESS cup is never touched until the organizer explicitly prepares the draft slot.

  React.useEffect(() => {
    if (!selectedEditionId || !viewingDraftSlot) return;
    let cancelled = false;
    void getPublishStatus(selectedEditionId).then((res) => {
      if (cancelled || !res.success) return;
      setPublishGuard({ canPublish: res.canPublish, reason: res.reason });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedEditionId, viewingDraftSlot, selectedEdition?.status]);

  const handleTournamentSlotChange = async (slot: TournamentSlot) => {
    calendarSeedRef.current = null;
    setTournamentSlot(slot);
    const targetEdition = slot === 'A' ? slotAEdition : slotBEdition;
    if (!targetEdition && slot === 'B') {
      await refreshSlots();
    }
  };

  const handleOpenRegistration = async () => {
    if (!selectedEditionId) return;
    setSlotActionBusy('open');
    const res = await openRegistration(selectedEditionId);
    if (res.success && res.edition) {
      setEditions((prev) => prev.map((e) => (e.id === res.edition.id ? { ...e, ...res.edition, participants: res.edition.participants ?? e.participants } : e)));
    } else {
      alert(res.error || 'Failed to open registration.');
    }
    setSlotActionBusy(null);
  };

  const handleCloseRegistration = async () => {
    if (!selectedEditionId) return;
    setSlotActionBusy('close');
    const res = await closeRegistration(selectedEditionId);
    if (res.success && res.edition) {
      setEditions((prev) => prev.map((e) => (e.id === res.edition.id ? { ...e, ...res.edition, participants: res.edition.participants ?? e.participants } : e)));
    } else {
      alert(res.error || 'Failed to close registration.');
    }
    setSlotActionBusy(null);
  };

  const handlePublishTournament = async () => {
    if (!selectedEditionId) return;
    const guard = canPublishDraft(liveTournament, selectedEdition);
    if (!guard.ok) {
      alert(guard.reason);
      return;
    }
    if (!window.confirm('Publish this tournament? It will go live and the current live slot will move to draft.')) return;
    setSlotActionBusy('publish');
    const res = await publishTournament(selectedEditionId);
    if (res.success) {
      mergeSlotEditions(res.published, res.resetLive);
      setTournamentSlot('A');
      router.refresh();
    } else {
      alert(res.error || 'Failed to publish tournament.');
    }
    setSlotActionBusy(null);
  };

  const handleStartClearTournament = async () => {
    if (!selectedEditionId || !selectedEdition) return;
    if (
      !window.confirm(
        `Download a full Excel archive for Edition ${selectedEdition.number}, then confirm to clear all tournament data from this slot? Player profiles and website CMS are kept.`,
      )
    ) {
      return;
    }
    setSlotActionBusy('clear-export');
    try {
      const res = await exportEditionArchive(selectedEditionId);
      if (!res.success || !res.fileBase64) {
        alert(res.error || 'Could not build archive. Tournament was not cleared.');
        return;
      }
      const binary = atob(res.fileBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: res.mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = res.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      setClearConfirmNumber('');
      setClearDialogOpen(true);
    } finally {
      setSlotActionBusy(null);
    }
  };

  const handleConfirmClearTournament = async () => {
    if (!selectedEditionId || !selectedEdition) return;
    setSlotActionBusy('clear');
    const res = await emptyEditionTournamentData(selectedEditionId, clearConfirmNumber);
    if (res.success) {
      setClearDialogOpen(false);
      setClearConfirmNumber('');
      setTeamsList((prev) => prev.filter((t) => t.editionId !== selectedEditionId));
      setEditions((prev) =>
        prev.map((edition) =>
          edition.id === selectedEditionId
            ? {
                ...edition,
                participants: [],
                status: 'DRAFT',
                dayDates: null,
                tournamentStartDate: null,
                tournamentEndDate: null,
              }
            : edition,
        ),
      );
      router.refresh();
      alert(res.message);
    } else {
      alert(res.error || 'Failed to clear tournament data.');
    }
    setSlotActionBusy(null);
  };

  const handleEnrolledParticipantsChange = React.useCallback((participants: any[]) => {
    if (!selectedEditionId) return;
    setEditions((prev) =>
      prev.map((edition) => {
        if (edition.id !== selectedEditionId) return edition;
        const enrolledIds = new Set(participants.map((p: { userId: string }) => p.userId));
        const others = (edition.participants || []).filter(
          (p: { userId: string }) => !enrolledIds.has(p.userId)
        );
        return { ...edition, participants: [...others, ...participants] };
      })
    );
  }, [selectedEditionId]);

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
      // Days already played keep the dates they were played on. A tournament that has
      // not started has no history to protect, so every day follows the new start date.
      const preserved: Record<number, string> = {};
      if (tournamentInProgress) {
        Object.entries(map).forEach(([k, v]) => {
          const day = Number(k);
          if (isCalendarDayCompleted(day, map)) preserved[day] = v;
        });
      }
      return generateDefaultDayDates(date, totalDays, preserved);
    });
  }, [totalDays, tournamentInProgress]);

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

      const loadedMap = normalizeDayDates(selectedEdition.dayDates) ?? {};
      const expectedStart = toCalendarDate(selectedEdition.tournamentStartDate);
      const firstDate =
        (viewingDraftSlot && expectedStart ? expectedStart : (loadedMap[1] || expectedStart)) || '';
      const editionChanged = calendarSeedRef.current?.editionId !== selectedEditionId;
      const dirty =
        !editionChanged &&
        Boolean(calendarSeedRef.current) &&
        startDateRef.current !== calendarSeedRef.current!.start;
      if (dirty) return;

      const nextStart = firstDate || (viewingDraftSlot ? defaultDay1Calendar() : startDateRef.current) || defaultDay1Calendar();
      setStartDate(nextStart);
      setDayDatesMap(generateDefaultDayDates(nextStart, numDays, loadedMap));
      calendarSeedRef.current = { editionId: selectedEditionId, start: nextStart };
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
      setEditions((prev) => prev.map((ed) => (ed.id === res.edition!.id ? { ...ed, ...res.edition, participants: res.edition!.participants ?? ed.participants } : ed)));
      alert('🏆 Tournament schedule & rounds configuration saved successfully to the database!');
    } else {
      alert('⚠️ Failed to save configuration: ' + (res.error || 'Unknown error'));
    }
    setIsSubmitting(false);
  };

  const teamsForEdition = React.useCallback(
    (editionId: string, liveOnlyLegacy = false) =>
      teamsList.filter((t) => {
        if (!editionId) return false;
        if (t.editionId === editionId) return true;
        if (!t.editionId && liveOnlyLegacy && editionId === liveEditionId) return true;
        return false;
      }),
    [teamsList, liveEditionId]
  );

  const selectedEditionTeams = filterMainTeams(teamsForEdition(selectedEditionId, isLiveSlotA));
  const selectedEditionSpocTeams = filterSpocTeams(teamsForEdition(selectedEditionId, isLiveSlotA));

  const memoizedStageTeams = React.useMemo(
    () => selectedEditionTeams.map((t: any) => ({ id: t.id, name: t.name, tag: t.tag })),
    [selectedEditionTeams]
  );
  const memoizedStageSpocTeams = React.useMemo(
    () => selectedEditionSpocTeams.map((t: any) => ({ id: t.id, name: t.name, tag: t.tag })),
    [selectedEditionSpocTeams]
  );

  const selectedEditionScoresUsers = React.useMemo(() => {
    const byId = new Map(usersList.map((u) => [u.id, u]));
    if (viewingDraftSlot) {
      // Draft / Next Edition: show only enrolled players for this edition
      return enrolledParticipants.map((p: any) => {
        const usr = byId.get(p.userId);
        const assignedTeam = selectedEditionTeams.find(
          (t) =>
            t.members?.some((m: any) => (m.user?.id || m.userId) === p.userId) ||
            t.spocMembers?.some((m: any) => (m.user?.id || m.userId) === p.userId)
        );
        return {
          id: p.userId,
          name: usr?.name || (p as any).user?.name || usr?.username || 'Player',
          username: usr?.username || (p as any).user?.username || '',
          target: usr?.target ?? null,
          teamName: assignedTeam?.name || undefined,
          grade: (p as any).grade || usr?.grade || (usr as any)?.category || null,
          category: (p as any).category || (usr as any)?.category || null,
        };
      });
    }

    // Live / Current Edition: show roster / teams players for this edition
    const participants = selectedEdition?.participants || [];
    const enrolledUserIds = new Set(participants.map((p: any) => p.userId));

    // Players from teams in this edition
    const teamUserIds = new Set<string>();
    selectedEditionTeams.forEach((t: any) => {
      (t.members || []).forEach((m: any) => teamUserIds.add(m.user?.id || m.userId));
      (t.spocMembers || []).forEach((m: any) => teamUserIds.add(m.user?.id || m.userId));
    });

    const activeUserIds = new Set([...teamUserIds, ...enrolledUserIds]);
    if (activeUserIds.size === 0) {
      return usersList.map((u) => ({
        id: u.id,
        name: u.name || u.username || 'Player',
        username: u.username || '',
        target: u.target ?? null,
        teamName: undefined,
        grade: u.grade || null,
        category: (u as any).category || null,
      }));
    }

    return Array.from(activeUserIds).map((uId) => {
      const usr = byId.get(uId);
      const assignedTeam = selectedEditionTeams.find(
        (t) =>
          t.members?.some((m: any) => (m.user?.id || m.userId) === uId) ||
          t.spocMembers?.some((m: any) => (m.user?.id || m.userId) === uId)
      );
      return {
        id: uId,
        name: usr?.name || usr?.username || 'Player',
        username: usr?.username || '',
        target: usr?.target ?? null,
        teamName: assignedTeam?.name || undefined,
        grade: usr?.grade || (usr as any)?.category || null,
        category: (usr as any)?.category || null,
      };
    });
  }, [viewingDraftSlot, enrolledParticipants, selectedEdition, selectedEditionTeams, usersList]);

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
      editionId: selectedEditionId || '',
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

  const [autoAssigning, setAutoAssigning] = React.useState(false);
  const [teamsNotice, setTeamsNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const handleAutoAssignPlayers = async () => {
    const editionId = selectedEditionId || slotAEdition?.id || '';
    if (!editionId || autoAssigning) return;
    setAutoAssigning(true);
    setTeamsNotice(null);

    const res = await autoAssignPlayersToTeams(editionId);

    if (res.success) {
      const spread = (res.breakdown || []).map((b: any) => `${b.name}: ${b.count}`).join(' · ');
      setTeamsNotice({
        kind: 'ok',
        text: `Assigned ${res.assigned} players across ${res.teamCount} teams. ${spread}`,
      });
      router.refresh();
    } else {
      setTeamsNotice({ kind: 'error', text: res.error || 'Could not auto-assign players.' });
    }
    setAutoAssigning(false);
  };

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
      setTeamsNotice(null);
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
    } else {
      // Without this the optimistic roster above would linger on screen and
      // only look wrong after a reload.
      setTeamsNotice({
        kind: 'error',
        text: (res as any).error || 'The roster could not be saved. Reload to see what was stored.',
      });
      router.refresh();
    }
    setIsSubmitting(false);
  };

  const handleEditEditionSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEditionId) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    // Optimistic update — close modal immediately
    const optimisticTitle = (formData.get('title') as string) || selectedEdition?.title;
    const optimisticTheme = (formData.get('theme') as string) || selectedEdition?.theme;
    const optimisticDescription = (formData.get('description') as string) || selectedEdition?.themeDescription;
    const optimisticPrizePool = (formData.get('prizePool') as string) || selectedEdition?.prizePool;
    const optimisticMaxTeams = parseInt((formData.get('maxTeams') as string) || '16', 10);
    const optimisticFee = parseFloat((formData.get('enrollmentFee') as string) || '0');
    const optimisticQr = (formData.get('paymentQrUrl') as string) || '';
    const optimisticUpi = (formData.get('paymentUpiLink') as string) || '';
    const optimisticPhone = (formData.get('paymentPhoneNumber') as string) || '';
    const optimisticIntlQr = (formData.get('intlPaymentQrUrl') as string) || '';
    const optimisticIntlUpi = (formData.get('intlPaymentUpiLink') as string) || '';
    const optimisticIntlPhone = (formData.get('intlPaymentPhone') as string) || '';
    setEditions((prev) => prev.map((ed) =>
      ed.id === selectedEditionId
        ? {
            ...ed,
            title: optimisticTitle,
            theme: optimisticTheme,
            themeDescription: optimisticDescription,
            prizePool: optimisticPrizePool,
            maxTeams: optimisticMaxTeams,
            enrollmentFee: Number.isFinite(optimisticFee) ? optimisticFee : ed.enrollmentFee,
            paymentQrUrl: optimisticFee > 0 ? optimisticQr || null : null,
            paymentUpiLink: optimisticFee > 0 ? optimisticUpi || null : null,
            paymentPhoneNumber: optimisticFee > 0 ? optimisticPhone || null : null,
            intlPaymentQrUrl: optimisticFee > 0 ? optimisticIntlQr || null : null,
            intlPaymentUpiLink: optimisticFee > 0 ? optimisticIntlUpi || null : null,
            intlPaymentPhone: optimisticFee > 0 ? optimisticIntlPhone || null : null,
          }
        : ed
    ));
    setEditModalOpen(false);
    setIsSubmitting(false);

    // Persist in background
    const res = await updateEdition(selectedEditionId, formData);
    if (res.success && res.edition) {
      setEditions((prev) => prev.map((ed) => (ed.id === res.edition!.id ? { ...ed, ...res.edition, participants: res.edition!.participants ?? ed.participants } : ed)));
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
    setEditUserAddress(usr.address || '');
    setEditUserPincode(usr.pincode || '');
    setEditUserState(usr.state || '');
    setEditUserCountry(usr.country || '');
    setEditUserAvgHistory([]);
    setEditUserModalOpen(true);
    getEditionProfileStatsForUser(usr.id)
      .then((res) => setEditUserAvgHistory(res.history || []))
      .catch(() => setEditUserAvgHistory([]));
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
              address: editUserAddress.trim() || undefined,
              pincode: editUserPincode.trim() || undefined,
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
      address: editUserAddress.trim() || undefined,
      pincode: editUserPincode.trim() || undefined,
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

  const startInlineStatEdit = (usr: any, field: InlineStatField) => {
    const value =
      field === 'average'
        ? usr.average !== undefined && usr.average !== null && usr.average > 0
          ? String(usr.average)
          : ''
        : usr.target !== undefined && usr.target !== null && usr.target > 0
          ? String(usr.target)
          : '';
    setInlineStatEdit({ userId: usr.id, field, value });
  };

  const cancelInlineStatEdit = () => {
    setInlineStatEdit(null);
  };

  const saveInlineStatEdit = async (usr: any) => {
    if (!inlineStatEdit || inlineStatEdit.userId !== usr.id) return;
    const { field, value } = inlineStatEdit;
    const saveKey = `${usr.id}-${field}`;
    setInlineStatSaving(saveKey);

    const payload =
      field === 'average'
        ? { average: parseFloat(value) || 0 }
        : { target: parseInt(value, 10) || 0 };

    setUsersList((prev) => prev.map((u) => (u.id === usr.id ? { ...u, ...payload } : u)));
    setInlineStatEdit(null);

    const res = await updatePlayerProfileDetails(usr.id, payload);
    if (res.success && res.user) {
      setUsersList((prev) => prev.map((u) => (u.id === usr.id ? { ...u, ...res.user } : u)));
    } else if (!res.success) {
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === usr.id
            ? {
                ...u,
                average: usr.average,
                target: usr.target,
              }
            : u
        )
      );
    }
    setInlineStatSaving(null);
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
            Manage the current CBOT cup, generate player credentials, reset PINs, and audit match score reports.
          </p>
        </div>
      </div>

      {/* Current Edition / Next Edition Slot Selector Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 via-background/80 to-violet-500/5 border border-amber-500/30 flex flex-col gap-4 shadow-lg shadow-amber-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div
            className="inline-flex items-center rounded-full border border-amber-500/30 bg-black/40 p-1 shadow-inner"
            role="tablist"
            aria-label="Edition slot"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tournamentSlot === 'A'}
              onClick={() => void handleTournamentSlotChange('A')}
              disabled={ensuringSlots}
              className={`rounded-full px-4 py-2 text-xs font-black transition-all duration-200 disabled:opacity-60 flex items-center gap-2 ${
                tournamentSlot === 'A'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              <Trophy className="h-3.5 w-3.5" />
              <span>Current Edition</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${tournamentSlot === 'A' ? 'bg-black/20 text-slate-950' : 'bg-amber-500/20 text-amber-300'}`}>
                {slotAEnrolledCount}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tournamentSlot === 'B'}
              onClick={() => void handleTournamentSlotChange('B')}
              disabled={ensuringSlots}
              className={`rounded-full px-4 py-2 text-xs font-black transition-all duration-200 disabled:opacity-60 flex items-center gap-2 ${
                tournamentSlot === 'B'
                  ? 'bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              {ensuringSlots ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Award className="h-3.5 w-3.5" />
              )}
              <span>Next Edition</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${tournamentSlot === 'B' ? 'bg-black/20 text-white' : 'bg-violet-500/20 text-violet-300'}`}>
                {slotBEnrolledCount}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={isLiveSlotA ? 'success' : 'outline'} className="text-[10px] font-black tracking-wider uppercase">
              {isLiveSlotA ? 'Live Tournament' : 'Draft / Upcoming'}
            </Badge>
            <Badge variant={selectedEdition?.status === 'IN_PROGRESS' ? 'warning' : 'outline'} className="text-[10px] font-bold">
              {statusLabel(selectedEdition?.status)}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2 border-t border-border/50">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-black text-amber-500">
                {selectedEdition?.title || `Edition #${selectedEdition?.number}`}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditPaymentQrUrl(selectedEdition?.paymentQrUrl || '');
                  setEditIntlPaymentQrUrl(selectedEdition?.intlPaymentQrUrl || '');
                  setEditEnrollmentFee(Number(selectedEdition?.enrollmentFee) || 0);
                  setEditModalOpen(true);
                }}
                className="h-7 text-xs font-extrabold border-amber-500/40 text-amber-400 hover:bg-amber-500/20"
              >
                <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit Edition
              </Button>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium flex-wrap">
              <span>
                <strong className="text-foreground">Theme:</strong> {selectedEdition?.theme || selectedEdition?.themeDescription || 'Standard Carrom Theme'}
              </span>
              <span>·</span>
              <span>
                <strong className="text-foreground">Fee:</strong> {formatEnrollmentFee(selectedEdition?.enrollmentFee)}
              </span>
              {viewingDraftSlot && selectedEdition?.tournamentStartDate && (
                <>
                  <span>·</span>
                  <span className="text-violet-300">
                    <strong className="text-foreground">Expected start:</strong> {toCalendarDate(selectedEdition.tournamentStartDate)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action buttons on right */}
          <div className="flex flex-wrap items-center gap-2">
            {viewingDraftSlot && !slotBEdition && (
              <Button
                type="button"
                size="sm"
                variant="carrom"
                disabled={ensuringSlots}
                onClick={() => void refreshSlots()}
                className="text-xs font-black h-8"
              >
                {ensuringSlots ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                Prepare Next Edition
              </Button>
            )}

            {viewingDraftSlot && slotBEdition && selectedEditionId && (
              <>
                {['DRAFT', 'REGISTRATION_CLOSED'].includes(
                  String(selectedEdition?.status).toUpperCase()
                ) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={slotActionBusy !== null}
                    onClick={() => void handleOpenRegistration()}
                    className="text-xs font-bold border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 h-8"
                  >
                    {slotActionBusy === 'open' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    Open Registration
                  </Button>
                )}
                {String(selectedEdition?.status).toUpperCase() === 'REGISTRATION_OPEN' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={slotActionBusy !== null}
                    onClick={() => void handleCloseRegistration()}
                    className="text-xs font-bold border-amber-500/40 text-amber-400 hover:bg-amber-500/10 h-8"
                  >
                    {slotActionBusy === 'close' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    Close Registration
                  </Button>
                )}
                {['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED'].includes(
                  String(selectedEdition?.status).toUpperCase()
                ) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="carrom"
                    disabled={slotActionBusy !== null || !publishGuard.canPublish}
                    onClick={() => void handlePublishTournament()}
                    title={publishGuard.reason || 'Publish this tournament to go live'}
                    className="text-xs font-black h-8 shadow-md shadow-amber-500/20"
                  >
                    {slotActionBusy === 'publish' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trophy className="h-3.5 w-3.5 mr-1" />}
                    Publish Tournament
                  </Button>
                )}
              </>
            )}

            {canClearEdition && selectedEditionId && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={slotActionBusy !== null}
                onClick={() => void handleStartClearTournament()}
                className="text-xs font-bold border-rose-500/30 text-rose-300 hover:bg-rose-500/10 h-8"
                title="Download backup & clear tournament data"
              >
                {slotActionBusy === 'clear-export' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 mr-1 text-rose-400" />
                )}
                Clear tournament data
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-5 border-amber-500/30 bg-amber-500/5">
          <div className="text-xs font-bold text-amber-500 uppercase">Edition</div>
          <div className="text-xl font-black text-foreground mt-1 truncate">{selectedEdition?.title || 'Edition'}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            #{selectedEdition?.number || '—'} · Slot {tournamentSlot}
            {slotAEdition?.number && slotBEdition?.number ? (
              <span className="ml-1 text-muted-foreground/80">
                (A = #{slotAEdition.number}, B = #{slotBEdition.number})
              </span>
            ) : null}
          </div>
        </Card>

        <Card className="p-5 border-violet-500/30 bg-violet-500/5">
          <div className="text-xs font-bold text-violet-400 uppercase">Teams</div>
          <div className="text-3xl font-black text-foreground mt-1">
            {selectedEditionTeams.length}
          </div>
          {enrolledCount > 0 ? (
            <div className="text-[10px] text-muted-foreground mt-0.5">{enrolledCount} enrolled</div>
          ) : null}
        </Card>

        <Card className="p-5 border-emerald-500/30 bg-emerald-500/5">
          <div className="text-xs font-bold text-emerald-500 uppercase">Enrolled Players</div>
          <div className="text-3xl font-black text-foreground mt-1">
            {enrolledCount}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {usersList.length} total accounts
          </div>
        </Card>
      </div>

      <Tabs key={tournamentSlot} defaultValue="players" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto w-full gap-1 p-1.5 bg-card border border-border rounded-2xl">
          <TabsTrigger value="players" className="text-xs font-bold gap-1.5 px-3 py-2">
            <KeyRound className="h-3.5 w-3.5" /> Players
          </TabsTrigger>
          <TabsTrigger value="enrolled-players" className="text-xs font-bold gap-1.5 px-3 py-2">
            <UserCheck className="h-3.5 w-3.5 text-violet-400" /> Enrolled ({enrolledCount})
          </TabsTrigger>
          <TabsTrigger value="grading" className="text-xs font-bold gap-1.5 px-3 py-2">
            <GraduationCap className="h-3.5 w-3.5" /> Grading
          </TabsTrigger>
          <TabsTrigger value="scores" className="text-xs font-bold gap-1.5 px-3 py-2">
            <Trophy className="h-3.5 w-3.5" /> Scores
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
          <TabsTrigger value="push-notifications" className="text-xs font-bold gap-1.5 px-3 py-2">
            <Bell className="h-3.5 w-3.5 text-amber-500" /> Push Notifications
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
                Assign calendar dates for each event day and configure per-round match formats for <strong className="text-amber-500">{selectedEdition?.title || 'This Edition'}</strong>. Start date and length come from the Stage Designer.
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
              <p className="text-[11px] text-muted-foreground">
                Main tournament only. Spoc exhibition matches use separate event formats configured in the <strong className="text-violet-300">Spoc Exhibition</strong> stage under Stages.
              </p>
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
        key={selectedEditionId}
        editionId={selectedEditionId}
        editionTitle={selectedEdition?.title || selectedEdition?.name || 'Edition'}
        spocTeams={memoizedStageSpocTeams}
        teams={memoizedStageTeams}
        eventsPerDay={roundCount}
        dayDates={dayDatesMap}
        totalDays={totalDays}
        startDate={startDate}
        onStartDateChange={handleStartDateChange}
        onDaysNeededChange={handleDaysNeeded}
        onCalendarSaved={(saved) => {
          if (saved[1]) {
            setStartDate(saved[1]);
            calendarSeedRef.current = { editionId: selectedEditionId, start: saved[1] };
          }
          setDayDatesMap(saved);
          setEditions((prev) =>
            prev.map((ed) =>
              ed.id === selectedEditionId
                ? { ...ed, dayDates: JSON.stringify(saved), tournamentStartDate: saved[1] }
                : ed,
            ),
          );
        }}
      />
      </TabsContent>

      <TabsContent value="teams" forceMount className="mt-4">
      {/* Teams Management */}
      <Card className="border-amber-500/30">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border pb-4 gap-2">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" /> Teams — {initialWebsiteCms.site.editionSeriesName}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage teams, assign captains and roster players for this edition.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoAssignPlayers}
              disabled={autoAssigning || selectedEditionTeams.length === 0}
              className="text-xs font-bold border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              title="Spread every player evenly across these teams, keeping each captain on their own team"
            >
              {autoAssigning ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <UserCheck className="h-3.5 w-3.5 mr-1" />
              )}
              {autoAssigning ? 'Assigning...' : 'Auto-assign Players'}
            </Button>
            <Button variant="carrom" size="sm" onClick={() => setAddTeamModalOpen(true)} className="text-xs font-bold">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Team
            </Button>
          </div>
        </CardHeader>
        {teamsNotice && (
          <div
            className={`mx-4 mt-3 rounded-md border px-3 py-2 text-xs font-medium ${
              teamsNotice.kind === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
            }`}
          >
            {teamsNotice.text}
          </div>
        )}
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

      <TabsContent value="scores" className="mt-4">
        <OrganizerScoresPanel
          key={selectedEditionId}
          users={selectedEditionScoresUsers}
          teams={selectedEditionTeams}
          editionTitle={selectedEdition?.title}
          editionId={selectedEditionId}
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
                <TableHead>
                  <div className="flex flex-col gap-1">
                    <span>Average (Avg)</span>
                    <Select
                      value={avgSort}
                      onChange={(e) => {
                        const next = e.target.value as PlayerStatSort;
                        setAvgSort(next);
                        if (next !== 'none') setTgtSort('none');
                      }}
                      className="h-7 w-[7.5rem] text-[10px] font-bold border-amber-500/30 bg-background px-1.5 py-0"
                    >
                      <option value="none">Sort</option>
                      <option value="asc">Low to High</option>
                      <option value="desc">High to Low</option>
                    </Select>
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex flex-col gap-1">
                    <span>Target (Tgt)</span>
                    <Select
                      value={tgtSort}
                      onChange={(e) => {
                        const next = e.target.value as PlayerStatSort;
                        setTgtSort(next);
                        if (next !== 'none') setAvgSort('none');
                      }}
                      className="h-7 w-[7.5rem] text-[10px] font-bold border-amber-500/30 bg-background px-1.5 py-0"
                    >
                      <option value="none">Sort</option>
                      <option value="asc">Low to High</option>
                      <option value="desc">High to Low</option>
                    </Select>
                  </div>
                </TableHead>
                <TableHead>4-Digit PIN</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedPlayers.map((usr) => {
                const avgVal = usr.average !== undefined && usr.average !== null && usr.average > 0 ? Number(usr.average).toFixed(2) : '-';
                const tgtVal = usr.target !== undefined && usr.target !== null && usr.target > 0 ? usr.target : '-';
                const displayPin = activePinMap[usr.username.toLowerCase()] || (usr.pin && usr.pin.length === 4 ? usr.pin : '••••');

                return (
                  <TableRow key={usr.id}>
                    <TableCell className="font-bold text-xs">{usr.name}</TableCell>
                    <TableCell className="font-mono text-xs text-amber-500 font-bold">@{usr.username}</TableCell>
                    <TableCell>
                      <InlineStatCell
                        usr={usr}
                        field="average"
                        displayText={avgVal}
                        valueClassName="text-emerald-400"
                        editState={inlineStatEdit}
                        savingKey={inlineStatSaving}
                        onStart={startInlineStatEdit}
                        onChange={(v) => setInlineStatEdit((prev) => (prev ? { ...prev, value: v } : null))}
                        onCancel={cancelInlineStatEdit}
                        onSave={saveInlineStatEdit}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineStatCell
                        usr={usr}
                        field="target"
                        displayText={tgtVal !== '-' ? `${tgtVal} pts` : '-'}
                        valueClassName="text-amber-400"
                        suffix="pts"
                        editState={inlineStatEdit}
                        savingKey={inlineStatSaving}
                        onStart={startInlineStatEdit}
                        onChange={(v) => setInlineStatEdit((prev) => (prev ? { ...prev, value: v } : null))}
                        onCancel={cancelInlineStatEdit}
                        onSave={saveInlineStatEdit}
                      />
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

      <TabsContent value="enrolled-players" className="mt-4">
        <EnrolledPlayersPanel
          editionId={selectedEditionId || null}
          editionTitle={selectedEdition?.title || selectedEdition?.name}
          participants={enrolledParticipants}
          allUsers={usersList}
          enrollmentFee={selectedEdition?.enrollmentFee}
          onParticipantsChange={handleEnrolledParticipantsChange}
        />
      </TabsContent>

      <TabsContent value="grading" className="mt-4">
        <OrganizerGradingPanel
          key={selectedEditionId}
          editionId={selectedEditionId || null}
          editionTitle={selectedEdition?.title || selectedEdition?.name}
          users={selectedEditionScoresUsers}
          enrolledUserIds={enrolledParticipants.map((p: any) => p.userId)}
          participants={enrolledParticipants}
        />
      </TabsContent>

      <TabsContent value="website-cms" className="mt-4">
        <WebsiteCmsPanel
          initialCms={initialWebsiteCms}
          currentEditionId={selectedEditionId || initialEditions[0]?.id}
        />
      </TabsContent>

      <TabsContent value="push-notifications" className="mt-4">
        <PushNotificationTab />
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
              <p className="text-[10px] text-muted-foreground mt-1">A change saved today applies from tomorrow IST. Today’s matches keep the current average.</p>
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

          <AverageHistoryGraph
            history={editUserAvgHistory}
            note="Date-wise log for this edition. Lower average is better."
          />

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
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold block mb-1">Full address</label>
              <textarea
                value={editUserAddress}
                onChange={(e) => setEditUserAddress(e.target.value)}
                placeholder="House / flat, street, area, landmark"
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">Pincode</label>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={editUserPincode}
                  onChange={(e) => setEditUserPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="e.g. 600001"
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">City / Town</label>
                <Input
                  value={editUserCity}
                  onChange={(e) => setEditUserCity(e.target.value)}
                  placeholder="e.g. Chennai"
                  className="text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* Edit Tournament Edition Dialog */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-amber-500" /> Edit Edition: {selectedEdition?.title || selectedEdition?.name || 'Selected Edition'}
          </DialogTitle>
          <DialogDescription>
            {viewingDraftSlot
              ? 'Configure the draft slot — title, edition number, enrollment fee, expected start, theme, prize pool, and rounds.'
              : 'Update this edition — title, theme, prize pool, dates, and rounds.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleEditEditionSubmit} className="space-y-4 py-2">
          <div>
            <label className="text-xs font-bold block mb-1">Edition Title</label>
            <Input name="title" defaultValue={selectedEdition?.title || selectedEdition?.name || ''} required placeholder="e.g. CBOT Edition #205" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold block mb-1">Edition Number</label>
              <Input
                name="editionNumber"
                type="number"
                min="1"
                defaultValue={selectedEdition?.number || ''}
                placeholder="e.g. 202"
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">
                {viewingDraftSlot ? 'Expected Start Date' : 'Start Date'}
              </label>
              <Input
                name="expectedStartDate"
                type="date"
                defaultValue={toCalendarDate(selectedEdition?.tournamentStartDate) || ''}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold block mb-1">Enrollment Fee (₹)</label>
              <Input
                name="enrollmentFee"
                type="number"
                min="0"
                step="1"
                defaultValue={selectedEdition?.enrollmentFee ?? 0}
                placeholder="0 for free"
                onChange={(e) => setEditEnrollmentFee(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Registration Cutoff (optional)</label>
              <Input
                name="registrationEndDate"
                type="date"
                defaultValue={toCalendarDate(selectedEdition?.registrationEndDate) || ''}
              />
            </div>
          </div>

          {editEnrollmentFee > 0 ? (
            <div className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-amber-400">
                  Player Payment Details
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Configure Primary and Alternate payment details. Players can switch between both in the enrollment popup.
                </p>
              </div>

              {/* Primary Payments */}
              <div className="rounded-lg border border-border/60 bg-background/50 p-3 space-y-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🇮🇳</span>
                  <span className="text-xs font-black text-foreground uppercase tracking-wider">Primary Payment (India)</span>
                </div>
                <input type="hidden" name="paymentQrUrl" value={editPaymentQrUrl} />
                <ImageUploader
                  label="Primary Payment QR Code"
                  value={editPaymentQrUrl}
                  onChange={setEditPaymentQrUrl}
                  bucket="teams"
                  placeholder="Upload Primary UPI QR image or paste image URL"
                />
                <div>
                  <label className="text-xs font-bold block mb-1">Primary UPI ID / Payment Link</label>
                  <Input
                    name="paymentUpiLink"
                    defaultValue={selectedEdition?.paymentUpiLink || ''}
                    placeholder="e.g. username@upi or upi://pay?..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Primary Payment Phone Number (GPay / PhonePe / Paytm)</label>
                  <Input
                    name="paymentPhoneNumber"
                    defaultValue={selectedEdition?.paymentPhoneNumber || ''}
                    placeholder="e.g. +91 9876543210 or 9876543210"
                  />
                </div>
              </div>

              {/* Alternate Payment Option */}
              <div className="rounded-lg border border-border/60 bg-background/50 p-3 space-y-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🔄</span>
                  <span className="text-xs font-black text-foreground uppercase tracking-wider">Alternate Payment Option</span>
                </div>
                <input type="hidden" name="intlPaymentQrUrl" value={editIntlPaymentQrUrl} />
                <ImageUploader
                  label="Alternate Payment QR Code"
                  value={editIntlPaymentQrUrl}
                  onChange={setEditIntlPaymentQrUrl}
                  bucket="teams"
                  placeholder="Upload Alternate UPI / Payment QR image or paste image URL"
                />
                <div>
                  <label className="text-xs font-bold block mb-1">Alternate UPI ID / Payment Link</label>
                  <Input
                    name="intlPaymentUpiLink"
                    defaultValue={selectedEdition?.intlPaymentUpiLink || ''}
                    placeholder="e.g. alternate@upi or payment URL / ID"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Alternate Payment Phone Number (GPay / PhonePe / Paytm)</label>
                  <Input
                    name="intlPaymentPhone"
                    defaultValue={selectedEdition?.intlPaymentPhone || ''}
                    placeholder="e.g. +91 9876543210 or alternate contact number"
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <input type="hidden" name="paymentQrUrl" value="" />
              <input type="hidden" name="paymentUpiLink" value="" />
              <input type="hidden" name="paymentPhoneNumber" value="" />
              <input type="hidden" name="intlPaymentQrUrl" value="" />
              <input type="hidden" name="intlPaymentUpiLink" value="" />
              <input type="hidden" name="intlPaymentPhone" value="" />
            </>
          )}

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

      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-400">
            <Trash2 className="h-5 w-5" /> Confirm clear tournament data
          </DialogTitle>
          <DialogDescription>
            The Excel archive was downloaded. This permanently removes teams, matches, scores, combis, grading grid, and stage data for Edition {selectedEdition?.number}. Player profiles, career averages, and website CMS are kept.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-muted-foreground">
            Archive saved. Check your downloads folder for <strong className="text-foreground">CBOT-Edition-{selectedEdition?.number}-*.xlsx</strong>
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">
              Type <strong className="text-rose-400">{selectedEdition?.number}</strong> to confirm:
            </label>
            <Input
              value={clearConfirmNumber}
              onChange={(e) => setClearConfirmNumber(e.target.value)}
              placeholder={`Edition number ${selectedEdition?.number || ''}`}
              className="text-xs font-bold border-rose-500/40 focus:border-rose-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setClearDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                slotActionBusy === 'clear' ||
                clearConfirmNumber.trim() !== String(selectedEdition?.number || '')
              }
              onClick={() => void handleConfirmClearTournament()}
              className="font-bold text-xs bg-rose-600 hover:bg-rose-700"
            >
              {slotActionBusy === 'clear' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Clearing…
                </>
              ) : (
                'Clear all tournament data'
              )}
            </Button>
          </div>
        </div>
      </Dialog>

    </div>
  );
}
