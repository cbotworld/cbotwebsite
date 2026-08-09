'use client';

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { MOCK_TEAMS, MOCK_PATTERN_LIBRARY } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/avatar';
import { Crown, Trophy, Calendar, CheckCircle2, Send, AlertCircle, Lock, Save, Sparkles, ChevronRight, History } from 'lucide-react';
import { sendLineupEmailAction, saveTeamDailyLineup } from '@/lib/actions/lineupActions';

function isDayLocked(dayNum: number, dayDatesMap: Record<number, string>): boolean {
  const dateStr = dayDatesMap[dayNum];
  if (!dateStr) return false;
  const cutoffTime = new Date(`${dateStr}T21:30:00+05:30`).getTime();
  return Date.now() >= cutoffTime;
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
  initialAllTeams = [],
  initialAllUsers = [],
  initialActiveEdition,
}: {
  initialTeam?: any;
  initialMembers?: any[];
  initialAllTeams?: any[];
  initialAllUsers?: any[];
  initialActiveEdition?: any;
}) {
  const { data: session } = useSession();
  const sessionUser = (session?.user as any);

  // Active Team & Roster Context
  const currentTeam = initialTeam || MOCK_TEAMS[0];
  const teamMembers = (initialMembers && initialMembers.length > 0)
    ? initialMembers
    : (currentTeam.members?.map((m: any) => m.user) || []);

  const allTeams = (initialAllTeams && initialAllTeams.length > 0) ? initialAllTeams : MOCK_TEAMS;

  // Round formats from organiser — e.g. ["SINGLES","DOUBLES","TRIPLES","SINGLES","SINGLES"]
  const editionRoundFormats: string[] = (initialActiveEdition?.roundFormats && initialActiveEdition.roundFormats.length > 0)
    ? initialActiveEdition.roundFormats
    : ['SINGLES', 'SINGLES', 'SINGLES', 'SINGLES', 'SINGLES'];

  const roundsPerDay: number = editionRoundFormats.length;

  // Helper to get labels like "Singles 1", "Doubles 2", "Triples 1"
  const getRoundLabel = (index: number) => {
    let singlesCount = 0;
    let doublesCount = 0;
    let triplesCount = 0;
    let genericCount = 0;

    for (let i = 0; i <= index; i++) {
      const fmt = editionRoundFormats[i]?.toUpperCase() || 'SINGLES';
      if (fmt.includes('TRIPLES')) {
        triplesCount++;
      } else if (fmt.includes('DOUBLES')) {
        doublesCount++;
      } else if (fmt.includes('SINGLES')) {
        singlesCount++;
      } else {
        genericCount++;
      }
    }

    const currentFmt = editionRoundFormats[index]?.toUpperCase() || 'SINGLES';
    if (currentFmt.includes('TRIPLES')) return `Triples ${triplesCount}`;
    if (currentFmt.includes('DOUBLES')) return `Doubles ${doublesCount}`;
    if (currentFmt.includes('SINGLES')) return `Singles ${singlesCount}`;
    return `Match ${genericCount}`;
  };

  // Roster view
  const [rosterViewMode, setRosterViewMode] = React.useState<'MY_TEAM' | 'ALL_TEAMS'>('MY_TEAM');

  // Day lineup state
  const [selectedDayNumber, setSelectedDayNumber] = React.useState<number>(1);
  const [dayLineupModalOpen, setDayLineupModalOpen] = React.useState(false);
  const [roundLineups, setRoundLineups] = React.useState<Array<{ playerIds: string[] }>>([]);
  const [savedDayLineups, setSavedDayLineups] = React.useState<Record<number, any>>({});
  const [lineupSubmittedSuccess, setLineupSubmittedSuccess] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [emailPreviewUrl, setEmailPreviewUrl] = React.useState<string | null>(null);
  const [combiFilter, setCombiFilter] = React.useState<string>('ALL');

  const dayDatesMap: Record<number, string> = React.useMemo(() => {
    let map: Record<number, string> = {};
    if (initialActiveEdition?.dayDates) {
      try {
        map = JSON.parse(initialActiveEdition.dayDates);
      } catch (e) {}
    }
    
    const total = initialActiveEdition?.totalDays || 15;
    const startStr = map[1] || (initialActiveEdition?.tournamentStartDate ? new Date(initialActiveEdition.tournamentStartDate).toISOString().split('T')[0] : '2026-08-10');
    const baseDate = startStr && !isNaN(new Date(startStr).getTime()) ? new Date(startStr) : new Date('2026-08-10');

    for (let i = 1; i <= total; i++) {
      if (!map[i]) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + (i - 1));
        map[i] = d.toISOString().split('T')[0];
      }
    }
    return map;
  }, [initialActiveEdition]);

  const totalEventDays = initialActiveEdition?.totalDays || 15;

  React.useEffect(() => {
    if (currentTeam?.savedLineups) {
      try {
        setSavedDayLineups(JSON.parse(currentTeam.savedLineups));
      } catch (e) {
        console.error('Failed to parse currentTeam savedLineups JSON:', e);
      }
    } else {
      setSavedDayLineups({});
    }
  }, [currentTeam]);

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
          if (savedRound.playerIds && Array.isArray(savedRound.playerIds)) {
            return { playerIds: Array.from({ length: numPlayers }, (_, i) => savedRound.playerIds[i] || '') };
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
      setRoundLineups(initRoundLineups(dayNum));
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

  const handleSaveDayLineup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setEmailPreviewUrl(null);

    const rounds = roundLineups.map((r, ri) => ({
      name: getRoundLabel(ri),
      players: r.playerIds.map(pid => teamMembers.find((m: any) => m.id === pid)?.name || pid),
      playerIds: r.playerIds, // Save player IDs for easy modal pre-population
    }));

    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST';

    // Persist to database
    const dbSaveRes = await saveTeamDailyLineup(currentTeam.id, selectedDayNumber, rounds, timeStr);
    if (!dbSaveRes.success) {
      alert('⚠️ Failed to save lineup to database: ' + (dbSaveRes.error || 'Unknown error'));
      setIsSubmitting(false);
      return;
    }

    setSavedDayLineups(prev => ({
      ...prev,
      [selectedDayNumber]: {
        rounds,
        submittedAt: timeStr,
      },
    }));

    // Trigger email send
    const res = await sendLineupEmailAction({
      teamName,
      captainName,
      captainEmail,
      dayNumber: selectedDayNumber,
      rounds,
    });

    if (res && res.success && res.previewUrl) {
      setEmailPreviewUrl(res.previewUrl);
    }

    setLineupSubmittedSuccess(true);
    setTimeout(() => {
      setDayLineupModalOpen(false);
      setLineupSubmittedSuccess(false);
      setEmailPreviewUrl(null);
    }, 5000);
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
          </div>
          <h1 className="text-3xl font-black">{teamName}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Captain Dashboard
          </p>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
          <div className="text-[10px] font-bold text-emerald-500 uppercase">Total Team Members</div>
          <div className="text-3xl font-black text-foreground mt-1">{teamMembers.length}</div>
        </Card>
        <Card className="p-4 border-blue-500/30 bg-blue-500/5">
          <div className="text-[10px] font-bold text-blue-400 uppercase">Combis Saved</div>
          <div className="text-3xl font-black text-foreground mt-1">{Object.keys(savedDayLineups).length}</div>
        </Card>
      </div>

      {/* SECTION 1: PARTICIPANTS */}
      <Card className="border-amber-500/30">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" /> My Team
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">View your team members for this edition.</p>
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

      {/* SECTION 2: DAY COMBI SUBMISSION */}
      <Card className="border-amber-500/40">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-500" /> Day 1 to Day {totalEventDays} Combi Submission
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Select your combi for {roundsPerDay} events per day before <strong className="text-rose-400">9:30 PM IST</strong>.
              </CardDescription>
            </div>
            <Badge variant="carrom" className="font-bold text-xs px-3 py-1 self-start sm:self-auto">
              Current Active: Day {selectedDayNumber}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Dynamic Event Days Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {Array.from({ length: totalEventDays }, (_, i) => i + 1).map((dayNum) => {
              const isSaved = !!savedDayLineups[dayNum];
              const isSelected = dayNum === selectedDayNumber;
              const isLocked = isDayLocked(dayNum, dayDatesMap);
              const rawDate = dayDatesMap[dayNum];
              const formattedDate = rawDate && !isNaN(new Date(rawDate).getTime())
                ? new Date(rawDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                : '';
              const formattedDateFull = rawDate && !isNaN(new Date(rawDate).getTime())
                ? new Date(rawDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
                : '';

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => handleOpenDayLineupModal(dayNum)}
                  className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    isLocked
                      ? 'border-rose-500/40 bg-rose-500/10'
                      : isSaved
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : isSelected
                      ? 'border-amber-500/60 bg-amber-500/10'
                      : 'border-border bg-card hover:border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider">DAY {dayNum}</span>
                    {formattedDate && (
                      <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30 font-mono">
                        {formattedDate}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-extrabold text-foreground/90 mt-1.5 flex items-center justify-between">
                    <span>{formattedDateFull}</span>
                    {isLocked && <span className="text-xs" title="Locked (Past 9:30 PM IST)">🔒</span>}
                  </div>
                  <div className="mt-1.5 pt-1 border-t border-border/40">
                    {isLocked ? (
                      <span className="text-[9.5px] font-bold text-rose-400 flex items-center gap-1">
                        🔒 Locked (Past 9:30 PM)
                      </span>
                    ) : isSaved ? (
                      <span className="text-[9.5px] font-bold text-emerald-400 flex items-center gap-1">
                        ✓ Saved · {savedDayLineups[dayNum].submittedAt}
                      </span>
                    ) : (
                      <span className="text-[9.5px] font-bold text-muted-foreground/60">Not submitted</span>
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
                            Saved at {data.submittedAt}
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

      {/* COMBI MODAL */}
      <Dialog open={dayLineupModalOpen} onOpenChange={setDayLineupModalOpen}>
        <div className="flex flex-col max-h-[85vh] overflow-hidden -mx-6 -my-6 bg-card text-foreground rounded-2xl">
          {/* STICKY HEADER */}
          <div className="px-6 pt-6 pb-4 border-b border-border bg-card/95 backdrop-blur-md sticky top-0 z-20 flex flex-col space-y-1.5 text-left pr-12">
            <h2 className="text-xl font-bold leading-none tracking-tight flex items-center gap-2">
              <Send className="h-5 w-5 text-amber-500" /> Day {selectedDayNumber} Combi {dayDatesMap[selectedDayNumber] && !isNaN(new Date(dayDatesMap[selectedDayNumber]).getTime()) ? `(${new Date(dayDatesMap[selectedDayNumber]).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })})` : ''} — {roundsPerDay} events
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Deadline: <strong className="text-rose-400">9:30 PM IST</strong>
            </p>
          </div>

          {lineupSubmittedSuccess ? (
            <div className="p-8 text-center space-y-4 bg-emerald-500/10 border-b border-emerald-500/20">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto animate-bounce" />
              <h3 className="font-extrabold text-base text-foreground">Day {selectedDayNumber} Combi Saved!</h3>
              <p className="text-xs text-muted-foreground">{roundsPerDay} combis recorded before the 9:30 PM IST deadline.</p>
              {captainEmail ? (
                <p className="text-xs text-muted-foreground">
                  A confirmation receipt with your submitted details has been sent to <span className="text-amber-400 font-semibold">{captainEmail}</span>.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Your combi has been saved securely. All team combis remain confidential until the 9:30 PM IST cutoff.
                </p>
              )}
              {emailPreviewUrl && (
                <div className="pt-2">
                  <a
                    href={emailPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/20 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>✉️ [Dev Mode] View Ethereal Email Preview</span>
                  </a>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveDayLineup} className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* SCROLLABLE INNER SECTION */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0 scrollbar-thin scrollbar-thumb-amber-500/20 hover:scrollbar-thumb-amber-500/40 scrollbar-track-transparent">
                {isDayLocked(selectedDayNumber, dayDatesMap) && (
                  <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs font-bold text-rose-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>🔒 Submissions for Day {selectedDayNumber} closed at 9:30 PM IST. This combi is locked and read-only.</span>
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
                    <div key={ri} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3 hover:border-amber-500/20 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-400">{getRoundLabel(ri)}</span>
                      </div>

                      <div className={`grid gap-2 ${roundPlayersNeeded === 1 ? 'grid-cols-1' : roundPlayersNeeded === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
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
                                        ? `🚫 ${m.name || m.username} (${getRoundLabel(inOtherRound - 1)})`
                                        : inSameRound && m.id !== selectedId
                                        ? `🚫 ${m.name || m.username} (Selected)`
                                        : m.name || m.username}
                                    </option>
                                  );
                                })}
                              </select>
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
                    {isSubmitting ? 'Saving...' : `Save Day ${selectedDayNumber} (${roundsPerDay} Combis)`}
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
