'use client';

import * as React from 'react';
import { UserCheck, Search, Plus, Trash2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  addEnrolledPlayer,
  pullCurrentAverageAsGrade,
  removeEnrolledPlayer,
  syncUnlockedGradeAverages,
  updateGradeAverage,
} from '@/lib/actions/tournamentSlotActions';
import { InlineStatCell, type InlineStatEditState } from '@/components/organizer/InlineStatCell';
import { formatEnrollmentFee } from '@/lib/tournament-slots';

type EnrolledRow = {
  id: string;
  editionId: string;
  userId: string;
  gradeAverage?: number | null;
  gradeAverageLocked?: boolean;
  status?: string;
  paymentStatus?: string | null;
  paymentAmount?: number | null;
  enrolledAt?: string | Date | null;
  user?: {
    id: string;
    name?: string | null;
    username?: string | null;
    average?: number | null;
    target?: number | null;
  } | null;
};

type UserLite = {
  id: string;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  average?: number | null;
};

function getGradeAverage(row: EnrolledRow): number | null {
  const value = row.gradeAverage;
  if (value === undefined || value === null || Number(value) <= 0) return null;
  return Number(value);
}

function sortByGradeAverageAsc(rows: EnrolledRow[]) {
  return [...rows].sort((a, b) => {
    const aVal = getGradeAverage(a);
    const bVal = getGradeAverage(b);
    const aMissing = aVal === null;
    const bMissing = bVal === null;
    if (aMissing && bMissing) return (a.user?.name || '').localeCompare(b.user?.name || '');
    if (aMissing) return 1;
    if (bMissing) return -1;
    if (aVal === bVal) return (a.user?.name || '').localeCompare(b.user?.name || '');
    return aVal - bVal;
  });
}

function paymentLabel(row: EnrolledRow) {
  const status = (row.paymentStatus || '').toUpperCase();
  if (status === 'PAID') return `Paid ₹${Number(row.paymentAmount || 0).toLocaleString('en-IN')}`;
  if (status === 'FREE') return 'Free';
  if (status === 'WAIVED') return 'Waived';
  return status || '—';
}

export default function EnrolledPlayersPanel({
  editionId,
  editionTitle,
  participants,
  allUsers,
  enrollmentFee,
  onParticipantsChange,
}: {
  editionId: string | null;
  editionTitle?: string;
  participants: EnrolledRow[];
  allUsers: UserLite[];
  enrollmentFee?: number | null;
  onParticipantsChange: (participants: EnrolledRow[]) => void;
}) {
  const [listSearch, setListSearch] = React.useState('');
  const [addSearch, setAddSearch] = React.useState('');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const [inlineStatEdit, setInlineStatEdit] = React.useState<InlineStatEditState>(null);
  const [inlineStatSaving, setInlineStatSaving] = React.useState<string | null>(null);

  const enrolledUserIds = React.useMemo(() => new Set(participants.map((p) => p.userId)), [participants]);

  React.useEffect(() => {
    if (!editionId) return;
    let cancelled = false;
    (async () => {
      await syncUnlockedGradeAverages(editionId);
      if (cancelled) return;
      const updated = participants.map((p) => {
        if (p.gradeAverageLocked) return p;
        const user = allUsers.find((u) => u.id === p.userId);
        const gradeAverage = user && Number(user.average) > 0 ? Number(user.average) : null;
        if (p.gradeAverage === gradeAverage) return p;
        return { ...p, gradeAverage };
      });
      if (updated.some((p, i) => p.gradeAverage !== participants[i]?.gradeAverage)) {
        onParticipantsChange(sortByGradeAverageAsc(updated));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId, allUsers]);

  const filteredParticipants = React.useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    const sorted = sortByGradeAverageAsc(participants);
    if (!q) return sorted;
    return sorted.filter((row) => {
      const name = (row.user?.name || '').toLowerCase();
      const username = (row.user?.username || '').toLowerCase();
      return name.includes(q) || username.includes(q);
    });
  }, [participants, listSearch]);

  const addCandidates = React.useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const qClean = q.startsWith('@') ? q.slice(1) : q;
    return allUsers
      .filter((u) => !enrolledUserIds.has(u.id))
      .filter((u) => {
        const role = (u.role || '').toUpperCase();
        return role === 'PLAYER' || role === 'CAPTAIN' || !role;
      })
      .filter(
        (u) =>
          (u.name || '').toLowerCase().includes(q) ||
          (u.username || '').toLowerCase().includes(qClean)
      )
      .slice(0, 8);
  }, [addSearch, allUsers, enrolledUserIds]);

  const handleAdd = async (user: UserLite) => {
    if (!editionId) return;
    setError('');
    setBusyId(user.id);
    const res = await addEnrolledPlayer(editionId, user.id);
    if (res.success && res.participant) {
      onParticipantsChange(sortByGradeAverageAsc([...participants, res.participant as EnrolledRow]));
      setAddSearch('');
    } else {
      setError(res.error || 'Failed to enroll player.');
    }
    setBusyId(null);
  };

  const handleRemove = async (row: EnrolledRow) => {
    if (!editionId || !row.userId) return;
    const label = row.user?.name || row.user?.username || 'this player';
    if (!window.confirm(`Remove ${label} from ${editionTitle || 'this edition'} enrolled players?`)) return;

    setError('');
    setBusyId(row.userId);
    const res = await removeEnrolledPlayer(editionId, row.userId);
    if (res.success) {
      onParticipantsChange(participants.filter((p) => p.userId !== row.userId));
    } else {
      setError(res.error || 'Failed to remove player.');
    }
    setBusyId(null);
  };

  const handlePullCurrent = async (row: EnrolledRow) => {
    if (!editionId || !row.userId) return;
    setError('');
    setBusyId(row.userId);
    const res = await pullCurrentAverageAsGrade(editionId, row.userId);
    if (res.success && res.participant) {
      onParticipantsChange(
        sortByGradeAverageAsc(
          participants.map((p) => (p.userId === row.userId ? (res.participant as EnrolledRow) : p))
        )
      );
    } else {
      setError(res.error || 'Failed to pull current average.');
    }
    setBusyId(null);
  };

  const startGradeEdit = (usr: { id: string }) => {
    const row = participants.find((p) => p.userId === usr.id);
    const value =
      row?.gradeAverage !== undefined && row?.gradeAverage !== null && row.gradeAverage > 0
        ? String(row.gradeAverage)
        : '';
    setInlineStatEdit({ userId: usr.id, field: 'average', value });
  };

  const saveGradeEdit = async (usr: { id: string }) => {
    if (!editionId || !inlineStatEdit || inlineStatEdit.userId !== usr.id) return;
    const saveKey = `${usr.id}-average`;
    setInlineStatSaving(saveKey);
    const parsed = parseFloat(inlineStatEdit.value) || 0;
    const previous = participants.find((p) => p.userId === usr.id);

    setInlineStatEdit(null);
    const res = await updateGradeAverage(editionId, usr.id, parsed, true);
    if (res.success && res.participant) {
      onParticipantsChange(
        sortByGradeAverageAsc(
          participants.map((p) => (p.userId === usr.id ? (res.participant as EnrolledRow) : p))
        )
      );
    } else if (previous) {
      setError(res.error || 'Failed to update grade average.');
    }
    setInlineStatSaving(null);
  };

  if (!editionId) {
    return (
      <Card className="border-border">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No tournament slot selected.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border pb-4 gap-3">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-sky-400" /> Enrolled Players
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Edition enrollment for{' '}
            <strong className="text-amber-400">{editionTitle || 'selected tournament'}</strong>.
            {' '}
            <strong className="text-sky-400">({participants.length} enrolled)</strong>
            {' · '}
            Fee: <strong className="text-emerald-400">{formatEnrollmentFee(enrollmentFee)}</strong>
            {' · '}
            Grade average syncs from current average until you edit it manually.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Input
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Search enrolled players..."
            className="h-9 text-xs font-semibold bg-background border-sky-500/40 focus:border-sky-500 pr-7"
          />
          <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="text-xs font-bold text-amber-400 uppercase tracking-wide">Add enrollment</div>
          <Input
            value={addSearch}
            onChange={(e) => {
              setAddSearch(e.target.value);
              setError('');
            }}
            placeholder="Search by name or @username to enroll player..."
            className="h-9 text-xs font-semibold bg-background border-amber-500/40 focus:border-amber-500"
          />
          {addCandidates.length > 0 && (
            <div className="rounded-lg border border-border bg-card divide-y divide-border max-h-56 overflow-y-auto">
              {addCandidates.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <div className="font-bold truncate">{user.name}</div>
                    <div className="text-amber-500 font-mono truncate">@{user.username}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === user.id}
                    onClick={() => handleAdd(user)}
                    className="h-7 text-[10px] font-bold border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 shrink-0"
                  >
                    {busyId === user.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Enroll
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Current Avg</TableHead>
                <TableHead>Grade Avg</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParticipants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-xs text-muted-foreground">
                    {listSearch.trim()
                      ? 'No enrolled players match your search.'
                      : 'No players enrolled yet. Open registration or add players above.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredParticipants.map((row) => {
                  const currentAvg =
                    row.user?.average !== undefined &&
                    row.user?.average !== null &&
                    row.user.average > 0
                      ? Number(row.user.average).toFixed(2)
                      : '-';
                  const gradeAvg =
                    row.gradeAverage !== undefined &&
                    row.gradeAverage !== null &&
                    row.gradeAverage > 0
                      ? Number(row.gradeAverage).toFixed(2)
                      : '-';

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-bold text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{row.user?.name || '—'}</span>
                          {row.gradeAverageLocked && (
                            <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-300">
                              Manual
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-amber-500 font-bold">
                        @{row.user?.username || '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-black text-emerald-400">{currentAvg}</TableCell>
                      <TableCell>
                        <InlineStatCell
                          usr={{ id: row.userId }}
                          field="average"
                          displayText={gradeAvg}
                          valueClassName="text-violet-300"
                          editState={inlineStatEdit}
                          savingKey={inlineStatSaving}
                          onStart={startGradeEdit}
                          onChange={(v) => setInlineStatEdit((prev) => (prev ? { ...prev, value: v } : null))}
                          onCancel={() => setInlineStatEdit(null)}
                          onSave={saveGradeEdit}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{paymentLabel(row)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busyId === row.userId}
                            onClick={() => handlePullCurrent(row)}
                            className="h-7 px-2 text-[10px] font-bold text-sky-400 hover:bg-sky-500/10"
                            title="Use current average"
                          >
                            {busyId === row.userId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1" /> Sync
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={busyId === row.userId}
                            onClick={() => handleRemove(row)}
                            className="h-7 px-2 text-xs font-bold bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
