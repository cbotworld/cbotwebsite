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
  Table as TableIcon,
  LayoutGrid,
  Save,
  RotateCcw,
  Edit3,
  Filter,
  Layers,
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
  dayNumber: number;
  playerName: string;
  username?: string;
  grade?: string;
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

function parseGradeRank(grade?: string | null): number {
  if (!grade) return 999999;
  const match = String(grade).match(/\d+/);
  if (match) return parseInt(match[0], 10);
  return 999999;
}

export default function OrganizerScoresPanel({
  users,
  teams = [],
  editionTitle,
  editionId,
}: {
  users: Array<{ id: string; name?: string; username?: string; target?: number | null; teamName?: string; grade?: string | null; category?: string | null }>;
  teams?: Array<{ id: string; name: string; members?: Array<{ user?: { id?: string; grade?: string | null; category?: string | null } }>; spocMembers?: Array<{ user?: { id?: string; grade?: string | null; category?: string | null } }> }>;
  editionTitle?: string;
  editionId?: string;
}) {
  const [userId, setUserId] = React.useState(users[0]?.id || '');
  const [day, setDay] = React.useState(1);
  const [boards, setBoards] = React.useState([emptyBoardDraft()]);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [days, setDays] = React.useState<DeskDay[]>([]);
  const [scores, setScores] = React.useState<DeskScore[]>([]);
  const [deskUserGradeMap, setDeskUserGradeMap] = React.useState<Record<string, string>>({});
  const [review, setReview] = React.useState<{ finishedStageName: string; nextStageName: string | null } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [scoresViewMode, setScoresViewMode] = React.useState<'matrix' | 'single'>('matrix');

  // Matrix inline editing & filter states
  const [commonBoardCount, setCommonBoardCount] = React.useState<number>(4);
  const [cellDrafts, setCellDrafts] = React.useState<Record<string, string>>({});
  const [slamDrafts, setSlamDrafts] = React.useState<Record<string, string>>({});
  const [gridSearchQuery, setGridSearchQuery] = React.useState('');
  const [gridTeamFilter, setGridTeamFilter] = React.useState('ALL');
  const [gridGradeFilter, setGridGradeFilter] = React.useState('ALL');
  const [gridSaving, setGridSaving] = React.useState(false);

  // Bulk Upload state
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);
  const [parsedRows, setParsedRows] = React.useState<ParsedUploadRow[]>([]);
  const [uploadFilter, setUploadFilter] = React.useState('');
  const [diffTabFilter, setDiffTabFilter] = React.useState<'ALL' | 'DIFF' | 'NEW' | 'MATCH' | 'WO'>('ALL');
  const [modalDayFilter, setModalDayFilter] = React.useState<number | 'ALL'>('ALL');
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

  // Build a map of userId -> Grade from teams prop
  const memberGradeMap = React.useMemo(() => {
    const map = new Map<string, string>();
    if (teams && teams.length > 0) {
      for (const t of teams) {
        if (Array.isArray(t.members)) {
          for (const m of t.members) {
            const uid = m.user?.id || (m as any).userId || (m as any).id;
            const g = (m as any).grade || (m as any).category || (m.user as any)?.grade || (m.user as any)?.category;
            if (uid && g) map.set(uid, String(g));
          }
        }
        if (Array.isArray(t.spocMembers)) {
          for (const m of t.spocMembers) {
            const uid = m.user?.id || (m as any).userId || (m as any).id;
            const g = (m as any).grade || (m as any).category || (m.user as any)?.grade || (m.user as any)?.category;
            if (uid && g) map.set(uid, String(g));
          }
        }
      }
    }
    return map;
  }, [teams]);

  const getGrade = React.useCallback(
    (usr: { id: string; grade?: string | null; category?: string | null }) => {
      return (
        deskUserGradeMap[usr.id] ||
        memberGradeMap.get(usr.id) ||
        (usr as any).grade ||
        (usr as any).category ||
        ''
      );
    },
    [deskUserGradeMap, memberGradeMap]
  );

  const loadDesk = React.useCallback(async () => {
    const desk = await getOrganiserScoreDesk(editionId);
    if (desk.success) {
      setDays(desk.days || []);
      setScores(desk.scores || []);
      if ((desk as any).userGradeMap) {
        setDeskUserGradeMap((desk as any).userGradeMap);
      }
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

  const isUnassigned = React.useCallback((name?: string | null) => {
    if (!name) return true;
    const normalized = name.trim().toLowerCase();
    return (
      !normalized ||
      normalized === 'unassigned' ||
      normalized === 'none' ||
      normalized === 'no team' ||
      normalized === 'free agent' ||
      normalized === '-'
    );
  }, []);

  // Assigned and enrolled players, sorted Team-Wise (teams first, then Not Assigned), then Grade-Wise (G1, G2, G3...)
  const assignedUsers = React.useMemo(() => {
    return users
      .map((u) => {
        const rawTeam = (u.teamName || userTeamMap.get(u.id) || '').trim();
        const teamName = !rawTeam || isUnassigned(rawTeam) ? 'Not Assigned' : rawTeam;
        return { ...u, resolvedTeamName: teamName };
      })
      .sort((a, b) => {
        const teamA = a.resolvedTeamName;
        const teamB = b.resolvedTeamName;
        const unassignedA = teamA === 'Not Assigned';
        const unassignedB = teamB === 'Not Assigned';
        if (unassignedA && !unassignedB) return 1;
        if (!unassignedA && unassignedB) return -1;

        // 1. Primary: Sort by Team Name
        const teamDiff = teamA.localeCompare(teamB, undefined, { sensitivity: 'base', numeric: true });
        if (teamDiff !== 0) return teamDiff;

        // 2. Secondary: Sort by Grade rank (G1, G2, G3...)
        const gradeA = getGrade(a);
        const gradeB = getGrade(b);
        const rankA = parseGradeRank(gradeA);
        const rankB = parseGradeRank(gradeB);
        if (rankA !== rankB) return rankA - rankB;

        // 3. Tertiary: Sort by Player Name within that grade
        const nameA = (a.name || a.username || '').trim();
        const nameB = (b.name || b.username || '').trim();
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
      });
  }, [users, userTeamMap, getGrade, isUnassigned]);

  const uniqueTeams = React.useMemo(() => {
    const set = new Set<string>();
    assignedUsers.forEach((u) => {
      const t = u.resolvedTeamName;
      if (t && t !== 'Not Assigned') set.add(t);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
  }, [assignedUsers]);

  const uniqueGrades = React.useMemo(() => {
    const set = new Set<string>();
    assignedUsers.forEach((u) => {
      const g = getGrade(u);
      if (g) set.add(g);
    });
    return Array.from(set).sort((a, b) => parseGradeRank(a) - parseGradeRank(b));
  }, [assignedUsers, getGrade]);

  const filteredGridUsers = React.useMemo(() => {
    return assignedUsers.filter((u) => {
      const t = u.resolvedTeamName;
      const g = getGrade(u);
      if (gridTeamFilter && gridTeamFilter !== 'ALL' && t !== gridTeamFilter) return false;
      if (gridGradeFilter && gridGradeFilter !== 'ALL' && g !== gridGradeFilter) return false;
      if (!gridSearchQuery.trim()) return true;
      const q = gridSearchQuery.toLowerCase().trim();
      return (
        (u.name || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        t.toLowerCase().includes(q) ||
        g.toLowerCase().includes(q)
      );
    });
  }, [assignedUsers, getGrade, gridTeamFilter, gridGradeFilter, gridSearchQuery]);

  const totalDays = React.useMemo(() => {
    const maxDayNum = days.length > 0 ? Math.max(...days.map((d) => d.dayNumber), 10) : 10;
    return Math.max(10, maxDayNum);
  }, [days]);

  // Track dirty (unsaved) cells (either score or slams changed)
  const dirtyKeys = React.useMemo(() => {
    const allKeys = new Set([...Object.keys(cellDrafts), ...Object.keys(slamDrafts)]);
    return Array.from(allKeys).filter((k) => {
      const [uId, dStr] = k.split('___');
      const dNum = parseInt(dStr, 10);
      const existingScore = scores.find((s) => s.userId === uId && s.dayNumber === dNum);
      const serverScoreStr = existingScore && existingScore.score !== null && existingScore.score !== undefined ? String(existingScore.score) : '';
      const serverSlamStr = existingScore && existingScore.slams !== null && existingScore.slams !== undefined ? String(existingScore.slams) : '0';

      const currentScoreStr = (k in cellDrafts ? cellDrafts[k] : serverScoreStr).trim();
      const currentSlamStr = (k in slamDrafts ? slamDrafts[k] : serverSlamStr).trim();

      const isScoreChanged = currentScoreStr !== serverScoreStr.trim();
      const isSlamChanged = currentSlamStr !== serverSlamStr.trim() && !(currentSlamStr === '0' && serverSlamStr === '');
      return isScoreChanged || isSlamChanged;
    });
  }, [cellDrafts, slamDrafts, scores]);

  const handleSaveGrid = async () => {
    if (dirtyKeys.length === 0) return;
    setGridSaving(true);
    setMsg(null);

    const payload = dirtyKeys.map((k) => {
      const [uId, dStr] = k.split('___');
      const dNum = parseInt(dStr, 10);
      const existingScore = scores.find((s) => s.userId === uId && s.dayNumber === dNum);
      const serverScoreStr = existingScore && existingScore.score !== null && existingScore.score !== undefined ? String(existingScore.score) : '';
      const serverSlamStr = existingScore && existingScore.slams !== null && existingScore.slams !== undefined ? String(existingScore.slams) : '0';

      const rawScoreVal = (k in cellDrafts ? cellDrafts[k] : serverScoreStr).trim();
      const rawSlamVal = (k in slamDrafts ? slamDrafts[k] : serverSlamStr).trim();

      const isWo = /^(wo|walkover|absent|na|none|-)$/i.test(rawScoreVal);
      const isBlank = rawScoreVal === '';
      const numScore = isBlank ? null : parseInt(rawScoreVal, 10);
      const numSlams = Math.max(0, parseInt(rawSlamVal, 10) || 0);

      return {
        userId: uId,
        dayNumber: dNum,
        score: isWo ? null : (isNaN(numScore!) ? null : numScore),
        isWalkover: isWo,
        boardCount: commonBoardCount,
        slams: numSlams,
      };
    });

    const res = await bulkOrganiserUpsertDayScores({
      editionId,
      rows: payload,
    });

    if (res.success) {
      setMsg(`✅ Successfully saved ${dirtyKeys.length} score & slam update(s) directly to website.`);
      setCellDrafts({});
      setSlamDrafts({});
      await loadDesk();
    } else {
      setMsg(`❌ Failed to save scores: ${res.error || 'Unknown error'}`);
    }
    setGridSaving(false);
  };

  const handleDiscardGrid = () => {
    setCellDrafts({});
    setSlamDrafts({});
    setMsg('Unsaved changes discarded.');
  };

  // ── Download Master All Days Excel Template ──────────────────────────────
  const downloadScoresTemplate = () => {

    // Total days in tournament (at least 10 or max day number)
    const maxDayNum = days.length > 0 ? Math.max(...days.map((d) => d.dayNumber), 10) : 10;
    const totalDays = Math.max(10, maxDayNum);

    const aoa: any[][] = [];

    // Row 1: Top merged header with "Daily Scores" spanning across Day columns
    const row1: any[] = ['', '', '', ''];
    row1.push('Daily Scores');
    for (let i = 1; i < totalDays; i++) {
      row1.push('');
    }
    aoa.push(row1);

    // Row 2: Sub-headers matching image: Sl.No | TEAMS | Player | Group | Day1 | Day2 | Day3 ...
    const row2: any[] = ['Sl.No', 'TEAMS', 'Player', 'Group'];
    for (let d = 1; d <= totalDays; d++) {
      row2.push(`Day${d}`);
    }
    aoa.push(row2);

    // Rows: Players sorted Team-wise, then Grade-wise
    let slNo = 1;
    for (const u of assignedUsers) {
      const teamName = u.teamName || userTeamMap.get(u.id) || '';
      const playerName = u.name || u.username || 'Player';
      const playerGrade = getGrade(u);

      const row: any[] = [slNo++, teamName, playerName, playerGrade];

      for (let d = 1; d <= totalDays; d++) {
        const existingScore = scores.find((s) => s.userId === u.id && s.dayNumber === d);
        if (existingScore && existingScore.score !== null && existingScore.score !== undefined) {
          row.push(existingScore.score);
        } else {
          row.push('');
        }
      }

      aoa.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Merge "Daily Scores" across the day columns (from column index 4 to 4 + totalDays - 1)
    ws['!merges'] = [
      { s: { r: 0, c: 4 }, e: { r: 0, c: 4 + totalDays - 1 } },
    ];

    // Column widths
    ws['!cols'] = [
      { wch: 8 },  // Sl.No
      { wch: 22 }, // TEAMS
      { wch: 24 }, // Player
      { wch: 10 }, // Group
      ...Array.from({ length: totalDays }, () => ({ wch: 9 })), // Day1 .. DayN
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Daily Scores`);
    XLSX.writeFile(wb, `CBOT_Scores_Template_All_Days.xlsx`);
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

        // Read as array of arrays (AOA) to handle multi-row headers flexibly
        const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (!aoa || !aoa.length) {
          setUploadError('The uploaded file contains no rows or data.');
          return;
        }

        const userById = new Map(users.map((u) => [u.id.toLowerCase().trim(), u]));
        const userByUsername = new Map(users.filter((u) => u.username).map((u) => [u.username!.toLowerCase().replace('@', '').trim(), u]));
        const userByName = new Map(users.filter((u) => u.name).map((u) => [u.name!.toLowerCase().trim(), u]));
        const userByTeamAndName = new Map(users.map((u) => {
          const tName = (u.teamName || userTeamMap.get(u.id) || '').toLowerCase().trim();
          const pName = (u.name || u.username || '').toLowerCase().trim();
          return [`${tName}___${pName}`, u];
        }));

        // Find the header row (the row that contains "Player", "Teams", or "Day1", etc.)
        let headerRowIdx = -1;
        for (let r = 0; r < Math.min(aoa.length, 10); r++) {
          const row = aoa[r];
          if (!Array.isArray(row)) continue;
          const strRow = row.map((cell) => String(cell || '').trim().toLowerCase());
          const hasPlayer = strRow.some((c) => c.includes('player') || c === 'name');
          const hasTeam = strRow.some((c) => c.includes('team'));
          const hasDayCol = strRow.some((c) => /^(?:day\s*\d+|d\d+|day)$/i.test(c));
          if ((hasPlayer || hasTeam) && (hasDayCol || strRow.some((c) => c.includes('group') || c.includes('grade')))) {
            headerRowIdx = r;
            break;
          }
        }

        // If no explicit header row found, default to row 0 or row 1
        if (headerRowIdx === -1) {
          headerRowIdx = aoa.length > 1 && aoa[1].some((c: any) => String(c).toLowerCase().includes('player')) ? 1 : 0;
        }

        const headerRow = aoa[headerRowIdx] || [];
        const headerStrings = headerRow.map((c: any) => String(c || '').trim());

        // Identify column indexes
        let slNoCol = -1;
        let teamCol = -1;
        let playerCol = -1;
        let groupCol = -1;
        let userIdCol = -1;
        let usernameCol = -1;
        let flatDayCol = -1;
        let flatScoreCol = -1;
        let flatBoardsCol = -1;
        let flatSlamsCol = -1;

        const wideDayCols: Array<{ dayNumber: number; colIdx: number }> = [];

        headerStrings.forEach((hdr, idx) => {
          const lower = hdr.toLowerCase();
          if (/^(?:sl\.?\s*no|s\.?\s*no|serial|#)$/i.test(lower)) {
            slNoCol = idx;
          } else if (/^(?:teams?|team\s*name)$/i.test(lower)) {
            teamCol = idx;
          } else if (/^(?:player|player\s*name|name)$/i.test(lower)) {
            playerCol = idx;
          } else if (/^(?:group|grade|category|tier)$/i.test(lower)) {
            groupCol = idx;
          } else if (/^(?:user\s*id|userid|uid|id)$/i.test(lower)) {
            userIdCol = idx;
          } else if (/^(?:username|handle)$/i.test(lower)) {
            usernameCol = idx;
          } else if (/^(?:day|day\s*number|daynumber)$/i.test(lower)) {
            flatDayCol = idx;
          } else if (/score|total/i.test(lower) && !/^(?:day\s*\d+|d\d+)$/i.test(lower)) {
            flatScoreCol = idx;
          } else if (/board/i.test(lower)) {
            flatBoardsCol = idx;
          } else if (/slam/i.test(lower)) {
            flatSlamsCol = idx;
          }

          // Check if this column is a Day column in Wide Format (e.g. "Day1", "Day 1", "Day2", "D1", etc.)
          const dayMatch = hdr.match(/^(?:day\s*|d)(\d+)$/i);
          if (dayMatch) {
            wideDayCols.push({ dayNumber: parseInt(dayMatch[1], 10), colIdx: idx });
          }
        });

        // Fallback: if player column not found, find first non-team column with strings
        if (playerCol === -1) {
          playerCol = headerStrings.findIndex((h) => h.toLowerCase().includes('player') || h.toLowerCase().includes('name'));
        }

        const isWideFormat = wideDayCols.length > 0;
        wideDayCols.sort((a, b) => a.dayNumber - b.dayNumber);

        const parsed: ParsedUploadRow[] = [];

        for (let r = headerRowIdx + 1; r < aoa.length; r++) {
          const row = aoa[r];
          if (!Array.isArray(row) || !row.length) continue;

          // Check if entire row is empty
          if (row.every((cell) => cell === undefined || String(cell).trim() === '')) {
            continue;
          }

          const rawTeam = teamCol !== -1 ? String(row[teamCol] || '').trim() : '';
          const rawName = playerCol !== -1 ? String(row[playerCol] || '').trim() : '';
          const rawGrade = groupCol !== -1 ? String(row[groupCol] || '').trim() : '';
          const rawId = userIdCol !== -1 ? String(row[userIdCol] || '').trim().toLowerCase() : '';
          const rawUsername = usernameCol !== -1 ? String(row[usernameCol] || '').trim().toLowerCase().replace('@', '') : '';

          if (!rawName && !rawId && !rawUsername && !rawTeam) {
            continue;
          }

          const teamKey = `${rawTeam.toLowerCase().trim()}___${rawName.toLowerCase().trim()}`;
          const matchedUser =
            (rawTeam && rawName && userByTeamAndName.get(teamKey)) ||
            (rawName && userByName.get(rawName.toLowerCase().trim())) ||
            (rawId && userById.get(rawId)) ||
            (rawUsername && userByUsername.get(rawUsername)) ||
            null;

          const playerGrade = rawGrade || (matchedUser ? getGrade(matchedUser) : '');

          if (isWideFormat) {
            // Process each day in wide format
            for (const { dayNumber, colIdx } of wideDayCols) {
              const rawCellVal = row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';

              if (!matchedUser) {
                // If cell is empty, skip unassigned / unknown player
                if (!rawCellVal) continue;
                parsed.push({
                  userId: '',
                  dayNumber,
                  playerName: rawName || 'Unknown Player',
                  username: rawUsername || '',
                  grade: playerGrade,
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

              // Check existing website score
              const existingScore = scores.find((s) => s.userId === matchedUser.id && s.dayNumber === dayNumber);
              const hasExisting = !!existingScore;
              const webScore = existingScore ? existingScore.score : null;
              const webSlams = existingScore ? (existingScore.slams ?? 0) : null;
              const webBoards = existingScore ? (existingScore.boards?.length || 1) : null;
              const webSource = existingScore ? existingScore.source : null;

              const isBlank = rawCellVal === '';
              const isExplicitWo = /^(wo|walkover|absent|na|none|null|-)$/i.test(rawCellVal);

              if (isBlank) {
                // When uploading partial days or leaving future days blank:
                // - If website already has score for this day, preserve it (MATCH / Skipped / Untouched)
                // - If website has NO score, it's an unentered day / empty slot (MATCH / Skipped)
                if (hasExisting && webScore !== null) {
                  parsed.push({
                    userId: matchedUser.id,
                    dayNumber,
                    playerName: matchedUser.name || matchedUser.username || 'Player',
                    username: matchedUser.username,
                    grade: playerGrade,
                    teamName: matchedUser.teamName || userTeamMap.get(matchedUser.id) || rawTeam || '',
                    target: matchedUser.target,
                    score: webScore,
                    boardCount: webBoards || 1,
                    slams: webSlams || 0,
                    isWalkover: false,
                    bonusAchieved: (Number(matchedUser.target) || 0) > 0 ? (webScore < (Number(matchedUser.target) || 0)) : null,
                    isValid: true,
                    hasExistingWebScore: true,
                    existingWebScore: webScore,
                    existingWebSlams: webSlams,
                    existingWebBoards: webBoards,
                    existingWebSource: webSource,
                    diffType: 'MATCH',
                    diffDescription: `Preserved website score (${webScore} pts · ${webSource}) — blank in Excel (Untouched)`,
                  });
                } else {
                  parsed.push({
                    userId: matchedUser.id,
                    dayNumber,
                    playerName: matchedUser.name || matchedUser.username || 'Player',
                    username: matchedUser.username,
                    grade: playerGrade,
                    teamName: matchedUser.teamName || userTeamMap.get(matchedUser.id) || rawTeam || '',
                    target: matchedUser.target,
                    score: null,
                    boardCount: 1,
                    slams: 0,
                    isWalkover: false,
                    bonusAchieved: null,
                    isValid: true,
                    hasExistingWebScore: false,
                    existingWebScore: null,
                    existingWebSlams: null,
                    existingWebBoards: null,
                    existingWebSource: null,
                    diffType: 'MATCH',
                    diffDescription: `Unentered / Blank for Day ${dayNumber} (Skipped)`,
                  });
                }
              } else if (isExplicitWo) {
                let diffType: 'MATCH' | 'DIFF' | 'NEW' | 'WO' = 'WO';
                let diffDescription = `Day ${dayNumber} Explicit Walkover (WO)`;

                if (hasExisting && webScore !== null) {
                  diffType = 'DIFF';
                  diffDescription = `Website has ${webScore} pts (${webSource}) ➔ Explicit Walkover in Excel`;
                } else if (!hasExisting) {
                  diffType = 'WO';
                  diffDescription = `Explicit Walkover (WO) for Day ${dayNumber}`;
                }

                parsed.push({
                  userId: matchedUser.id,
                  dayNumber,
                  playerName: matchedUser.name || matchedUser.username || 'Player',
                  username: matchedUser.username,
                  grade: playerGrade,
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
                const numScore = parseInt(rawCellVal, 10);
                // Extract slams if provided in wide format cell (e.g., "65 (1s)", "65 + 1 slam", "65/1s", "65, 1")
                let numSlams = 0;
                const slamMatch = rawCellVal.match(/(?:[\+,\/\*\(]|\b(?:slam|slams|s)\b)\s*(\d+)/i) || rawCellVal.match(/(\d+)\s*(?:s|slam|slams)/i);
                if (slamMatch) {
                  numSlams = parseInt(slamMatch[1], 10) || 0;
                }

                if (isNaN(numScore) || numScore < 0) {
                  parsed.push({
                    userId: matchedUser.id,
                    dayNumber,
                    playerName: matchedUser.name || matchedUser.username || 'Player',
                    username: matchedUser.username,
                    grade: playerGrade,
                    teamName: matchedUser.teamName || userTeamMap.get(matchedUser.id) || rawTeam || '',
                    target: matchedUser.target,
                    score: null,
                    boardCount: 1,
                    slams: 0,
                    isWalkover: false,
                    bonusAchieved: null,
                    isValid: false,
                    errorReason: `Invalid score "${rawCellVal}"`,
                    hasExistingWebScore: hasExisting,
                    existingWebScore: webScore,
                    existingWebSlams: webSlams,
                    existingWebBoards: webBoards,
                    existingWebSource: webSource,
                    diffType: 'DIFF',
                    diffDescription: `Invalid score format "${rawCellVal}"`,
                  });
                } else {
                  const tgt = Number(matchedUser.target) || 0;
                  const bonusAchieved = tgt > 0 ? numScore < tgt : null;

                  let diffType: 'MATCH' | 'DIFF' | 'NEW' | 'WO' = 'NEW';
                  let diffDescription = 'Not submitted on website yet (New entry)';

                  if (!hasExisting || webScore === null) {
                    diffType = 'NEW';
                    diffDescription = `New Entry for Day ${dayNumber} (Not submitted on website)`;
                  } else {
                    const scoreMatches = numScore === webScore;
                    const slamsMatches = numSlams === (webSlams ?? 0);
                    if (scoreMatches && slamsMatches) {
                      diffType = 'MATCH';
                      diffDescription = `Matches website score (${webScore} pts${(webSlams ?? 0) > 0 ? `, ${webSlams} slams` : ''}) — Skipped (Identical)`;
                    } else {
                      diffType = 'DIFF';
                      const parts: string[] = [];
                      if (!scoreMatches) {
                        const diff = numScore - webScore;
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
                    dayNumber,
                    playerName: matchedUser.name || matchedUser.username || 'Player',
                    username: matchedUser.username,
                    grade: playerGrade,
                    teamName: matchedUser.teamName || userTeamMap.get(matchedUser.id) || rawTeam || '',
                    target: matchedUser.target,
                    score: numScore,
                    boardCount: 1,
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
          } else {
            // Flat Format
            const rawDayStr = flatDayCol !== -1 ? String(row[flatDayCol] || '').trim() : '';
            const rowDay = parseInt(rawDayStr, 10) || day;
            const rawScoreStr = flatScoreCol !== -1 ? String(row[flatScoreCol] || '').trim() : '';
            const rawBoardsStr = flatBoardsCol !== -1 ? String(row[flatBoardsCol] || '1').trim() : '1';
            const rawSlamsStr = flatSlamsCol !== -1 ? String(row[flatSlamsCol] || '0').trim() : '0';

            if (!matchedUser) {
              parsed.push({
                userId: '',
                dayNumber: rowDay,
                playerName: rawName || 'Unknown Player',
                username: rawUsername || '',
                grade: playerGrade,
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

            const existingScore = scores.find((s) => s.userId === matchedUser.id && s.dayNumber === rowDay);
            const hasExisting = !!existingScore;
            const webScore = existingScore ? existingScore.score : null;
            const webSlams = existingScore ? (existingScore.slams ?? 0) : null;
            const webBoards = existingScore ? (existingScore.boards?.length || 1) : null;
            const webSource = existingScore ? existingScore.source : null;

            const isBlank = rawScoreStr === '';
            const isExplicitWo = /^(wo|walkover|absent|na|none|null|-)$/i.test(rawScoreStr);

            if (isBlank) {
              if (hasExisting && webScore !== null) {
                parsed.push({
                  userId: matchedUser.id,
                  dayNumber: rowDay,
                  playerName: matchedUser.name || matchedUser.username || 'Player',
                  username: matchedUser.username,
                  grade: playerGrade,
                  teamName: matchedUser.teamName || userTeamMap.get(matchedUser.id) || rawTeam || '',
                  target: matchedUser.target,
                  score: webScore,
                  boardCount: webBoards || 1,
                  slams: webSlams || 0,
                  isWalkover: false,
                  bonusAchieved: (Number(matchedUser.target) || 0) > 0 ? (webScore < (Number(matchedUser.target) || 0)) : null,
                  isValid: true,
                  hasExistingWebScore: true,
                  existingWebScore: webScore,
                  existingWebSlams: webSlams,
                  existingWebBoards: webBoards,
                  existingWebSource: webSource,
                  diffType: 'MATCH',
                  diffDescription: `Preserved website score (${webScore} pts · ${webSource}) — blank in Excel (Untouched)`,
                });
              } else {
                parsed.push({
                  userId: matchedUser.id,
                  dayNumber: rowDay,
                  playerName: matchedUser.name || matchedUser.username || 'Player',
                  username: matchedUser.username,
                  grade: playerGrade,
                  teamName: matchedUser.teamName || userTeamMap.get(matchedUser.id) || rawTeam || '',
                  target: matchedUser.target,
                  score: null,
                  boardCount: 1,
                  slams: 0,
                  isWalkover: false,
                  bonusAchieved: null,
                  isValid: true,
                  hasExistingWebScore: false,
                  existingWebScore: null,
                  existingWebSlams: null,
                  existingWebBoards: null,
                  existingWebSource: null,
                  diffType: 'MATCH',
                  diffDescription: `Unentered / Blank for Day ${rowDay} (Skipped)`,
                });
              }
            } else if (isExplicitWo) {
              let diffType: 'MATCH' | 'DIFF' | 'NEW' | 'WO' = 'WO';
              let diffDescription = `Day ${rowDay} Explicit Walkover (WO)`;

              if (hasExisting && webScore !== null) {
                diffType = 'DIFF';
                diffDescription = `Website has ${webScore} pts (${webSource}) ➔ Explicit Walkover in Excel`;
              } else if (!hasExisting) {
                diffType = 'WO';
                diffDescription = `Explicit Walkover (WO) for Day ${rowDay}`;
              }

              parsed.push({
                userId: matchedUser.id,
                dayNumber: rowDay,
                playerName: matchedUser.name || matchedUser.username || 'Player',
                username: matchedUser.username,
                grade: playerGrade,
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
                  dayNumber: rowDay,
                  playerName: matchedUser.name || matchedUser.username || 'Player',
                  username: matchedUser.username,
                  grade: playerGrade,
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
                  diffDescription = `New Entry for Day ${rowDay} (Not submitted on website)`;
                } else {
                  const scoreMatches = numScore === webScore;
                  const slamsMatches = numSlams === webSlams;

                  if (scoreMatches && slamsMatches) {
                    diffType = 'MATCH';
                    diffDescription = `Matches website score (${webScore} pts, ${webSlams} slams) — Skipped (Identical)`;
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
                  dayNumber: rowDay,
                  playerName: matchedUser.name || matchedUser.username || 'Player',
                  username: matchedUser.username,
                  grade: playerGrade,
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
        }

        setParsedRows(parsed);
        setDiffTabFilter('ALL');
        setModalDayFilter('ALL');
        setUploadModalOpen(true);
      } catch (err: any) {
        setUploadError(err.message || 'Failed to parse Excel file.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // ── Apply Bulk Save (Only changes and new additions; identical MATCH rows skipped) ──
  const handleConfirmBulkUpload = async () => {
    const rowsToApply = parsedRows.filter(
      (r) => r.isValid && r.userId && (r.diffType === 'DIFF' || r.diffType === 'NEW' || (r.diffType === 'WO' && r.isWalkover))
    );
    if (!rowsToApply.length) {
      alert('All scores in the uploaded file already match the website or are blank/unchanged. No updates needed.');
      setUploadModalOpen(false);
      return;
    }

    setUploadBusy(true);
    setUploadError(null);

    const payload = rowsToApply.map((r) => ({
      userId: r.userId,
      dayNumber: r.dayNumber,
      score: r.isWalkover ? null : r.score,
      boardCount: r.boardCount,
      slams: r.slams,
      isWalkover: r.isWalkover,
    }));

    const res = await bulkOrganiserUpsertDayScores({
      editionId,
      rows: payload,
    });

    if (res.success) {
      setUploadModalOpen(false);
      setMsg(`✅ Successfully updated ${res.count} player scores across edition days (identical/blank scores skipped).`);
      await loadDesk();
    } else {
      setUploadError(res.error || 'Failed to save bulk scores.');
    }
    setUploadBusy(false);
  };

  const uploadedDays = React.useMemo(() => {
    const set = new Set<number>();
    for (const r of parsedRows) {
      if (r.dayNumber) set.add(r.dayNumber);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [parsedRows]);

  const validParsedCount = parsedRows.filter((r) => r.isValid && !r.isWalkover).length;
  const walkoverCount = parsedRows.filter((r) => r.isValid && r.isWalkover).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;
  const diffCount = parsedRows.filter((r) => r.isValid && r.diffType === 'DIFF').length;
  const newCount = parsedRows.filter((r) => r.isValid && r.diffType === 'NEW').length;
  const matchCount = parsedRows.filter((r) => r.isValid && r.diffType === 'MATCH').length;
  const rowsToApplyCount = parsedRows.filter((r) => r.isValid && r.userId && (r.diffType === 'DIFF' || r.diffType === 'NEW' || (r.diffType === 'WO' && r.isWalkover))).length;

  const filteredPreviewRows = parsedRows.filter((r) => {
    // Day filter
    if (modalDayFilter !== 'ALL' && r.dayNumber !== modalDayFilter) return false;

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
      (r.grade && r.grade.toLowerCase().includes(q)) ||
      `day ${r.dayNumber}`.includes(q) ||
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
              Pick a player and day, or use Master Excel to upload and update all days continuously.
            </CardDescription>
          </div>

          {/* ── Action Buttons: Download Template & Bulk Upload ─────────────── */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadScoresTemplate}
              className="text-xs font-bold border-amber-500/30 hover:bg-amber-500/10 text-amber-300 gap-1.5 h-9"
              title="Download master all-days Excel template with pre-filled scores"
            >
              <Download className="h-3.5 w-3.5 text-amber-400" />
              <span>All Days Template (.xlsx)</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 gap-1.5 h-9 shadow-xs"
              title="Bulk upload scores from master Excel (.xlsx)"
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

      <CardContent className="space-y-4">
        {/* View Switcher & Quick Save Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/50">
            <button
              type="button"
              onClick={() => setScoresViewMode('matrix')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                scoresViewMode === 'matrix'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TableIcon className="h-4 w-4" />
              <span>Daily Scores Matrix (All Days)</span>
            </button>
            <button
              type="button"
              onClick={() => setScoresViewMode('single')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                scoresViewMode === 'single'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Edit3 className="h-4 w-4" />
              <span>Single Player / Board Details</span>
            </button>
          </div>

          {/* Save / Discard buttons when in matrix mode */}
          {scoresViewMode === 'matrix' && dirtyKeys.length > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleDiscardGrid}
                disabled={gridSaving}
                className="text-xs font-bold border-rose-500/40 text-rose-300 hover:bg-rose-500/15 h-8 gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Discard</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveGrid}
                disabled={gridSaving}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs h-8 gap-1.5 shadow-md shadow-amber-500/20 animate-pulse"
              >
                {gridSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Save {dirtyKeys.length} Changes</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {msg && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-semibold flex items-center justify-between gap-2">
            <span>{msg}</span>
            <button type="button" onClick={() => setMsg(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
          </div>
        )}

        {/* ── MODE 1: DAILY SCORES MATRIX (SPREADSHEET GRID) ────────────────── */}
        {scoresViewMode === 'matrix' && (
          <div className="space-y-3">
            {/* Filter controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/20 p-2.5 rounded-xl border border-border/40 text-xs">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                {/* Search player / team */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={gridSearchQuery}
                    onChange={(e) => setGridSearchQuery(e.target.value)}
                    placeholder="Search player, team, grade…"
                    className="h-8 pl-8 pr-7 text-xs bg-background"
                  />
                  {gridSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setGridSearchQuery('')}
                      className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Team Filter */}
                {uniqueTeams.length > 1 && (
                  <select
                    value={gridTeamFilter}
                    onChange={(e) => setGridTeamFilter(e.target.value)}
                    className="h-8 text-xs font-semibold rounded-md bg-background border border-border px-2 text-foreground"
                  >
                    <option value="ALL">All Teams ({uniqueTeams.length})</option>
                    {uniqueTeams.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                )}

                {/* Grade Filter */}
                {uniqueGrades.length > 1 && (
                  <select
                    value={gridGradeFilter}
                    onChange={(e) => setGridGradeFilter(e.target.value)}
                    className="h-8 text-xs font-semibold rounded-md bg-background border border-border px-2 text-foreground"
                  >
                    <option value="ALL">All Groups/Grades ({uniqueGrades.length})</option>
                    {uniqueGrades.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                )}

                {/* Common No. of Boards Setting */}
                <div className="flex items-center gap-1.5 bg-background border border-amber-500/40 px-2.5 py-1 rounded-lg shadow-xs shrink-0">
                  <span className="text-[11px] font-black text-amber-300 flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-amber-400" />
                    <span>No. of Boards:</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={commonBoardCount}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setCommonBoardCount(isNaN(v) ? 1 : Math.max(1, Math.min(10, v)));
                    }}
                    className="w-12 h-6 text-center text-xs font-black font-mono bg-muted/60 border border-border rounded text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    title="Common number of boards across all players (e.g. 4 boards -> Player Day Average = Total Score ÷ 4)"
                  />
                  <span className="text-[10px] text-muted-foreground font-mono font-semibold hidden sm:inline">
                    (Avg = Score ÷ {commonBoardCount})
                  </span>
                </div>
              </div>

              {/* Status Counters */}
              <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground shrink-0">
                <span>Showing {filteredGridUsers.length} of {assignedUsers.length} players</span>
                {dirtyKeys.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {dirtyKeys.length} unsaved
                  </span>
                )}
              </div>
            </div>

            {/* Matrix Table */}
            <div className="w-full overflow-x-auto rounded-xl border border-border/80 shadow-md bg-card max-h-[72vh] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-30 bg-muted text-foreground font-black border-b border-border/80 shadow-xs">
                  {/* Row 1: Merged Daily Scores Header */}
                  <tr className="bg-muted/95 border-b border-border/60 text-[11px]">
                    <th className="py-2 px-2 text-center text-muted-foreground sticky left-0 z-40 bg-muted/95 w-11 border-r border-border/40"></th>
                    <th className="py-2 px-3 text-muted-foreground sticky left-[44px] z-40 bg-muted/95 min-w-[130px] border-r border-border/40"></th>
                    <th className="py-2 px-3 text-muted-foreground sticky left-[174px] z-40 bg-muted/95 min-w-[160px] border-r border-border/40"></th>
                    <th className="py-2 px-2 text-center text-muted-foreground sticky left-[334px] z-40 bg-muted/95 w-16 border-r border-border/60"></th>
                    <th
                      colSpan={totalDays}
                      className="py-1.5 px-3 text-center text-amber-400 font-black uppercase tracking-widest text-xs bg-muted/90"
                    >
                      Daily Scores
                    </th>
                  </tr>

                  {/* Row 2: Column Headers */}
                  <tr className="bg-muted text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/80">
                    <th className="py-2.5 px-2 text-center sticky left-0 z-40 bg-muted w-11 border-r border-border/40">
                      Sl.No
                    </th>
                    <th className="py-2.5 px-3 sticky left-[44px] z-40 bg-muted min-w-[130px] border-r border-border/40 text-foreground font-black">
                      TEAMS
                    </th>
                    <th className="py-2.5 px-3 sticky left-[174px] z-40 bg-muted min-w-[160px] border-r border-border/40 text-foreground font-black">
                      Player
                    </th>
                    <th className="py-2.5 px-2 text-center sticky left-[334px] z-40 bg-muted w-16 border-r border-border/60 text-foreground font-black">
                      Group
                    </th>
                    {Array.from({ length: totalDays }, (_, i) => i + 1).map((dNum) => (
                      <th
                        key={dNum}
                        className="py-2 px-1 text-center min-w-[72px] font-mono font-black border-l border-border/40 text-slate-200"
                        title={`Day ${dNum}`}
                      >
                        <div className="flex flex-col items-center">
                          <span>Day{dNum}</span>
                          <span className="text-[9px] font-normal text-muted-foreground font-sans">pts · 🔥slam</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/40 text-xs">
                  {filteredGridUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4 + totalDays} className="py-12 text-center text-muted-foreground font-semibold">
                        No players matching &ldquo;{gridSearchQuery}&rdquo; in the selected team/grade.
                      </td>
                    </tr>
                  ) : (
                    filteredGridUsers.map((u, idx) => {
                      const teamName = u.teamName || userTeamMap.get(u.id) || '—';
                      const playerGrade = getGrade(u);
                      const targetVal = Number(u.target) || 0;

                      return (
                        <tr key={u.id} className="hover:bg-accent/30 transition-colors group">
                          {/* Sl.No */}
                          <td className="py-2 px-2 text-center font-mono font-bold text-muted-foreground sticky left-0 z-20 bg-card group-hover:bg-muted/80 border-r border-border/40">
                            {idx + 1}
                          </td>

                          {/* TEAMS */}
                          <td className="py-2 px-3 font-bold text-amber-300/90 truncate max-w-[130px] sticky left-[44px] z-20 bg-card group-hover:bg-muted/80 border-r border-border/40" title={teamName}>
                            {teamName}
                          </td>

                          {/* Player */}
                          <td className="py-2 px-3 sticky left-[174px] z-20 bg-card group-hover:bg-muted/80 border-r border-border/40 min-w-[160px]">
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <span className="font-bold text-foreground truncate block">{u.name || u.username}</span>
                                {u.username && u.name && (
                                  <span className="text-[10px] text-muted-foreground font-mono truncate block">@{u.username}</span>
                                )}
                              </div>
                              {targetVal > 0 && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-muted/80 text-muted-foreground font-mono font-bold shrink-0" title={`Target: ${targetVal}`}>
                                  tgt {targetVal}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Group / Grade */}
                          <td className="py-2 px-2 text-center sticky left-[334px] z-20 bg-card group-hover:bg-muted/80 border-r border-border/60">
                            {playerGrade ? (
                              <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-black border border-amber-500/30 font-mono">
                                {playerGrade}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[10px]">—</span>
                            )}
                          </td>

                          {/* Day Columns */}
                          {Array.from({ length: totalDays }, (_, i) => i + 1).map((dNum) => {
                            const key = `${u.id}___${dNum}`;
                            const existingScore = scores.find((s) => s.userId === u.id && s.dayNumber === dNum);
                            const serverScoreStr = existingScore && existingScore.score !== null && existingScore.score !== undefined ? String(existingScore.score) : '';
                            const serverSlamStr = existingScore && existingScore.slams !== null && existingScore.slams !== undefined ? String(existingScore.slams) : '0';

                            const currentVal = key in cellDrafts ? cellDrafts[key] : serverScoreStr;
                            const currentSlamVal = key in slamDrafts ? slamDrafts[key] : (serverSlamStr === '0' ? '' : serverSlamStr);
                            const numSlams = parseInt(currentSlamVal, 10) || 0;

                            const isScoreDirty = (key in cellDrafts) && (cellDrafts[key].trim() !== serverScoreStr.trim());
                            const isSlamDirty = (key in slamDrafts) && (slamDrafts[key].trim() !== serverSlamStr.trim()) && !(slamDrafts[key].trim() === '0' && serverSlamStr === '0');
                            const isDirty = isScoreDirty || isSlamDirty;

                            const trimmed = currentVal.trim();
                            const isWo = /^(wo|walkover|absent|-)$/i.test(trimmed);
                            const numScore = parseInt(trimmed, 10);
                            const isBonus = targetVal > 0 && !isNaN(numScore) && numScore < targetVal;

                            return (
                              <td
                                key={dNum}
                                className={`p-1 text-center border-l border-border/30 transition-colors ${
                                  isDirty ? 'bg-amber-500/15' : ''
                                }`}
                              >
                                <div className="relative flex flex-col items-center justify-center gap-0.5">
                                  {/* Score Input */}
                                  <input
                                    type="text"
                                    value={currentVal}
                                    placeholder="—"
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setCellDrafts((prev) => ({ ...prev, [key]: val }));
                                    }}
                                    className={`w-13 h-7 text-center text-xs font-mono font-bold rounded border transition-all focus:outline-none focus:ring-2 ${
                                      isDirty
                                        ? 'border-amber-400 bg-amber-500/25 text-amber-200 focus:ring-amber-500 shadow-xs'
                                        : isBonus
                                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 focus:ring-emerald-500'
                                        : isWo
                                        ? 'border-sky-500/40 bg-sky-500/10 text-sky-300 font-bold'
                                        : trimmed !== ''
                                        ? 'border-border/80 bg-background/80 text-foreground focus:ring-amber-500/50'
                                        : 'border-border/30 bg-muted/10 text-muted-foreground hover:border-border focus:ring-amber-500/40'
                                    }`}
                                    title={`Day ${dNum} score for ${u.name || u.username}${existingScore?.source ? ` · Source: ${existingScore.source}` : ''}`}
                                  />

                                  {/* Slams Counter & Input */}
                                  <div className="flex items-center justify-center gap-0.5 w-full" title={`Day ${dNum} slams for ${u.name || u.username}`}>
                                    <button
                                      type="button"
                                      tabIndex={-1}
                                      onClick={() => {
                                        const next = (parseInt(currentSlamVal, 10) || 0) + 1;
                                        setSlamDrafts((prev) => ({ ...prev, [key]: String(next > 10 ? 0 : next) }));
                                      }}
                                      className="text-[11px] leading-none hover:scale-125 transition-transform select-none cursor-pointer"
                                      title="Click to add/increment slam"
                                    >
                                      🔥
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      max={20}
                                      value={currentSlamVal}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setSlamDrafts((prev) => ({ ...prev, [key]: val }));
                                      }}
                                      placeholder="0"
                                      className={`w-7 h-4 text-center text-[10px] font-mono font-bold rounded border transition-colors focus:outline-none ${
                                        numSlams > 0
                                          ? 'bg-amber-500/25 text-amber-300 border-amber-500/60 font-black'
                                          : 'bg-muted/20 text-muted-foreground/60 border-border/30 hover:border-border/60 focus:border-amber-500 focus:text-foreground'
                                      }`}
                                      title={`Slams: ${numSlams}`}
                                    />
                                  </div>

                                  {/* Quick Switch to Board Editor Button on Hover */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setUserId(u.id);
                                      setDay(dNum);
                                      setScoresViewMode('single');
                                    }}
                                    className="opacity-0 group-hover:opacity-100 hover:!opacity-100 text-[9px] text-muted-foreground hover:text-amber-300 absolute -top-1 -right-1 p-0.5 bg-popover rounded border border-border/60 shadow-xs z-10"
                                    title="Edit board-by-board detail"
                                  >
                                    ✏️
                                  </button>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Helper Tips & Floating Save Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
              <div className="text-muted-foreground text-[11px] space-y-0.5">
                <p>💡 <strong>Tip:</strong> Type total score directly into any cell. Click 🔥 or type in mini box to add <strong>Slams</strong>. Type <code className="text-sky-300">WO</code> for walkover, or leave blank for unentered.</p>
                <p>✨ Green score denotes <strong className="text-emerald-400">Target Bonus</strong> (&lt; target). Click ✏️ icon on any cell for detailed board-by-board breakdown.</p>
              </div>

              {dirtyKeys.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDiscardGrid}
                    disabled={gridSaving}
                    className="text-xs font-bold border-rose-500/40 text-rose-300 hover:bg-rose-500/15 h-8 gap-1"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Discard</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveGrid}
                    disabled={gridSaving}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs h-8 gap-1.5 shadow-md shadow-amber-500/20 animate-pulse"
                  >
                    {gridSaving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Save {dirtyKeys.length} Changes</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MODE 2: SINGLE PLAYER DETAILED EDITOR ────────────────────────── */}
        {scoresViewMode === 'single' && (
          <div className="space-y-4 max-w-2xl">
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
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
            >
              {busy ? 'Saving…' : existing ? `Update Day ${day}` : `Save Day ${day}`}
            </Button>
          </div>
        )}
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
                  <span>
                    Bulk Upload Scores — {uploadedDays.length > 1 ? `Master All Days (${uploadedDays.length} Days)` : `Day ${uploadedDays[0] || day}`} Comparison & Preview
                  </span>
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
                  Total Rows: <strong>{parsedRows.length}</strong>
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
                  placeholder="Search player, team, day…"
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            {/* Quick Filter Tabs (Diffs + Days) */}
            <div className="px-4 py-2 border-b border-border/30 bg-muted/10 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto">
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

              {/* Day filter selector if multiple days present */}
              {uploadedDays.length > 1 && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-bold text-muted-foreground">Filter Day:</span>
                  <select
                    className="h-7 text-xs font-bold rounded-md bg-background border border-border px-2 text-foreground"
                    value={modalDayFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setModalDayFilter(val === 'ALL' ? 'ALL' : parseInt(val, 10));
                    }}
                  >
                    <option value="ALL">All Days ({uploadedDays.length})</option>
                    {uploadedDays.map((dNum) => (
                      <option key={dNum} value={dNum}>
                        Day {dNum} ({parsedRows.filter((r) => r.dayNumber === dNum).length} rows)
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                      <th className="py-2.5 px-3 text-center">Day</th>
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
                        <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs font-semibold">
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
                            {/* Day Column */}
                            <td className="py-2.5 px-3 text-center font-black text-amber-400 font-mono text-xs">
                              Day {row.dayNumber}
                            </td>

                            {/* Team & Player */}
                            <td className="py-2.5 px-3 font-semibold">
                              <div className="font-bold text-foreground flex items-center gap-1.5">
                                <span>{row.playerName}</span>
                                {row.grade && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30">
                                    {row.grade}
                                  </span>
                                )}
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
                                  WO (Walkover)
                                </span>
                              ) : row.score === null || row.score === undefined ? (
                                <span className="text-muted-foreground text-xs italic">
                                  — (Unentered)
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
                                row.score !== null ? (
                                  <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                    <span>Matches Website ({row.score} pts)</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-[11px] italic">
                                    ⚪ Unentered in Excel &amp; Website (Skipped)
                                  </span>
                                )
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
                                <span className="text-sky-300 font-bold">WO</span>
                              ) : row.score === null ? (
                                <span className="text-muted-foreground font-normal">Unentered</span>
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
                disabled={uploadBusy || rowsToApplyCount === 0}
                onClick={handleConfirmBulkUpload}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs gap-1.5 shadow-md disabled:opacity-50"
              >
                {uploadBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving Updates…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>
                      {rowsToApplyCount > 0
                        ? `Confirm & Save ${rowsToApplyCount} Updates (${matchCount} identical skipped)`
                        : 'All Scores Match Website (0 Updates Needed)'}
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

