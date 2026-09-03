'use client';

import * as React from 'react';
import { UserCheck, Search, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  addEditionParticipant,
  getEditionParticipants,
  removeEditionParticipant,
} from '@/lib/actions/participantActions';
import { updatePlayerProfileDetails } from '@/lib/actions/userActions';
import { InlineStatCell, type InlineStatEditState } from '@/components/organizer/InlineStatCell';

type ParticipantRow = {
  id: string;
  editionId: string;
  userId: string;
  teamId?: string | null;
  category?: string | null;
  status?: string;
  user?: {
    id: string;
    name?: string | null;
    username?: string | null;
    average?: number | null;
    target?: number | null;
    role?: string | null;
    isActivated?: boolean;
  } | null;
  team?: { id: string; name: string; tag?: string | null } | null;
};

type UserLite = {
  id: string;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  average?: number | null;
  target?: number | null;
};

function getParticipantAverage(row: ParticipantRow): number | null {
  const value = row.user?.average;
  if (value === undefined || value === null || Number(value) <= 0) return null;
  return Number(value);
}

function sortParticipantsByAverageAsc(rows: ParticipantRow[]) {
  return [...rows].sort((a, b) => {
    const aAvg = getParticipantAverage(a);
    const bAvg = getParticipantAverage(b);
    const aMissing = aAvg === null;
    const bMissing = bAvg === null;
    if (aMissing && bMissing) return (a.user?.name || '').localeCompare(b.user?.name || '');
    if (aMissing) return 1;
    if (bMissing) return -1;
    if (aAvg === bAvg) return (a.user?.name || '').localeCompare(b.user?.name || '');
    return aAvg - bAvg;
  });
}

function isAssignedParticipant(row: ParticipantRow) {
  return Boolean(row.teamId || row.team);
}

export default function EditionParticipantsPanel({
  editionId,
  editionTitle,
  participants,
  allUsers,
  captainUserIds,
  onParticipantsChange,
  onUserStatUpdate,
}: {
  editionId: string | null;
  editionTitle?: string;
  participants: ParticipantRow[];
  allUsers: UserLite[];
  captainUserIds: Set<string>;
  onParticipantsChange: (participants: ParticipantRow[]) => void;
  onUserStatUpdate?: (userId: string, updates: { average?: number; target?: number }) => void;
}) {
  const [listSearch, setListSearch] = React.useState('');
  const [addSearch, setAddSearch] = React.useState('');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [inlineStatEdit, setInlineStatEdit] = React.useState<InlineStatEditState>(null);
  const [inlineStatSaving, setInlineStatSaving] = React.useState<string | null>(null);

  const assignedParticipants = React.useMemo(
    () => participants.filter(isAssignedParticipant),
    [participants]
  );

  const participantUserIds = React.useMemo(
    () => new Set(participants.map((p) => p.userId)),
    [participants]
  );

  React.useEffect(() => {
    if (!editionId) return;
    if (participants.length > 0) return;

    let cancelled = false;
    setLoading(true);
    getEditionParticipants(editionId)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.participants) {
          onParticipantsChange(res.participants as ParticipantRow[]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editionId, participants.length, onParticipantsChange]);

  const filteredParticipants = React.useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    const sorted = sortParticipantsByAverageAsc(assignedParticipants);
    if (!q) return sorted;
    return sorted.filter((row) => {
      const name = (row.user?.name || '').toLowerCase();
      const username = (row.user?.username || '').toLowerCase();
      const team = (row.team?.name || '').toLowerCase();
      return name.includes(q) || username.includes(q) || team.includes(q);
    });
  }, [assignedParticipants, listSearch]);

  const addCandidates = React.useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const qClean = q.startsWith('@') ? q.slice(1) : q;
    return allUsers
      .filter((u) => !participantUserIds.has(u.id))
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
  }, [addSearch, allUsers, participantUserIds]);

  const handleAdd = async (user: UserLite) => {
    if (!editionId) return;
    setError('');
    setBusyId(user.id);
    const res = await addEditionParticipant(editionId, user.id);
    if (res.success && res.participant) {
      onParticipantsChange(sortParticipantsByAverageAsc([...participants, res.participant as ParticipantRow]));
      setAddSearch('');
    } else {
      setError(res.error || 'Failed to add player.');
    }
    setBusyId(null);
  };

  const handleRemove = async (row: ParticipantRow) => {
    if (!editionId || !row.userId) return;
    const label = row.user?.name || row.user?.username || 'this player';
    const teamNote = row.team?.name ? ` They will also be removed from team "${row.team.name}".` : '';
    if (!window.confirm(`Remove ${label} from ${editionTitle || 'this edition'}?${teamNote}`)) return;

    setError('');
    setBusyId(row.userId);
    const res = await removeEditionParticipant(editionId, row.userId);
    if (res.success) {
      onParticipantsChange(participants.filter((p) => p.userId !== row.userId));
    } else {
      setError(res.error || 'Failed to remove player.');
    }
    setBusyId(null);
  };

  const startInlineStatEdit = (usr: { id: string }, field: 'average' | 'target') => {
    const participant = participants.find((p) => p.userId === usr.id);
    const value =
      field === 'average'
        ? participant?.user?.average !== undefined &&
          participant?.user?.average !== null &&
          participant.user.average > 0
          ? String(participant.user.average)
          : ''
        : participant?.user?.target !== undefined &&
            participant?.user?.target !== null &&
            participant.user.target > 0
          ? String(participant.user.target)
          : '';
    setInlineStatEdit({ userId: usr.id, field, value });
  };

  const cancelInlineStatEdit = () => {
    setInlineStatEdit(null);
  };

  const applyParticipantStatUpdate = (userId: string, updates: { average?: number; target?: number }) => {
    const updated = participants.map((p) =>
      p.userId === userId && p.user ? { ...p, user: { ...p.user, ...updates } } : p
    );
    onParticipantsChange(sortParticipantsByAverageAsc(updated));
    onUserStatUpdate?.(userId, updates);
  };

  const saveInlineStatEdit = async (usr: { id: string }) => {
    if (!inlineStatEdit || inlineStatEdit.userId !== usr.id) return;
    const { field, value } = inlineStatEdit;
    const saveKey = `${usr.id}-${field}`;
    setInlineStatSaving(saveKey);

    const payload =
      field === 'average'
        ? { average: parseFloat(value) || 0 }
        : { target: parseInt(value, 10) || 0 };

    const previous = participants.find((p) => p.userId === usr.id);
    applyParticipantStatUpdate(usr.id, payload);
    setInlineStatEdit(null);

    const res = await updatePlayerProfileDetails(usr.id, payload);
    if (res.success && res.user) {
      applyParticipantStatUpdate(usr.id, {
        average: res.user.average ?? payload.average,
        target: res.user.target ?? payload.target,
      });
    } else if (!res.success && previous?.user) {
      applyParticipantStatUpdate(usr.id, {
        average: previous.user.average ?? undefined,
        target: previous.user.target ?? undefined,
      });
      setError(res.error || 'Failed to update average.');
    }

    setInlineStatSaving(null);
  };

  if (!editionId) {
    return (
      <Card className="border-border">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No active edition selected.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border pb-4 gap-3">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-sky-400" /> Selected Players
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Team-assigned players in <strong className="text-amber-400">{editionTitle || 'current edition'}</strong>.
            {' '}
            <strong className="text-sky-400">({assignedParticipants.length} selected)</strong>
            {' · '}
            <span className="text-muted-foreground">{allUsers.length} total accounts</span>
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Input
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Search selected players..."
            className="h-9 text-xs font-semibold bg-background border-sky-500/40 focus:border-sky-500 pr-7"
          />
          <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="text-xs font-bold text-amber-400 uppercase tracking-wide">Add to edition</div>
          <div className="relative">
            <Input
              value={addSearch}
              onChange={(e) => {
                setAddSearch(e.target.value);
                setError('');
              }}
              placeholder="Search by name or @username to add player..."
              className="h-9 text-xs font-semibold bg-background border-amber-500/40 focus:border-amber-500"
            />
          </div>
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
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
          {addSearch.trim().length >= 2 && addCandidates.length === 0 && (
            <p className="text-[11px] text-muted-foreground">No matching players outside this edition.</p>
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
                <TableHead>Avg</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && assignedParticipants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                    Loading selected players...
                  </TableCell>
                </TableRow>
              ) : filteredParticipants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                    {listSearch.trim()
                      ? 'No selected players match your search.'
                      : 'No team-assigned players yet. Assign rosters in the Teams tab, or add players above.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredParticipants.map((row) => {
                  const avg =
                    row.user?.average !== undefined &&
                    row.user?.average !== null &&
                    row.user.average > 0
                      ? Number(row.user.average).toFixed(2)
                      : '-';
                  const tgt =
                    row.user?.target !== undefined &&
                    row.user?.target !== null &&
                    row.user.target > 0
                      ? row.user.target
                      : '-';

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-bold text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{row.user?.name || '—'}</span>
                          {captainUserIds.has(row.userId) && (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-black border-violet-500/50 text-violet-300 bg-violet-500/10 uppercase tracking-wide"
                            >
                              SPOC
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-amber-500 font-bold">
                        @{row.user?.username || '—'}
                      </TableCell>
                      <TableCell>
                        <InlineStatCell
                          usr={{ id: row.userId }}
                          field="average"
                          displayText={avg}
                          valueClassName="text-emerald-400"
                          editState={inlineStatEdit}
                          savingKey={inlineStatSaving}
                          onStart={startInlineStatEdit}
                          onChange={(v) => setInlineStatEdit((prev) => (prev ? { ...prev, value: v } : null))}
                          onCancel={cancelInlineStatEdit}
                          onSave={saveInlineStatEdit}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs font-black text-amber-400">
                        {tgt !== '-' ? `${tgt} pts` : '-'}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-300">
                          {row.team?.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.category ? (
                          <Badge variant="carrom" className="text-[10px]">
                            {row.category}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={busyId === row.userId}
                          onClick={() => handleRemove(row)}
                          className="h-7 px-2 text-xs font-bold bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30"
                          title="Remove from edition"
                        >
                          {busyId === row.userId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
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
