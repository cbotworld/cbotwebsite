'use client';

import * as React from 'react';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trophy, Activity, Users, Flame, Download } from 'lucide-react';

type ScoreDay = { dayNumber: number; published: boolean; calendarDate: string };
type ScoreTeam = { id: string; name: string; tag: string; players: Array<{ id: string; name: string }> };
type ScoreRow = { userId: string; dayNumber: number; score: number; slams: number };

const PLAYER_COLS = [
  { wch: 8 },
  { wch: 14 },
  { wch: 18 },
  { wch: 8 },
  { wch: 24 },
  { wch: 10 },
  { wch: 8 },
  { wch: 12 },
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
      playerRows.push({
        Day: dayMeta.dayNumber,
        Date: dayMeta.calendarDate || '',
        Team: team.name,
        Tag: team.tag,
        Player: player.name,
        Points: row ? row.score : '',
        Slams: row ? row.slams : '',
        Status: row ? 'Submitted' : 'Pending',
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

export default function PlayerScoresClient({
  editionTitle,
  days,
  teams,
  scores,
}: {
  editionTitle: string;
  days?: Array<{ dayNumber: number; published: boolean; calendarDate: string }>;
  teams?: Array<{ id: string; name: string; tag: string; players: Array<{ id: string; name: string }> }>;
  scores?: Array<{ userId: string; dayNumber: number; score: number; slams: number }>;
}) {
  const dayList = Array.isArray(days) ? days : [];
  const teamList = Array.isArray(teams) ? teams : [];
  const scoreList = Array.isArray(scores) ? scores : [];

  const [day, setDay] = React.useState(1);

  const selected = dayList.find((d) => d.dayNumber === day) || dayList[0];
  const selectedDay = selected?.dayNumber ?? day;
  const byUser = scoresByUserForDay(scoreList, selectedDay);

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
          {editionTitle} — Day-wise and team-wise real-time score updates.
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

                <CardContent className="pt-3 space-y-2">
                  {(team.players || []).length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-2">No players assigned to this team.</div>
                  ) : (
                    (team.players || []).map((player) => {
                      const row = byUser.get(player.id);
                      return (
                        <div
                          key={player.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 border border-border/40 hover:border-border transition-colors"
                        >
                          <span className="font-bold text-sm text-foreground flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-amber-500/70 shrink-0" />
                            {player.name}
                          </span>

                          {row ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="carrom" className="font-mono text-xs font-black px-2.5 py-0.5">
                                {row.score} pts
                              </Badge>
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
