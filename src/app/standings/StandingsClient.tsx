'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldAlert, Info, Flame, Trophy, Activity, Users, Calculator, Search, X, Award, Download, Medal, ChevronRight, CheckCircle2, Crown, Sparkles, FileSpreadsheet, ImageIcon } from 'lucide-react';
import { resolveTop4Podium } from '@/lib/tournament-podium';
import { exportFinalStandingsWorkbook } from '@/lib/export-final-standings';

type FocusCol = 'event' | 'slams' | 'avg' | 'total';

function playerBonusCards(days: any[], kind: 'target' | 'slams') {
  return days
    .map((d: any) => {
      const players = kind === 'target' ? d.targetBonusPlayers || [] : d.slamPlayers || [];
      return { day: d, players };
    })
    .filter((x: { players: any[] }) => x.players.length > 0);
}

function StatButton({
  value,
  onClick,
  className,
}: {
  value: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`underline decoration-dotted decoration-amber-500/70 underline-offset-4 hover:text-amber-400 cursor-pointer ${className || ''}`}
    >
      {value}
    </button>
  );
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

export default function StandingsClient({ payload }: { payload: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab');
  const data = payload || {};
  const allEditions = Array.isArray(data.allEditions) ? data.allEditions : [];
  const blocks = Array.isArray(data.blocks) ? data.blocks : [];
  const [tab, setTab] = React.useState<'teams' | 'players' | 'final'>(
    urlTab === 'final' ? 'final' : urlTab === 'players' ? 'players' : 'teams'
  );

  React.useEffect(() => {
    if (urlTab === 'final' || urlTab === 'players' || urlTab === 'teams') {
      setTab(urlTab);
    }
  }, [urlTab]);

  const [stageId, setStageId] = React.useState(blocks.find((b: any) => b.current)?.stageId || blocks[0]?.stageId || '');
  const stage = blocks.find((b: any) => b.stageId === stageId) || blocks[0];
  const players = Array.isArray(data.players) ? data.players : [];
  const placement = Array.isArray(data.placement) ? data.placement : [];
  const [open, setOpen] = React.useState<{ row: any; focus: FocusCol } | null>(null);
  const [selectedDayNumber, setSelectedDayNumber] = React.useState<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = React.useState<any | null>(null);

  const [playerSearch, setPlayerSearch] = React.useState('');

  const standingTeamsMap = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; logo?: string | null; tag?: string | null }>();
    blocks.forEach((b: any) => {
      (b.groups || []).forEach((g: any) => {
        (g.rows || []).forEach((r: any) => {
          if (r.teamId) {
            map.set(r.teamId, { id: r.teamId, name: r.teamName, logo: r.teamLogo, tag: r.teamTag });
          }
        });
      });
      (b.knockout || []).forEach((k: any) => {
        if (k.team1Id && !map.has(k.team1Id)) {
          map.set(k.team1Id, { id: k.team1Id, name: k.team1Name });
        }
        if (k.team2Id && !map.has(k.team2Id)) {
          map.set(k.team2Id, { id: k.team2Id, name: k.team2Name });
        }
      });
    });
    return map;
  }, [blocks]);

  const podium = React.useMemo(() => {
    return resolveTop4Podium(blocks, standingTeamsMap);
  }, [blocks, standingTeamsMap]);

  const rrBlock = React.useMemo(() => {
    return blocks.find((b: any) => b.kind === 'LEAGUE' || b.kind === 'ROUND_ROBIN') || blocks[0];
  }, [blocks]);

  const [isExporting, setIsExporting] = React.useState(false);
  const [isCapturing, setIsCapturing] = React.useState(false);
  const captureRef = React.useRef<HTMLDivElement>(null);

  const handleDownloadExcel = () => {
    try {
      setIsExporting(true);
      exportFinalStandingsWorkbook({
        edition: data.edition,
        blocks,
        players,
        standingTeamsMap,
      });
    } catch (err) {
      console.error('Error exporting final standings excel:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadJpeg = async () => {
    if (!captureRef.current) return;
    setIsCapturing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;

      const CANVAS_WIDTH = 1200;

      // ── Outer wrapper ──────────────────────────────────────────────
      const wrapper = document.createElement('div');
      wrapper.style.cssText = [
        'position:fixed',
        'left:-99999px',
        'top:0',
        `width:${CANVAS_WIDTH}px`,
        'background:#0d0d0d',
        'font-family:ui-sans-serif,system-ui,-apple-system,sans-serif',
        'color:#f9fafb',
        'box-sizing:border-box',
      ].join(';');

      // ── Header ─────────────────────────────────────────────────────
      const header = document.createElement('div');
      header.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'padding:18px 28px',
        'background:linear-gradient(135deg,rgba(251,191,36,0.18) 0%,rgba(13,13,13,0) 55%)',
        'border-bottom:2px solid rgba(251,191,36,0.35)',
      ].join(';');

      // Logo + text group (left)
      const leftGroup = document.createElement('div');
      leftGroup.style.cssText = 'display:flex;align-items:center;gap:14px;';

      const logoImg = document.createElement('img');
      logoImg.src = '/logo.png';
      logoImg.style.cssText = 'height:56px;width:auto;object-fit:contain;flex-shrink:0;';
      logoImg.crossOrigin = 'anonymous';

      const textBlock = document.createElement('div');
      textBlock.style.cssText = 'display:flex;flex-direction:column;gap:3px;';

      const titleEl = document.createElement('div');
      titleEl.textContent = data.edition?.title || 'Final Standings';
      titleEl.style.cssText = [
        'font-size:20px',
        'font-weight:900',
        'color:#f9fafb',
        'letter-spacing:-0.4px',
        'line-height:1.2',
      ].join(';');

      const subtitleEl = document.createElement('div');
      subtitleEl.textContent = 'CBOT · Carrom Board of Tamil Nadu';
      subtitleEl.style.cssText = [
        'font-size:11px',
        'font-weight:700',
        'color:rgba(251,191,36,0.85)',
        'letter-spacing:0.5px',
        'text-transform:uppercase',
      ].join(';');

      textBlock.appendChild(titleEl);
      textBlock.appendChild(subtitleEl);
      leftGroup.appendChild(logoImg);
      leftGroup.appendChild(textBlock);

      // Date badge (right)
      const dateBadge = document.createElement('div');
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      dateBadge.textContent = `Final Standings · ${dateStr}`;
      dateBadge.style.cssText = [
        'font-size:10px',
        'font-weight:700',
        'color:rgba(251,191,36,0.6)',
        'background:rgba(251,191,36,0.08)',
        'border:1px solid rgba(251,191,36,0.25)',
        'padding:5px 12px',
        'border-radius:20px',
        'letter-spacing:0.3px',
        'white-space:nowrap',
      ].join(';');

      header.appendChild(leftGroup);
      header.appendChild(dateBadge);

      // ── Content clone ──────────────────────────────────────────────
      const clone = captureRef.current.cloneNode(true) as HTMLElement;
      // Remove Tailwind animation classes that delay rendering
      clone.classList.remove('animate-in', 'fade-in');
      clone.style.cssText = [
        'padding:20px 28px 28px',
        'background:#0d0d0d',
        'color:#f9fafb',
        'display:block',
        'width:100%',
        'box-sizing:border-box',
      ].join(';');

      // ── Footer watermark ───────────────────────────────────────────
      const footer = document.createElement('div');
      footer.textContent = 'cbotworld.com  ·  Generated by CBOT Tournament System';
      footer.style.cssText = [
        'text-align:center',
        'padding:12px 28px',
        'font-size:9px',
        'font-weight:600',
        'color:rgba(255,255,255,0.2)',
        'letter-spacing:0.8px',
        'text-transform:uppercase',
        'border-top:1px solid rgba(255,255,255,0.06)',
      ].join(';');

      wrapper.appendChild(header);
      wrapper.appendChild(clone);
      wrapper.appendChild(footer);
      document.body.appendChild(wrapper);

      // Wait for logo to load
      await new Promise<void>((resolve) => {
        if (logoImg.complete && logoImg.naturalWidth > 0) { resolve(); return; }
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
        setTimeout(resolve, 2500);
      });

      // Small settle delay so the DOM is fully painted
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(wrapper, {
        scale: 2,
        backgroundColor: '#0d0d0d',
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: CANVAS_WIDTH,
        height: wrapper.scrollHeight,
        windowWidth: CANVAS_WIDTH,
      });

      document.body.removeChild(wrapper);

      const link = document.createElement('a');
      const editionTitle = (data.edition?.title || 'final-standings')
        .replace(/\s+/g, '-')
        .toLowerCase();
      link.download = `${editionTitle}-standings.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.93);
      link.click();
    } catch (err) {
      console.error('Error capturing standings image:', err);
    } finally {
      setIsCapturing(false);
    }
  };


  const filteredPlayers = React.useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p: any) => {
      const name = (p.name || '').toLowerCase();
      const team = (p.teamName || '').toLowerCase();
      const grade = (p.grade || '').toLowerCase();
      return name.includes(q) || team.includes(q) || grade.includes(q);
    });
  }, [players, playerSearch]);

  const days = open?.row?.days || [];

  // Default to selecting the most recent day (highest dayNumber)
  React.useEffect(() => {
    if (open?.row?.days && open.row.days.length > 0) {
      const dayNums = open.row.days.map((d: any) => d.dayNumber).filter((n: any) => typeof n === 'number');
      if (dayNums.length > 0) {
        setSelectedDayNumber(Math.max(...dayNums));
      } else {
        setSelectedDayNumber(open.row.days[open.row.days.length - 1]?.dayNumber ?? null);
      }
    } else {
      setSelectedDayNumber(null);
    }
  }, [open]);

  const activeDay = days.find((d: any) => d.dayNumber === selectedDayNumber) || (days.length > 0 ? days[days.length - 1] : null);
  const targetBonusDays = open && (open.focus === 'avg' || open.focus === 'total') ? playerBonusCards(days, 'target') : [];
  const slamBonusDays = open && (open.focus === 'slams' || open.focus === 'total') ? playerBonusCards(days, 'slams') : [];

  const activeTargetBonusDay = activeDay ? targetBonusDays.find((t) => t.day.dayNumber === activeDay.dayNumber) : null;
  const activeSlamBonusDay = activeDay ? slamBonusDays.find((s) => s.day.dayNumber === activeDay.dayNumber) : null;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="carrom">Standings</Badge>
            {data.edition?.status === 'COMPLETED' && (
              <Badge variant="outline" className="text-[10px] font-black border-amber-500/40 text-amber-300 bg-amber-500/10">
                Completed Tournament
              </Badge>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{data.edition?.title || 'Team Standings'}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-3xl">
            One table per organiser stage. Position is determined by <strong>Total Points</strong>. If points are tied between teams, <strong>Number of Match Wins</strong> is considered. If wins are also tied, <strong>Team Total Score</strong> (including walkover scores) determines the rank. Tap Event, Slams, Target+ or Total for the day-wise breakdown.
          </p>
        </div>

        <div className="shrink-0 flex flex-wrap items-center gap-2.5">
          {allEditions.length > 1 && (
            <div className="flex items-center gap-2 bg-card/80 p-2.5 rounded-2xl border border-border">
              <label className="text-xs font-bold text-muted-foreground">Edition:</label>
              <select
                value={data.edition?.id || ''}
                onChange={(e) => router.push(`/standings?editionId=${e.target.value}`)}
                className="h-8 px-3 text-xs font-bold rounded-lg border border-amber-500/40 bg-background text-foreground shadow-xs focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                {allEditions.map((ed: any) => (
                  <option key={ed.id} value={ed.id}>
                    {ed.title} {ed.isCurrent ? '(Live)' : '(Completed)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={isExporting}
            className="h-10 px-3.5 py-1.5 rounded-2xl text-xs font-black border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 shadow-sm"
            title="Download complete 5-sheet tournament excel with all match combis"
          >
            <Download className="h-4 w-4 text-emerald-400" />
            <span>{isExporting ? 'Generating...' : 'Download Excel (.xlsx)'}</span>
          </button>

          {tab === 'final' && (
            <button
              type="button"
              onClick={handleDownloadJpeg}
              disabled={isCapturing}
              className="h-10 px-3.5 py-1.5 rounded-2xl text-xs font-black border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition-all flex items-center gap-1.5 shadow-sm"
              title="Download Final Standings as JPEG image with CBOT logo"
            >
              <ImageIcon className="h-4 w-4 text-sky-400" />
              <span>{isCapturing ? 'Capturing...' : 'Download Image (.jpg)'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('teams')}
            className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${
              tab === 'teams' ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' : 'border-border bg-card/60 text-muted-foreground'
            }`}
          >
            Teams
          </button>
          <button
            type="button"
            onClick={() => setTab('players')}
            className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${
              tab === 'players' ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' : 'border-border bg-card/60 text-muted-foreground'
            }`}
          >
            Players
          </button>
          <button
            type="button"
            onClick={() => setTab('final')}
            className={`px-4 py-2 rounded-xl text-xs font-black border transition-all flex items-center gap-1.5 ${
              tab === 'final' ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            <span>Final Standings (Top 4)</span>
          </button>
        </div>
      </div>

      {tab === 'final' ? (
        <div ref={captureRef} className="space-y-6 animate-in fade-in duration-200">
          {/* Top 4 Tournament Podium Card */}
          <Card className="border-amber-500/40 bg-gradient-to-b from-amber-500/10 via-card/90 to-card shadow-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-6 border-b border-border/60 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-400" />
                    <CardTitle className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                      Top 4 Tournament Standings
                    </CardTitle>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {podium.stageStatusDescription} · Grand Final Winner (1st), Grand Finalist (2nd), Qualifier 2 Loser (3rd), Eliminator Loser (4th)
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* Podium Grid for Top 4 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1st Place */}
                <div className="p-4 rounded-2xl border-2 border-amber-400/80 bg-gradient-to-b from-amber-500/25 via-amber-500/10 to-card shadow-lg flex flex-col justify-between space-y-3 relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-15">
                    <Trophy className="h-24 w-24 text-amber-400" />
                  </div>
                  <div className="space-y-2 relative z-10">
                    <div className="flex items-center">
                      <span className="text-[11px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-sm">
                        🥇 1st Place
                      </span>
                    </div>
                    <div className="pt-2 flex items-center gap-3">
                      {podium.champion?.teamLogo ? (
                        <img src={podium.champion.teamLogo} alt={podium.champion.teamName} className="w-12 h-12 rounded-2xl object-cover bg-slate-900 border-2 border-amber-400/60 shadow-md shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border-2 border-amber-400/60 flex items-center justify-center text-lg font-black text-amber-300 shrink-0">
                          {podium.champion?.teamName?.[0] || '1'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-base sm:text-lg font-black text-foreground truncate">{podium.champion?.teamName || 'TBD'}</div>
                        {podium.champion?.tag && <div className="text-[11px] font-bold text-amber-400 font-mono">[{podium.champion.tag}]</div>}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-amber-300/90 pt-2 border-t border-amber-400/20 relative z-10">
                    {podium.champion?.matchDetail || 'Grand Final Winner'}
                  </div>
                </div>

                {/* 2nd Place */}
                <div className="p-4 rounded-2xl border-2 border-slate-400/60 bg-gradient-to-b from-slate-400/20 via-slate-400/10 to-card shadow-md flex flex-col justify-between space-y-3 relative overflow-hidden">
                  <div className="space-y-2 relative z-10">
                    <div className="flex items-center">
                      <span className="text-[11px] font-black uppercase tracking-wider bg-slate-300 text-slate-950 px-2.5 py-0.5 rounded-full shadow-sm">
                        🥈 2nd Place
                      </span>
                    </div>
                    <div className="pt-2 flex items-center gap-3">
                      {podium.runnerUp?.teamLogo ? (
                        <img src={podium.runnerUp.teamLogo} alt={podium.runnerUp.teamName} className="w-12 h-12 rounded-2xl object-cover bg-slate-900 border-2 border-slate-400/60 shadow-md shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-slate-400/20 border-2 border-slate-400/60 flex items-center justify-center text-lg font-black text-slate-300 shrink-0">
                          {podium.runnerUp?.teamName?.[0] || '2'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-base sm:text-lg font-black text-foreground truncate">{podium.runnerUp?.teamName || 'TBD'}</div>
                        {podium.runnerUp?.tag && <div className="text-[11px] font-bold text-slate-400 font-mono">[{podium.runnerUp.tag}]</div>}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-slate-300/90 pt-2 border-t border-slate-400/20 relative z-10">
                    {podium.runnerUp?.matchDetail || 'Grand Final Finalist'}
                  </div>
                </div>

                {/* 3rd Place */}
                <div className="p-4 rounded-2xl border-2 border-amber-700/60 bg-gradient-to-b from-amber-700/20 via-amber-700/10 to-card shadow-md flex flex-col justify-between space-y-3 relative overflow-hidden">
                  <div className="space-y-2 relative z-10">
                    <div className="flex items-center">
                      <span className="text-[11px] font-black uppercase tracking-wider bg-amber-700 text-amber-100 px-2.5 py-0.5 rounded-full shadow-sm">
                        🥉 3rd Place
                      </span>
                    </div>
                    <div className="pt-2 flex items-center gap-3">
                      {podium.thirdPlace?.teamLogo ? (
                        <img src={podium.thirdPlace.teamLogo} alt={podium.thirdPlace.teamName} className="w-12 h-12 rounded-2xl object-cover bg-slate-900 border-2 border-amber-700/60 shadow-md shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-amber-700/20 border-2 border-amber-700/60 flex items-center justify-center text-lg font-black text-amber-400 shrink-0">
                          {podium.thirdPlace?.teamName?.[0] || '3'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-base sm:text-lg font-black text-foreground truncate">{podium.thirdPlace?.teamName || 'TBD'}</div>
                        {podium.thirdPlace?.tag && <div className="text-[11px] font-bold text-amber-600 font-mono">[{podium.thirdPlace.tag}]</div>}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-amber-500/90 pt-2 border-t border-amber-700/20 relative z-10">
                    {podium.thirdPlace?.matchDetail || 'Qualifier 2 Loser'}
                  </div>
                </div>

                {/* 4th Place */}
                <div className="p-4 rounded-2xl border-2 border-zinc-600/50 bg-gradient-to-b from-zinc-600/20 via-zinc-600/10 to-card shadow-md flex flex-col justify-between space-y-3 relative overflow-hidden">
                  <div className="space-y-2 relative z-10">
                    <div className="flex items-center">
                      <span className="text-[11px] font-black uppercase tracking-wider bg-zinc-700 text-zinc-100 px-2.5 py-0.5 rounded-full shadow-sm">
                        4️⃣ 4th Place
                      </span>
                    </div>
                    <div className="pt-2 flex items-center gap-3">
                      {podium.fourthPlace?.teamLogo ? (
                        <img src={podium.fourthPlace.teamLogo} alt={podium.fourthPlace.teamName} className="w-12 h-12 rounded-2xl object-cover bg-slate-900 border-2 border-zinc-600/60 shadow-md shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-zinc-600/20 border-2 border-zinc-600/60 flex items-center justify-center text-lg font-black text-zinc-300 shrink-0">
                          {podium.fourthPlace?.teamName?.[0] || '4'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-base sm:text-lg font-black text-foreground truncate">{podium.fourthPlace?.teamName || 'TBD'}</div>
                        {podium.fourthPlace?.tag && <div className="text-[11px] font-bold text-zinc-400 font-mono">[{podium.fourthPlace.tag}]</div>}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-zinc-400/90 pt-2 border-t border-zinc-600/20 relative z-10">
                    {podium.fourthPlace?.matchDetail || 'Eliminator Loser'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Complete Tournament Multi-Stage Journey */}
          <div className="space-y-6 pt-2">
            <h2 className="text-lg font-black text-foreground flex items-center gap-2">
              <span>Tournament Journey Across All Stages</span>
            </h2>

            {/* Stage 1: Round Robin Standings */}
            {rrBlock && (
              <Card className="border-border bg-card/80 backdrop-blur-sm">
                <CardHeader className="p-4 bg-muted/20 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-black flex items-center gap-2">
                      <span>Stage 1: {rrBlock.name || 'Round Robin'}</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-bold">Full Stage Table</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {(rrBlock.groups || []).map((g: any) => (
                    <Table key={g.key}>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead className="text-center">Total</TableHead>
                          <TableHead className="text-center">Played</TableHead>
                          <TableHead className="text-center">Won</TableHead>
                          <TableHead className="text-center">Lost</TableHead>
                          <TableHead className="text-center">Tied</TableHead>
                          <TableHead className="text-center font-bold text-foreground">Team Score</TableHead>
                          <TableHead className="text-center">Event</TableHead>
                          <TableHead className="text-center">Slams</TableHead>
                          <TableHead className="text-center">Target+</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(g.rows || []).map((row: any) => (
                          <TableRow key={row.teamId} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-black text-amber-500">{row.rank}</TableCell>
                            <TableCell className="font-semibold">
                              <div className="flex items-center gap-2">
                                {row.teamLogo ? (
                                  <img src={row.teamLogo} alt={row.teamName} className="w-6 h-6 rounded-full object-cover bg-slate-900 border border-border" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-slate-800 border border-border flex items-center justify-center text-[10px] text-slate-400 font-bold">
                                    {row.teamName?.[0]}
                                  </div>
                                )}
                                <span className="truncate">{row.teamName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-black">
                              <StatButton value={row.total} onClick={() => setOpen({ row, focus: 'total' })} className="font-black text-amber-400" />
                            </TableCell>
                            <TableCell className="text-center font-bold text-muted-foreground">{row.matchesPlayed ?? 0}</TableCell>
                            <TableCell className="text-center font-bold text-emerald-400">{row.matchesWon ?? 0}</TableCell>
                            <TableCell className="text-center font-bold text-rose-400">{row.matchesLost ?? 0}</TableCell>
                            <TableCell className="text-center font-bold text-amber-300">{row.matchesTied ?? 0}</TableCell>
                            <TableCell className="text-center font-mono font-bold text-foreground">{row.teamScore ?? 0}</TableCell>
                            <TableCell className="text-center">
                              <StatButton value={row.eventPts} onClick={() => setOpen({ row, focus: 'event' })} />
                            </TableCell>
                            <TableCell className="text-center">
                              <StatButton value={row.slamBonus} onClick={() => setOpen({ row, focus: 'slams' })} />
                            </TableCell>
                            <TableCell className="text-center">
                              <StatButton value={row.avgBonus} onClick={() => setOpen({ row, focus: 'avg' })} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Stage 2 & 3: Playoff Knockout Stages */}
            {blocks.filter((b: any) => b.knockout && b.knockout.length > 0).map((b: any) => (
              <Card key={b.stageId} className="border-border bg-card/80 backdrop-blur-sm">
                <CardHeader className="p-4 bg-muted/20 border-b border-border/50">
                  <CardTitle className="text-base font-black flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-400" />
                    <span>{b.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {(b.knockout || []).map((m: any, i: number) => {
                    const isT1Winner = m.team1EventPts != null && m.team2EventPts != null && m.team1EventPts > m.team2EventPts;
                    const isT2Winner = m.team1EventPts != null && m.team2EventPts != null && m.team2EventPts > m.team1EventPts;

                    return (
                      <div key={`${m.label}-${i}`} className="p-3.5 rounded-xl border border-border/70 bg-background/80 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              {m.label}
                            </span>
                            {m.dayNumber && <span className="text-[10px] font-bold text-muted-foreground">Day {m.dayNumber}</span>}
                          </div>
                          <div className="flex items-center gap-2 font-mono font-bold text-sm">
                            <span className={isT1Winner ? 'text-emerald-400 font-black' : 'text-foreground'}>{m.team1Name} ({m.team1EventPts ?? '—'})</span>
                            <span className="text-muted-foreground text-xs font-bold">vs</span>
                            <span className={isT2Winner ? 'text-emerald-400 font-black' : 'text-foreground'}>{m.team2Name} ({m.team2EventPts ?? '—'})</span>
                          </div>
                        </div>

                        {/* Combi Events */}
                        {m.events && m.events.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {m.events.map((ev: any, evIdx: number) => (
                              <div key={evIdx} className="text-xs p-2 rounded-lg bg-card/60 border border-border/40 flex flex-wrap items-center justify-between gap-2">
                                <div className="font-bold flex items-center gap-1.5">
                                  <span>{ev.name}</span>
                                  {ev.format && <span className="text-[10px] text-muted-foreground">({ev.format})</span>}
                                </div>
                                <div className="text-[11px] font-mono text-muted-foreground">
                                  <span className="text-sky-400 font-bold">{ev.team1Players || '—'}</span>
                                  <span className="font-black px-1.5 text-foreground">{ev.team1Pts ?? 0} – {ev.team2Pts ?? 0}</span>
                                  <span className="text-rose-400 font-bold">{ev.team2Players || '—'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : tab === 'players' ? (
        <Card className="border-border/80 bg-card/70 backdrop-blur-sm shadow-xl">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" /> Player Ranking
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ranked by player average, lowest first. Players with the same average share the same ranking.
                </p>
              </div>

              {/* Player Search Input */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Search player, team, grade..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="pl-9 pr-8 h-9 text-xs font-semibold bg-background/90 border-border shadow-xs focus-visible:ring-amber-500"
                />
                {playerSearch && (
                  <button
                    type="button"
                    onClick={() => setPlayerSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            {playerSearch && (
              <div className="text-[11px] text-muted-foreground font-medium pt-1">
                Showing <strong className="text-amber-400 font-bold">{filteredPlayers.length}</strong> of {players.length} players for &ldquo;{playerSearch}&rdquo;
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-3">
            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players on the edition roster yet.</p>
            ) : filteredPlayers.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs text-muted-foreground font-medium">No players found matching &ldquo;{playerSearch}&rdquo;</p>
                <button
                  type="button"
                  onClick={() => setPlayerSearch('')}
                  className="text-xs text-amber-400 font-bold underline hover:text-amber-300"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">Matches</TableHead>
                    <TableHead className="text-center">Slams</TableHead>
                    <TableHead className="text-center">WO</TableHead>
                    <TableHead className="text-right">Avg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlayers.map((row: any) => (
                    <TableRow
                      key={row.userId}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setSelectedPlayer(row)}
                    >
                      <TableCell className="font-black text-amber-500">{row.rank}</TableCell>
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-2">
                          <span>{row.name}</span>
                          {row.grade && (
                            <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {row.grade}
                            </span>
                          )}
                          {row.target !== null && row.target !== undefined && Number(row.target) > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              T: {row.target}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{row.teamName}</TableCell>
                      <TableCell className="text-center font-bold text-xs text-foreground">
                        {row.matches ?? row.daysCounted ?? 0}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.slams > 0 ? (
                          <span className="text-xs font-bold text-amber-400 flex items-center justify-center gap-0.5">
                            <Flame className="h-3 w-3 fill-amber-400 text-amber-500" /> {row.slams}
                          </span>
                        ) : (
                          '0'
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.walkovers > 0 ? (
                          <Badge variant="destructive" className="text-[10px] font-black px-1.5 py-0 bg-rose-500/20 text-rose-300 border-rose-500/40">
                            {row.walkovers} WO
                          </Badge>
                        ) : (
                          '0'
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-foreground">
                        {row.boardAverage == null ? '—' : Number(row.boardAverage).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stages configured yet.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {blocks.map((b: any) => (
              <button
                key={b.stageId}
                type="button"
                onClick={() => setStageId(b.stageId)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black border transition-all ${
                  stageId === b.stageId ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' : 'border-border bg-card/60 text-muted-foreground'
                }`}
              >
                {b.name}{b.current ? ' • now' : ''}
              </button>
            ))}
          </div>
          {!stage ? (
            <p className="text-sm text-muted-foreground">No stages configured yet.</p>
          ) : stage.knockout?.length ? (
            <div className="space-y-4">
              {stage.knockout.map((m: any, i: number) => {
                const isT1Winner = m.team1EventPts != null && m.team2EventPts != null && m.team1EventPts > m.team2EventPts;
                const isT2Winner = m.team1EventPts != null && m.team2EventPts != null && m.team2EventPts > m.team1EventPts;

                return (
                  <Card key={`${m.label}-${i}`} className="border-border bg-card/80 backdrop-blur-sm overflow-hidden shadow-lg">
                    <CardHeader className="p-4 bg-muted/20 border-b border-border/50">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              {m.label}
                            </span>
                            {m.dayNumber && (
                              <span className="text-[10px] font-bold text-muted-foreground">
                                Day {m.dayNumber}
                              </span>
                            )}
                          </div>
                          <div className="text-base sm:text-lg font-black flex items-center gap-2 flex-wrap">
                            <span className={isT1Winner ? 'text-emerald-400 font-extrabold' : 'text-foreground'}>
                              {m.team1Name}
                            </span>
                            <span className="text-xs text-muted-foreground font-black px-1">vs</span>
                            <span className={isT2Winner ? 'text-emerald-400 font-extrabold' : 'text-foreground'}>
                              {m.team2Name}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {m.team1EventPts == null ? (
                            <Badge variant="outline" className="text-xs font-bold text-muted-foreground">
                              After 9:30pm IST
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-2 bg-background/80 px-3.5 py-1.5 rounded-xl border border-border shadow-xs">
                              <span className={`text-base font-black font-mono ${isT1Winner ? 'text-emerald-400' : 'text-foreground'}`}>
                                {m.team1EventPts}
                              </span>
                              <span className="text-xs text-muted-foreground font-bold">–</span>
                              <span className={`text-base font-black font-mono ${isT2Winner ? 'text-emerald-400' : 'text-foreground'}`}>
                                {m.team2EventPts}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {/* Combi Events Breakdown */}
                    {m.events && m.events.length > 0 && (
                      <CardContent className="p-4 space-y-2.5 bg-card/40">
                        <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground pb-1">
                          Combi Events & Player Scores
                        </div>
                        <div className="space-y-2">
                          {m.events.map((ev: any, evIdx: number) => {
                            const isWin = String(ev.result || '').includes('Win');
                            const isLoss = String(ev.result || '').includes('Loss');
                            const isWO = String(ev.result || '').includes('WO') || ev.reason === 'walkover' || ev.reason === 'double-walkover';

                            return (
                              <div
                                key={`${m.label}-${i}-ev-${evIdx}`}
                                className="text-xs rounded-xl bg-background/80 border border-border/70 p-3 grid grid-cols-1 md:grid-cols-3 gap-2.5 items-center"
                              >
                                {/* Event Title & Points */}
                                <div className="space-y-1">
                                  <div className="font-extrabold text-foreground flex items-center gap-1.5 flex-wrap">
                                    <span>{ev.name}</span>
                                    {ev.format && (
                                      <span className="text-[10px] text-muted-foreground font-bold">
                                        ({ev.format})
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black ${
                                        isWin
                                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                          : isLoss
                                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                          : isWO
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                          : 'bg-muted text-muted-foreground border border-border'
                                      }`}
                                    >
                                      {ev.team1Pts} – {ev.team2Pts} pts
                                    </span>
                                  </div>
                                </div>

                                {/* Team 1 Players & Score */}
                                <div className="space-y-0.5">
                                  <div className="text-[10px] font-bold text-sky-400 uppercase truncate">
                                    {m.team1Name}
                                  </div>
                                  <div className="text-xs">
                                    {ev.team1PlayerList && ev.team1PlayerList.length > 0 ? (
                                      ev.team1PlayerList.map((p: any, idx: number) => (
                                        <span key={p.id || idx}>
                                          {idx > 0 && ', '}
                                          <span className={p.isWalkover ? 'text-amber-400 font-bold' : 'font-medium'}>
                                            {p.name}
                                            {p.score != null ? ` (${p.score})` : ''}
                                            {p.isWalkover && (
                                              <span className="ml-1 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">
                                                WO
                                              </span>
                                            )}
                                          </span>
                                        </span>
                                      ))
                                    ) : (
                                      <span>{ev.team1Players || '—'}</span>
                                    )}
                                    {ev.team1Score != null && (
                                      <span className="font-mono text-muted-foreground font-bold ml-1">
                                        = {ev.team1Score}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Team 2 Players & Score */}
                                <div className="space-y-0.5">
                                  <div className="text-[10px] font-bold text-rose-400 uppercase truncate">
                                    {m.team2Name}
                                  </div>
                                  <div className="text-xs">
                                    {ev.team2PlayerList && ev.team2PlayerList.length > 0 ? (
                                      ev.team2PlayerList.map((p: any, idx: number) => (
                                        <span key={p.id || idx}>
                                          {idx > 0 && ', '}
                                          <span className={p.isWalkover ? 'text-amber-400 font-bold' : 'font-medium'}>
                                            {p.name}
                                            {p.score != null ? ` (${p.score})` : ''}
                                            {p.isWalkover && (
                                              <span className="ml-1 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">
                                                WO
                                              </span>
                                            )}
                                          </span>
                                        </span>
                                      ))
                                    ) : (
                                      <span>{ev.team2Players || '—'}</span>
                                    )}
                                    {ev.team2Score != null && (
                                      <span className="font-mono text-muted-foreground font-bold ml-1">
                                        = {ev.team2Score}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
              {placement.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-lg font-black">Final ranking 1–8</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {placement.map((p: any) => (
                      <div key={p.place} className="flex justify-between text-sm">
                        <span className="font-black">{p.place}.</span>
                        <span className="font-semibold">{p.teamName}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {stage.kind === 'LEAGUE' ? (
                <p className="text-xs text-muted-foreground">Groups from Round Robin positions</p>
              ) : null}
              {(stage.groups || []).map((g: any) => (
                <Card key={g.key}>
                  <CardHeader>
                    <CardTitle className="text-lg font-black">{g.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead className="text-center">Total</TableHead>
                          <TableHead className="text-center">Played</TableHead>
                          <TableHead className="text-center">Won</TableHead>
                          <TableHead className="text-center">Lost</TableHead>
                          <TableHead className="text-center">Tied</TableHead>
                          <TableHead className="text-center font-bold text-foreground">Team Score</TableHead>
                          <TableHead className="text-center">Event</TableHead>
                          <TableHead className="text-center">Slams</TableHead>
                          <TableHead className="text-center">Target+</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(g.rows || []).map((row: any) => (
                          <TableRow key={row.teamId} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-black text-amber-500">{row.rank}</TableCell>
                            <TableCell className="font-semibold">
                              <div className="flex items-center gap-2">
                                {row.teamLogo ? (
                                  <img src={row.teamLogo} alt={row.teamName} className="w-6 h-6 rounded-full object-cover bg-slate-900 border border-border" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-slate-800 border border-border flex items-center justify-center text-[10px] text-slate-400 font-bold">
                                    {row.teamName?.[0]}
                                  </div>
                                )}
                                <span className="truncate">{row.teamName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-black">
                              <StatButton value={row.total} onClick={() => setOpen({ row, focus: 'total' })} className="font-black text-amber-400" />
                            </TableCell>
                            <TableCell className="text-center font-bold text-muted-foreground">{row.matchesPlayed ?? 0}</TableCell>
                            <TableCell className="text-center font-bold text-emerald-400">{row.matchesWon ?? 0}</TableCell>
                            <TableCell className="text-center font-bold text-rose-400">{row.matchesLost ?? 0}</TableCell>
                            <TableCell className="text-center font-bold text-amber-300">{row.matchesTied ?? 0}</TableCell>
                            <TableCell className="text-center font-mono font-bold text-foreground">
                              {row.teamScore ?? 0}
                            </TableCell>
                            <TableCell className="text-center">
                              <StatButton value={row.eventPts} onClick={() => setOpen({ row, focus: 'event' })} />
                            </TableCell>
                            <TableCell className="text-center">
                              <StatButton value={row.slamBonus} onClick={() => setOpen({ row, focus: 'slams' })} />
                            </TableCell>
                            <TableCell className="text-center">
                              <StatButton value={row.avgBonus} onClick={() => setOpen({ row, focus: 'avg' })} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Team Day Points Dialog ──────────────────────────────────────────── */}
      <Dialog open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogHeader>
          <DialogTitle>{open?.row?.teamName} · day-wise points</DialogTitle>
          <DialogDescription>
            {open?.focus === 'event'
              ? 'Event points from each completed combi day (after 9:30pm IST).'
              : open?.focus === 'slams'
                ? 'Slam bonus · +1 per published slam. Players who scored slams are listed by day.'
                : open?.focus === 'avg'
                  ? 'Target bonus · +1 when a published day’s score is at or below that day’s target. Players who earned it are listed by day.'
                  : 'Event + slams + target bonus, day by day after the day completes.'}
          </DialogDescription>
        </DialogHeader>
        {!days.length ? (
          <p className="text-sm text-muted-foreground">No completed days in this stage yet. Breakdown appears after 9:00pm IST (scores) and 9:30pm IST (event points).</p>
        ) : (
          <div className="space-y-4">
            {/* Day Selector Pills if multiple days */}
            {days.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto touch-scroll-x desktop-slim-scrollbar pb-1 pt-0.5">
                <span className="text-[11px] font-bold text-muted-foreground mr-1 shrink-0">Select Day:</span>
                {days.map((d: any) => {
                  const isSelected = activeDay?.dayNumber === d.dayNumber;
                  return (
                    <button
                      key={d.dayNumber}
                      type="button"
                      onClick={() => setSelectedDayNumber(d.dayNumber)}
                      className={`px-3 py-1 rounded-lg text-xs font-black border whitespace-nowrap transition-all ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm shadow-amber-500/20 scale-[1.02]'
                          : 'border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-amber-500/40'
                      }`}
                    >
                      Day {d.dayNumber}
                    </button>
                  );
                })}
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Vs</TableHead>
                  <TableHead className={open?.focus === 'total' ? 'text-amber-400 font-black' : 'font-bold'}>Total Pts</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead className="font-bold text-foreground">Team Score</TableHead>
                  <TableHead className={open?.focus === 'event' ? 'text-amber-400' : ''}>Event</TableHead>
                  <TableHead className={open?.focus === 'slams' ? 'text-amber-400' : ''}>Slams</TableHead>
                  <TableHead className={open?.focus === 'avg' ? 'text-amber-400' : ''}>Target+</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map((d: any) => {
                  const isSelected = activeDay?.dayNumber === d.dayNumber;
                  return (
                    <TableRow
                      key={d.dayNumber}
                      onClick={() => setSelectedDayNumber(d.dayNumber)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-500/15 hover:bg-amber-500/20 font-bold border-l-2 border-l-amber-400'
                          : 'hover:bg-muted/40'
                      }`}
                    >
                      <TableCell className="font-black">
                        <div className="flex items-center gap-1.5">
                          <span>Day {d.dayNumber}</span>
                          {isSelected && (
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{d.opponentName || '—'}</TableCell>
                      <TableCell className={open?.focus === 'total' ? 'font-black text-amber-400' : 'font-black'}>{d.total}</TableCell>
                      <TableCell className="font-bold">{d.matchResult || '—'}</TableCell>
                      <TableCell className="font-mono font-bold text-foreground">{d.teamScore ?? '—'}</TableCell>
                      <TableCell className={open?.focus === 'event' ? 'font-black text-amber-400' : ''}>{d.eventPts}</TableCell>
                      <TableCell className={open?.focus === 'slams' ? 'font-black text-amber-400' : ''}>{d.slamBonus}</TableCell>
                      <TableCell className={open?.focus === 'avg' ? 'font-black text-amber-400' : ''}>{d.avgBonus}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Selected Day Breakdown Details */}
            {activeDay && (
              <div className="space-y-3 pt-1">
                {/* Combis for active day */}
                {(open?.focus === 'event' || open?.focus === 'total') && activeDay.events?.length ? (
                  <div className="rounded-xl border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-black uppercase tracking-wide text-amber-500">
                        Day {activeDay.dayNumber} combis {activeDay.opponentName ? `vs ${activeDay.opponentName}` : ''}
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground font-bold">
                        Event Pts: <strong className="text-emerald-400 font-extrabold">+{activeDay.eventPts}</strong>
                      </span>
                    </div>
                    {activeDay.events.map((ev: any, i: number) => {
                      const isWin = String(ev.result || '').includes('Win');
                      const isLoss = String(ev.result || '').includes('Loss');
                      const isWO = String(ev.result || '').includes('WO') || ev.reason === 'walkover' || ev.reason === 'double-walkover';
                      return (
                        <div key={`${activeDay.dayNumber}-${i}`} className="text-xs grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-border/60 pt-2.5">
                          <div className="flex flex-col gap-0.5">
                            <div className="font-bold flex items-center gap-1.5 flex-wrap">
                              <span>{ev.name}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                  isWin
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : isLoss
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : isWO
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-muted text-muted-foreground border border-border'
                                }`}
                              >
                                {ev.result} · {ev.myPts}–{ev.oppPts}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-0.5">
                            <span className="font-bold text-sky-400">YOU</span>
                            <span className="text-muted-foreground"> · </span>
                            {ev.myPlayerList && ev.myPlayerList.length > 0 ? (
                              ev.myPlayerList.map((p: any, idx: number) => (
                                <span key={p.id || idx}>
                                  {idx > 0 && ', '}
                                  <span className={p.isWalkover ? 'text-amber-400 font-bold' : 'font-medium'}>
                                    {p.name}
                                    {p.score != null ? ` (${p.score})` : ''}
                                    {p.isWalkover && (
                                      <span className="ml-1 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">
                                        Walkover
                                      </span>
                                    )}
                                  </span>
                                </span>
                              ))
                            ) : (
                              <span>{ev.myPlayers || '—'}</span>
                            )}
                            {ev.myScore != null && (
                              <span className="font-mono text-muted-foreground font-bold ml-1">
                                = {ev.myScore}
                              </span>
                            )}
                          </div>

                          <div className="space-y-0.5">
                            <span className="font-bold text-rose-400">OPP</span>
                            <span className="text-muted-foreground"> · </span>
                            {ev.oppPlayerList && ev.oppPlayerList.length > 0 ? (
                              ev.oppPlayerList.map((p: any, idx: number) => (
                                <span key={p.id || idx}>
                                  {idx > 0 && ', '}
                                  <span className={p.isWalkover ? 'text-amber-400 font-bold' : 'font-medium'}>
                                    {p.name}
                                    {p.score != null ? ` (${p.score})` : ''}
                                    {p.isWalkover && (
                                      <span className="ml-1 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">
                                        Walkover
                                      </span>
                                    )}
                                  </span>
                                </span>
                              ))
                            ) : (
                              <span>{ev.oppPlayers || '—'}</span>
                            )}
                            {ev.oppScore != null && (
                              <span className="font-mono text-muted-foreground font-bold ml-1">
                                = {ev.oppScore}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {/* Target bonus for active day */}
                {(open?.focus === 'avg' || open?.focus === 'total') && (
                  activeTargetBonusDay && activeTargetBonusDay.players.length > 0 ? (
                    <div className="rounded-xl border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-black uppercase tracking-wide text-amber-500">
                          Day {activeDay.dayNumber} target bonus · +{activeDay.avgBonus}
                        </div>
                      </div>
                      {activeTargetBonusDay.players.map((p: any) => (
                        <div key={`${activeDay.dayNumber}-${p.userId}`} className="text-xs flex flex-wrap justify-between gap-2 border-t border-border/60 pt-2">
                          <span className="font-bold">{p.name}</span>
                          <span className="font-mono text-muted-foreground">
                            {p.score} (target {p.target ?? '—'}) · +1
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : open?.focus === 'avg' ? (
                    <p className="text-xs text-muted-foreground">No player scored under target for Day {activeDay.dayNumber}.</p>
                  ) : null
                )}

                {/* Slams for active day */}
                {(open?.focus === 'slams' || open?.focus === 'total') && (
                  activeSlamBonusDay && activeSlamBonusDay.players.length > 0 ? (
                    <div className="rounded-xl border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-black uppercase tracking-wide text-amber-500">
                          Day {activeDay.dayNumber} slams · +{activeDay.slamBonus}
                        </div>
                      </div>
                      {activeSlamBonusDay.players.map((p: any) => (
                        <div key={`${activeDay.dayNumber}-${p.userId}`} className="text-xs flex flex-wrap justify-between gap-2 border-t border-border/60 pt-2">
                          <span className="font-bold">{p.name}</span>
                          <span className="font-mono text-muted-foreground">{p.slams} slam{p.slams === 1 ? '' : 's'} · +{p.slams}</span>
                        </div>
                      ))}
                    </div>
                  ) : open?.focus === 'slams' ? (
                    <p className="text-xs text-muted-foreground">No slams scored for Day {activeDay.dayNumber}.</p>
                  ) : null
                )}
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* ── Player Score & Walkover Breakdown Dialog ────────────────────────── */}
      <Dialog open={Boolean(selectedPlayer)} onOpenChange={(next) => !next && setSelectedPlayer(null)}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              {selectedPlayer?.name}
            </DialogTitle>
            {selectedPlayer?.grade && (
              <Badge variant="carrom" className="text-xs font-black uppercase">
                {selectedPlayer.grade}
              </Badge>
            )}
          </div>
          <DialogDescription>
            {selectedPlayer?.teamName} · Overall Rank #{selectedPlayer?.rank} · Average: {selectedPlayer?.boardAverage == null ? '—' : Number(selectedPlayer?.boardAverage).toFixed(2)}
            {selectedPlayer?.target ? ` · Target: ${selectedPlayer.target}` : ''}
          </DialogDescription>
        </DialogHeader>

        {selectedPlayer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Rank</div>
                <div className="text-base font-black text-amber-400">#{selectedPlayer.rank}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Average</div>
                <div className="text-base font-black text-foreground">{selectedPlayer.boardAverage == null ? '—' : Number(selectedPlayer.boardAverage).toFixed(2)}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Matches</div>
                <div className="text-base font-black text-foreground">{selectedPlayer.matches ?? selectedPlayer.daysCounted ?? 0}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Slams</div>
                <div className="text-base font-black text-amber-400">{selectedPlayer.slams ?? 0}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Walkovers</div>
                <div className="text-base font-black text-rose-400">{selectedPlayer.walkovers ?? 0}</div>
              </div>
            </div>

            {/* Tournament Average Formula & Calculation Card */}
            {selectedPlayer.dayScores && selectedPlayer.dayScores.length > 0 && (() => {
              const dayItems = selectedPlayer.dayScores.map((ds: any) => {
                const bCount = ds.boardCount || 4;
                const dAvg = ds.dayAverage != null ? Number(ds.dayAverage) : Math.round((ds.score / bCount) * 100) / 100;
                return { ...ds, bCount, dAvg };
              });
              const sumDayAverages = dayItems.reduce((acc: number, curr: any) => acc + curr.dAvg, 0);
              const totalMatchesCount = dayItems.length;
              const computedAvg = totalMatchesCount > 0 ? (Math.round((sumDayAverages / totalMatchesCount) * 100) / 100).toFixed(2) : '0.00';

              return (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                  <div className="flex items-center justify-between font-black text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <Calculator className="h-4 w-4 text-amber-400" />
                      Tournament Average Calculation Breakdown
                    </span>
                    <Badge variant="carrom" className="text-xs font-black">
                      Avg: {computedAvg}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono leading-relaxed bg-background/80 p-2.5 rounded-lg border border-border/60 space-y-1">
                    <div>
                      <span className="text-amber-400 font-bold">Formula:</span> (Sum of Daily Match Averages) ÷ (Total Matches)
                    </div>
                    <div className="text-foreground/90">
                      <span className="text-amber-400 font-bold">Sum of Match Averages:</span> {dayItems.map((d: any) => d.dAvg.toFixed(2)).join(' + ')} = <span className="text-amber-400 font-bold">{sumDayAverages.toFixed(2)}</span>
                    </div>
                    <div className="text-foreground/90">
                      <span className="text-amber-400 font-bold">Calculation:</span> {sumDayAverages.toFixed(2)} ÷ {totalMatchesCount} matches = <span className="text-amber-400 font-black text-xs">{computedAvg}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">
              <div className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Day-by-Day Scores & Calculations
              </div>

              {(!selectedPlayer.dayScores || selectedPlayer.dayScores.length === 0) ? (
                <p className="text-xs text-muted-foreground italic py-3 text-center">No scores recorded yet for this player.</p>
              ) : (
                <div className="space-y-2">
                  {selectedPlayer.dayScores.map((ds: any) => {
                    const isWo = Boolean(ds.isWalkover);
                    const b = ds.breakdown;
                    const bCount = ds.boardCount || 4;
                    const dAvg = ds.dayAverage != null ? Number(ds.dayAverage) : Math.round((ds.score / bCount) * 100) / 100;

                    return (
                      <div
                        key={ds.dayNumber}
                        className={`p-3 rounded-xl border text-xs space-y-2 ${
                          isWo
                            ? 'bg-rose-950/20 border-rose-500/40'
                            : 'bg-background/80 border-border/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold flex items-center gap-2">
                            <span>Day {ds.dayNumber}</span>
                            {ds.eventName && (
                              <span className="text-[10px] text-muted-foreground">({ds.eventName})</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {isWo ? (
                              <Badge variant="destructive" className="text-[10px] font-black px-2 py-0.5 bg-rose-500/20 text-rose-300 border-rose-500/50">
                                Walkover: {ds.score} pts
                              </Badge>
                            ) : (
                              <Badge variant="carrom" className="text-[10px] font-black px-2 py-0.5">
                                {ds.score} pts
                              </Badge>
                            )}

                            {ds.slams > 0 && (
                              <span className="text-amber-400 font-bold flex items-center gap-0.5">
                                <Flame className="h-3 w-3 fill-amber-400 text-amber-500" /> {ds.slams}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Match Average Calculation Line */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px]">
                          <div className="text-muted-foreground font-medium">
                            Score: <strong className="text-foreground">{ds.score} pts</strong> across <strong className="text-foreground">{bCount} boards</strong>
                          </div>
                          <div className="font-mono font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                            Day Avg = {ds.score} ÷ {bCount} = {dAvg.toFixed(2)}
                          </div>
                        </div>

                        {/* If Walkover with breakdown */}
                        {isWo && b && (
                          <div className="p-2.5 rounded-lg bg-slate-950/70 border border-rose-500/30 text-[11px] space-y-1.5">
                            <div className="text-[10px] font-black text-rose-300 flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3 text-rose-400" />
                              Auto Walkover Calculation Breakdown
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px]">
                              <div className="p-1.5 rounded bg-card/60 border border-border/40">
                                <div className="text-muted-foreground">1. Event Loss</div>
                                <div className="font-bold text-foreground">{b.eventLossScore} pts</div>
                                <div className="text-[9px] text-muted-foreground/80">Opp({b.opponentsTotal})+1 - Tm({b.teammatesTotal})</div>
                              </div>
                              <div className="p-1.5 rounded bg-card/60 border border-border/40">
                                <div className="text-muted-foreground">2. Grade Worst</div>
                                <div className="font-bold text-foreground">{b.gradeWorstScore} pts</div>
                                <div className="text-[9px] text-muted-foreground/80">Grade Max({b.gradeMaxDayScore ?? 'N/A'})+1</div>
                              </div>
                              <div className="p-1.5 rounded bg-card/60 border border-border/40">
                                <div className="text-muted-foreground">3. Target Loss</div>
                                <div className="font-bold text-foreground">{b.targetLossScore > 0 ? `${b.targetLossScore} pts` : 'None'}</div>
                                <div className="text-[9px] text-muted-foreground/80">{selectedPlayer.target ? `Target(${selectedPlayer.target})+1` : 'No target'}</div>
                              </div>
                            </div>
                            <div className="text-[10px] text-rose-300 font-bold pt-1 border-t border-rose-500/20">
                              Result: max({b.eventLossScore}, {b.gradeWorstScore}, {b.targetLossScore || 0}) = <span className="text-amber-400">{ds.score} pts</span> ({constraintBadgeLabel(b.appliedConstraint)})
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
