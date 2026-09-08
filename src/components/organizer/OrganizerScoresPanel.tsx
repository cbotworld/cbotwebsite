'use client';

import * as React from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Check,
  ChevronDown,
  Search,
  User,
  X,
  Download,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Flame,
} from 'lucide-react';
import {
  organiserUpsertPlayerDayScore,
  bulkOrganiserUpsertDayScores,
  getOrganiserScoreDesk,
  getAverageReviewPrompt,
} from '@/lib/actions/playerScoreActions';
import { BoardScoreEditor } from '@/components/scores/BoardScoreEditor';
import { ScoreEditRules } from '@/components/scores/ScoreEditRules';
import { SCORE_EDIT_ORGANISER_HELP } from '@/lib/score-edit-policy';
import { boardsToDraft, draftToPayload, emptyBoardDraft, type DayBoardScore } from '@/lib/board-scores';

type DeskDay = { dayNumber: number; calendarDate: string; published: boolean };
type DeskScore = {
  userId: string;
  dayNumber: number;
  score: number;
  slams: number;
  boards: DayBoardScore[];
  source: string;
  enteredByName?: string | null;
};

function SearchablePlayerSelect({
  users,
  value,
  onChange,
}: {
  users: Array<{ id: string; name?: string; username?: string; target?: number | null }>;
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedUser = users.find((u) => u.id === value);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.name || ''} ${u.username || ''}`.toLowerCase().includes(q)
    );
  }, [users, query]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold flex items-center justify-between gap-2 hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-colors text-left shadow-xs"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate text-foreground">
            {selectedUser ? (selectedUser.name || selectedUser.username) : 'Select a player...'}
          </span>
          {Number(selectedUser?.target) > 0 && (
            <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold shrink-0">
              tgt {selectedUser?.target}
            </span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-lg border border-border bg-popover shadow-2xl p-2 space-y-1.5 backdrop-blur-md">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by player name or username…"
              className="w-full h-8.5 rounded-md border border-input bg-background pl-8 pr-7 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-border/20 rounded-md">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No players found matching &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map((u) => {
                const isSelected = u.id === value;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onChange(u.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full px-2.5 py-2 text-left text-xs font-semibold flex items-center justify-between gap-2 rounded transition-colors ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-200'
                        : 'hover:bg-accent text-foreground'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{u.name || u.username}</div>
                      {u.username && u.name && (
                        <div className="text-[10px] text-muted-foreground truncate">@{u.username}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {Number(u.target) > 0 && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                          tgt {u.target}
                        </span>
                      )}
                      {isSelected && <Check className="h-3.5 w-3.5 text-amber-400" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type ParsedUploadRow = {
  userId: string;
  playerName: string;
  username?: string;
  teamName?: string;
  target?: number | null;
  score: number | null;
  boardCount: number;
  slams: number;
  isWalkover: boolean;
  bonusAchieved: boolean | null;
  isValid: boolean;
  errorReason?: string;

  // Difference Tracking against existing website score
  hasExistingWebScore: boolean;
  existingWebScore?: number | null;
  existingWebSlams?: number | null;
  existingWebBoards?: number | null;
  existingWebSource?: string | null;
  diffType: 'MATCH' | 'DIFF' | 'NEW' | 'WO';
  diffDescription: string;
};

export default function OrganizerScoresPanel({
  users,
  teams = [],
  editionTitle,
  editionId,
}: {
  users: Array<{ id: string; name?: string; username?: string; target?: number | null; teamName?: string }>;
  teams?: Array<{ id: string; name: string; members?: Array<{ user?: { id?: string } }>; spocMembers?: Array<{ user?: { id?: string } }> }>;
  editionTitle?: string;
  editionId?: string;
}) {
  const [userId, setUserId] = React.useState(users[0]?.id || '');
  const [day, setDay] = React.useState(1);
  const [boards, setBoards] = React.useState([emptyBoardDraft()]);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [days, setDays] = React.useState<DeskDay[]>([]);
  const [scores, setScores] = React.useState<DeskScore[]>([]);
  const [review, setReview] = React.useState<{ finishedStageName: string; nextStageName: string | null } | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Bulk Upload state
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);
  const [parsedRows, setParsedRows] = React.useState<ParsedUploadRow[]>([]);
  const [uploadFilter, setUploadFilter] = React.useState('');
  const [diffTabFilter, setDiffTabFilter] = React.useState<'ALL' | 'DIFF' | 'NEW' | 'MATCH' | 'WO'>('ALL');
  const [uploadBusy, setUploadBusy] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const selected = users.find((u) => u.id === userId);
  const target = Number(selected?.target) || 0;
  const existing = scores.find((s) => s.userId === userId && s.dayNumber === day) || null;

  // Build a map of userId -> teamName for template & preview
  const userTeamMap = React.useMemo(() => {
    const map = new Map<string, string>();
    if (teams && teams.length > 0) {
      for (const t of teams) {
        if (Array.isArray(t.members)) {
          for (const m of t.members) {
            const uid = m.user?.id || (m as any).userId || (m as any).id;
            if (uid) map.set(uid, t.name);
          }
        }
        if (Array.isArray(t.spocMembers)) {
          for (const m of t.spocMembers) {
            const uid = m.user?.id || (m as any).userId || (m as any).id;
            if (uid) map.set(uid, t.name);
          }
        }
      }
    }
    return map;
  }, [teams]);

  const loadDesk = React.useCallback(async () => {
    const desk = await getOrganiserScoreDesk(editionId);
    if (desk.success) {
      setDays(desk.days || []);
      setScores(desk.scores || []);
    }
    return desk;
  }, [editionId]);

  React.useEffect(() => {
    loadDesk()
      .then((desk) => {
        if (desk.success && desk.days?.length) {
          setDay((prev) => (desk.days.some((d) => d.dayNumber === prev) ? prev : desk.days[0].dayNumber));
        }
      })
      .catch(() => {});
    getAverageReviewPrompt(editionId).then(setReview).catch(() => {});
  }, [loadDesk, editionId]);

  React.useEffect(() => {
    if (!userId && users[0]?.id) setUserId(users[0].id);
  }, [users, userId]);

  React.useEffect(() => {
    setBoards(boardsToDraft(existing?.boards, existing?.score, existing?.slams));
  }, [userId, day, scores]);

  const dayOptions = days.length
    ? days
    : Array.from({ length: 15 }, (_, i) => ({ dayNumber: i + 1, calendarDate: '', published: false }));

  // ── Download Day Excel Template ──────────────────────────────────────────
  const downloadDayTemplate = () => {
    // Only include assigned players who belong to a team
    const assignedUsers = users
      .filter((u) => {
        const teamName = u.teamName || userTeamMap.get(u.id);
        return Boolean(teamName && teamName.trim() !== '' && teamName.trim().toLowerCase() !== 'unassigned');
      })
      .sort((a, b) => {
        const teamA = (a.teamName || userTeamMap.get(a.id) || '').toLowerCase();
        const teamB = (b.teamName || userTeamMap.get(b.id) || '').toLowerCase();
        if (teamA !== teamB) return teamA.localeCompare(teamB);
        const nameA = (a.name || a.username || '').toLowerCase();
        const nameB = (b.name || b.username || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

    const rows = assignedUsers.map((u) => {
      const existingScore = scores.find((s) => s.userId === u.id && s.dayNumber === day);
      const teamName = u.teamName || userTeamMap.get(u.id) || '';
      return {
        'Team': teamName,
        'Player Name': u.name || u.username || 'Player',
        'User ID': u.id,
        'Total Score (Leave blank for WO)': existingScore ? existingScore.score : '',
        'No. of Boards': existingScore ? (Array.isArray(existingScore.boards) ? existingScore.boards.length : 1) : 1,
        'Slams': existingScore ? (existingScore.slams || 0) : 0,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 18 }, // Team
      { wch: 24 }, // Player Name
      { wch: 30 }, // User ID
      { wch: 32 }, // Total Score (Leave blank for WO)
      { wch: 14 }, // No. of Boards
      { wch: 10 }, // Slams
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Day ${day} Scores`);
    XLSX.writeFile(wb, `CBOT_Day_${day}_Score_Upload_Template.xlsx`);
  };

  // ── Parse Uploaded Excel File ────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawJson.length) {
          setUploadError('The uploaded file contains no rows or data.');
          return;
        }

        const userById = new Map(users.map((u) => [u.id.toLowerCase().trim(), u]));
        const userByUsername = new Map(users.filter((u) => u.username).map((u) => [u.username!.toLowerCase().replace('@', '').trim(), u]));
        const userByName = new Map(users.filter((u) => u.name).map((u) => [u.name!.toLowerCase().trim(), u]));

        const parsed: ParsedUploadRow[] = [];

        for (const row of rawJson) {
          const rawId = String(row['User ID'] || row['userId'] || row['id'] || row['UID'] || '').trim().toLowerCase();
          const rawUsername = String(row['Username'] || row['username'] || '').trim().toLowerCase().replace('@', '');
          const rawName = String(row['Player Name'] || row['Player'] || row['Name'] || row['player_name'] || '').trim();
          const rawTeam = String(row['Team'] || row['Team Name'] || '').trim();

          const matchedUser =
            (rawId && userById.get(rawId)) ||
            (rawUsername && userByUsername.get(rawUsername)) ||
            (rawName && userByName.get(rawName.toLowerCase())) ||
            null;

          if (!matchedUser) {
            parsed.push({
              userId: '',
              playerName: rawName || 'Unknown Player',
              username: rawUsername || '',
              teamName: rawTeam || '',
              score: null,
              boardCount: 1,
              slams: 0,
              isWalkover: true,
              bonusAchieved: null,
              isValid: false,
              errorReason: 'Player not found in edition roster',
              hasExistingWebScore: false,
              diffType: 'DIFF',
              diffDescription: 'Unmatched player in edition roster',
            });
            continue;
          }

          // Check for existing score in website for this player on selected day
          const existingScore = scores.find((s) => s.userId === matchedUser.id && s.dayNumber === day);
          const hasExisting = !!existingScore;
          const webScore = existingScore ? existingScore.score : null;
          const webSlams = existingScore ? (existingScore.slams ?? 0) : null;
          const webBoards = existingScore ? (existingScore.boards?.length || 1) : null;
          const webSource = existingScore ? existingScore.source : null;

          // Read Total Score
          const rawScoreStr = String(
            row['Total Score (Leave blank for WO)'] ??
            row['Total Score'] ??
            row['Total'] ??
            row['Score'] ??
            row['score'] ??
            row['total_score'] ??
            ''
          ).trim();

          // Read Boards
          const rawBoardsStr = String(
            row['No. of Boards'] ??
            row['Boards'] ??
            row['no_of_boards'] ??
            row['board_count'] ??
            '1'
          ).trim();

          // Read Slams
          const rawSlamsStr = String(
            row['Slams'] ??
            row['No. of Slams'] ??
            row['slams'] ??
            '0'
          ).trim();

          const isBlankOrWo =
            rawScoreStr === '' ||
            /^(wo|walkover|absent|na|none|null|-)$/i.test(rawScoreStr);

          if (isBlankOrWo) {
            let diffType: 'MATCH' | 'DIFF' | 'NEW' | 'WO' = 'WO';
            let diffDescription = 'Walkover (Blank / WO)';

            if (hasExisting && webScore !== null) {
              diffType = 'DIFF';
              diffDescription = `Website has ${webScore} pts (${webSource}) ➔ Excel is marked Walkover`;
            } else if (!hasExisting) {
              diffType = 'WO';
              diffDescription = 'Walkover (No score on website)';
            }

            parsed.push({
              userId: matchedUser.id,
              playerName: matchedUser.name || matchedUser.username || 'Player',
              username: matchedUser.username,
              teamName: matchedUser.teamName || userTeamMap.get(matchedUser.id) || rawTeam || '',
              target: matchedUser.target,
              score: null,
              boardCount: 1,
              slams: 0,
              isWalkover: true,
              bonusAchieved: null,
              isValid: true,
              hasExistingWebScore: hasExisting,
              existingWebScore: webScore,
              existingWebSlams: webSlams,
              existingWebBoards: webBoards,
              existingWebSource: webSource,
              diffType,
              diffDescription,
            });
          } else {
            const numScore = parseInt(rawScoreStr, 10);
            const numBoards = Math.max(1, Math.min(10, parseInt(rawBoardsStr, 10) || 1));
            const numSlams = Math.max(0, parseInt(rawSlamsStr, 10) || 0);

            if (isNaN(numScore) || numScore < 0) {
              parsed.push({
                userId: matchedUser.id,
                playerName: matchedUser.name || matchedUser.username || 'Player',
                username: matchedUser.username,
                teamName: matchedUser.teamName || userTeamMap.get(matchedUser.id) || rawTeam || '',
                target: matchedUser.target,
                score: null,
                boardCount: 1,
                slams: 0,
                isWalkover: false,
                bonusAchieved: null,
                isValid: false,
                errorReason: `Invalid score "${rawScoreStr}"`,
                hasExistingWebScore: hasExisting,
                existingWebScore: webScore,
                existingWebSlams: webSlams,
                existingWebBoards: webBoards,
                existingWebSource: webSource,
                diffType: 'DIFF',
                diffDescription: `Invalid score format "${rawScoreStr}"`,
              });
            } else {
              const tgt = Number(matchedUser.target) || 0;
              const bonusAchieved = tgt > 0 ? numScore < tgt : null;

              let diffType: 'MATCH' | 'DIFF' | 'NEW' | 'WO' = 'NEW';
              let diffDescription = 'Not submitted on website yet (New entry)';

              if (!hasExisting || webScore === null) {
                diffType = 'NEW';
                diffDescription = 'New Entry (Player has not submitted on website)';
              } else {
                const scoreMatches = numScore === webScore;
                const slamsMatches = numSlams === webSlams;

                if (scoreMatches && slamsMatches) {
                  diffType = 'MATCH';
                  diffDescription = `Matches website score (${webScore} pts, ${webSlams} slams)`;
                } else {
                  diffType = 'DIFF';
                  const parts: string[] = [];
                  if (!scoreMatches) {
                    const diff = numScore - (webScore ?? 0);
                    const diffSign = diff > 0 ? `+${diff}` : `${diff}`;
                    parts.push(`Score: Web ${webScore} ➔ Excel ${numScore} (${diffSign})`);
                  }
                  if (!slamsMatches) {
                    parts.push(`Slams: Web ${webSlams ?? 0} ➔ Excel ${numSlams}`);
                  }
                  diffDescription = parts.join(' | ');
                }
              }

              parsed.push({
                userId: matchedUser.id,
                playerName: matchedUser.name || matchedUser.username || 'Player',
                username: matchedUser.username,
                teamName: matchedUser.teamName || userTeamMap.get(matchedUser.id) || rawTeam || '',
                target: matchedUser.target,
                score: numScore,
                boardCount: numBoards,
                slams: numSlams,
                isWalkover: false,
                bonusAchieved,
                isValid: true,
                hasExistingWebScore: hasExisting,
                existingWebScore: webScore,
                existingWebSlams: webSlams,
                existingWebBoards: webBoards,
                existingWebSource: webSource,
                diffType,
                diffDescription,
              });
            }
          }
        }

        setParsedRows(parsed);
        setDiffTabFilter('ALL');
        setUploadModalOpen(true);
      } catch (err: any) {
        setUploadError(err.message || 'Failed to parse Excel file.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // ── Apply Bulk Save ──────────────────────────────────────────────────────
  const handleConfirmBulkUpload = async () => {
    const validRows = parsedRows.filter((r) => r.isValid && r.userId);
    if (!validRows.length) return;

    setUploadBusy(true);
    setUploadError(null);

    const payload = validRows.map((r) => ({
      userId: r.userId,
      score: r.isWalkover ? null : r.score,
      boardCount: r.boardCount,
      slams: r.slams,
      isWalkover: r.isWalkover,
    }));

    const res = await bulkOrganiserUpsertDayScores({
      editionId,
      dayNumber: day,
      rows: payload,
    });

    if (res.success) {
      setUploadModalOpen(false);
      setMsg(`✅ Successfully updated ${res.count} player scores for Day ${day}.`);
      await loadDesk();
    } else {
      setUploadError(res.error || 'Failed to save bulk scores.');
    }
    setUploadBusy(false);
  };

  const validParsedCount = parsedRows.filter((r) => r.isValid && !r.isWalkover).length;
  const walkoverCount = parsedRows.filter((r) => r.isValid && r.isWalkover).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;
  const diffCount = parsedRows.filter((r) => r.isValid && r.diffType === 'DIFF').length;
  const newCount = parsedRows.filter((r) => r.isValid && r.diffType === 'NEW').length;
  const matchCount = parsedRows.filter((r) => r.isValid && r.diffType === 'MATCH').length;

  const filteredPreviewRows = parsedRows.filter((r) => {
    // Diff tab filter
    if (diffTabFilter === 'DIFF' && r.diffType !== 'DIFF') return false;
    if (diffTabFilter === 'NEW' && r.diffType !== 'NEW') return false;
    if (diffTabFilter === 'MATCH' && r.diffType !== 'MATCH') return false;
    if (diffTabFilter === 'WO' && !r.isWalkover) return false;

    // Search query filter
    if (!uploadFilter.trim()) return true;
    const q = uploadFilter.toLowerCase().trim();
    return (
      r.playerName.toLowerCase().includes(q) ||
      (r.username && r.username.toLowerCase().includes(q)) ||
      (r.teamName && r.teamName.toLowerCase().includes(q)) ||
      r.diffDescription.toLowerCase().includes(q)
    );
  });

  return (
    <Card className="border-amber-500/30">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <span>Edit player scores</span>
            </CardTitle>
            <CardDescription>
              {editionTitle ? (
                <>
                  <strong className="text-amber-400">{editionTitle}</strong>
                  {' · '}
                </>
              ) : null}
              Pick a player and day, or use Bulk Upload to import all player scores at once from Excel.
            </CardDescription>
          </div>

          {/* ── Action Buttons: Download Template & Bulk Upload ─────────────── */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadDayTemplate}
              className="text-xs font-bold border-amber-500/30 hover:bg-amber-500/10 text-amber-300 gap-1.5 h-9"
              title={`Download pre-filled Excel template for Day ${day}`}
            >
              <Download className="h-3.5 w-3.5 text-amber-400" />
              <span>Day {day} Template</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 gap-1.5 h-9 shadow-xs"
              title={`Bulk upload scores for Day ${day} from Excel (.xlsx)`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Bulk Upload (.xlsx)</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 max-w-2xl">
        <ScoreEditRules note={SCORE_EDIT_ORGANISER_HELP} />
        {review ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
            {review.finishedStageName} just finished. Review player averages
            {review.nextStageName ? ` for ${review.nextStageName}` : ' for the next stage'}
            {' '}on each player’s edit form. Changes apply from tomorrow IST.
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold block mb-1">Player</label>
            <SearchablePlayerSelect users={users} value={userId} onChange={setUserId} />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">Day</label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm font-semibold"
              value={day}
              onChange={(e) => setDay(parseInt(e.target.value, 10) || 1)}
            >
              {dayOptions.map((d) => {
                const row = scores.find((s) => s.userId === userId && s.dayNumber === d.dayNumber);
                const status = row ? ` · ${row.source}` : ' · empty';
                return (
                  <option key={d.dayNumber} value={d.dayNumber}>
                    Day {d.dayNumber}
                    {d.calendarDate ? ` · ${d.calendarDate}` : ''}
                    {status}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {existing ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
            Day {day} already has scores from the {existing.source.toLowerCase()}
            {existing.enteredByName && existing.source !== 'Player' ? ` (${existing.enteredByName})` : ''}.
            {' '}Edit Total Score, Slams, and Boards below, or switch to Board-by-Board details, then save.
          </div>
        ) : (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs font-semibold text-muted-foreground">
            No score for this player on Day {day} yet. Enter Total Score, Slams, and No. of Boards below and save.
          </div>
        )}

        <BoardScoreEditor boards={boards} onChange={setBoards} target={target} defaultMode="summary" />
        {msg && <p className="text-xs font-semibold">{msg}</p>}
        <Button
          disabled={busy || !userId}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            const payload = draftToPayload(boards);
            const res = await organiserUpsertPlayerDayScore(userId, day, 0, 0, payload, editionId);
            setMsg(res.success ? 'Saved. Standings will use this score.' : res.error || 'Failed');
            if (res.success) await loadDesk();
            setBusy(false);
          }}
        >
          {busy ? 'Saving…' : existing ? `Update Day ${day}` : `Save Day ${day}`}
        </Button>
      </CardContent>

      {/* ── Bulk Upload Preview Modal with Differences Detection ───────────── */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-card border border-amber-500/40 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border/80 flex items-start justify-between gap-3 bg-card/95">
              <div>
                <h3 className="text-lg font-black text-amber-400 flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  <span>Bulk Upload Scores — Day {day} Comparison & Preview</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Compare Excel scores against player/website submissions, verify walkovers, and audit differences before saving.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 rounded-md hover:bg-muted"
              >
                ✕
              </button>
            </div>

            {/* KPI Badges */}
            <div className="p-3 sm:p-4 border-b border-border/40 bg-muted/20 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-background border border-border font-bold text-foreground">
                  Total: <strong>{parsedRows.length}</strong>
                </span>

                {diffCount > 0 ? (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/50 font-black text-amber-300 flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    <span>Differences: <strong>{diffCount}</strong></span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>0 Differences</span>
                  </span>
                )}

                <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 font-bold text-sky-300">
                  ✨ New Entries: <strong>{newCount}</strong>
                </span>

                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 font-bold text-emerald-400">
                  ✓ Matching: <strong>{matchCount}</strong>
                </span>

                <span className="px-2.5 py-1 rounded-lg bg-slate-500/15 border border-slate-500/30 font-bold text-slate-300">
                  ⚡ Walkovers: <strong>{walkoverCount}</strong>
                </span>

                {invalidCount > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 font-bold text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Errors: <strong>{invalidCount}</strong></span>
                  </span>
                )}
              </div>

              {/* Filter Search */}
              <div className="w-full sm:w-60">
                <Input
                  value={uploadFilter}
                  onChange={(e) => setUploadFilter(e.target.value)}
                  placeholder="Search player, team, notes…"
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            {/* Quick Filter Tabs */}
            <div className="px-4 py-2 border-b border-border/30 bg-muted/10 flex items-center gap-1.5 overflow-x-auto text-xs">
              <button
                type="button"
                onClick={() => setDiffTabFilter('ALL')}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  diffTabFilter === 'ALL'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({parsedRows.length})
              </button>

              <button
                type="button"
                onClick={() => setDiffTabFilter('DIFF')}
                className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                  diffTabFilter === 'DIFF'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : diffCount > 0
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>⚠️ Differences ({diffCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setDiffTabFilter('NEW')}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  diffTabFilter === 'NEW'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                ✨ New ({newCount})
              </button>

              <button
                type="button"
                onClick={() => setDiffTabFilter('MATCH')}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  diffTabFilter === 'MATCH'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                ✓ Matching ({matchCount})
              </button>

              <button
                type="button"
                onClick={() => setDiffTabFilter('WO')}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  diffTabFilter === 'WO'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                Walkovers ({walkoverCount})
              </button>
            </div>

            {/* Modal Table Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {diffCount > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                    <span>
                      Found <strong>{diffCount} player score difference(s)</strong> between Excel and website submissions.
                      Confirming will overwrite website scores with the Excel numbers.
                    </span>
                  </div>
                  {diffTabFilter !== 'DIFF' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setDiffTabFilter('DIFF')}
                      className="h-7 text-[11px] font-bold border-amber-500/40 text-amber-300 hover:bg-amber-500/20 shrink-0"
                    >
                      Filter Differences
                    </Button>
                  )}
                </div>
              )}

              {uploadError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="rounded-xl border border-border/80 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-black border-b border-border/80">
                    <tr>
                      <th className="py-2.5 px-3">Team & Player</th>
                      <th className="py-2.5 px-3 text-center">Target</th>
                      <th className="py-2.5 px-3">Website Submission</th>
                      <th className="py-2.5 px-3 text-center">Excel Uploaded</th>
                      <th className="py-2.5 px-3">Comparison / Diff</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredPreviewRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs font-semibold">
                          No players matching this filter.
                        </td>
                      </tr>
                    ) : (
                      filteredPreviewRows.map((row, idx) => {
                        const isDiff = row.diffType === 'DIFF';
                        const isNew = row.diffType === 'NEW';
                        const isMatch = row.diffType === 'MATCH';

                        return (
                          <tr
                            key={idx}
                            className={`transition-colors ${
                              !row.isValid
                                ? 'bg-rose-500/10'
                                : isDiff
                                ? 'bg-amber-500/10 border-l-4 border-l-amber-500 hover:bg-amber-500/15'
                                : row.isWalkover
                                ? 'bg-sky-500/5 hover:bg-accent/40'
                                : 'hover:bg-accent/40'
                            }`}
                          >
                            {/* Team & Player */}
                            <td className="py-2.5 px-3 font-semibold">
                              <div className="font-bold text-foreground flex items-center gap-1.5">
                                <span>{row.playerName}</span>
                                {row.username && (
                                  <span className="text-[10px] text-muted-foreground font-mono font-normal">
                                    @{row.username}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {row.teamName || 'Unassigned'}
                              </div>
                            </td>

                            {/* Target */}
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-muted-foreground">
                              {Number(row.target) > 0 ? row.target : '—'}
                            </td>

                            {/* Website Existing Submission */}
                            <td className="py-2.5 px-3">
                              {row.hasExistingWebScore ? (
                                <div className="space-y-0.5">
                                  <div className="font-mono font-bold text-slate-200 flex items-center gap-1.5">
                                    <span>{row.existingWebScore} pts</span>
                                    {Number(row.existingWebSlams) > 0 && (
                                      <span className="text-orange-400 text-[11px] flex items-center">
                                        ({row.existingWebSlams} <Flame className="h-3 w-3 fill-orange-400 inline" />)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {row.existingWebSource || 'Submitted'}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-[11px] italic">
                                  ⚪ Not submitted in website
                                </span>
                              )}
                            </td>

                            {/* Excel Uploaded Value */}
                            <td className="py-2.5 px-3 text-center">
                              {row.isWalkover ? (
                                <span className="text-sky-300 font-bold text-xs bg-sky-500/10 px-2 py-0.5 rounded">
                                  WO (Blank)
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  <div className="font-mono font-black text-sm text-amber-400">
                                    {row.score} pts
                                  </div>
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    {row.boardCount} {row.boardCount === 1 ? 'board' : 'boards'}
                                    {row.slams > 0 && ` · ${row.slams} slam${row.slams > 1 ? 's' : ''}`}
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Comparison / Diff Column */}
                            <td className="py-2.5 px-3">
                              {isDiff ? (
                                <div className="space-y-0.5">
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black tracking-wide uppercase">
                                    ⚠️ Difference
                                  </span>
                                  <div className="text-[11px] font-bold text-amber-200 mt-1">
                                    {row.diffDescription}
                                  </div>
                                </div>
                              ) : isMatch ? (
                                <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                  <span>Matches Website ({row.score} pts)</span>
                                </div>
                              ) : isNew ? (
                                <div className="text-sky-300 text-[11px] font-bold flex items-center gap-1">
                                  <span>✨ New Submission</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">Walkover</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-3 text-right font-bold text-[11px]">
                              {!row.isValid ? (
                                <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                                  {row.errorReason || 'Error'}
                                </span>
                              ) : row.bonusAchieved === true ? (
                                <span className="text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-md">
                                  🎉 Target Bonus
                                </span>
                              ) : row.isWalkover ? (
                                <span className="text-sky-300">WO</span>
                              ) : (
                                <span className="text-emerald-400">Ready</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border/80 bg-card/95 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUploadModalOpen(false)}
                disabled={uploadBusy}
                className="text-xs font-bold"
              >
                Cancel
              </Button>

              <Button
                type="button"
                disabled={uploadBusy || validParsedCount + walkoverCount === 0}
                onClick={handleConfirmBulkUpload}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs gap-1.5 shadow-md"
              >
                {uploadBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving Day {day} Scores…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>
                      Confirm & Save All Day {day} Scores ({validParsedCount + walkoverCount})
                    </span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

