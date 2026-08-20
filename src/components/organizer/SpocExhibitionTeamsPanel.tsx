'use client';

import * as React from 'react';
import { addOrUpdateSpocTeam, deleteSpocTeam, updateSpocTeamRoster } from '@/lib/actions/spocTeamActions';
import { isMainTournamentTeam } from '@/lib/spoc-teams';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ImageUploader } from '@/components/ui/image-uploader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Crown, Edit3, Loader2, Plus, Search, Sparkles, Trash2 } from 'lucide-react';

type Props = {
  editionId: string;
  teams: any[];
  allTeams: any[];
  usersList: any[];
  onTeamsChange: (teams: any[]) => void;
};

type SpocTeamFormProps = {
  name: string;
  tag: string;
  logo: string;
  captainId: string;
  playerIds: string[];
  eligiblePlayers: any[];
  mainTeams: any[];
  assignedSpocMap: Record<string, { teamId: string; teamName: string }>;
  usersList: any[];
  excludeTeamId?: string;
  onNameChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onLogoChange: (value: string) => void;
  onCaptainChange: (value: string) => void;
  onTogglePlayer: (userId: string) => void;
};

function SpocTeamFormFields({
  name,
  tag,
  logo,
  captainId,
  playerIds,
  eligiblePlayers,
  mainTeams,
  assignedSpocMap,
  usersList,
  excludeTeamId,
  onNameChange,
  onTagChange,
  onLogoChange,
  onCaptainChange,
  onTogglePlayer,
}: SpocTeamFormProps) {
  const [playerSearchQuery, setPlayerSearchQuery] = React.useState('');

  const filteredPlayers = React.useMemo(() => {
    if (!playerSearchQuery.trim()) return eligiblePlayers;
    const q = playerSearchQuery.toLowerCase().trim();
    const qClean = q.startsWith('@') ? q.slice(1) : q;
    return eligiblePlayers.filter((usr) => {
      const mainTeam = mainTeams.find((t) =>
        (t.members || []).some((m: any) => (m.userId || m.user?.id) === usr.id)
      );
      return (
        (usr.name || '').toLowerCase().includes(q) ||
        (usr.username || '').toLowerCase().includes(qClean) ||
        (mainTeam?.name || '').toLowerCase().includes(q)
      );
    });
  }, [eligiblePlayers, mainTeams, playerSearchQuery]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Team name" />
        <Input value={tag} onChange={(e) => onTagChange(e.target.value)} placeholder="Tag (e.g. SE1)" />
      </div>
      <ImageUploader label="Team logo (optional)" value={logo} onChange={onLogoChange} bucket="teams" />
      <div>
        <label className="text-xs font-bold block mb-1">
          Players from any main team <span className="text-muted-foreground font-normal">(one Spoc team per player)</span>
        </label>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={playerSearchQuery}
            onChange={(e) => setPlayerSearchQuery(e.target.value)}
            placeholder="Search by name, @username, or main team…"
            className="h-8 pl-8 pr-8 text-xs font-semibold bg-background border-violet-500/40 focus:border-violet-500"
          />
          {playerSearchQuery ? (
            <button
              type="button"
              onClick={() => setPlayerSearchQuery('')}
              className="absolute right-2.5 top-2 text-xs text-muted-foreground hover:text-foreground font-bold"
            >
              ✕
            </button>
          ) : null}
        </div>
        <div className="max-h-48 overflow-y-auto rounded-xl border border-border/60 p-2 space-y-1 bg-muted/10">
          {eligiblePlayers.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">Add main tournament teams with rosters first.</p>
          ) : filteredPlayers.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">No players match your search.</p>
          ) : (
            filteredPlayers.map((usr) => {
              const assigned = assignedSpocMap[usr.id];
              const onOtherSpoc = assigned && assigned.teamId !== excludeTeamId;
              const mainTeam = mainTeams.find((t) =>
                (t.members || []).some((m: any) => (m.userId || m.user?.id) === usr.id)
              );
              return (
                <label
                  key={usr.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer ${
                    onOtherSpoc ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={playerIds.includes(usr.id)}
                    disabled={onOtherSpoc}
                    onChange={() => !onOtherSpoc && onTogglePlayer(usr.id)}
                  />
                  <span className="font-bold">{usr.name || usr.username}</span>
                  {mainTeam ? (
                    <span className="text-[10px] text-muted-foreground">({mainTeam.name})</span>
                  ) : null}
                  {onOtherSpoc ? (
                    <span className="text-[10px] text-rose-400 ml-auto">On {assigned.teamName}</span>
                  ) : null}
                </label>
              );
            })
          )}
        </div>
        {playerIds.length > 0 ? (
          <p className="text-[10px] text-violet-300 font-bold mt-1.5">{playerIds.length} player{playerIds.length === 1 ? '' : 's'} selected</p>
        ) : null}
      </div>
      <div>
        <label className="text-xs font-bold block mb-1">
          Captain <span className="text-muted-foreground font-normal">(pick from selected players)</span>
        </label>
        <select
          className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs disabled:opacity-50"
          value={captainId}
          onChange={(e) => onCaptainChange(e.target.value)}
          disabled={playerIds.length === 0}
        >
          <option value="">{playerIds.length === 0 ? 'Select players first…' : 'Select captain…'}</option>
          {playerIds.map((id) => {
            const u = usersList.find((x) => x.id === id);
            return (
              <option key={id} value={id}>
                {u?.name || u?.username || id}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}

export default function SpocExhibitionTeamsPanel({ editionId, teams, allTeams, usersList, onTeamsChange }: Props) {
  const [addOpen, setAddOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editingTeam, setEditingTeam] = React.useState<any | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState('');
  const [tag, setTag] = React.useState('');
  const [logo, setLogo] = React.useState('');
  const [captainId, setCaptainId] = React.useState('');
  const [playerIds, setPlayerIds] = React.useState<string[]>([]);
  const [formSession, setFormSession] = React.useState(0);

  const mainTeams = React.useMemo(
    () => allTeams.filter((t) => t.editionId === editionId && isMainTournamentTeam(t)),
    [allTeams, editionId]
  );

  const eligiblePlayers = React.useMemo(() => {
    const ids = new Set<string>();
    mainTeams.forEach((team) => {
      (team.members || []).forEach((m: any) => {
        if (m.userId) ids.add(m.userId);
        else if (m.user?.id) ids.add(m.user.id);
      });
    });
    return usersList.filter((u) => ids.has(u.id));
  }, [mainTeams, usersList]);

  const assignedSpocMap = React.useMemo(() => {
    const map: Record<string, { teamId: string; teamName: string }> = {};
    teams.forEach((team) => {
      (team.spocMembers || []).forEach((m: any) => {
        const uid = m.userId || m.user?.id;
        if (uid) map[uid] = { teamId: team.id, teamName: team.name };
      });
    });
    return map;
  }, [teams]);

  const formProps: SpocTeamFormProps = {
    name,
    tag,
    logo,
    captainId,
    playerIds,
    eligiblePlayers,
    mainTeams,
    assignedSpocMap,
    usersList,
    onNameChange: setName,
    onTagChange: setTag,
    onLogoChange: setLogo,
    onCaptainChange: setCaptainId,
    onTogglePlayer: (userId) => {
      setPlayerIds((prev) => {
        const next = prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId];
        setCaptainId((cap) => (cap && next.includes(cap) ? cap : ''));
        return next;
      });
    },
  };

  const resetForm = () => {
    setName('');
    setTag('');
    setLogo('');
    setCaptainId('');
    setPlayerIds([]);
    setEditingTeam(null);
  };

  const openAdd = () => {
    resetForm();
    setFormSession((n) => n + 1);
    setAddOpen(true);
  };

  const openEdit = (team: any) => {
    setEditingTeam(team);
    setName(team.name || '');
    setTag(team.tag || '');
    setLogo(team.logo || '');
    setCaptainId(team.captainId || team.captain?.id || '');
    setPlayerIds(
      (team.spocMembers || []).map((m: any) => m.userId || m.user?.id).filter(Boolean)
    );
    setFormSession((n) => n + 1);
    setEditOpen(true);
  };

  const upsertTeamInList = (team: any) => {
    const others = allTeams.filter((t) => t.id !== team.id);
    onTeamsChange([team, ...others]);
  };

  const removeTeamFromList = (teamId: string) => {
    onTeamsChange(allTeams.filter((t) => t.id !== teamId));
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const res = await addOrUpdateSpocTeam({
      editionId,
      name: name.trim(),
      tag: tag.trim() || name.trim().slice(0, 3).toUpperCase(),
      captainId: captainId || undefined,
      playerUserIds: playerIds,
      logo: logo || undefined,
    });
    setSaving(false);
    if (res.success && res.team) {
      upsertTeamInList(res.team);
      setAddOpen(false);
      resetForm();
    } else {
      alert(res.error || 'Failed to create Spoc team');
    }
  };

  const handleUpdate = async () => {
    if (!editingTeam || !name.trim()) return;
    setSaving(true);
    const res = await updateSpocTeamRoster({
      teamId: editingTeam.id,
      name: name.trim(),
      tag: tag.trim() || name.trim().slice(0, 3).toUpperCase(),
      captainId: captainId || playerIds[0] || '',
      playerUserIds: playerIds,
      logo,
    });
    setSaving(false);
    if (res.success && res.team) {
      upsertTeamInList(res.team);
      setEditOpen(false);
      resetForm();
    } else {
      alert(res.error || 'Failed to update Spoc team');
    }
  };

  const handleDelete = async (team: any) => {
    if (!confirm(`Delete Spoc exhibition team "${team.name}"?`)) return;
    const res = await deleteSpocTeam(team.id);
    if (res.success) removeTeamFromList(team.id);
    else alert(res.error || 'Failed to delete team');
  };

  return (
    <>
      <Card className="border-violet-500/30 mt-4">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border pb-4 gap-2">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-400" /> Spoc Exhibition Teams
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Exhibition-only teams — pick players from any main team. Not part of the main tournament bracket.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={openAdd} className="text-xs font-bold border-violet-500/40 text-violet-300">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Spoc Team
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Captain</TableHead>
                <TableHead>Roster</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => {
                const captain = usersList.find((u) => u.id === team.captainId || u.id === team.captain?.id);
                const count = team.spocMembers?.length || 0;
                return (
                  <TableRow key={team.id}>
                    <TableCell className="font-bold text-xs">{team.name}</TableCell>
                    <TableCell className="font-mono text-xs text-violet-400">{team.tag}</TableCell>
                    <TableCell className="text-xs">
                      {captain ? (
                        <span className="text-violet-300 font-bold flex items-center gap-1">
                          <Crown className="h-3 w-3" /> {captain.name || captain.username}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-violet-300">{count} Players</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-300">
                        Exhibition
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(team)}>
                          <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 px-2" onClick={() => handleDelete(team)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {teams.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                    No Spoc exhibition teams yet. Create teams here, then add a <strong className="text-violet-300">Spoc Exhibition</strong> stage under Stages.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogHeader>
          <DialogTitle>Add Spoc Exhibition Team</DialogTitle>
          <DialogDescription>Players can come from any main team, but only one Spoc team each.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-1">
          <SpocTeamFormFields key={`add-${formSession}`} {...formProps} />
          <Button variant="carrom" onClick={handleCreate} disabled={saving} className="w-full font-black">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Spoc Team
          </Button>
        </div>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogHeader>
          <DialogTitle>Edit Spoc Exhibition Team</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 p-1">
          <SpocTeamFormFields key={`edit-${formSession}`} {...formProps} excludeTeamId={editingTeam?.id} />
          <Button variant="carrom" onClick={handleUpdate} disabled={saving} className="w-full font-black">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Spoc Team
          </Button>
        </div>
      </Dialog>
    </>
  );
}
