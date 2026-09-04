'use client';

import * as React from 'react';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trophy, Activity, Users, Flame, Download, Info, ChevronDown, ChevronUp, AlertCircle, ShieldAlert } from 'lucide-react';

type ScoreDay = { dayNumber: number; published: boolean; calendarDate: string };
type ScoreTeam = { id: string; name: string; tag: string; players: Array<{ id: string; name: string }> };

export type WalkoverBreakdown = {
  eventLossScore: number;
  opponentsTotal: number;
  teammatesTotal: number;
  gradeWorstScore: number;
  gradeMaxDayScore: number | null;
  targetLossScore: number;
  finalScore: number;
  appliedConstraint: 'EVENT_LOSS' | 'GRADE_WORST' | 'TARGET_LOSS' | 'FALLBACK';
};

export type ScoreRow = {
  userId: string;
  dayNumber: number;
  score: number;
  slams: number;
  isWalkover?: boolean;
  eventName?: string;
  playerGrade?: string | null;
  playerTarget?: number | null;
  breakdown?: WalkoverBreakdown;
};

const PLAYER_COLS = [
  { wch: 8 },
  { wch: 14 },
  { wch: 18 },
  { wch: 8 },
  { wch: 24 },
  { wch: 10 },
  { wch: 8 },
  { wch: 16 },
  { wch: 36 },
];
const TEAM_COLS = [
  { wch: 8 },
  { wch: 14 },
  { wch: 18 },
  { wch: 8 },
  { wch: 10 },
  { wch: 12 },
  { wch: 14 },
  { wch: 8 },
];

function scoresByUserForDay(scoreList: ScoreRow[], dayNumber: number) {
  return new Map(scoreList.filter((s) => s.dayNumber === dayNumber).map((s) => [s.userId, s]));
}

function buildExcelRows(
  dayMeta: ScoreDay,
  teamList: ScoreTeam[],
  byUser: Map<string, ScoreRow>,
) {
  const playerRows: Array<Record<string, string | number>> = [];
  const teamRows: Array<Record<string, string | number>> = [];

  teamList.forEach((team) => {
    let teamTotalPts = 0;
    let teamTotalSlams = 0;
    let submittedCount = 0;
    const players = team.players || [];

    players.forEach((player) => {
      const row = byUser.get(player.id);
      if (row) {
        teamTotalPts += row.score || 0;
        teamTotalSlams += row.slams || 0;
        submittedCount++;
      }
      let statusStr = 'Pending';
      let woDetail = '';
      if (row) {
        if (row.isWalkover) {
          statusStr = 'Walkover (WO)';
          const b = row.breakdown;
          if (b) {
            woDetail = `EventLoss: ${b.eventLossScore} (Opp:${b.opponentsTotal}+1 - Tm:${b.teammatesTotal}), GradeWorst: ${b.gradeWorstScore}, TargetLoss: ${b.targetLossScore} => Final: ${b.finalScore}`;
          }
        } else {
          statusStr = 'Submitted';
        }
      }

      playerRows.push({
        Day: dayMeta.dayNumber,
        Date: dayMeta.calendarDate || '',
        Team: team.name,
        Tag: team.tag,
        Player: player.name,
        Points: row ? row.score : '',
        Slams: row ? row.slams : '',
        Status: statusStr,
        'Walkover Calculation': woDetail,
      });
    });

    teamRows.push({
      Day: dayMeta.dayNumber,
      Date: dayMeta.calendarDate || '',
      Team: team.name,
      Tag: team.tag,
      Players: players.length,
      Submitted: submittedCount,
      'Team Points': teamTotalPts,
      Slams: teamTotalSlams,
    });
  });

  return { playerRows, teamRows };
}

function writeScoreWorkbook(
  playerRows: Array<Record<string, string | number>>,
  teamRows: Array<Record<string, string | number>>,
  playerSheetName: string,
  teamSheetName: string,
  fileName: string,
) {
  const workbook = XLSX.utils.book_new();
  const playersSheet = XLSX.utils.json_to_sheet(playerRows);
  playersSheet['!cols'] = PLAYER_COLS;
  const teamsSheet = XLSX.utils.json_to_sheet(teamRows);
  teamsSheet['!cols'] = TEAM_COLS;
  XLSX.utils.book_append_sheet(workbook, playersSheet, playerSheetName.slice(0, 31));
  XLSX.utils.book_append_sheet(workbook, teamsSheet, teamSheetName.slice(0, 31));
  XLSX.writeFile(workbook, fileName);
}

function constraintBadgeLabel(appliedConstraint?: string) {
  switch (appliedConstraint) {
    case 'EVENT_LOSS':
      return 'Event Loss (Opponents + 1)';
    case 'GRADE_WORST':
      return 'Grade Worst (Day Max + 1)';
    case 'TARGET_LOSS':
      return 'Target Loss (Target + 1)';
    default:
      return 'Calculated Penalty';
  }
}

export default function PlayerScoresClient({
  editionTitle,
  days,
  teams,
  scores,
}: {
  editionTitle: string;
  days?: Array<{ dayNumber: number; published: boolean; calendarDate: string }>;
  teams?: Array<{ id: string; name: string; tag: string; players: Array<{ id: string; name: string }> }>;
  scores?: Array<ScoreRow>;
}) {
  const dayList = Array.isArray(days) ? days : [];
  const teamList = Array.isArray(teams) ? teams : [];
  const scoreList = Array.isArray(scores) ? scores : [];

  const [day, setDay] = React.useState(1);
  const [expandedWoUsers, setExpandedWoUsers] = React.useState<Record<string, boolean>>({});

  const selected = dayList.find((d) => d.dayNumber === day) || dayList[0];
  const selectedDay = selected?.dayNumber ?? day;
  const byUser = scoresByUserForDay(scoreList, selectedDay);

  const toggleWoExpand = (userId: string) => {
    setExpandedWoUsers((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const downloadDayExcel = () => {
    if (!selected) return;
    const { playerRows, teamRows } = buildExcelRows(selected, teamList, byUser);
    writeScoreWorkbook(
      playerRows,
      teamRows,
      `Day ${selectedDay} Players`,
      `Day ${selectedDay} Teams`,
      `Official Day ${selectedDay} Player Scores Spreadsheet.xlsx`,
    );
  };

  const downloadAllDaysExcel = () => {
    if (dayList.length === 0) return;
    const playerRows: Array<Record<string, string | number>> = [];
    const teamRows: Array<Record<string, string | number>> = [];
    dayList.forEach((dayMeta) => {
      const rows = buildExcelRows(dayMeta, teamList, scoresByUserForDay(scoreList, dayMeta.dayNumber));
      playerRows.push(...rows.playerRows);
      teamRows.push(...rows.teamRows);
    });
    writeScoreWorkbook(
      playerRows,
      teamRows,
      'All Days Players',
      'All Days Teams',
      'Official All Days Player Scores Spreadsheet.xlsx',
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="border-b border-border/60 pb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Badge variant="carrom" className="flex items-center gap-1">
            <Activity className="h-3 w-3 animate-pulse" /> Real-time Live Scores
          </Badge>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
          <Trophy className="h-7 w-7 text-amber-500" /> Player Scores
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          {editionTitle} — Day-wise and team-wise real-time score updates with official walkover calculations.
        </p>
      </div>

      {/* ── Day Selector Buttons ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto touch-scroll-x scrollbar-none pb-1.5 flex-1 min-w-0">
          {dayList.map((d) => (
            <button
              key={d.dayNumber}
              type="button"
              onClick={() => setDay(d.dayNumber)}
              className={`px-4 py-2 rounded-xl text-xs font-black border whitespace-nowrap shrink-0 transition-all ${
                day === d.dayNumber
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 scale-[1.02]'
                  : 'border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-amber-500/40'
              }`}
            >
              Day {d.dayNumber}
            </button>
          ))}
        </div>
        {dayList.length > 0 ? (
          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
            <Button
              type="button"
              onClick={downloadDayExcel}
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-4 h-9 rounded-xl shadow-md border border-emerald-400"
            >
              <Download className="h-4 w-4" />
              Download Day {selectedDay} Excel
            </Button>
            <Button
              type="button"
              onClick={downloadAllDaysExcel}
              className="w-full sm:w-auto bg-sky-500 hover:bg-sky-600 text-slate-950 font-black text-xs px-4 h-9 rounded-xl shadow-md border border-sky-400"
            >
              <Download className="h-4 w-4" />
              Download All Days Excel
            </Button>
          </div>
        ) : null}
      </div>

      {/* ── Team-Wise Player Scores Grid ──────────────────────────────────── */}
      {dayList.length === 0 ? (
        <Card className="border-amber-500/30">
          <CardContent className="p-8 text-center text-sm font-semibold text-muted-foreground">
            Player scores will appear here once tournament days are scheduled.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {teamList.map((team) => {
            // Calculate total team score for this day
            let teamTotalPts = 0;
            let teamTotalSlams = 0;
            let submittedCount = 0;

            (team.players || []).forEach((player) => {
              const row = byUser.get(player.id);
              if (row) {
                teamTotalPts += row.score || 0;
                teamTotalSlams += row.slams || 0;
                submittedCount++;
              }
            });

            return (
              <Card key={team.id} className="border-border/80 bg-card/70 backdrop-blur-sm shadow-xl hover:border-amber-500/40 transition-all">
                <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-black flex items-center gap-2">
                      <Users className="h-4 w-4 text-amber-500" /> {team.name}
                    </CardTitle>
                    <CardDescription className="text-xs font-bold text-amber-400/90">{team.tag}</CardDescription>
                  </div>

                  <div className="text-right bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
                    <div className="text-[10px] uppercase font-bold text-amber-400/80">Day {selectedDay} Total</div>
                    <div className="text-sm font-black text-amber-400">
                      {teamTotalPts} <span className="text-xs font-semibold text-muted-foreground">pts</span>
                      {teamTotalSlams > 0 && (
                        <span className="ml-1.5 text-xs text-amber-300">({teamTotalSlams} 🔥)</span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-3 space-y-2.5">
                  {(team.players || []).length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-2">No players assigned to this team.</div>
                  ) : (
                    (team.players || []).map((player) => {
                      const row = byUser.get(player.id);
                      const isExpanded = Boolean(expandedWoUsers[player.id]);
                      const isWo = Boolean(row?.isWalkover);
                      const b = row?.breakdown;

                      return (
                        <div
                          key={player.id}
                          className={`rounded-xl border transition-all ${
                            isWo
                              ? 'bg-rose-950/20 border-rose-500/40'
                              : 'bg-background/60 border-border/40 hover:border-border'
                          }`}
                        >
                          <div className="flex items-center justify-between p-2.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2 w-2 rounded-full shrink-0 ${
                                  isWo ? 'bg-rose-500' : 'bg-amber-500/70'
                                }`}
                              />
                              <div>
                                <span className="font-bold text-sm text-foreground">{player.name}</span>
                                {row?.playerGrade && (
                                  <span className="ml-2 text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    {row.playerGrade}
                                  </span>
                                )}
                              </div>
                            </div>

                            {row ? (
                              <div className="flex items-center gap-2">
                                {isWo ? (
                                  <div className="flex items-center gap-1.5">
                                    <Badge
                                      variant="destructive"
                                      className="font-mono text-xs font-black px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30"
                                    >
                                      WO: {row.score} pts
                                    </Badge>
                                    <button
                                      type="button"
                                      onClick={() => toggleWoExpand(player.id)}
                                      className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
                                      title="Toggle walkover calculation breakdown"
                                    >
                                      <Info className="h-3 w-3" />
                                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    </button>
                                  </div>
                                ) : (
                                  <Badge variant="carrom" className="font-mono text-xs font-black px-2.5 py-0.5">
                                    {row.score} pts
                                  </Badge>
                                )}

                                {row.slams > 0 && (
                                  <span className="text-xs font-extrabold text-amber-400 flex items-center gap-0.5">
                                    <Flame className="h-3.5 w-3.5 fill-amber-400 text-amber-500" /> {row.slams}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs font-semibold text-muted-foreground/60 italic">
                                — Pending
                              </span>
                            )}
                          </div>

                          {/* ── Walkover Breakdown Details Panel ───────────────── */}
                          {isWo && b && isExpanded && (
                            <div className="mx-2.5 mb-2.5 p-3 rounded-lg bg-slate-950/80 border border-rose-500/30 text-xs space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                              <div className="flex items-center justify-between border-b border-rose-500/20 pb-1.5">
                                <div className="font-black text-rose-300 flex items-center gap-1.5">
                                  <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                                  Walkover Score Calculation Breakdown
                                </div>
                                <span className="text-[10px] font-bold text-rose-400/80">
                                  {row.eventName || `Event Match`}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                                {/* 1. Event Loss */}
                                <div
                                  className={`p-2 rounded border ${
                                    b.appliedConstraint === 'EVENT_LOSS'
                                      ? 'bg-rose-500/20 border-rose-400 text-foreground font-semibold shadow-sm'
                                      : 'bg-card/40 border-border/40 text-muted-foreground'
                                  }`}
                                >
                                  <div className="text-[10px] font-bold uppercase text-amber-400">1. Event Loss Rule</div>
                                  <div className="text-xs font-black text-foreground mt-0.5">{b.eventLossScore} pts</div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    Opponents ({b.opponentsTotal}) + 1 - Teammates ({b.teammatesTotal})
                                  </div>
                                </div>

                                {/* 2. Grade Worst */}
                                <div
                                  className={`p-2 rounded border ${
                                    b.appliedConstraint === 'GRADE_WORST'
                                      ? 'bg-rose-500/20 border-rose-400 text-foreground font-semibold shadow-sm'
                                      : 'bg-card/40 border-border/40 text-muted-foreground'
                                  }`}
                                >
                                  <div className="text-[10px] font-bold uppercase text-amber-400">2. Grade Worst Rule</div>
                                  <div className="text-xs font-black text-foreground mt-0.5">{b.gradeWorstScore} pts</div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    {row.playerGrade || 'Grade'} Max ({b.gradeMaxDayScore ?? 'N/A'}) + 1
                                  </div>
                                </div>

                                {/* 3. Target Loss */}
                                <div
                                  className={`p-2 rounded border ${
                                    b.appliedConstraint === 'TARGET_LOSS'
                                      ? 'bg-rose-500/20 border-rose-400 text-foreground font-semibold shadow-sm'
                                      : 'bg-card/40 border-border/40 text-muted-foreground'
                                  }`}
                                >
                                  <div className="text-[10px] font-bold uppercase text-amber-400">3. Target Rule</div>
                                  <div className="text-xs font-black text-foreground mt-0.5">
                                    {b.targetLossScore > 0 ? `${b.targetLossScore} pts` : 'No Target'}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    {row.playerTarget ? `Target (${row.playerTarget}) + 1` : 'No target set'}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1.5 border-t border-rose-500/20 gap-1.5 text-[11px]">
                                <div className="text-muted-foreground">
                                  Final Score: <span className="font-mono font-black text-rose-300">max({b.eventLossScore}, {b.gradeWorstScore}, {b.targetLossScore || 0})</span>
                                </div>
                                <div className="text-rose-300 font-extrabold flex items-center gap-1">
                                  Applied Constraint: <span className="text-amber-400">{constraintBadgeLabel(b.appliedConstraint)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
