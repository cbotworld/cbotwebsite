'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Play, Search, X, Youtube, Radio, Calendar, Trophy, Sparkles, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type EditionOption = {
  number: number;
  title: string;
  isCurrent: boolean;
  videoCount: number;
};

export type VideoItem = {
  id: string;
  dayNumber: number;
  editionNumber?: number | null;
  editionTitle?: string | null;
  playerName: string;
  playerUsername?: string | null;
  teamName: string;
  teamTag?: string | null;
  status: string;
  isLive: boolean;
  youtubeUrl: string | null;
  youtubeVideoId?: string | null;
  thumbnailUrl?: string | null;
  title: string;
  channelTitle?: string | null;
  recordedAt?: string | null;
};

function VideoCard({ v }: { v: VideoItem }) {
  const thumb = v.thumbnailUrl || (v.youtubeVideoId ? `https://img.youtube.com/vi/${v.youtubeVideoId}/hqdefault.jpg` : null);

  return (
    <a
      href={v.youtubeUrl || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex flex-col rounded-2xl border bg-card overflow-hidden transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-amber-500/10 ${
        v.isLive ? 'border-rose-500/60 shadow-rose-500/10' : 'border-border/70 hover:border-amber-500/40'
      } ${!v.youtubeUrl ? 'opacity-50 pointer-events-none' : ''}`}
      aria-label={`Watch ${v.title} on YouTube`}
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-video bg-slate-950 overflow-hidden">
        {thumb ? (
          <img
            src={thumb}
            alt={v.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="h-12 w-12 text-amber-500/30" />
          </div>
        )}
        {/* Overlay play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
          <div className="h-12 w-12 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/40">
            <Play className="h-5 w-5 fill-slate-950 text-slate-950 ml-0.5" />
          </div>
        </div>
        {/* Live badge */}
        {v.isLive && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow">
            <Radio className="h-2.5 w-2.5 animate-pulse" /> LIVE
          </div>
        )}
        {/* Badges in top-right */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {v.editionNumber && (
            <div className="bg-slate-950/85 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-500/30 shadow">
              ED {v.editionNumber}
            </div>
          )}
          {v.dayNumber > 0 && (
            <div className="bg-slate-950/85 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-500/30 shadow">
              DAY {v.dayNumber}
            </div>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="p-3 flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
          {v.editionNumber && (
            <span className="text-amber-400/90 font-black">Edition {v.editionNumber}</span>
          )}
          {v.editionNumber && v.dayNumber > 0 && <span>·</span>}
          {v.dayNumber > 0 && <span>Day {v.dayNumber}</span>}
        </div>
        <p className="text-sm font-black text-foreground line-clamp-2 leading-snug">{v.title}</p>
        <p className="text-xs text-muted-foreground font-semibold truncate">{v.teamName}</p>
        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide flex items-center gap-1">
            <Youtube className="h-3 w-3" /> Watch on YouTube
          </span>
          {v.recordedAt && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(v.recordedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

export default function VideosClient({
  initialVideos,
  allDays,
  allEditions,
  currentEditionNumber,
  defaultEdition = currentEditionNumber,
  defaultPlayer,
  defaultDay,
}: {
  initialVideos: VideoItem[];
  allDays: number[];
  allEditions: EditionOption[];
  currentEditionNumber: number;
  defaultEdition?: number | 'ALL';
  defaultPlayer?: string;
  defaultDay?: number | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [editionFilter, setEditionFilter] = React.useState<number | 'ALL'>(defaultEdition);
  const [playerDraft, setPlayerDraft] = React.useState(defaultPlayer || '');
  const [playerFilter, setPlayerFilter] = React.useState(defaultPlayer || '');
  const [dayFilter, setDayFilter] = React.useState<number | 'ALL'>(defaultDay || 'ALL');

  // Days available for the current edition filter:
  const daysForSelectedEdition = React.useMemo(() => {
    const vids =
      editionFilter === 'ALL'
        ? initialVideos
        : initialVideos.filter((v) => v.editionNumber === editionFilter);
    const days = [...new Set(vids.map((v) => v.dayNumber).filter((d) => d > 0))].sort((a, b) => a - b);
    return days.length > 0 ? days : allDays;
  }, [initialVideos, editionFilter, allDays]);

  const filtered = React.useMemo(() => {
    return initialVideos.filter((v) => {
      if (editionFilter !== 'ALL' && v.editionNumber !== editionFilter) return false;
      if (dayFilter !== 'ALL' && v.dayNumber !== dayFilter) return false;
      if (playerFilter.trim()) {
        const q = playerFilter.trim().toLowerCase();
        const hay = `${v.playerName} ${v.playerUsername || ''} ${v.teamName} ${v.title} ${v.channelTitle || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [initialVideos, editionFilter, dayFilter, playerFilter]);

  const applySearch = (
    p = playerDraft,
    d = dayFilter,
    ed = editionFilter,
  ) => {
    setPlayerFilter(p.trim());
    setDayFilter(d);
    setEditionFilter(ed);
    const params = new URLSearchParams(searchParams.toString());
    if (ed !== currentEditionNumber) {
      if (ed === 'ALL') params.set('edition', 'ALL');
      else params.set('edition', String(ed));
    } else {
      params.delete('edition'); // default is current edition
    }
    if (p.trim()) params.set('player', p.trim()); else params.delete('player');
    if (d !== 'ALL') params.set('day', String(d)); else params.delete('day');
    router.replace(`/videos?${params.toString()}`, { scroll: false });
  };

  const selectEdition = (ed: number | 'ALL') => {
    setEditionFilter(ed);
    // If the currently selected day doesn't exist in the target edition, reset day to 'ALL'
    let nextDay = dayFilter;
    if (ed !== 'ALL' && dayFilter !== 'ALL') {
      const vids = initialVideos.filter((v) => v.editionNumber === ed);
      const hasDay = vids.some((v) => v.dayNumber === dayFilter);
      if (!hasDay) nextDay = 'ALL';
    }
    setDayFilter(nextDay);
    applySearch(playerDraft, nextDay, ed);
  };

  const clearFilters = () => {
    setPlayerDraft('');
    setPlayerFilter('');
    setDayFilter('ALL');
    setEditionFilter(currentEditionNumber);
    router.replace('/videos', { scroll: false });
  };

  const hasFilter =
    playerFilter.trim() ||
    dayFilter !== 'ALL' ||
    editionFilter !== currentEditionNumber;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      {/* Header */}
      <div className="border-b border-border/60 pb-5">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge variant="carrom" className="flex items-center gap-1 w-fit">
            <Play className="h-3 w-3" /> Tournament Videos
          </Badge>
          <Badge
            variant="outline"
            className="border-amber-500/40 text-amber-400 bg-amber-500/10 font-bold text-xs flex items-center gap-1"
          >
            <Trophy className="h-3 w-3" /> Edition {currentEditionNumber} Live
          </Badge>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight">Player Match Videos</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
          Official CBOT World YouTube recordings of every player&apos;s match day. Filter by tournament edition, search by player name, or filter by day.
        </p>
      </div>

      {/* Search Input */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={playerDraft}
            onChange={(e) => setPlayerDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch(playerDraft, dayFilter, editionFilter)}
            placeholder="Search player, team or match…"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all"
          />
          {playerDraft && (
            <button
              type="button"
              onClick={() => {
                setPlayerDraft('');
                applySearch('', dayFilter, editionFilter);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant="carrom"
          className="font-black text-xs px-5 h-10 shrink-0"
          onClick={() => applySearch(playerDraft, dayFilter, editionFilter)}
        >
          SEARCH
        </Button>
      </div>

      {/* Tournament Edition Filter Bar */}
      <div className="space-y-2 rounded-2xl border border-border/70 bg-card/60 p-3.5 sm:p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-400" /> Tournament Edition:
            </span>
            <span className="text-xs font-bold text-muted-foreground">
              {editionFilter === 'ALL'
                ? 'Showing all tournament editions'
                : editionFilter === currentEditionNumber
                ? `Edition ${currentEditionNumber} (Current Cup)`
                : `Edition ${editionFilter}`}
            </span>
          </div>
          {editionFilter !== currentEditionNumber && (
            <button
              type="button"
              onClick={() => selectEdition(currentEditionNumber)}
              className="text-[11px] font-black text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
            >
              <span>⚡ Switch to Current Edition ({currentEditionNumber})</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {allEditions.map((ed) => {
            const isSelected = editionFilter === ed.number;
            return (
              <button
                key={ed.number}
                type="button"
                onClick={() => selectEdition(ed.number)}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border shadow-sm ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25 ring-2 ring-amber-400/40'
                    : ed.isCurrent
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/40 hover:bg-amber-500/20'
                    : 'bg-card/90 text-muted-foreground border-border/80 hover:text-foreground hover:border-amber-500/40'
                }`}
              >
                {ed.isCurrent ? <span>🏆</span> : <span>🎯</span>}
                <span>Edition {ed.number}</span>
                {ed.isCurrent && (
                  <span
                    className={`text-[9.5px] px-1.5 py-0.2 rounded-full uppercase font-black ${
                      isSelected ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    Current
                  </span>
                )}
                <span
                  className={`text-[10px] font-mono font-bold ${
                    isSelected ? 'text-slate-950/80' : 'text-muted-foreground'
                  }`}
                >
                  ({ed.videoCount})
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => selectEdition('ALL')}
            className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border shadow-sm ${
              editionFilter === 'ALL'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25 ring-2 ring-amber-400/40'
                : 'bg-card/90 text-muted-foreground border-border/80 hover:text-foreground hover:border-amber-500/40'
            }`}
          >
            All Editions
          </button>
        </div>
      </div>

      {/* Day Chips for selected edition */}
      {daysForSelectedEdition.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3 text-amber-500" /> Filter by Match Day:
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setDayFilter('ALL');
                applySearch(playerDraft, 'ALL', editionFilter);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                dayFilter === 'ALL'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/30'
                  : 'border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-amber-500/40'
              }`}
            >
              All Days
            </button>
            {daysForSelectedEdition.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDayFilter(d);
                  applySearch(playerDraft, d, editionFilter);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                  dayFilter === d
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/30'
                    : 'border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-amber-500/40'
                }`}
              >
                Day {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result Meta & Clear */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground">
          {filtered.length} video{filtered.length === 1 ? '' : 's'}
          {editionFilter !== 'ALL'
            ? ` · Edition ${editionFilter}${editionFilter === currentEditionNumber ? ' (Current)' : ''}`
            : ' · All Editions'}
          {dayFilter !== 'ALL' ? ` · Day ${dayFilter}` : ''}
          {playerFilter ? ` · "${playerFilter}"` : ''}
        </p>
        {hasFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Reset to Current Edition (205)
          </button>
        )}
      </div>

      {/* Video Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3">
          <Play className="h-10 w-10 mx-auto text-amber-500/30" />
          <p className="font-black text-muted-foreground">
            {hasFilter
              ? `No videos found${
                  editionFilter !== 'ALL' ? ` in Edition ${editionFilter}` : ''
                }${dayFilter !== 'ALL' ? ` on Day ${dayFilter}` : ''}${
                  playerFilter ? ` for "${playerFilter}"` : ''
                }.`
              : 'No videos recorded yet. Check back after matches go live.'}
          </p>
          {hasFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-bold text-amber-500 hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((v) => (
            <VideoCard key={v.id} v={v} />
          ))}
        </div>
      )}
    </div>
  );
}
