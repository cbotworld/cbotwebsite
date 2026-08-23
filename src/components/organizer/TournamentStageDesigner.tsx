'use client';

import * as React from 'react';
import {
  getEditionStageSnapshot,
  saveTournamentStageConfig,
} from '@/lib/actions/schedulerActions';
import {
  computeStandings,
  defaultTournamentStages,
  emptyGroups,
  formatMatchStage,
  formatPairingSlot,
  isCalendarDayCompleted,
  lastCompletedDay,
  groupKey,
  groupLabel,
  createTournamentStage,
  layoutStageDays,
  stageSpanDays,
  leagueIndexOf,
  leagueStageKey,
  leaguePairingsForStage,
  officialFirstLeaguePairings,
  matchesStageKind,
  qualifiedFromGroups,
  seedLeagueGroups,
  stageMatchStages,
  suggestFinalsPairings,
  suggestLeaguePairings,
  suggestQualifierPairings,
  nextQualifierPairing,
  nextFinalsPairing,
  nextSpocExhibitionPairing,
  assignScheduleSlots,
  pairingsAlreadyScheduled,
  hasTeamPlayingTwiceOnSameDay,
  retargetPairingDay,
  teamIdsBookedOnDay,
  type SuggestedPairing,
} from '@/lib/tournament-stages';
import type { QualifierPairing, ScheduleMode, StageKind, StageSeeding, TournamentStage, TournamentStageConfig } from '@/types';
import {
  BICENTENNIAL_MONUMENTS,
  monumentStatus,
  roundRobinMatchCount,
  seedRoyalCarromLeague,
} from '@/lib/bicentennial-monuments';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trophy,
  Users,
  X,
} from 'lucide-react';

type TeamLite = { id: string; name: string; tag?: string };
type MatchLite = {
  id: string;
  stage?: string;
  matchNumber: number;
  status: string;
  round?: number;
  team1Id?: string | null;
  team2Id?: string | null;
  team1?: { name?: string; tag?: string } | null;
  team2?: { name?: string; tag?: string } | null;
  score1?: number;
  score2?: number;
  winnerId?: string | null;
  scheduledTime?: string | Date | null;
  tableNumber?: number | null;
};

function teamsPlayingTwiceOnDay(
  pairings: SuggestedPairing[],
  idx: number,
  teams: TeamLite[]
): string | undefined {
  const pair = pairings[idx];
  if (!pair?.dayNumber) return undefined;
  const used = teamIdsBookedOnDay(pairings, pair.dayNumber, idx);
  const clashes = [pair.team1Id, pair.team2Id].filter((id) => id && used.has(id)) as string[];
  if (!clashes.length) return undefined;
  const names = clashes.map((id) => teams.find((t) => t.id === id)?.name || 'A team').join(' and ');
  return `${names} already ${clashes.length > 1 ? 'play' : 'plays'} another game on this day.`;
}

function setPairingTeam(
  pair: SuggestedPairing,
  side: 1 | 2,
  id: string,
  teams: TeamLite[],
): SuggestedPairing {
  const name = teams.find((t) => t.id === id)?.name || '';
  return side === 1
    ? { ...pair, team1Id: id, team1Name: name }
    : { ...pair, team2Id: id, team2Name: name };
}

function TeamSlotSelect({
  value,
  teams,
  onChange,
  includeTag = false,
  locked = false,
  takenIds,
}: {
  value: string;
  teams: TeamLite[];
  onChange: (id: string) => void;
  includeTag?: boolean;
  locked?: boolean;
  takenIds?: Set<string>;
}) {
  return (
    <div className="flex items-center gap-1">
      <Select
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          if (next && takenIds?.has(next) && next !== value) return;
          onChange(next);
        }}
        disabled={locked}
        className="h-9 text-xs font-bold flex-1 min-w-0"
      >
        <option value="">Select team…</option>
        {teams.map((team) => {
          const taken = Boolean(takenIds?.has(team.id) && team.id !== value);
          return (
            <option key={team.id} value={team.id} disabled={taken}>
              {team.name}
              {includeTag && team.tag ? ` (${team.tag})` : ''}
              {taken ? ' — already plays this day' : ''}
            </option>
          );
        })}
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
        onClick={() => onChange('')}
        disabled={locked || !value}
        aria-label="Remove team"
        title={locked ? 'Completed days cannot be edited' : 'Remove team'}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function teamLabel(teams: TeamLite[], id?: string | null, fallback?: string) {
  if (!id) return fallback || 'TBD';
  const found = teams.find((t) => t.id === id);
  return found ? `${found.name}${found.tag ? ` (${found.tag})` : ''}` : fallback || 'TBD';
}

function EditablePairingRow({
  label,
  team1Id,
  team2Id,
  teams,
  meta,
  dayNumber,
  dayOptions,
  onTeam1,
  onTeam2,
  onDay,
  onRemove,
  warning,
  locked = false,
  takenIds,
}: {
  label: string;
  team1Id: string;
  team2Id: string;
  teams: TeamLite[];
  meta?: string;
  dayNumber?: number;
  dayOptions?: Array<{ day: number; date?: string; completed?: boolean }>;
  onTeam1: (id: string) => void;
  onTeam2: (id: string) => void;
  onDay?: (day: number) => void;
  onRemove?: () => void;
  warning?: string;
  locked?: boolean;
  takenIds?: Set<string>;
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${locked ? 'border-border/60 bg-muted/20 opacity-90' : 'border-border bg-card'}`}>
      {meta ? <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500">{meta}{locked ? ' · Locked' : ''}</div> : locked ? (
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Completed day · locked</div>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,0.8fr)_1fr_auto_1fr_auto] gap-3 items-end">
      {onDay && dayOptions?.length ? (
        <div>
          <label className="text-[10px] font-bold uppercase text-amber-500 block mb-1">Match day</label>
          <Select
            value={String(dayNumber || '')}
            onChange={(e) => onDay(parseInt(e.target.value, 10))}
            disabled={locked}
            className="h-9 text-xs font-bold"
          >
            <option value="">Assign day…</option>
            {dayOptions.map((opt) => (
              <option key={opt.day} value={opt.day} disabled={opt.completed && opt.day !== dayNumber}>
                Day {opt.day}{opt.date ? ` · ${opt.date}` : ''}{opt.completed ? ' (done)' : ''}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div>
        <label className="text-[10px] font-bold uppercase text-emerald-400 block mb-1">{label} · Team 1</label>
        <TeamSlotSelect value={team1Id} teams={teams} onChange={onTeam1} locked={locked} takenIds={takenIds} />
      </div>
      <div className="text-center text-[10px] font-black text-muted-foreground pb-2">VS</div>
      <div>
        <label className="text-[10px] font-bold uppercase text-rose-400 block mb-1">Team 2</label>
        <TeamSlotSelect value={team2Id} teams={teams} onChange={onTeam2} locked={locked} takenIds={takenIds} />
      </div>
      {onRemove && !locked ? (
        <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground" onClick={onRemove} aria-label="Remove match">
          <X className="h-4 w-4" />
        </Button>
      ) : null}
      </div>
      {warning ? <p className="text-[11px] font-bold text-rose-400">{warning}</p> : null}
    </div>
  );
}

export default function TournamentStageDesigner({
  editionId,
  editionTitle,
  teams,
  spocTeams = [],
  eventsPerDay = 4,
  dayDates = {},
  totalDays = 15,
  startDate,
  onStartDateChange,
  onDaysNeededChange,
}: {
  editionId: string;
  editionTitle: string;
  teams: TeamLite[];
  spocTeams?: TeamLite[];
  eventsPerDay?: number;
  dayDates?: Record<number, string>;
  totalDays?: number;
  startDate?: string;
  onStartDateChange?: (date: string) => void;
  onDaysNeededChange?: (days: number) => void;
}) {
  const [config, setConfig] = React.useState<TournamentStageConfig>(() => defaultTournamentStages(teams.length || 8));
  const [matches, setMatches] = React.useState<MatchLite[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [scheduleMode, setScheduleMode] = React.useState<ScheduleMode>('DIVIDED');
  const [message, setMessage] = React.useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const stages = config.stages;
  const active = stages[activeIndex] || stages[0];
  const activeStageTeams = active?.kind === 'SPOC_EXHIBITION' ? spocTeams : teams;
  const daysNeeded = React.useMemo(() => Math.max(1, stageSpanDays(stages)), [stages]);

  React.useEffect(() => {
    onDaysNeededChange?.(daysNeeded);
  }, [daysNeeded, onDaysNeededChange]);

  const loadSnapshot = React.useCallback(async () => {
    if (!editionId) return;
    setLoading(true);
    const res = await getEditionStageSnapshot(editionId);
    if (res.success) {
      const lastDone = lastCompletedDay(dayDates);
      const nextConfig = res.config || defaultTournamentStages(res.teams.length || teams.length || 8);
      nextConfig.stages = layoutStageDays(nextConfig.stages, lastDone);
      setConfig(nextConfig);
      if (nextConfig.scheduleMode) setScheduleMode(nextConfig.scheduleMode);
      setMatches((res.matches as MatchLite[]) || []);
    } else {
      setMessage({ type: 'err', text: res.error || 'Could not load stage design.' });
    }
    setLoading(false);
  }, [editionId, teams.length]);

  React.useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const stageMatches = React.useMemo(() => {
    if (!active) return [];
    const keys = stageMatchStages(active);
    return matches.filter((m) => keys.includes(m.stage || ''));
  }, [active, matches]);

  const rrStandings = React.useMemo(
    () => computeStandings(teams, matches, (stage) => matchesStageKind(stage, 'ROUND_ROBIN')),
    [teams, matches]
  );

  const standingsByGroup = React.useMemo(() => {
    const map: Record<string, ReturnType<typeof computeStandings>> = {};
    const leagueGroups =
      (active && active.kind === 'LEAGUE'
        ? active.groups
        : [...stages].reverse().find((s) => s.kind === 'LEAGUE')?.groups) || [];
    const leagueStage =
      active && active.kind === 'LEAGUE' ? active : [...stages].reverse().find((s) => s.kind === 'LEAGUE');
    leagueGroups.forEach((group, gi) => {
      const groupTeams = teams.filter((t) => group.teamIds.includes(t.id));
      map[groupKey(group, gi)] = computeStandings(
        groupTeams,
        matches,
        (stage) => stage === leagueStageKey(groupKey(group, gi), leagueIndexOf(leagueStage))
      );
    });
    return map;
  }, [active, stages, teams, matches]);

  const updateStage = (patch: Partial<TournamentStage>) => {
    setConfig((prev) => ({
      stages: prev.stages.map((s, idx) => (idx === activeIndex ? { ...s, ...patch } : s)),
    }));
  };

  const skipLeagueAutoSeed = React.useRef(false);
  const lastDoneDay = lastCompletedDay(dayDates);
  const currentEventDay = lastDoneDay + 1;

  const isDayLocked = (day?: number) =>
    !!day && day !== currentEventDay && isCalendarDayCompleted(day, dayDates);

  const isStageLocked = (stage: TournamentStage) => {
    const keys = stageMatchStages(stage);
    if (matches.some((m) => keys.includes(m.stage || '') && m.status === 'COMPLETED')) return true;
    const start = stage.startDay || 0;
    const duration = stage.durationDays || 1;
    if (!start) return false;
    const days = Array.from({ length: duration }, (_, i) => start + i);
    return days.length > 0 && days.every((day) => isDayLocked(day));
  };

  const addStage = (kind: StageKind) => {
    if (kind !== 'LEAGUE' && stages.some((s) => s.kind === kind)) return;
    const knockoutAt = stages.findIndex((s) => s.kind === 'QUALIFIER' || s.kind === 'FINALS');
    const insertAt = knockoutAt === -1 ? stages.length : knockoutAt;
    const leagueIndex = kind === 'LEAGUE' ? stages.filter((s) => s.kind === 'LEAGUE').length + 1 : 1;
    const created = createTournamentStage(kind, insertAt + 1, teams.length || 8, leagueIndex);
    const next = [...stages];
    next.splice(insertAt, 0, created);
    setConfig((prev) => ({ ...prev, stages: layoutStageDays(next, lastDoneDay) }));
    setActiveIndex(insertAt);
  };

  const removeStage = (idx: number) => {
    const stage = stages[idx];
    if (!stage || stages.length <= 1) return;
    if (isStageLocked(stage)) {
      setMessage({ type: 'err', text: `${stage.name} has completed days and cannot be removed.` });
      return;
    }
    const next = stages.filter((_, i) => i !== idx);
    setConfig((prev) => ({ ...prev, stages: layoutStageDays(next, lastDoneDay) }));
    setActiveIndex(Math.max(0, Math.min(idx, next.length - 1)));
  };

  const autoSeedLeague = () => {
    if (!active || active.kind !== 'LEAGUE') return;
    skipLeagueAutoSeed.current = false;
    const groupCount = active.groupCount || 2;
    const teamsPerGroup = active.teamsPerGroup || 4;
    if (leagueIndexOf(active) === 1 && groupCount === 2 && teamsPerGroup === 4) {
      const royal = seedRoyalCarromLeague(teams);
      if (royal.some((g) => g.teamIds.some(Boolean))) {
        skipLeagueAutoSeed.current = true;
        const pairings = officialFirstLeaguePairings(teams, 1) || [];
        updateStage({
          groups: royal,
          groupCount: 2,
          teamsPerGroup: 4,
          seeding: 'MANUAL',
          startDay: active.startDay || 8,
          durationDays: active.durationDays || 3,
          matchPairings: pairings,
        });
        if (pairings.length) setLeaguePairings(pairings);
        return;
      }
    }
    const rankedIds = (rrStandings.length ? rrStandings.map((r) => r.teamId) : teams.map((t) => t.id));
    const seeded = seedLeagueGroups(rankedIds, groupCount, teamsPerGroup, active.seeding || 'RR_STANDINGS_SNAKE');
    updateStage({
      groups: seeded.map((g, i) => ({
        ...g,
        key: active.groups?.[i]?.key || g.key || String.fromCharCode(65 + i),
        name: active.groups?.[i]?.name || g.name,
      })),
      groupCount,
      teamsPerGroup,
      seeding: active.seeding || 'RR_STANDINGS_SNAKE',
    });
  };

  const resetLeagueTeams = () => {
    if (!active || active.kind !== 'LEAGUE') return;
    skipLeagueAutoSeed.current = true;
    const groupCount = active.groupCount || 2;
    const teamsPerGroup = active.teamsPerGroup || 4;
    updateStage({
      groups: emptyGroups(groupCount, teamsPerGroup).map((g, i) => ({
        ...g,
        name: active.groups?.[i]?.name || g.name,
        key: active.groups?.[i]?.key || g.key,
      })),
      seeding: 'MANUAL',
      matchPairings: [],
    });
    setLeaguePairings([]);
  };

  const resetLeagueGroup = (groupIndex: number) => {
    if (!active?.groups) return;
    skipLeagueAutoSeed.current = true;
    const teamsPerGroup = active.teamsPerGroup || 4;
    const groups = active.groups.map((g, i) =>
      i === groupIndex ? { ...g, teamIds: Array.from({ length: teamsPerGroup }, () => '') } : g
    );
    updateStage({ groups, seeding: 'MANUAL' });
  };

  React.useEffect(() => {
    if (loading || active?.kind !== 'LEAGUE' || !active) return;
    if (skipLeagueAutoSeed.current) return;
    if (isStageLocked(active)) return;

    if (leagueIndexOf(active) === 1) {
      const royal = seedRoyalCarromLeague(teams);
      if (!royal.some((g) => g.teamIds.some(Boolean))) return;
      const current = (active.groups || []).map((g) => ({ key: g.key, teamIds: g.teamIds || [] }));
      const expected = royal.map((g) => ({ key: g.key, teamIds: g.teamIds }));
      if (JSON.stringify(current) !== JSON.stringify(expected)) autoSeedLeague();
      return;
    }

    if (active.seeding === 'MANUAL') return;
    const assigned = (active.groups || []).some((g) => (g.teamIds || []).some(Boolean));
    if (!assigned && (rrStandings.length > 0 || teams.length > 0)) {
      autoSeedLeague();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, active?.id, active?.kind]);

  const setGroupName = (groupIndex: number, name: string) => {
    if (!active?.groups) return;
    skipLeagueAutoSeed.current = true;
    const groups = active.groups.map((g, i) => (i === groupIndex ? { ...g, name } : g));
    updateStage({ groups, seeding: 'MANUAL' });
  };

  const setGroupSlot = (groupIndex: number, slot: number, teamId: string) => {
    if (!active?.groups) return;
    skipLeagueAutoSeed.current = true;
    const groups = active.groups.map((g, gi) => {
      let teamIds = [...(g.teamIds || [])];
      if (teamId) {
        teamIds = teamIds.map((id, i) => (id === teamId && !(gi === groupIndex && i === slot) ? '' : id));
      }
      if (gi === groupIndex) {
        teamIds[slot] = teamId;
      }
      return { ...g, teamIds };
    });
    updateStage({ groups, seeding: 'MANUAL' });
  };

  const [leaguePairings, setLeaguePairings] = React.useState<SuggestedPairing[]>([]);
  const lastLeagueGroupSig = React.useRef('');
  const leagueGroupSignature = JSON.stringify(active?.kind === 'LEAGUE' ? active.groups || [] : []);

  const applyLeaguePairings = (next: SuggestedPairing[]) => {
    const enriched = next.map((p) => ({
      ...p,
      team1Name: teams.find((t) => t.id === p.team1Id)?.name || p.team1Name || '',
      team2Name: teams.find((t) => t.id === p.team2Id)?.name || p.team2Name || '',
    }));
    setLeaguePairings(enriched);
    updateStage({ matchPairings: enriched });
  };

  const slotLeaguePairings = (pairings: SuggestedPairing[]) =>
    pairingsAlreadyScheduled(pairings)
      ? pairings
      : assignScheduleSlots(pairings, {
          mode: scheduleMode,
          eventsPerDay,
          dayDates,
          startDay: active?.startDay || 8,
          durationDays: active?.durationDays || 3,
        });

  const leaguePairingsSource = () =>
    leaguePairingsForStage(active?.groups || [], teams, leagueIndexOf(active));

  React.useEffect(() => {
    if (active?.kind !== 'LEAGUE') return;
    const sig = leagueGroupSignature;
    const groupsChanged = sig !== lastLeagueGroupSig.current && lastLeagueGroupSig.current !== '';
    lastLeagueGroupSig.current = sig;
    const official = officialFirstLeaguePairings(teams, leagueIndexOf(active));

    if (groupsChanged) {
      applyLeaguePairings(slotLeaguePairings(official || suggestLeaguePairings(active.groups || [], teams, leagueIndexOf(active))));
      return;
    }
    if (active.matchPairings?.length) {
      const existing = active.matchPairings;
      if (official) {
        const pairKey = (p: SuggestedPairing) => [p.team1Id, p.team2Id].filter(Boolean).sort().join('|');
        const officialKeys = new Set(official.map(pairKey));
        const matchesOfficial =
          existing.length === official.length && existing.every((p) => officialKeys.has(pairKey(p)));
        if (!matchesOfficial) {
          applyLeaguePairings(official);
          return;
        }
      }
      const start = active.startDay || 8;
      const needsSlot =
        !pairingsAlreadyScheduled(existing) &&
        (existing.some((p) => !p.dayNumber) ||
          hasTeamPlayingTwiceOnSameDay(existing) ||
          existing.some((p) => p.round && p.dayNumber !== start + (p.round - 1)));
      if (needsSlot) applyLeaguePairings(slotLeaguePairings(existing));
      else setLeaguePairings(existing);
      return;
    }
    if (stageMatches.length) {
      const fromMatches = stageMatches.map((m, idx) => ({
        stage: m.stage || 'LEAGUE_A',
        label: `${formatMatchStage(m.stage)} · Match ${idx + 1}`,
        team1Id: m.team1Id || '',
        team2Id: m.team2Id || '',
        team1Name: m.team1?.name,
        team2Name: m.team2?.name,
        round: m.round,
      }));
      applyLeaguePairings(slotLeaguePairings(official || fromMatches));
      return;
    }
    applyLeaguePairings(slotLeaguePairings(leaguePairingsSource()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.kind, active?.id, leagueGroupSignature]);

  const suggestedQualifiers = React.useMemo(() => {
    const league = [...stages].reverse().find((s) => s.kind === 'LEAGUE');
    if (!league?.groups?.length) return [];
    const qualified = qualifiedFromGroups(league.groups, standingsByGroup, league.qualifyPerGroup || 2);
    return suggestQualifierPairings(qualified, active?.pairing || league.pairing || 'CROSS');
  }, [stages, standingsByGroup, active?.pairing]);

  const [qualifierPairings, setQualifierPairings] = React.useState(suggestedQualifiers);
  const [finalsPairings, setFinalsPairings] = React.useState(
    suggestFinalsPairings(
      matches.filter((m) => matchesStageKind(m.stage, 'QUALIFIER')),
      !!active?.includeThirdPlace
    )
  );

  const applyQualifierPairings = (next: SuggestedPairing[]) => {
    const enriched = next.map((p) => ({
      ...p,
      team1Name: teams.find((t) => t.id === p.team1Id)?.name || p.team1Name || '',
      team2Name: teams.find((t) => t.id === p.team2Id)?.name || p.team2Name || '',
    }));
    setQualifierPairings(enriched);
    updateStage({ matchPairings: enriched });
  };

  const applyFinalsPairings = (next: SuggestedPairing[]) => {
    const enriched = next.map((p) => ({
      ...p,
      team1Name: teams.find((t) => t.id === p.team1Id)?.name || p.team1Name || '',
      team2Name: teams.find((t) => t.id === p.team2Id)?.name || p.team2Name || '',
    }));
    setFinalsPairings(enriched);
    updateStage({
      matchPairings: enriched,
      includeThirdPlace: enriched.some((p) => p.stage === 'THIRD_PLACE'),
    });
  };

  const [spocPairings, setSpocPairings] = React.useState<SuggestedPairing[]>([]);
  const applySpocPairings = (next: SuggestedPairing[]) => {
    const enriched = next.map((p) => ({
      ...p,
      team1Name: spocTeams.find((t) => t.id === p.team1Id)?.name || p.team1Name || '',
      team2Name: spocTeams.find((t) => t.id === p.team2Id)?.name || p.team2Name || '',
    }));
    setSpocPairings(enriched);
    updateStage({ matchPairings: enriched });
  };

  const handleSpocEventCountChange = (count: number) => {
    const formats = [...(active?.spocEventFormats || ['SINGLES', 'DOUBLES', 'SINGLES'])];
    const cycle = ['SINGLES', 'DOUBLES', 'SINGLES', 'DOUBLES', 'TRIPLES'];
    while (formats.length < count) formats.push(cycle[formats.length % cycle.length]);
    formats.length = count;
    updateStage({ spocEventCount: count, spocEventFormats: formats });
  };

  React.useEffect(() => {
    if (active?.kind !== 'QUALIFIER') return;
    if (active.matchPairings?.length) {
      setQualifierPairings(active.matchPairings);
      return;
    }
    applyQualifierPairings(
      suggestedQualifiers.length
        ? suggestedQualifiers
        : [
            { stage: 'QUALIFIER_1', label: 'Qualifier 1', team1Id: '', team2Id: '', team1Name: '', team2Name: '' },
            { stage: 'QUALIFIER_2', label: 'Qualifier 2', team1Id: '', team2Id: '', team1Name: '', team2Name: '' },
          ]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.kind, active?.id]);

  React.useEffect(() => {
    if (active?.kind !== 'FINALS') return;
    if (active.matchPairings?.length) {
      setFinalsPairings(active.matchPairings);
      return;
    }
    applyFinalsPairings(
      suggestFinalsPairings(
        matches.filter((m) => matchesStageKind(m.stage, 'QUALIFIER')),
        !!active.includeThirdPlace
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.kind, active?.id]);

  React.useEffect(() => {
    if (active?.kind !== 'SPOC_EXHIBITION') return;
    if (active.matchPairings?.length) {
      setSpocPairings(active.matchPairings);
      return;
    }
    applySpocPairings([nextSpocExhibitionPairing([])]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.kind, active?.id]);

  const allDraftPairings = React.useMemo(
    () => [...leaguePairings, ...qualifierPairings, ...finalsPairings, ...spocPairings],
    [leaguePairings, qualifierPairings, finalsPairings, spocPairings],
  );

  const takenIdsFor = (pair: SuggestedPairing | undefined) =>
    teamIdsBookedOnDay(
      allDraftPairings.filter((p) => p !== pair),
      pair?.dayNumber,
    );

  const stagedConfig = (): TournamentStageConfig => ({
    scheduleMode,
    stages: config.stages.map((s, idx) => {
      if (idx !== activeIndex) return s;
      if (s.kind === 'LEAGUE') return { ...s, matchPairings: leaguePairings };
      if (s.kind === 'QUALIFIER') return { ...s, matchPairings: qualifierPairings };
      if (s.kind === 'FINALS') return { ...s, matchPairings: finalsPairings };
      if (s.kind === 'SPOC_EXHIBITION') return { ...s, matchPairings: spocPairings };
      return s;
    }),
  });

  const handleSave = async () => {
    if (!editionId) return;
    const clash = allDraftPairings.filter((p) => p.dayNumber && (p.team1Id || p.team2Id));
    if (hasTeamPlayingTwiceOnSameDay(clash)) {
      setMessage({
        type: 'err',
        text: 'A team cannot play two matches on the same day. Clear the duplicate booking, then save.',
      });
      return;
    }
    setSaving(true);
    setMessage(null);
    const res = await saveTournamentStageConfig(editionId, stagedConfig());
    setSaving(false);
    if (res.success) {
      setConfig(res.config);
      setMessage({ type: 'ok', text: 'Tournament stage design saved.' });
    } else {
      setMessage({ type: 'err', text: res.error || 'Failed to save stage design.' });
    }
  };

  const dayOptions = React.useMemo(
    () =>
      Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => ({
        day,
        date: dayDates[day],
        completed: day !== currentEventDay && isCalendarDayCompleted(day, dayDates),
      })),
    [totalDays, dayDates, currentEventDay]
  );

  if (!editionId) return null;

  const dbRrCount = matches.filter((m) => m.stage === 'ROUND_ROBIN').length;
  const rrCount = Math.max(dbRrCount, roundRobinMatchCount());

  return (
    <Card className="border-emerald-500/30">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-emerald-400" /> Tournament Stage Designer
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pick how many stages this tournament has, then arrange teams and days. Save anytime. Completed days stay locked.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="carrom" className="font-extrabold text-xs px-3 py-1">
              {daysNeeded} Days
            </Badge>
            <Badge variant="carrom" className="font-extrabold text-xs px-3 py-1">
              {teams.length || 0} Teams
            </Badge>
            <Badge variant="success" className="font-extrabold text-xs px-3 py-1">
              {rrCount} Round Robin Matches
            </Badge>
            <Button type="button" variant="carrom" size="sm" className="text-xs font-bold" onClick={handleSave} disabled={saving || loading}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading stage design…
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-amber-500">1. Tournament path</div>
                <p className="text-[11px] text-muted-foreground mt-1">Add or remove stages here. Days fill in after the last completed day.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
              {stages.map((stage, idx) => {
                const locked = isStageLocked(stage);
                const isActive = idx === activeIndex;
                return (
                  <React.Fragment key={stage.id}>
                    {idx > 0 ? <ArrowRight className="h-3.5 w-3.5 text-amber-500 shrink-0" /> : null}
                    <div
                      className={`flex items-center gap-1 rounded-full border px-2 py-1 ${
                        isActive ? 'border-amber-500 bg-amber-500/15' : 'border-border bg-card'
                      }`}
                    >
                      <button type="button" onClick={() => setActiveIndex(idx)} className="text-[11px] font-black px-1">
                        {idx + 1}. {stage.name}
                      </button>
                      {locked ? (
                        <span className="text-[9px] font-bold text-muted-foreground pr-1">Locked</span>
                      ) : stages.length > 1 ? (
                        <button type="button" className="h-6 w-6 inline-flex items-center justify-center text-muted-foreground hover:text-rose-400" onClick={() => removeStage(idx)} aria-label={`Remove ${stage.name}`}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </React.Fragment>
                );
              })}
              <div className="flex items-center gap-1">
                {!stages.some((s) => s.kind === 'LEAGUE') || stages.filter((s) => s.kind === 'LEAGUE').length < 3 ? (
                  <Button type="button" variant="outline" size="sm" className="h-8 text-[11px] font-bold" onClick={() => addStage('LEAGUE')}>
                    <Plus className="h-3.5 w-3.5" /> Add league
                  </Button>
                ) : null}
                {!stages.some((s) => s.kind === 'QUALIFIER') ? (
                  <Button type="button" variant="outline" size="sm" className="h-8 text-[11px] font-bold" onClick={() => addStage('QUALIFIER')}>
                    <Plus className="h-3.5 w-3.5" /> Add qualifiers
                  </Button>
                ) : null}
                {!stages.some((s) => s.kind === 'FINALS') ? (
                  <Button type="button" variant="outline" size="sm" className="h-8 text-[11px] font-bold" onClick={() => addStage('FINALS')}>
                    <Plus className="h-3.5 w-3.5" /> Add final
                  </Button>
                ) : null}
                {!stages.some((s) => s.kind === 'SPOC_EXHIBITION') ? (
                  <Button type="button" variant="outline" size="sm" className="h-8 text-[11px] font-bold border-violet-500/40 text-violet-300" onClick={() => addStage('SPOC_EXHIBITION')}>
                    <Plus className="h-3.5 w-3.5" /> Spoc exhibition
                  </Button>
                ) : null}
              </div>
              </div>
            </div>

            {lastDoneDay > 0 ? (
              <p className="text-[11px] font-semibold text-muted-foreground">
                Days 1–{lastDoneDay} are completed and locked. Upcoming days can still be edited and saved.
              </p>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-border bg-muted/20 p-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Event start date (Day 1)</label>
                <Input
                  type="date"
                  value={startDate || dayDates[1] || ''}
                  onChange={(e) => onStartDateChange?.(e.target.value)}
                  className="h-9 text-xs font-bold font-mono bg-background"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Number of event days</label>
                <div className="h-9 px-3 rounded-lg border border-input bg-background flex items-center text-xs font-bold">
                  {daysNeeded} days
                  <span className="ml-2 text-[10px] font-semibold text-muted-foreground">from the stage path</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {stages.map((stage, idx) => {
                const generated = matches.some((m) => stageMatchStages(stage).includes(m.stage || ''));
                const isActive = idx === activeIndex;
                const locked = isStageLocked(stage);
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      isActive ? 'border-amber-500 bg-amber-500/10' : 'border-border bg-card hover:border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Stage {idx + 1}</span>
                      {locked ? (
                        <Badge variant="outline" className="text-[9px] px-2 py-0">Locked</Badge>
                      ) : generated ? (
                        <Badge variant="success" className="text-[9px] px-2 py-0">Live</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] px-2 py-0">Draft</Badge>
                      )}
                    </div>
                    <div className="text-sm font-black">{stage.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 font-semibold">
                      {stage.startDay ? `Days ${stage.startDay}–${stage.startDay + (stage.durationDays || 1) - 1}` : 'Days to be assigned'}
                    </div>
                  </button>
                );
              })}
            </div>

            {message && (
              <div
                className={`text-xs font-semibold rounded-lg px-3 py-2 border ${
                  message.type === 'ok'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-muted/20 p-4 sm:p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Stage name</label>
                  <input
                    value={active?.name || ''}
                    onChange={(e) => updateStage({ name: e.target.value })}
                    disabled={!!active && isStageLocked(active)}
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-xs font-bold disabled:opacity-60"
                  />
                </div>
                <div className="flex items-end">
                  <p className="text-[11px] text-muted-foreground font-medium pb-2">
                    {active?.kind === 'ROUND_ROBIN' && 'All teams play each other once.'}
                    {active?.kind === 'LEAGUE' && 'Put teams into groups. Each team plays one game per day.'}
                    {active?.kind === 'QUALIFIER' && 'Knockout matches after the last group stage.'}
                    {active?.kind === 'FINALS' && 'Grand Final. Optional 3rd place.'}
                    {active?.kind === 'SPOC_EXHIBITION' && 'Exhibition matches only — pick Spoc teams and schedule on any day (qualifier, final, etc.).'}
                  </p>
                </div>
              </div>

              {active?.kind !== 'SPOC_EXHIBITION' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Starts on event day</label>
                  <Select
                    value={String(active?.startDay || '')}
                    onChange={(e) => updateStage({ startDay: parseInt(e.target.value, 10) })}
                    disabled={!!active && isStageLocked(active)}
                    className="h-9 text-xs font-bold"
                  >
                    <option value="">Select day…</option>
                    {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day} disabled={isDayLocked(day) && day !== active?.startDay}>
                        Day {day}{dayDates[day] ? ` · ${dayDates[day]}` : ''}{isDayLocked(day) ? ' (locked)' : ''}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Runs for</label>
                  <Select
                    value={String(active?.durationDays || 1)}
                    onChange={(e) => {
                      const durationDays = parseInt(e.target.value, 10);
                      const next = stages.map((s, idx) => (idx === activeIndex ? { ...s, durationDays } : s));
                      setConfig((prev) => ({ ...prev, stages: layoutStageDays(next, lastDoneDay) }));
                    }}
                    disabled={!!active && isStageLocked(active)}
                    className="h-9 text-xs font-bold"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>{n} day{n > 1 ? 's' : ''}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex items-end">
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {lastCompletedDay(dayDates) > 0
                      ? `Day ${lastCompletedDay(dayDates)} is completed. ${active?.name || 'This stage'} is set for Days ${active?.startDay || lastCompletedDay(dayDates) + 1}–${(active?.startDay || lastCompletedDay(dayDates) + 1) + (active?.durationDays || 1) - 1}.`
                      : `Day window follows the stage path. Set the event start date above.`}
                  </p>
                </div>
              </div>
              )}

              {active?.kind === 'SPOC_EXHIBITION' && (
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-[11px] text-muted-foreground font-medium">
                  Spoc exhibition is separate from the main tournament. Assign each match to any event day below — qualifier day, final day, or any other day.
                  {spocTeams.length === 0 ? (
                    <span className="block mt-1 text-rose-400 font-bold">Create Spoc exhibition teams under the Teams tab first.</span>
                  ) : null}
                </div>
              )}

              {active?.kind === 'ROUND_ROBIN' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-500 uppercase tracking-wider">
                    <Users className="h-4 w-4" /> Stage 1 · Round Robin · {teams.length || 8} teams
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Bicentennial Monuments 1–7 are Stage 1. Each day has 4 matches so every team plays once. Completed monument days are locked.
                  </p>
                  <div className="space-y-2">
                    {BICENTENNIAL_MONUMENTS.map((monument) => {
                      const status = monumentStatus(monument);
                      return (
                        <div key={monument.monumentNumber} className="rounded-xl border border-border bg-card p-3 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-amber-500">
                              Day {monument.monumentNumber} · {monument.title}
                            </span>
                            <span className="text-[10px] font-bold text-muted-foreground">
                              {status === 'completed' ? 'Completed · locked' : status === 'live' ? 'Live' : 'Upcoming'} · {monument.matches.length} matches
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{monument.timeRange}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {monument.matches.map((match, idx) => (
                              <div key={`${monument.monumentNumber}-${idx}`} className="text-[11px] font-semibold text-muted-foreground">
                                <span className="text-emerald-400">{match.team1}</span>
                                <span className="text-[10px] font-black mx-1">VS</span>
                                <span className="text-rose-400">{match.team2}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {active?.kind === 'LEAGUE' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Groups</label>
                      <Select
                        value={String(active.groupCount || 2)}
                        onChange={(e) => {
                          const groupCount = parseInt(e.target.value, 10);
                          const teamsPerGroup = active.teamsPerGroup || 4;
                          updateStage({ groupCount, groups: emptyGroups(groupCount, teamsPerGroup, active.groups) });
                        }}
                        className="h-9 text-xs font-bold"
                        disabled={isStageLocked(active)}
                      >
                        <option value="2">2 Groups</option>
                        <option value="3">3 Groups</option>
                        <option value="4">4 Groups</option>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Teams / group</label>
                      <Select
                        value={String(active.teamsPerGroup || 4)}
                        onChange={(e) => {
                          const teamsPerGroup = parseInt(e.target.value, 10);
                          const groupCount = active.groupCount || 2;
                          updateStage({ teamsPerGroup, groups: emptyGroups(groupCount, teamsPerGroup, active.groups) });
                        }}
                        className="h-9 text-xs font-bold"
                        disabled={isStageLocked(active)}
                      >
                        <option value="3">3 Teams</option>
                        <option value="4">4 Teams</option>
                        <option value="5">5 Teams</option>
                        <option value="6">6 Teams</option>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Qualify / group</label>
                      <Select
                        value={String(active.qualifyPerGroup || 2)}
                        onChange={(e) => updateStage({ qualifyPerGroup: parseInt(e.target.value, 10) })}
                        className="h-9 text-xs font-bold"
                      >
                        <option value="1">Top 1</option>
                        <option value="2">Top 2</option>
                        <option value="3">Top 3</option>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Seeding</label>
                      <Select
                        value={active.seeding || 'RR_STANDINGS_SNAKE'}
                        onChange={(e) => updateStage({ seeding: e.target.value as StageSeeding })}
                        className="h-9 text-xs font-bold"
                      >
                        <option value="RR_STANDINGS_SNAKE">Snake from RR table</option>
                        <option value="RR_STANDINGS_SPLIT">1–4 / 5–8 split</option>
                        <option value="MANUAL">Manual assignment</option>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" className="text-xs font-bold" onClick={resetLeagueTeams} disabled={isStageLocked(active)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Reset teams
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(active.groups || emptyGroups(active.groupCount || 2, active.teamsPerGroup || 4)).map((group, groupIndex) => (
                      <div key={group.key || groupIndex} className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            value={group.name}
                            onChange={(e) => setGroupName(groupIndex, e.target.value)}
                            disabled={!!active && isStageLocked(active)}
                            placeholder="Group name"
                            className="flex h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-xs font-black uppercase tracking-wider text-amber-500 disabled:opacity-60"
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-muted-foreground font-bold">
                              {(group.teamIds || []).filter(Boolean).length}/{active.teamsPerGroup || 4} teams
                            </span>
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold" onClick={() => resetLeagueGroup(groupIndex)} disabled={!!active && isStageLocked(active)}>
                              Clear
                            </Button>
                          </div>
                        </div>
                        {(group.teamIds || Array.from({ length: active.teamsPerGroup || 4 }, () => '')).map((teamId, slot) => (
                          <TeamSlotSelect
                            key={`${groupKey(group, groupIndex)}-${slot}`}
                            value={teamId}
                            teams={teams}
                            includeTag
                            onChange={(id) => setGroupSlot(groupIndex, slot, id)}
                            locked={!!active && isStageLocked(active)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-500 uppercase tracking-wider">League matches</span>
                      <span className="text-[10px] font-bold text-muted-foreground">{leaguePairings.length} pairings</span>
                    </div>
                    {(active.groups || []).map((group, groupIndex) => {
                      const groupStage = leagueStageKey(groupKey(group, groupIndex), leagueIndexOf(active));
                      const label = groupLabel(group, groupIndex);
                      const groupPairs = leaguePairings
                        .map((pair, idx) => ({ pair, idx }))
                        .filter(({ pair }) => pair.stage === groupStage)
                        .sort((a, b) => (a.pair.round || 0) - (b.pair.round || 0) || a.idx - b.idx);
                      return (
                        <div key={group.key || groupIndex} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{label}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-[11px] font-bold h-7"
                              onClick={() => {
                                applyLeaguePairings([
                                  ...leaguePairings,
                                  {
                                    stage: groupStage,
                                    label: `${label} · Match ${groupPairs.length + 1}`,
                                    team1Id: '',
                                    team2Id: '',
                                  },
                                ]);
                              }}
                            >
                              <Plus className="h-3.5 w-3.5" /> Add match
                            </Button>
                          </div>
                          {groupPairs.map(({ pair, idx }) => (
                            <EditablePairingRow
                              key={`${pair.stage}-${idx}`}
                              label={pair.label || `${label} · Match`}
                              team1Id={pair.team1Id}
                              team2Id={pair.team2Id}
                              teams={teams}
                              meta={formatPairingSlot(pair)}
                              dayNumber={pair.dayNumber}
                              dayOptions={dayOptions}
                              locked={isDayLocked(pair.dayNumber)}
                              onDay={(day) => {
                                if (isDayLocked(day) || isDayLocked(pair.dayNumber)) return;
                                const copy = [...leaguePairings];
                                copy[idx] = retargetPairingDay(copy[idx], day, dayDates);
                                applyLeaguePairings(copy);
                              }}
                              onTeam1={(id) => {
                                const copy = [...leaguePairings];
                                copy[idx] = setPairingTeam(copy[idx], 1, id, teams);
                                applyLeaguePairings(copy);
                              }}
                              onTeam2={(id) => {
                                const copy = [...leaguePairings];
                                copy[idx] = setPairingTeam(copy[idx], 2, id, teams);
                                applyLeaguePairings(copy);
                              }}
                              onRemove={() => applyLeaguePairings(leaguePairings.filter((_, i) => i !== idx))}
                              warning={teamsPlayingTwiceOnDay(allDraftPairings, allDraftPairings.indexOf(pair), teams)}
                              takenIds={takenIdsFor(pair)}
                            />
                          ))}
                          {groupPairs.length === 0 && (
                            <p className="text-[11px] text-muted-foreground px-1">No matches in this group yet. Add a match or auto-seed groups to fill pairings.</p>
                          )}
                        </div>
                      );
                    })}
                    <p className="text-[11px] text-muted-foreground">
                      Each team plays one game per day — one group round per day, both groups on the same day.
                    </p>
                  </div>
                </div>
              )}

              {active?.kind === 'QUALIFIER' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    <div className="flex-1 max-w-sm">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Pairing</label>
                      <Select
                        value={active.pairing || 'CROSS'}
                        onChange={(e) => {
                          const pairing = e.target.value as QualifierPairing;
                          updateStage({ pairing });
                          const extras = qualifierPairings.filter((p) => !['QUALIFIER_1', 'QUALIFIER_2'].includes(p.stage));
                          const seeded = suggestedQualifiers.length
                            ? suggestedQualifiers
                            : [
                                { stage: 'QUALIFIER_1', label: 'Qualifier 1', team1Id: '', team2Id: '', team1Name: '', team2Name: '' },
                                { stage: 'QUALIFIER_2', label: 'Qualifier 2', team1Id: '', team2Id: '', team1Name: '', team2Name: '' },
                              ];
                          applyQualifierPairings([...seeded, ...extras]);
                        }}
                        className="h-9 text-xs font-bold"
                      >
                        <option value="CROSS">Cross: A1 vs B2 · B1 vs A2</option>
                        <option value="RANKED">Ranked: 1st vs 2nd · 3rd vs 4th</option>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-[11px] font-bold h-9"
                      onClick={() => applyQualifierPairings([...qualifierPairings, nextQualifierPairing(qualifierPairings)])}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add match
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {qualifierPairings.map((pair, idx) => (
                      <EditablePairingRow
                        key={`${pair.stage}-${idx}`}
                        label={pair.label || `Qualifier ${idx + 1}`}
                        team1Id={pair.team1Id}
                        team2Id={pair.team2Id}
                        teams={teams}
                        meta={formatPairingSlot(pair)}
                        dayNumber={pair.dayNumber}
                        dayOptions={dayOptions}
                        locked={isDayLocked(pair.dayNumber)}
                        onDay={(day) => {
                          if (isDayLocked(day) || isDayLocked(pair.dayNumber)) return;
                          const copy = [...qualifierPairings];
                          copy[idx] = retargetPairingDay(copy[idx], day, dayDates);
                          applyQualifierPairings(copy);
                        }}
                        onTeam1={(id) => {
                          const copy = [...qualifierPairings];
                          copy[idx] = setPairingTeam(copy[idx], 1, id, teams);
                          applyQualifierPairings(copy);
                        }}
                        onTeam2={(id) => {
                          const copy = [...qualifierPairings];
                          copy[idx] = setPairingTeam(copy[idx], 2, id, teams);
                          applyQualifierPairings(copy);
                        }}
                        onRemove={() => applyQualifierPairings(qualifierPairings.filter((_, i) => i !== idx))}
                        warning={teamsPlayingTwiceOnDay(allDraftPairings, allDraftPairings.indexOf(pair), teams)}
                        takenIds={takenIdsFor(pair)}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Add extra qualifier or placement matches as needed. A team can play only one match per day. Completed days stay locked.
                  </p>
                </div>
              )}

              {active?.kind === 'FINALS' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Grand Final plus position matches (3rd, 5th, 7th). Add as many as you need.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-[11px] font-bold h-9"
                      onClick={() => applyFinalsPairings([...finalsPairings, nextFinalsPairing(finalsPairings)])}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add match
                    </Button>
                  </div>
                  {(finalsPairings.length ? finalsPairings : [{ stage: 'GRAND_FINAL', label: 'Grand Final', team1Id: '', team2Id: '', team1Name: '', team2Name: '' }]).map((pair, idx) => (
                    <EditablePairingRow
                      key={`${pair.stage}-${idx}`}
                      label={pair.label || `Finals match ${idx + 1}`}
                      team1Id={pair.team1Id}
                      team2Id={pair.team2Id}
                      teams={activeStageTeams}
                      meta={formatPairingSlot(pair)}
                      dayNumber={pair.dayNumber}
                      dayOptions={dayOptions}
                      locked={isDayLocked(pair.dayNumber)}
                      onDay={(day) => {
                        if (isDayLocked(day) || isDayLocked(pair.dayNumber)) return;
                        const copy = [...finalsPairings];
                        copy[idx] = retargetPairingDay(copy[idx], day, dayDates);
                        applyFinalsPairings(copy);
                      }}
                      onTeam1={(id) => {
                        const copy = [...finalsPairings];
                        copy[idx] = setPairingTeam(copy[idx], 1, id, activeStageTeams);
                        applyFinalsPairings(copy);
                      }}
                      onTeam2={(id) => {
                        const copy = [...finalsPairings];
                        copy[idx] = setPairingTeam(copy[idx], 2, id, activeStageTeams);
                        applyFinalsPairings(copy);
                      }}
                      onRemove={() => applyFinalsPairings(finalsPairings.filter((_, i) => i !== idx))}
                      warning={teamsPlayingTwiceOnDay(allDraftPairings, allDraftPairings.indexOf(pair), activeStageTeams)}
                      takenIds={takenIdsFor(pair)}
                    />
                  ))}
                </div>
              )}

              {active?.kind === 'SPOC_EXHIBITION' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-black text-violet-300 uppercase tracking-wider">
                          Spoc Exhibition Event Formats
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Separate from main tournament events — configure how many boards/events each Spoc match has.
                        </p>
                      </div>
                      <Select
                        value={String(active.spocEventCount || 3)}
                        onChange={(e) => handleSpocEventCountChange(parseInt(e.target.value, 10))}
                        className="h-9 w-36 text-xs font-bold"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                          <option key={n} value={n}>{n} Events</option>
                        ))}
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(active.spocEventFormats || ['SINGLES', 'DOUBLES', 'SINGLES']).map((format, idx) => (
                        <div key={idx} className="rounded-lg border border-violet-500/20 bg-card/80 p-3 space-y-1.5">
                          <div className="text-[10px] font-black text-violet-400 uppercase">Event {idx + 1}</div>
                          <Select
                            value={format}
                            onChange={(e) => {
                              const copy = [...(active.spocEventFormats || ['SINGLES', 'DOUBLES', 'SINGLES'])];
                              copy[idx] = e.target.value;
                              updateStage({ spocEventFormats: copy });
                            }}
                            className="h-8 text-xs font-bold w-full"
                          >
                            <option value="SINGLES">Singles (1v1)</option>
                            <option value="DOUBLES">Doubles (2v2)</option>
                            <option value="TRIPLES">Triples (3v3)</option>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Exhibition matches between Spoc teams. Pick the event day for each match.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-[11px] font-bold h-9 border-violet-500/40"
                      onClick={() => applySpocPairings([...spocPairings, nextSpocExhibitionPairing(spocPairings)])}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add match
                    </Button>
                  </div>
                  {(spocPairings.length ? spocPairings : [nextSpocExhibitionPairing([])]).map((pair, idx) => (
                    <EditablePairingRow
                      key={`${pair.stage}-${idx}`}
                      label={pair.label || `Spoc match ${idx + 1}`}
                      team1Id={pair.team1Id}
                      team2Id={pair.team2Id}
                      teams={activeStageTeams}
                      meta={formatPairingSlot(pair)}
                      dayNumber={pair.dayNumber}
                      dayOptions={dayOptions}
                      locked={false}
                      onDay={(day) => {
                        const copy = [...spocPairings];
                        copy[idx] = retargetPairingDay(copy[idx], day, dayDates);
                        applySpocPairings(copy);
                      }}
                      onTeam1={(id) => {
                        const copy = [...spocPairings];
                        copy[idx] = setPairingTeam(copy[idx], 1, id, activeStageTeams);
                        applySpocPairings(copy);
                      }}
                      onTeam2={(id) => {
                        const copy = [...spocPairings];
                        copy[idx] = setPairingTeam(copy[idx], 2, id, activeStageTeams);
                        applySpocPairings(copy);
                      }}
                      onRemove={() => applySpocPairings(spocPairings.filter((_, i) => i !== idx))}
                      warning={teamsPlayingTwiceOnDay(allDraftPairings, allDraftPairings.indexOf(pair), activeStageTeams)}
                      takenIds={takenIdsFor(pair)}
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button type="button" variant="outline" className="text-xs font-bold" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </Button>
              </div>
            </div>

            {active?.kind !== 'LEAGUE' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Trophy className="h-4 w-4" /> {active?.name} fixtures
                </span>
                <span className="text-[10px] font-bold text-muted-foreground">{stageMatches.length} matches</span>
              </div>
              <div className="overflow-auto max-h-72 rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Team 1</TableHead>
                      <TableHead>Team 2</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stageMatches.map((match) => (
                      <TableRow key={match.id}>
                        <TableCell className="font-mono text-xs">#{match.matchNumber}</TableCell>
                        <TableCell className="text-xs"><Badge variant="outline">{formatMatchStage(match.stage)}</Badge></TableCell>
                        <TableCell className="text-[11px] font-semibold text-muted-foreground">
                          {formatPairingSlot({
                            stage: match.stage || '',
                            label: '',
                            team1Id: match.team1Id || '',
                            team2Id: match.team2Id || '',
                            round: match.round,
                            tableNumber: match.tableNumber || undefined,
                            scheduledTime: match.scheduledTime ? String(match.scheduledTime) : undefined,
                          }) || '—'}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-emerald-400">{match.team1?.name || teamLabel(activeStageTeams, match.team1Id)}</TableCell>
                        <TableCell className="text-xs font-bold text-rose-400">{match.team2?.name || teamLabel(activeStageTeams, match.team2Id)}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={match.status === 'COMPLETED' ? 'success' : match.status === 'LIVE' ? 'warning' : 'outline'}>
                            {match.status === 'COMPLETED' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {match.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {stageMatches.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                          No fixtures for this stage yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
