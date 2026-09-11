'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { MOCK_TEAMS, MOCK_PATTERN_LIBRARY } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/avatar';
import { Crown, Trophy, Calendar, CheckCircle2, Send, AlertCircle, Lock, Save, Sparkles, ChevronRight, History, RotateCcw, X, UserCheck, PartyPopper, ShieldCheck, Info, CreditCard } from 'lucide-react';
import { sendLineupEmailAction, saveTeamDailyLineup } from '@/lib/actions/lineupActions';
import { getTeamDayScores, submitTeamDayScores, getPublicScoreboard } from '@/lib/actions/playerScoreActions';
import { BoardScoreEditor } from '@/components/scores/BoardScoreEditor';
import { ScoreEditRules } from '@/components/scores/ScoreEditRules';
import { SCORE_EDIT_CAPTAIN_CLOSED, SCORE_EDIT_CAPTAIN_HELP } from '@/lib/score-edit-policy';
import { PlayerEnrollmentCard, type PlayerEnrollmentInfo } from '@/components/player/PlayerEnrollmentCard';
import { DEFAULT_WEBSITE_CMS } from '@/lib/website-cms';
import {
  aggregateBoards,
  boardsToDraft,
  draftToPayload,
  previewTargetBonus,
  type BoardDraft,
} from '@/lib/board-scores';
import {
  buildDayDatesMap,
  currentCombiDayNumber,
  formatIsoDateLabel,
  isCombiSubmissionLocked,
  normalizeDayDates,
} from '@/lib/combi-cutoff';
import { combiRoundLabel } from '@/lib/combi-round-label';
import { resolveEffectiveTeamCombi } from '@/lib/combi-fallback';
import { formatToIst, getClientTimeZone } from '@/lib/ist-time';
import PlayerClient from '../player/PlayerClient';
function isDayLocked(dayNum: number, dayDatesMap: Record<number, string>): boolean {
  return isCombiSubmissionLocked(dayNum, dayDatesMap);
}

function mapTeamScorePlayers(players: any[]) {
  return (players || []).map((p: any) => {
    const boards = boardsToDraft(p.boards, p.score, p.slams);
    return {
      userId: p.userId,
      name: p.name,
      score: p.score == null ? '' : String(p.score),
      slams: p.slams == null ? '0' : String(p.slams),
      boards,
      target: Number(p.target) || 0,
      missingPrior: Boolean(p.missingPrior),
      average: Number(p.averageInEffect ?? p.average) || 0,
    };
  });
}

function rowFilledBoards(row: { boards?: BoardDraft[]; score: string; slams: string }) {
  const fromDrafts = draftToPayload(row.boards || []).filter((b) => Number.isFinite(b.score) && b.score >= 0);
  if (fromDrafts.length) return fromDrafts;
  const score = parseInt(row.score, 10);
  if (!Number.isFinite(score) || row.score === '') return [];
  return [{ score, slams: parseInt(row.slams || '0', 10) || 0 }];
}

function rowHasTargetBonus(row: { boards?: BoardDraft[]; score: string; slams: string; target?: number }): boolean | null {
  const filled = rowFilledBoards(row);
  if (!filled.length) return null;
  return previewTargetBonus(aggregateBoards(filled).score, row.target);
}

function avgBonusText(row: { boards?: BoardDraft[]; score: string; slams: string; target?: number }) {
  const yes = rowHasTargetBonus(row);
  if (yes == null) return 'Bonus —';
  return yes ? 'Bonus Yes' : 'Bonus No';
}

function combiPlayerLabel(
  member: { id: string; name?: string; username?: string },
  rows: Array<{ userId: string; score: string; slams: string; boards?: BoardDraft[]; target?: number }>,
) {
  const name = member.name || member.username || 'Player';
  const row = rows.find((r) => r.userId === member.id);
  if (!row) return `${name} · — · Bonus —`;
  const filled = rowFilledBoards(row);
  if (!filled.length) return `${name} · — · Bonus —`;
  const agg = aggregateBoards(filled);
  return `${name} · ${agg.score} · ${agg.boardCount}b · ${avgBonusText(row)}`;
}

// Helper: how many players a format needs per round
function playersNeeded(format: string): number {
  if (format.includes('TRIPLES') || format.includes('QUADRUPLES')) return 4;
  if ((format.match(/TRIPLES/) || format.includes('3v3'))) return 3;
  if (format.includes('DOUBLES') || format.includes('2v2')) return 2;
  return 1;
}

// More precise helper
function playersForFormat(format: string): number {
  const f = format.toUpperCase();
  if (f.includes('QUADRUPLES')) return 4;
  if (f.includes('TRIPLES')) return 3;
  if (f.includes('DOUBLES')) return 2;
  return 1;
}

export default function CaptainClient({
  initialTeam,
  initialMembers,
  initialSpocTeam,
  initialSpocMembers = [],
  initialPlayerTeam,
  initialAllTeams = [],
  initialAllUsers = [],
  initialActiveEdition,
  initialPlayer,
  initialPlayerMatches = [],
  initialPlayerStreams = [],
  initialPatterns = [],
  registrationEnrollment = null,
  currentEditionInfo = null,
  shortName = DEFAULT_WEBSITE_CMS.site.shortName,
  editionLabel = DEFAULT_WEBSITE_CMS.site.editionLabel,
}: {
  initialTeam?: any;
  initialMembers?: any[];
  initialSpocTeam?: any;
  initialSpocMembers?: any[];
  initialPlayerTeam?: any;
  initialAllTeams?: any[];
  initialAllUsers?: any[];
  initialActiveEdition?: any;
  initialPlayer?: any;
  initialPlayerMatches?: any[];
  initialPlayerStreams?: any[];
  initialPatterns?: any[];
  registrationEnrollment?: PlayerEnrollmentInfo | null;
  currentEditionInfo?: { id: string; title: string; number: number; status: string } | null;
  shortName?: string;
  editionLabel?: string;
}) {
  const { data: session } = useSession();
  const sessionUser = (session?.user as any);

  const mainTeam = initialTeam && initialTeam.teamType !== 'SPOC_EXHIBITION' ? initialTeam : null;
  const spocTeam = initialSpocTeam || (initialTeam?.teamType === 'SPOC_EXHIBITION' ? initialTeam : null);
  const hasMainCaptainDesk = Boolean(initialActiveEdition?.hasMainCaptainDesk) || Boolean(mainTeam);
  const hasSpocCaptainDesk = Boolean(initialActiveEdition?.hasSpocCaptainDesk) || Boolean(spocTeam);
  const hasBothCaptainDesks = hasMainCaptainDesk && hasSpocCaptainDesk;
  const [activeDesk, setActiveDesk] = React.useState<'main' | 'spoc'>(hasMainCaptainDesk ? 'main' : 'spoc');
  React.useEffect(() => {
    const desk = new URLSearchParams(window.location.search).get('desk');
    if (desk === 'spoc' || desk === 'main') setActiveDesk(desk);
  }, []);

  // Active Team & Roster Context
  const currentTeam =
    activeDesk === 'spoc' && spocTeam
      ? spocTeam
      : mainTeam || initialTeam || MOCK_TEAMS[0];
  const teamMembers =
    activeDesk === 'spoc' && spocTeam
      ? (initialSpocMembers.length > 0
          ? initialSpocMembers
          : currentTeam.spocMembers?.map((m: any) => m.user).filter(Boolean) || [])
      : (initialMembers && initialMembers.length > 0)
        ? initialMembers
        : (currentTeam.members?.map((m: any) => m.user) || []);

  const allTeams = (initialAllTeams && initialAllTeams.length > 0) ? initialAllTeams : MOCK_TEAMS;

  // Round formats from organiser — main tournament or Spoc exhibition stage
  const isSpocTeam = currentTeam?.teamType === 'SPOC_EXHIBITION';
  const spocMatchDays: Array<{ dayNumber: number; opponentName?: string; opponentTag?: string }> =
    initialActiveEdition?.spocMatchDays || [];

  const editionRoundFormats: string[] = isSpocTeam
    ? (initialActiveEdition?.spocRoundFormats?.length
        ? initialActiveEdition.spocRoundFormats
        : ['SINGLES', 'DOUBLES', 'SINGLES'])
    : (initialActiveEdition?.roundFormats && initialActiveEdition.roundFormats.length > 0)
      ? initialActiveEdition.roundFormats
      : ['SINGLES', 'SINGLES', 'SINGLES', 'SINGLES', 'SINGLES'];

  const roundsPerDay: number = editionRoundFormats.length;

  const getRoundLabel = (index: number) => combiRoundLabel(editionRoundFormats, index);

  // Roster view
  const [rosterViewMode, setRosterViewMode] = React.useState<'MY_TEAM' | 'ALL_TEAMS'>('MY_TEAM');
  const [captainTab, setCaptainTab] = React.useState<'combis' | 'scores' | 'roster' | 'enrollment' | 'player'>('combis');

  // Day lineup state
  const [selectedDayNumber, setSelectedDayNumber] = React.useState<number>(() => {
    if (initialActiveEdition?.isSpocTeam && initialActiveEdition?.spocMatchDays?.length) {
      return initialActiveEdition.spocMatchDays[0].dayNumber;
    }
    return currentCombiDayNumber(
      initialActiveEdition?.totalDays || 15,
      new Date(),
      initialActiveEdition?.dayDates,
    );
  });
  const [dayLineupModalOpen, setDayLineupModalOpen] = React.useState(false);
  const [roundLineups, setRoundLineups] = React.useState<Array<{ playerIds: string[] }>>([]);
  const [lineupsByTeamId, setLineupsByTeamId] = React.useState<Record<string, Record<number, any>>>({});
  const savedDayLineups = (currentTeam?.id && lineupsByTeamId[currentTeam.id]) || {};
  const [lineupSubmittedSuccess, setLineupSubmittedSuccess] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [emailPreviewUrl, setEmailPreviewUrl] = React.useState<string | null>(null);
  const [combiFilter, setCombiFilter] = React.useState<string>('ALL');
  const [teamScoreRows, setTeamScoreRows] = React.useState<Array<{
    userId: string;
    name: string;
    score: string;
    slams: string;
    boards: BoardDraft[];
    target?: number;
    missingPrior?: boolean;
    average?: number;
  }>>([]);
  const [teamScoreOpen, setTeamScoreOpen] = React.useState(true);
  const [teamScoreMsg, setTeamScoreMsg] = React.useState<string | null>(null);
  const [publishedBoard, setPublishedBoard] = React.useState<any>(null);

  const dayDatesMap: Record<number, string> = React.useMemo(() => {
    const totalDays = initialActiveEdition?.totalDays || 10;
    const stored = normalizeDayDates(initialActiveEdition?.dayDates);
    const map = buildDayDatesMap(totalDays, stored?.[1]);
    Object.entries(stored ?? {}).forEach(([key, date]) => {
      const day = Number(key);
      if (day >= 1 && day <= totalDays) map[day] = date;
    });
    return map;
  }, [initialActiveEdition]);

  const totalEventDays = initialActiveEdition?.totalDays || 10;
  const combiDayNumbers: number[] = isSpocTeam
    ? (spocMatchDays.length ? spocMatchDays.map((d) => d.dayNumber) : [])
    : Array.from({ length: totalEventDays }, (_, i) => i + 1);

  const spocDayMeta = React.useMemo(() => {
    const map = new Map<number, { opponentName?: string; opponentTag?: string }>();
    spocMatchDays.forEach((d) => map.set(d.dayNumber, d));
    return map;
  }, [spocMatchDays]);

  React.useEffect(() => {
    const teamId = currentTeam?.id;
    if (!teamId) return;
    setLineupsByTeamId((prev) => {
      if (prev[teamId]) return prev;
      let parsed: Record<number, any> = {};
      if (currentTeam.savedLineups) {
        try {
          parsed = JSON.parse(currentTeam.savedLineups);
        } catch (e) {
          console.error('Failed to parse currentTeam savedLineups JSON:', e);
        }
      }
      return { ...prev, [teamId]: parsed };
    });
  }, [currentTeam?.id, currentTeam?.savedLineups]);

  React.useEffect(() => {
    if (!currentTeam?.id) return;
    getTeamDayScores(currentTeam.id, selectedDayNumber).then((res) => {
      if (!res.success) return;
      setTeamScoreOpen(Boolean('windowOpen' in res && res.windowOpen));
      setTeamScoreRows(mapTeamScorePlayers(res.players));
    });
    getPublicScoreboard().then((board) => setPublishedBoard(board)).catch(() => {});
  }, [currentTeam?.id, selectedDayNumber]);

  React.useEffect(() => {
    if (isSpocTeam && (initialActiveEdition?.spocMatchDays?.length || 0) > 0) {
      setSelectedDayNumber(initialActiveEdition.spocMatchDays[0].dayNumber);
    } else {
      setSelectedDayNumber(1);
    }
    setCombiFilter('ALL');
  }, [currentTeam?.id]);

  // Initialise round lineups — each round starts with empty player slots
  const initRoundLineups = (_dayNum: number) => {
    return editionRoundFormats.map((fmt) => ({
      playerIds: Array.from({ length: playersForFormat(fmt) }, () => ''),
    }));
  };

  const handleOpenDayLineupModal = (dayNum: number) => {
    setSelectedDayNumber(dayNum);
    setLineupSubmittedSuccess(false);
    setEmailPreviewUrl(null);

    const saved = savedDayLineups[dayNum];
    if (saved && saved.rounds && saved.rounds.length > 0) {
      const populated = editionRoundFormats.map((fmt, ri) => {
        const savedRound = saved.rounds[ri];
        const numPlayers = playersForFormat(fmt);
        if (savedRound) {
          const ids = savedRound.playerIds;
          if (ids && Array.isArray(ids)) {
            return { playerIds: Array.from({ length: numPlayers }, (_, i) => ids[i] || '') };
          }
          // Fallback: look up player IDs by name
          return {
            playerIds: Array.from({ length: numPlayers }, (_, slotIdx) => {
              const playerName = savedRound.players?.[slotIdx];
              if (playerName) {
                const matchedMember = teamMembers.find((m: any) => m.name === playerName);
                return matchedMember ? matchedMember.id : '';
              }
              return '';
            })
          };
        }
        return { playerIds: Array.from({ length: numPlayers }, () => '') };
      });
      setRoundLineups(populated);
    } else {
      // Auto pre-fill with effective fallback lineup (Grade sequence on Day 1 or previous day carryover on Day > 1)
      const effective = resolveEffectiveTeamCombi({
        team: {
          ...currentTeam,
          savedLineups: savedDayLineups,
          members: teamMembers,
        },
        dayNumber: dayNum,
        roundFormats: editionRoundFormats,
      });

      if (effective && effective.rounds && effective.rounds.length > 0) {
        const populated = editionRoundFormats.map((fmt, ri) => {
          const round = effective.rounds[ri];
          const numPlayers = playersForFormat(fmt);
          if (round) {
            const ids = round.playerIds;
            if (ids && Array.isArray(ids)) {
              return { playerIds: Array.from({ length: numPlayers }, (_, i) => ids[i] || '') };
            }
            return {
              playerIds: Array.from({ length: numPlayers }, (_, slotIdx) => {
                const playerName = round.players?.[slotIdx];
                if (playerName) {
                  const matchedMember = teamMembers.find((m: any) => m.name === playerName);
                  return matchedMember ? matchedMember.id : '';
                }
                return '';
              })
            };
          }
          return { playerIds: Array.from({ length: numPlayers }, () => '') };
        });
        setRoundLineups(populated);
      } else {
        setRoundLineups(initRoundLineups(dayNum));
      }
    }

    setDayLineupModalOpen(true);
  };

  const updateRoundPlayer = (roundIdx: number, playerSlot: number, playerId: string) => {
    setRoundLineups(prev => prev.map((r, ri) =>
      ri === roundIdx
        ? { ...r, playerIds: r.playerIds.map((pid, si) => si === playerSlot ? playerId : pid) }
        : r
    ));
  };

  // Identify this captain
  const captainName = sessionUser?.name || sessionUser?.username || currentTeam?.captain?.name || 'Captain';
  const captainEmail = sessionUser?.email || currentTeam?.captain?.email || '';
  const captainInitial = captainName.charAt(0).toUpperCase();
  const teamName = currentTeam?.name || 'Your Team';
  const editionTitle = initialActiveEdition?.title || 'Active Edition';

  const handleSaveTeamScores = async () => {
    if (!currentTeam?.id) return;
    const filled = teamScoreRows.filter((r) => !r.missingPrior && rowFilledBoards(r).length > 0);
    const res = await submitTeamDayScores(
      currentTeam.id,
      selectedDayNumber,
      filled.map((r) => {
        const boards = rowFilledBoards(r);
        const agg = aggregateBoards(boards);
        return { userId: r.userId, score: agg.score, slams: agg.slams, boards };
      }),
    );
    setTeamScoreMsg(res.success ? 'Saved team scores.' : res.error || 'Failed');
    if (res.success) {
      const refreshed = await getTeamDayScores(currentTeam.id, selectedDayNumber);
      if (refreshed.success) {
        setTeamScoreOpen(Boolean(refreshed.windowOpen));
        setTeamScoreRows(mapTeamScorePlayers(refreshed.players));
      }
    }
  };

  const handleSaveDayLineup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setEmailPreviewUrl(null);

    const rounds = roundLineups.map((r, ri) => ({
      name: getRoundLabel(ri),
      players: r.playerIds.map(pid => teamMembers.find((m: any) => m.id === pid)?.name || pid),
      playerIds: r.playerIds, // Save player IDs for easy modal pre-population
    }));

    const clientTimeZone = getClientTimeZone();

    // Persist to database (server will calculate and standardize exact IST timestamp)
    const dbSaveRes = await saveTeamDailyLineup(currentTeam.id, selectedDayNumber, rounds, undefined, clientTimeZone);
    if (!dbSaveRes.success) {
      alert('⚠️ Failed to save lineup to database: ' + (dbSaveRes.error || 'Unknown error'));
      setIsSubmitting(false);
      return;
    }

    const finalSubmittedAt = dbSaveRes.submittedAt || formatToIst(new Date());
    const teamId = currentTeam.id;
    setLineupsByTeamId((prev) => ({
      ...prev,
      [teamId]: {
        ...(prev[teamId] || {}),
        [selectedDayNumber]: {
          rounds,
          submittedAt: finalSubmittedAt,
        },
      },
    }));

    // Individual email sending disabled per requirements.
    // Consolidated email at 9:45 PM IST will cover all combis.
    setLineupSubmittedSuccess(true);
    setTimeout(() => {
      setDayLineupModalOpen(false);
      setLineupSubmittedSuccess(false);
      setEmailPreviewUrl(null);
    }, 3000);
    setIsSubmitting(false);
  };



  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="carrom" className="font-bold">
              <Crown className="h-3.5 w-3.5 mr-1" /> Captain Dashboard
            </Badge>
            {isSpocTeam ? (
              <Badge variant="outline" className="text-violet-300 border-violet-500/40 bg-violet-500/10 font-bold">
                <Sparkles className="h-3 w-3 mr-1" /> Spoc Exhibition
              </Badge>
            ) : null}
          </div>
          <h1 className="text-3xl font-black">{teamName}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isSpocTeam ? 'Spoc Exhibition Team Captain' : 'Captain Dashboard'}
          </p>
          {hasBothCaptainDesks ? (
            <div className="mt-4 inline-flex rounded-xl border border-border bg-muted/30 p-1 gap-1">
              <button
                type="button"
                onClick={() => setActiveDesk('main')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
                  activeDesk === 'main'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Main team
              </button>
              <button
                type="button"
                onClick={() => setActiveDesk('spoc')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
                  activeDesk === 'spoc'
                    ? 'bg-violet-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Spoc exhibition
              </button>
            </div>
          ) : null}
          {hasBothCaptainDesks ? (
            <p className="text-xs text-violet-300/90 mt-2">
              You captain both teams. Use <strong>Main team</strong> as usual, then switch to{' '}
              <strong>Spoc exhibition</strong> to submit that match combi.
            </p>
          ) : null}
          {hasSpocCaptainDesk && !hasMainCaptainDesk && initialPlayerTeam ? (
            <p className="text-xs text-violet-300/90 mt-2">
              You play for <strong>{initialPlayerTeam.name}</strong> and captain this Spoc team.{' '}
              <Link href="/dashboard/player" className="underline font-bold">
                Open player portal
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center text-amber-400 font-black text-xl">
            {captainInitial}
          </div>
          <div>
            <div className="font-bold text-foreground">{captainName}</div>
            <div className="text-xs text-amber-400 font-bold">Team Captain</div>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setCaptainTab('combis')}
          className={`text-left p-3 sm:p-4 rounded-xl border transition-all cursor-pointer ${
            captainTab === 'combis'
              ? 'border-amber-500/60 bg-amber-500/15 shadow-sm ring-1 ring-amber-500/40'
              : 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 hover:bg-amber-500/10'
          }`}
        >
          <div className="text-[10px] font-bold text-amber-500 uppercase flex items-center justify-between">
            <span>Combis Saved</span>
            <Calendar className="h-3.5 w-3.5" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-foreground mt-1">
            {Object.keys(savedDayLineups).length} <span className="text-xs font-normal text-muted-foreground">/ {totalEventDays}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCaptainTab('scores')}
          className={`text-left p-3 sm:p-4 rounded-xl border transition-all cursor-pointer ${
            captainTab === 'scores'
              ? 'border-emerald-500/60 bg-emerald-500/15 shadow-sm ring-1 ring-emerald-500/40'
              : 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50 hover:bg-emerald-500/10'
          }`}
        >
          <div className="text-[10px] font-bold text-emerald-500 uppercase flex items-center justify-between">
            <span>Score Entry</span>
            <Trophy className="h-3.5 w-3.5" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-foreground mt-1 truncate">
            Day {selectedDayNumber} <span className="text-xs font-normal text-muted-foreground">{teamScoreOpen ? '· Open' : '· Closed'}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCaptainTab('roster')}
          className={`text-left p-3 sm:p-4 rounded-xl border transition-all cursor-pointer ${
            captainTab === 'roster'
              ? 'border-blue-500/60 bg-blue-500/15 shadow-sm ring-1 ring-blue-500/40'
              : 'border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50 hover:bg-blue-500/10'
          }`}
        >
          <div className="text-[10px] font-bold text-blue-400 uppercase flex items-center justify-between">
            <span>Team Roster</span>
            <Crown className="h-3.5 w-3.5" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-foreground mt-1">
            {teamMembers.length} <span className="text-xs font-normal text-muted-foreground">Players</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCaptainTab('enrollment')}
          className={`text-left p-3 sm:p-4 rounded-xl border transition-all cursor-pointer ${
            captainTab === 'enrollment'
              ? 'border-indigo-500/60 bg-indigo-500/15 shadow-sm ring-1 ring-indigo-500/40'
              : 'border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-500/50 hover:bg-indigo-500/10'
          }`}
        >
          <div className="text-[10px] font-bold text-indigo-400 uppercase flex items-center justify-between">
            <span>Next Edition</span>
            <PartyPopper className="h-3.5 w-3.5" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-foreground mt-1 truncate">
            {registrationEnrollment?.paymentStatus === 'VERIFIED'
              ? 'Verified'
              : registrationEnrollment
                ? 'Enrolled'
                : 'Not Enrolled'}{' '}
            <span className="text-xs font-normal text-muted-foreground">
              {registrationEnrollment ? `· #${registrationEnrollment.edition?.number || ''}` : '· Next Cup'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCaptainTab('player')}
          className={`text-left p-3 sm:p-4 rounded-xl border transition-all cursor-pointer ${
            captainTab === 'player'
              ? 'border-violet-500/60 bg-violet-500/15 shadow-sm ring-1 ring-violet-500/40'
              : 'border-violet-500/30 bg-violet-500/5 hover:border-violet-500/50 hover:bg-violet-500/10'
          }`}
        >
          <div className="text-[10px] font-bold text-violet-400 uppercase flex items-center justify-between">
            <span>Player Portal</span>
            <UserCheck className="h-3.5 w-3.5" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-foreground mt-1">
            Profile <span className="text-xs font-normal text-muted-foreground">· Active</span>
          </div>
        </button>
      </div>

      {/* CAPTAIN TABS BAR */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border/70 scrollbar-none">
        <button
          type="button"
          onClick={() => setCaptainTab('combis')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer ${
            captainTab === 'combis'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-card text-muted-foreground hover:text-foreground border border-border hover:border-amber-500/30'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Combi Lineups</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${captainTab === 'combis' ? 'bg-slate-950 text-amber-400' : 'bg-muted text-muted-foreground'}`}>
            {Object.keys(savedDayLineups).length}/{totalEventDays}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCaptainTab('scores')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer ${
            captainTab === 'scores'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'bg-card text-muted-foreground hover:text-foreground border border-border hover:border-emerald-500/30'
          }`}
        >
          <Trophy className="h-4 w-4" />
          <span>Player Scores Entry</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${captainTab === 'scores' ? 'bg-slate-950 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
            Day {selectedDayNumber}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCaptainTab('roster')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer ${
            captainTab === 'roster'
              ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
              : 'bg-card text-muted-foreground hover:text-foreground border border-border hover:border-blue-500/30'
          }`}
        >
          <Crown className="h-4 w-4" />
          <span>Team Roster</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${captainTab === 'roster' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>
            {teamMembers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCaptainTab('enrollment')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer ${
            captainTab === 'enrollment'
              ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
              : 'bg-card text-muted-foreground hover:text-foreground border border-border hover:border-indigo-500/30'
          }`}
        >
          <PartyPopper className="h-4 w-4" />
          <span>Next Edition Status</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
            captainTab === 'enrollment'
              ? 'bg-white/20 text-white'
              : registrationEnrollment?.paymentStatus === 'VERIFIED'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : registrationEnrollment
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-muted text-muted-foreground'
          }`}>
            {registrationEnrollment?.paymentStatus === 'VERIFIED'
              ? '✓ Verified'
              : registrationEnrollment
                ? (registrationEnrollment.enrollmentNumber ? `#${registrationEnrollment.enrollmentNumber}` : 'Enrolled')
                : 'Not Enrolled'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCaptainTab('player')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer ${
            captainTab === 'player'
              ? 'bg-violet-500 text-white shadow-md shadow-violet-500/20'
              : 'bg-card text-muted-foreground hover:text-foreground border border-border hover:border-violet-500/30'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          <span>My Player Portal</span>
        </button>
      </div>

      {/* TAB 1: COMBI LINEUPS */}
      {captainTab === 'combis' && (
      <Card className={isSpocTeam ? 'border-violet-500/40' : 'border-amber-500/40'}>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                {isSpocTeam ? (
                  <>
                    <Sparkles className="h-5 w-5 text-violet-400" /> Spoc Exhibition Combi Submission
                  </>
                ) : (
                  <>
                    <Calendar className="h-5 w-5 text-amber-500" /> Day 1 to Day {totalEventDays} Combi Submission
                  </>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {isSpocTeam ? (
                  <>
                    Submit your Spoc match combi using <strong className="text-violet-300">Spoc team players only</strong> —{' '}
                    {roundsPerDay} exhibition events per scheduled match day, before{' '}
                    <strong className="text-rose-400">9:30 PM IST</strong>.
                  </>
                ) : (
                  <>
                    Select your combi for {roundsPerDay} events per day before{' '}
                    <strong className="text-rose-400">9:30 PM IST</strong>.
                  </>
                )}
              </CardDescription>
            </div>
            <Badge variant="carrom" className={`font-bold text-xs px-3 py-1 self-start sm:self-auto ${isSpocTeam ? 'bg-violet-500/15 text-violet-300 border-violet-500/40' : ''}`}>
              Current Active: Day {selectedDayNumber}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {isSpocTeam && combiDayNumbers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-violet-500/40 bg-violet-500/5 p-6 text-center text-sm text-muted-foreground">
              No Spoc exhibition match days scheduled for your team yet. Ask the organizer to add pairings in the{' '}
              <strong className="text-violet-300">Spoc Exhibition</strong> stage.
            </div>
          ) : null}

          {/* Dynamic Event Days Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {combiDayNumbers.map((dayNum) => {
              const isSaved = !!savedDayLineups[dayNum];
              const effectiveCombi = !isSaved
                ? resolveEffectiveTeamCombi({
                    team: { ...currentTeam, savedLineups: savedDayLineups, members: teamMembers },
                    dayNumber: dayNum,
                    roundFormats: editionRoundFormats,
                  })
                : null;
              const isSelected = dayNum === selectedDayNumber;
              const isLocked = isDayLocked(dayNum, dayDatesMap);
              const rawDate = dayDatesMap[dayNum];
              const formattedDate = rawDate
                ? formatIsoDateLabel(rawDate, { day: 'numeric', month: 'short' })
                : '';
              const formattedDateFull = rawDate
                ? formatIsoDateLabel(rawDate, { weekday: 'short', day: 'numeric', month: 'short' })
                : '';
              const spocMeta = spocDayMeta.get(dayNum);

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => handleOpenDayLineupModal(dayNum)}
                  className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    isLocked
                      ? 'border-rose-500/40 bg-rose-500/10'
                      : isSaved
                      ? isSpocTeam
                        ? 'border-violet-500/50 bg-violet-500/10'
                        : 'border-emerald-500/50 bg-emerald-500/10'
                      : isSelected
                      ? isSpocTeam
                        ? 'border-violet-500/60 bg-violet-500/10'
                        : 'border-amber-500/60 bg-amber-500/10'
                      : 'border-border bg-card hover:border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${isSpocTeam ? 'text-violet-400' : 'text-amber-500'}`}>
                      {isSpocTeam ? 'SPOC DAY' : 'DAY'} {dayNum}
                    </span>
                    {formattedDate && (
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border font-mono ${
                        isSpocTeam
                          ? 'text-violet-300 bg-violet-500/15 border-violet-500/30'
                          : 'text-amber-400 bg-amber-500/15 border-amber-500/30'
                      }`}>
                        {formattedDate}
                      </span>
                    )}
                  </div>
                  {isSpocTeam && spocMeta?.opponentName ? (
                    <div className="text-[10px] font-bold text-violet-200/90 mt-1 truncate" title={`vs ${spocMeta.opponentName}`}>
                      vs {spocMeta.opponentName}
                    </div>
                  ) : null}
                  <div className="text-xs font-extrabold text-foreground/90 mt-1.5 flex items-center justify-between">
                    <span>{formattedDateFull}</span>
                    {isLocked && <span className="text-xs" title="Locked (Past 9:30 PM IST)">🔒</span>}
                  </div>
                  <div className="mt-1.5 pt-1 border-t border-border/40">
                    {isLocked ? (
                      <span className="text-[9.5px] font-bold text-rose-400 flex items-center gap-1" title={effectiveCombi?.reason}>
                        {isSaved ? `🔒 Locked · Saved` : `🔒 Locked · ${effectiveCombi?.fallbackType === 'PREVIOUS_DAY' ? `Day ${effectiveCombi.sourceDay}` : 'Grade G1→GN'}`}
                      </span>
                    ) : isSaved ? (
                      <span className={`text-[9.5px] font-bold flex items-center gap-1 ${isSpocTeam ? 'text-violet-300' : 'text-emerald-400'}`}>
                        ✓ Saved · {savedDayLineups[dayNum].submittedAt?.match(/[a-zA-Z]{3}/) ? savedDayLineups[dayNum].submittedAt : formattedDate ? `${formattedDate}, ${savedDayLineups[dayNum].submittedAt}` : savedDayLineups[dayNum].submittedAt}
                      </span>
                    ) : (
                      <span className="text-[9.5px] font-bold text-amber-400/90 flex items-center gap-1" title={effectiveCombi?.reason}>
                        {effectiveCombi?.fallbackType === 'PREVIOUS_DAY' ? `⚡ Auto: Day ${effectiveCombi.sourceDay}` : `⚡ Auto: Grade G1→GN`}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Saved Combis Directory with Chip Filter */}
          <div className="border-t border-border/60 pt-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-2 border-b border-border/40">
              <div>
                <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <span>📂</span> Saved Combis Directory
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Review and filter all submitted combinations for this tournament.
                </p>
              </div>
              
              {/* Filter Chips */}
              {Object.keys(savedDayLineups).length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end max-w-full sm:max-w-md">
                  <button
                    type="button"
                    onClick={() => setCombiFilter('ALL')}
                    className={`text-[10px] font-black px-2.5 py-1 rounded-full border transition-all ${
                      combiFilter === 'ALL'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm'
                        : 'bg-card text-muted-foreground border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    All Saved ({Object.keys(savedDayLineups).length})
                  </button>
                  {Object.keys(savedDayLineups)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map((dayNum) => (
                      <button
                        key={dayNum}
                        type="button"
                        onClick={() => setCombiFilter(dayNum.toString())}
                        className={`text-[10px] font-black px-2.5 py-1 rounded-full border transition-all ${
                          combiFilter === dayNum.toString()
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                            : 'bg-card text-muted-foreground border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        Day {dayNum}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Combis List */}
            {Object.keys(savedDayLineups).length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground bg-card rounded-xl border border-dashed border-border">
                No combis saved yet. Click any Day button above to set up and save your first combi!
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {Object.keys(savedDayLineups)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .filter((dayNum) => combiFilter === 'ALL' || combiFilter === dayNum.toString())
                  .map((dayNum) => {
                    const data = savedDayLineups[dayNum];
                    return (
                      <div
                        key={dayNum}
                        className="p-4 rounded-xl bg-card border border-border/80 shadow-md space-y-3 hover:border-amber-500/20 transition-all duration-200"
                      >
                        <div className="flex items-center justify-between border-b border-border/40 pb-2">
                          <span className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                            ⚡ Day {dayNum} Combi
                          </span>
                          <span className="text-[9px] font-bold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">
                            Saved at {data.submittedAt?.match(/[a-zA-Z]{3}/) ? data.submittedAt : dayDatesMap[dayNum] ? `${formatIsoDateLabel(dayDatesMap[dayNum], { day: 'numeric', month: 'short' })}, ${data.submittedAt}` : data.submittedAt}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {data.rounds?.map((r: any, ri: number) => (
                            <div key={ri} className="bg-background/40 rounded-lg p-2.5 border border-border/30">
                              <div className="text-[10px] font-black text-amber-500/80 mb-0.5">{r.name}</div>
                              <div className="text-[10.5px] font-medium text-foreground">{r.players?.join(', ')}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* TAB 2: PLAYER SCORES ENTRY */}
      {captainTab === 'scores' && (
        <Card className="border-emerald-500/30">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-emerald-500" /> Team Day Scores Entry
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Record and update player boards and match scores. Saved player scores sync automatically.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">Select Match Day:</span>
              <select
                className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-bold min-w-[9rem] focus:ring-2 focus:ring-emerald-500/50"
                value={selectedDayNumber}
                onChange={(e) => setSelectedDayNumber(parseInt(e.target.value, 10) || 1)}
              >
                {combiDayNumbers.map((d) => (
                  <option key={d} value={d}>
                    Day {d}
                    {dayDatesMap[d] ? ` · ${dayDatesMap[d]}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <ScoreEditRules note={teamScoreOpen ? SCORE_EDIT_CAPTAIN_HELP : SCORE_EDIT_CAPTAIN_CLOSED} />
            {teamScoreOpen && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <p className="font-semibold text-emerald-400">
                  ⚡ Board score and slams per player. Total score vs target decides match bonus.
                </p>
                <p className="text-[11px] font-bold text-muted-foreground">
                  Deadline: <strong className="text-rose-400">9:30 PM IST</strong>
                </p>
              </div>
            )}
            
            <div className="space-y-3">
              {teamScoreRows.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border">
                  No players found for score submission.
                </div>
              ) : (
                teamScoreRows.map((row, idx) => (
                  <div key={row.userId} className="rounded-xl border border-border/80 bg-card/60 p-4 space-y-2.5 shadow-sm hover:border-emerald-500/30 transition-all">
                    <div className="flex items-center justify-between min-w-0">
                      <div className="font-bold text-sm text-foreground truncate">{row.name}</div>
                      <div className="text-[11px] font-semibold">
                        {row.missingPrior ? (
                          <span className="text-amber-400">⚠️ Needs earlier day (organiser only)</span>
                        ) : row.score !== '' ? (
                          <span className="text-emerald-400">✓ Submitted ({row.score} pts · {row.slams} slams)</span>
                        ) : (
                          <span className="text-muted-foreground">Empty (Walkover if blank at 9:00 PM)</span>
                        )}
                      </div>
                    </div>
                    <BoardScoreEditor
                      compact
                      boards={row.boards}
                      disabled={!teamScoreOpen || row.missingPrior}
                      target={row.target}
                      onChange={(next) => {
                        const filled = draftToPayload(next).filter((b) => Number.isFinite(b.score) && b.score >= 0);
                        const agg = aggregateBoards(filled);
                        const updated = [...teamScoreRows];
                        updated[idx] = {
                          ...row,
                          boards: next,
                          score: filled.length ? String(agg.score) : '',
                          slams: String(agg.slams),
                        };
                        setTeamScoreRows(updated);
                      }}
                    />
                  </div>
                ))
              )}
            </div>

            {teamScoreMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400">
                {teamScoreMsg}
              </div>
            )}

            {teamScoreOpen && currentTeam?.id && teamScoreRows.length > 0 && (
              <div className="pt-2">
                <Button
                  onClick={() => void handleSaveTeamScores()}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  Save Team Scores for Day {selectedDayNumber}
                </Button>
              </div>
            )}

            {publishedBoard?.days?.find((d: any) => d.dayNumber === selectedDayNumber)?.published && (
              <div className="border-t border-border pt-4 mt-6">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">
                  Published Scoreboard · Day {selectedDayNumber}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(publishedBoard.teams || []).map((t: any) => (
                    <div key={t.id} className="text-xs border border-border/80 bg-card rounded-xl p-3 shadow-sm">
                      <div className="font-black text-amber-400 border-b border-border/40 pb-1.5 mb-2">{t.name}</div>
                      <div className="space-y-1.5">
                        {t.players.map((p: any) => {
                          const s = (publishedBoard.scores || []).find((x: any) => x.userId === p.id && x.dayNumber === selectedDayNumber);
                          return (
                            <div key={p.id} className="flex justify-between items-center gap-2">
                              <span className="truncate font-medium">{p.name}</span>
                              <span className="font-bold text-[11px] whitespace-nowrap text-muted-foreground">
                                {s ? `${s.score} pts · ${s.slams} slam${s.slams === 1 ? '' : 's'}` : 'Walkover'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: TEAM ROSTER */}
      {captainTab === 'roster' && (
        <Card className="border-amber-500/30">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" /> My Team Roster
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Team members assigned for this tournament edition.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamMembers.map((member: any) => (
                <div key={member.id} className="p-4 rounded-xl bg-card border border-amber-500/20 hover:border-amber-500/50 transition-all flex items-center gap-3 text-xs shadow-sm">
                  <Avatar src={member.image} fallback={member.name} size="sm" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-foreground">{member.name}</span>
                      {member.id === currentTeam?.captainId && (
                        <Badge variant="carrom" className="text-[9px]">CAPTAIN</Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">@{member.username}</span>
                  </div>
                </div>
              ))}
              {teamMembers.length === 0 && (
                <div className="col-span-3 text-center py-8 text-muted-foreground text-xs">
                  No team members found for this edition.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: NEXT EDITION ENROLLMENT STATUS */}
      {captainTab === 'enrollment' && (
        <div className="space-y-6">
          {registrationEnrollment ? (
            <PlayerEnrollmentCard enrollment={registrationEnrollment} />
          ) : (
            <Card className="border-amber-500/30">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <PartyPopper className="h-5 w-5 text-amber-500" /> Next Edition Enrollment Status
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Registration and payment status for the upcoming tournament edition.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 text-center space-y-4">
                <div className="p-8 rounded-2xl border border-dashed border-border bg-muted/10 space-y-3">
                  <Info className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                  <h3 className="font-bold text-foreground text-sm">No Active Next Edition Enrollment Found</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    You are not currently enrolled for the next upcoming tournament edition. Visit the tournaments page or contact the organizer to register.
                  </p>
                  <div className="pt-2">
                    <Link href="/tournaments">
                      <Button variant="carrom" size="sm" className="font-bold text-xs">
                        View Tournaments & Register
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 5: MY PLAYER PORTAL */}
      {captainTab === 'player' && (
        <div className="pt-2">
          <PlayerClient
            initialPlayer={initialPlayer || currentTeam?.captain || { name: captainName, wins: 0, losses: 0, rating: 1200, queenStrikes: 0, boardsWon: 0 }}
            initialTeam={initialPlayerTeam || mainTeam || initialTeam}
            initialTeammates={
              (initialPlayerTeam || mainTeam)?.members?.map((m: any) => m.user).filter(Boolean)
              || (initialMembers && initialMembers.length > 0 ? initialMembers : teamMembers)
            }
            initialMatches={initialPlayerMatches}
            initialPatterns={initialPatterns}
            initialStreams={initialPlayerStreams}
            registrationEnrollment={registrationEnrollment}
            currentEditionInfo={currentEditionInfo}
            shortName={shortName}
            editionLabel={editionLabel}
          />
        </div>
      )}

      {/* COMBI MODAL */}
      <Dialog open={dayLineupModalOpen} onOpenChange={setDayLineupModalOpen}>
        <div className="flex flex-col -m-6 max-h-[85vh] overflow-hidden bg-background">
          {/* HEADER */}
          <div className="p-4 sm:p-6 border-b border-border bg-muted/20 flex justify-between items-start gap-2">
            <div className="flex flex-col space-y-1 text-left pr-2 sm:pr-6 min-w-0 flex-1">
              <h2 className="text-base sm:text-xl font-bold leading-tight tracking-tight flex items-center gap-2 truncate">
                <Send className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 ${isSpocTeam ? 'text-violet-400' : 'text-amber-500'}`} />
                <span>
                  {isSpocTeam ? 'Spoc Exhibition' : 'Day'} {selectedDayNumber} Combi
                  {dayDatesMap[selectedDayNumber]
                    ? ` (${formatIsoDateLabel(dayDatesMap[selectedDayNumber], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })})`
                    : ''}{' '}
                  — {roundsPerDay} events
                </span>
              </h2>
              {isSpocTeam && spocDayMeta.get(selectedDayNumber)?.opponentName ? (
                <p className="text-xs sm:text-sm font-bold text-violet-300 mt-0.5 truncate">
                  vs {spocDayMeta.get(selectedDayNumber)?.opponentName}
                  {spocDayMeta.get(selectedDayNumber)?.opponentTag
                    ? ` (${spocDayMeta.get(selectedDayNumber)?.opponentTag})`
                    : ''}
                </p>
              ) : null}
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Deadline: <strong className="text-rose-400">9:30 PM IST</strong>
              </p>
            </div>
            {!isDayLocked(selectedDayNumber, dayDatesMap) && !lineupSubmittedSuccess && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRoundLineups(initRoundLineups(selectedDayNumber))}
                className="h-7 sm:h-8 px-2.5 sm:px-3 text-[11px] sm:text-xs gap-1.5 border-rose-500/30 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-bold shrink-0 transition-colors"
                title="Clear all player selections"
              >
                <RotateCcw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden xs:inline">Reset All</span>
                <span className="xs:hidden">Reset</span>
              </Button>
            )}
          </div>

          {lineupSubmittedSuccess ? (
            <div className="p-8 text-center space-y-4 bg-emerald-500/10 border-b border-emerald-500/20">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto animate-bounce" />
              <h3 className="font-extrabold text-base text-foreground">Day {selectedDayNumber} Combi Saved!</h3>
              <p className="text-xs text-muted-foreground">{roundsPerDay} combis recorded before the 9:30 PM IST deadline.</p>
              <p className="text-xs text-muted-foreground font-semibold">
                Your combi for Day {selectedDayNumber} has been saved successfully in the database and will auto-publish on the website at 9:30 PM IST.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSaveDayLineup} className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* SCROLLABLE INNER SECTION */}
              <div className="flex-1 overflow-y-auto px-3.5 py-3 sm:px-6 sm:py-4 space-y-3.5 sm:space-y-4 min-h-0 scrollbar-thin scrollbar-thumb-amber-500/20 hover:scrollbar-thumb-amber-500/40 scrollbar-track-transparent">
                {isDayLocked(selectedDayNumber, dayDatesMap) && (
                  <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs font-bold text-rose-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>🔒 Submissions for Day {selectedDayNumber} closed at 9:30 PM IST. This combi is locked and read-only.</span>
                  </div>
                )}

                {!savedDayLineups[selectedDayNumber] && (
                  <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs font-semibold text-amber-300 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
                    <span>
                      {selectedDayNumber === 1
                        ? '⚡ Auto-prefilled with Grade Sequence (G1 → GN). You can adjust and save.'
                        : '⚡ Auto-prefilled from previous day\'s combi. You can adjust and save.'}
                    </span>
                  </div>
                )}


                {/* Duplicate player validation */}
                {(() => {
                  const playerRoundMap: Record<string, number[]> = {};
                  roundLineups.forEach((r, ri) => {
                    r.playerIds.forEach(pid => {
                      if (pid) {
                        if (!playerRoundMap[pid]) playerRoundMap[pid] = [];
                        playerRoundMap[pid].push(ri + 1);
                      }
                    });
                  });
                  const duplicates = Object.entries(playerRoundMap).filter(([, rounds]) => rounds.length > 1);
                  if (duplicates.length === 0) return null;
                  return (
                    <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs font-bold text-rose-400 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-black mb-0.5">⚠️ Duplicate Players Detected — Fix Before Saving</div>
                        {duplicates.map(([pid, rounds]) => {
                          const m = teamMembers.find((tm: any) => tm.id === pid);
                          return (
                            <div key={pid} className="text-[11px] text-rose-300">
                              {m?.name || 'Player'} is in: {rounds.map(rIdx => getRoundLabel(rIdx - 1)).join(', ')}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* One card per round — each uses its own format */}
                {roundLineups.map((round, ri) => {
                  const roundFmt = editionRoundFormats[ri] || 'SINGLES';
                  const roundPlayersNeeded = playersForFormat(roundFmt);
                  // Players used in OTHER rounds
                  const usedElsewhere: Record<string, number> = {};
                  roundLineups.forEach((r, ri2) => {
                    if (ri2 !== ri) {
                      r.playerIds.forEach(pid => { if (pid) usedElsewhere[pid] = ri2 + 1; });
                    }
                  });
                  return (
                    <div key={ri} className="p-3 sm:p-4 rounded-xl border border-border bg-muted/20 space-y-2.5 sm:space-y-3 hover:border-amber-500/20 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-400">{getRoundLabel(ri)}</span>
                      </div>

                      <div className={`grid gap-2 ${roundPlayersNeeded === 1 ? 'grid-cols-1' : roundPlayersNeeded === 2 ? 'grid-cols-1 sm:grid-cols-2' : roundPlayersNeeded >= 4 ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
                        {Array.from({ length: roundPlayersNeeded }, (_, si) => {
                          const selectedId = round.playerIds[si] || '';
                          
                          // Players selected in other slots of this same round
                          const selectedInThisRound = round.playerIds.filter((pid, slotIdx) => slotIdx !== si && pid);
                          
                          const isDuplicateInOtherRound = selectedId && usedElsewhere[selectedId];
                          const isDuplicateInSameRound = selectedId && selectedInThisRound.includes(selectedId);
                          const isDuplicate = isDuplicateInOtherRound || isDuplicateInSameRound;
                          const isLocked = isDayLocked(selectedDayNumber, dayDatesMap);
                          
                          return (
                            <div key={si}>
                              <label className={`text-[10px] font-bold block mb-1 ${isDuplicate ? 'text-rose-400' : 'text-muted-foreground'}`}>
                                {roundPlayersNeeded === 1 ? 'Player' : `Player ${si + 1}`}
                                {isDuplicateInOtherRound && <span className="ml-1 text-rose-400 font-mono">⚠ {getRoundLabel(usedElsewhere[selectedId] - 1)}</span>}
                                {isDuplicateInSameRound && <span className="ml-1 text-rose-400 font-mono">⚠ Duplicate</span>}
                              </label>
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={selectedId}
                                  disabled={isLocked}
                                  onChange={(e) => updateRoundPlayer(ri, si, e.target.value)}
                                  className={`w-full bg-card border rounded-lg p-1.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50 ${
                                    isDuplicate ? 'border-rose-500/60 bg-rose-500/10' : 'border-input hover:border-amber-500/30'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  <option value="">Select Player</option>
                                  {teamMembers.map((m: any) => {
                                    const inOtherRound = usedElsewhere[m.id];
                                    const inSameRound = selectedInThisRound.includes(m.id);
                                    const shouldDisable = inOtherRound || inSameRound;
                                    return (
                                      <option
                                        key={m.id}
                                        value={m.id}
                                        disabled={!!shouldDisable && m.id !== selectedId}
                                      >
                                        {inOtherRound && m.id !== selectedId
                                          ? `🚫 ${combiPlayerLabel(m, teamScoreRows)} (${getRoundLabel(inOtherRound - 1)})`
                                          : inSameRound && m.id !== selectedId
                                          ? `🚫 ${combiPlayerLabel(m, teamScoreRows)} (Selected)`
                                          : combiPlayerLabel(m, teamScoreRows)}
                                      </option>
                                    );
                                  })}
                                </select>
                                {selectedId && !isLocked && (
                                  <button
                                    type="button"
                                    onClick={() => updateRoundPlayer(ri, si, '')}
                                    className="p-1.5 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-border/40 hover:border-rose-500/30 transition-colors shrink-0"
                                    title="Clear selection"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* STICKY FOOTER */}
              <div className="px-6 py-4 border-t border-border bg-muted/20 flex justify-end gap-2 sticky bottom-0 z-20">
                <Button type="button" variant="outline" onClick={() => setDayLineupModalOpen(false)}>
                  {isDayLocked(selectedDayNumber, dayDatesMap) ? 'Close' : 'Cancel'}
                </Button>
                {isDayLocked(selectedDayNumber, dayDatesMap) ? (
                  <Button disabled type="button" className="bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-not-allowed font-bold">
                    🔒 Submissions Closed at 9:30 PM IST
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="carrom"
                    disabled={isSubmitting || (() => {
                      const allIds = roundLineups.flatMap(r => r.playerIds);
                      const hasEmpty = allIds.some(pid => !pid);
                      const nonEmpties = allIds.filter(Boolean);
                      const hasDuplicates = nonEmpties.length !== new Set(nonEmpties).size;
                      return hasEmpty || hasDuplicates;
                    })()}
                  >
                    {isSubmitting ? 'Saving...' : `Save Day ${selectedDayNumber}`}
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      </Dialog>
    </div>
  );
}
