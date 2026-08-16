'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Video,
  Radio,
  Download,
  Share2,
  Calendar,
  Search,
  CheckCircle2,
  Clock,
  Trophy,
  ExternalLink,
  MessageCircle,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  Play,
  Filter,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const TEAMS_INFO: Record<string, { name: string; logo: string; tag: string; color: string; border: string; bg: string }> = {
  'PLYWOOD PIONEERS': {
    name: 'Plywood Pioneers',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/plywood-pioneers.jpeg',
    tag: 'PP',
    color: 'text-amber-400',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
  },
  'SUPERNOVA QUEEN': {
    name: 'Supernova Queen',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/supernova-queen.jpeg',
    tag: 'SQ',
    color: 'text-pink-400',
    border: 'border-pink-500/40',
    bg: 'bg-pink-500/10',
  },
  'POCKET DYNAMOS': {
    name: 'Pocket Dynamos',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/pocket-dynamos.jpeg',
    tag: 'PD',
    color: 'text-sky-400',
    border: 'border-sky-500/40',
    bg: 'bg-sky-500/10',
  },
  'LUMEN PILLAR': {
    name: 'Lumen Pillar',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/lumen-pillar.jpeg',
    tag: 'LP',
    color: 'text-yellow-400',
    border: 'border-yellow-500/40',
    bg: 'bg-yellow-500/10',
  },
  'VANILLA FALCONS': {
    name: 'Vanilla Falcons',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/vanilla-falcons.jpeg',
    tag: 'VF',
    color: 'text-emerald-400',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
  },
  'VINTAGE STRIKERS': {
    name: 'Vintage Strikers',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/vintage-strikers.jpeg',
    tag: 'VS',
    color: 'text-orange-400',
    border: 'border-orange-500/40',
    bg: 'bg-orange-500/10',
  },
  'EBONY OVERLORDS': {
    name: 'Ebony Overlords',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/ebony-overlords.jpeg',
    tag: 'EO',
    color: 'text-purple-400',
    border: 'border-purple-500/40',
    bg: 'bg-purple-500/10',
  },
  'BORIC SPEEDSTERS': {
    name: 'Boric Speedsters',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/boric-speedsters.jpeg',
    tag: 'BS',
    color: 'text-cyan-400',
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-500/10',
  },
};

const OFFICIAL_MONUMENTS_DATA: Array<{
  day: number;
  title: string;
  timeRange: string;
  matches: Array<{ team1: string; team2: string }>;
}> = [
  {
    day: 1,
    title: 'BICENTENNIAL MONUMENT 1',
    timeRange: '9TH AUG 9 PM TO 10TH AUG 8 PM',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'SUPERNOVA QUEEN' },
      { team1: 'POCKET DYNAMOS', team2: 'LUMEN PILLAR' },
      { team1: 'VANILLA FALCONS', team2: 'VINTAGE STRIKERS' },
      { team1: 'EBONY OVERLORDS', team2: 'BORIC SPEEDSTERS' },
    ],
  },
  {
    day: 2,
    title: 'BICENTENNIAL MONUMENT 2',
    timeRange: '10TH AUG 8 PM TO 11TH AUG 8 PM',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'VINTAGE STRIKERS' },
      { team1: 'LUMEN PILLAR', team2: 'BORIC SPEEDSTERS' },
      { team1: 'SUPERNOVA QUEEN', team2: 'EBONY OVERLORDS' },
      { team1: 'POCKET DYNAMOS', team2: 'VANILLA FALCONS' },
    ],
  },
  {
    day: 3,
    title: 'BICENTENNIAL MONUMENT 3',
    timeRange: '11TH AUG 8 PM TO 12TH AUG 8 PM',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'EBONY OVERLORDS' },
      { team1: 'BORIC SPEEDSTERS', team2: 'VANILLA FALCONS' },
      { team1: 'VINTAGE STRIKERS', team2: 'POCKET DYNAMOS' },
      { team1: 'LUMEN PILLAR', team2: 'SUPERNOVA QUEEN' },
    ],
  },
  {
    day: 4,
    title: 'BICENTENNIAL MONUMENT 4',
    timeRange: '12TH AUG 8 PM TO 13TH AUG 8 PM',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'VANILLA FALCONS' },
      { team1: 'EBONY OVERLORDS', team2: 'POCKET DYNAMOS' },
      { team1: 'BORIC SPEEDSTERS', team2: 'SUPERNOVA QUEEN' },
      { team1: 'VINTAGE STRIKERS', team2: 'LUMEN PILLAR' },
    ],
  },
  {
    day: 5,
    title: 'BICENTENNIAL MONUMENT 5',
    timeRange: '13TH AUG 8 PM TO 14TH AUG 8 PM',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'LUMEN PILLAR' },
      { team1: 'SUPERNOVA QUEEN', team2: 'VINTAGE STRIKERS' },
      { team1: 'POCKET DYNAMOS', team2: 'BORIC SPEEDSTERS' },
      { team1: 'VANILLA FALCONS', team2: 'EBONY OVERLORDS' },
    ],
  },
  {
    day: 6,
    title: 'BICENTENNIAL MONUMENT 6',
    timeRange: '14TH AUG 8 PM TO 15TH AUG 8 PM',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'BORIC SPEEDSTERS' },
      { team1: 'VINTAGE STRIKERS', team2: 'EBONY OVERLORDS' },
      { team1: 'LUMEN PILLAR', team2: 'VANILLA FALCONS' },
      { team1: 'SUPERNOVA QUEEN', team2: 'POCKET DYNAMOS' },
    ],
  },
  {
    day: 7,
    title: 'BICENTENNIAL MONUMENT 7',
    timeRange: '15TH AUG 8 PM TO 16TH AUG 8 PM',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'POCKET DYNAMOS' },
      { team1: 'VANILLA FALCONS', team2: 'SUPERNOVA QUEEN' },
      { team1: 'EBONY OVERLORDS', team2: 'LUMEN PILLAR' },
      { team1: 'BORIC SPEEDSTERS', team2: 'VINTAGE STRIKERS' },
    ],
  },
  {
    day: 8,
    title: 'BICENTENNIAL MONUMENT 8',
    timeRange: '16TH AUG 8 PM TO 17TH AUG 8 PM',
    matches: [
      { team1: 'SUPERNOVA QUEEN', team2: 'PLYWOOD PIONEERS' },
      { team1: 'LUMEN PILLAR', team2: 'POCKET DYNAMOS' },
      { team1: 'VINTAGE STRIKERS', team2: 'VANILLA FALCONS' },
      { team1: 'BORIC SPEEDSTERS', team2: 'EBONY OVERLORDS' },
    ],
  },
  {
    day: 9,
    title: 'BICENTENNIAL MONUMENT 9',
    timeRange: '17TH AUG 8 PM TO 18TH AUG 8 PM',
    matches: [
      { team1: 'VINTAGE STRIKERS', team2: 'PLYWOOD PIONEERS' },
      { team1: 'BORIC SPEEDSTERS', team2: 'LUMEN PILLAR' },
      { team1: 'EBONY OVERLORDS', team2: 'SUPERNOVA QUEEN' },
      { team1: 'VANILLA FALCONS', team2: 'POCKET DYNAMOS' },
    ],
  },
  {
    day: 10,
    title: 'BICENTENNIAL MONUMENT 10',
    timeRange: '18TH AUG 8 PM TO 19TH AUG 8 PM',
    matches: [
      { team1: 'EBONY OVERLORDS', team2: 'PLYWOOD PIONEERS' },
      { team1: 'VANILLA FALCONS', team2: 'BORIC SPEEDSTERS' },
      { team1: 'POCKET DYNAMOS', team2: 'VINTAGE STRIKERS' },
      { team1: 'SUPERNOVA QUEEN', team2: 'LUMEN PILLAR' },
    ],
  },
  {
    day: 11,
    title: 'BICENTENNIAL MONUMENT 11',
    timeRange: '19TH AUG 8 PM TO 20TH AUG 8 PM',
    matches: [
      { team1: 'VANILLA FALCONS', team2: 'PLYWOOD PIONEERS' },
      { team1: 'POCKET DYNAMOS', team2: 'EBONY OVERLORDS' },
      { team1: 'SUPERNOVA QUEEN', team2: 'BORIC SPEEDSTERS' },
      { team1: 'LUMEN PILLAR', team2: 'VINTAGE STRIKERS' },
    ],
  },
  {
    day: 12,
    title: 'BICENTENNIAL MONUMENT 12',
    timeRange: '20TH AUG 8 PM TO 21ST AUG 8 PM',
    matches: [
      { team1: 'LUMEN PILLAR', team2: 'PLYWOOD PIONEERS' },
      { team1: 'VINTAGE STRIKERS', team2: 'SUPERNOVA QUEEN' },
      { team1: 'BORIC SPEEDSTERS', team2: 'POCKET DYNAMOS' },
      { team1: 'EBONY OVERLORDS', team2: 'VANILLA FALCONS' },
    ],
  },
  {
    day: 13,
    title: 'BICENTENNIAL MONUMENT 13',
    timeRange: '21ST AUG 8 PM TO 22ND AUG 8 PM',
    matches: [
      { team1: 'BORIC SPEEDSTERS', team2: 'PLYWOOD PIONEERS' },
      { team1: 'EBONY OVERLORDS', team2: 'VINTAGE STRIKERS' },
      { team1: 'VANILLA FALCONS', team2: 'LUMEN PILLAR' },
      { team1: 'POCKET DYNAMOS', team2: 'SUPERNOVA QUEEN' },
    ],
  },
  {
    day: 14,
    title: 'BICENTENNIAL MONUMENT 14',
    timeRange: '22ND AUG 8 PM TO 23RD AUG 8 PM',
    matches: [
      { team1: 'POCKET DYNAMOS', team2: 'PLYWOOD PIONEERS' },
      { team1: 'SUPERNOVA QUEEN', team2: 'VANILLA FALCONS' },
      { team1: 'LUMEN PILLAR', team2: 'EBONY OVERLORDS' },
      { team1: 'VINTAGE STRIKERS', team2: 'BORIC SPEEDSTERS' },
    ],
  },
  {
    day: 15,
    title: 'BICENTENNIAL MONUMENT 15',
    timeRange: '23RD AUG 8 PM TO 24TH AUG 8 PM',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'SUPERNOVA QUEEN' },
      { team1: 'POCKET DYNAMOS', team2: 'LUMEN PILLAR' },
      { team1: 'VANILLA FALCONS', team2: 'VINTAGE STRIKERS' },
      { team1: 'EBONY OVERLORDS', team2: 'BORIC SPEEDSTERS' },
    ],
  },
  {
    day: 16,
    title: 'BICENTENNIAL MONUMENT 16',
    timeRange: '24TH AUG 8 PM TO 25TH AUG 8 PM',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'VINTAGE STRIKERS' },
      { team1: 'LUMEN PILLAR', team2: 'BORIC SPEEDSTERS' },
      { team1: 'SUPERNOVA QUEEN', team2: 'EBONY OVERLORDS' },
      { team1: 'POCKET DYNAMOS', team2: 'VANILLA FALCONS' },
    ],
  },
  {
    day: 17,
    title: 'BICENTENNIAL MONUMENT 17',
    timeRange: '25TH AUG 8 PM TO 26TH AUG 8 PM',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'EBONY OVERLORDS' },
      { team1: 'BORIC SPEEDSTERS', team2: 'VANILLA FALCONS' },
      { team1: 'VINTAGE STRIKERS', team2: 'POCKET DYNAMOS' },
      { team1: 'LUMEN PILLAR', team2: 'SUPERNOVA QUEEN' },
    ],
  },
  {
    day: 18,
    title: 'BICENTENNIAL MONUMENT 18',
    timeRange: '26TH AUG 8 PM TO 27TH AUG 8 PM',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'VANILLA FALCONS' },
      { team1: 'EBONY OVERLORDS', team2: 'POCKET DYNAMOS' },
      { team1: 'BORIC SPEEDSTERS', team2: 'SUPERNOVA QUEEN' },
      { team1: 'VINTAGE STRIKERS', team2: 'LUMEN PILLAR' },
    ],
  },
  {
    day: 19,
    title: 'BICENTENNIAL MONUMENT 19',
    timeRange: '27TH AUG 8 PM TO 28TH AUG 8 PM',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'LUMEN PILLAR' },
      { team1: 'SUPERNOVA QUEEN', team2: 'VINTAGE STRIKERS' },
      { team1: 'POCKET DYNAMOS', team2: 'BORIC SPEEDSTERS' },
      { team1: 'VANILLA FALCONS', team2: 'EBONY OVERLORDS' },
    ],
  },
  {
    day: 20,
    title: 'BICENTENNIAL MONUMENT 20',
    timeRange: '28TH AUG 8 PM TO 29TH AUG 8 PM',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'BORIC SPEEDSTERS' },
      { team1: 'VINTAGE STRIKERS', team2: 'EBONY OVERLORDS' },
      { team1: 'LUMEN PILLAR', team2: 'VANILLA FALCONS' },
      { team1: 'SUPERNOVA QUEEN', team2: 'POCKET DYNAMOS' },
    ],
  },
];

export interface VideoItem {
  matchId: string;
  dayNumber: number;
  team1Name: string;
  team2Name: string;
  score1: number;
  score2: number;
  status: string;
  isLive: boolean;
  hasReplay: boolean;
  videoUrl: string | null;
  youtubeVideoId: string | null;
  playerName?: string;
  playerUsername?: string;
  playerTeamName?: string;
  replayReason?: string | null;
  expiresAt?: string | null;
  scheduledTime?: string | null;
}

export default function VideosClient({ initialMatches, initialStreams }: { initialMatches: any[]; initialStreams: any[] }) {
  const [selectedDay, setSelectedDay] = React.useState<number | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | 'LIVE' | 'RECORDED' | 'SCHEDULED'>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [copiedMatchId, setCopiedMatchId] = React.useState<string | null>(null);

  // Compile full video list by combining Official 20 Monument fixtures with live DB records
  const allVideoItems: VideoItem[] = React.useMemo(() => {
    const items: VideoItem[] = [];

    OFFICIAL_MONUMENTS_DATA.forEach((monument) => {
      monument.matches.forEach((fix) => {
        const team1Key = fix.team1.toUpperCase();
        const team2Key = fix.team2.toUpperCase();
        const defaultMatchId = `monument_${monument.day}_${team1Key.replace(/\s+/g, '_')}`;

        // Find matching record in DB matches
        const dbMatch = initialMatches.find((m: any) => {
          if (m.id === defaultMatchId) return true;
          const monMatch = m.id.match(/monument_(\d+)/i);
          const matchDay = monMatch ? parseInt(monMatch[1], 10) : m.round;
          if (matchDay !== monument.day) return false;

          const m1 = (m.team1?.name || '').toUpperCase();
          const m2 = (m.team2?.name || '').toUpperCase();
          return (m1 === team1Key && m2 === team2Key) || (m1 === team2Key && m2 === team1Key);
        });

        const activeMatchId = dbMatch?.id || defaultMatchId;

        // Find stream in DB streams
        const stream = dbMatch?.liveStreams?.[0] || initialStreams.find((s: any) => s.matchId === activeMatchId);

        const isLive = dbMatch?.status === 'LIVE' || stream?.status === 'LIVE';
        const rawVideoUrl = stream?.youtubeUrl || stream?.youtubeEmbedUrl || null;
        const isDirectVideo = !!rawVideoUrl && !rawVideoUrl.includes('cbot_yt_') && (rawVideoUrl.startsWith('http') || rawVideoUrl.startsWith('blob:') || rawVideoUrl.startsWith('/'));
        const hasReplay = isDirectVideo || (!!stream?.youtubeVideoId && !stream.youtubeVideoId.startsWith('cbot_yt_')) || dbMatch?.status === 'COMPLETED' || stream?.status === 'ARCHIVED';

        const replayReason = stream?.failureReason?.startsWith('REPLAY_REASON:')
          ? stream.failureReason.replace('REPLAY_REASON:', '').trim()
          : null;

        items.push({
          matchId: activeMatchId,
          dayNumber: monument.day,
          team1Name: TEAMS_INFO[team1Key]?.name || fix.team1,
          team2Name: TEAMS_INFO[team2Key]?.name || fix.team2,
          score1: dbMatch?.score1 || 0,
          score2: dbMatch?.score2 || 0,
          status: isLive ? 'LIVE' : hasReplay ? 'COMPLETED' : dbMatch?.status || 'SCHEDULED',
          isLive,
          hasReplay,
          videoUrl: isDirectVideo ? rawVideoUrl : null,
          youtubeVideoId: stream?.youtubeVideoId || null,
          playerName: stream?.player?.name || stream?.player?.username || undefined,
          playerUsername: stream?.player?.username || undefined,
          playerTeamName: stream?.team?.name || undefined,
          replayReason,
          expiresAt: stream?.expiresAt || null,
          scheduledTime: dbMatch?.scheduledTime ? new Date(dbMatch.scheduledTime).toISOString() : null,
        });
      });
    });

    return items;
  }, [initialMatches, initialStreams]);

  // Statistics
  const liveCount = allVideoItems.filter((i) => i.isLive).length;
  const recordedCount = allVideoItems.filter((i) => i.hasReplay && !i.isLive).length;

  // Filtered List
  const filteredItems = React.useMemo(() => {
    return allVideoItems.filter((item) => {
      const matchDay = selectedDay === 'ALL' || item.dayNumber === selectedDay;
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'LIVE' && item.isLive) ||
        (statusFilter === 'RECORDED' && item.hasReplay && !item.isLive) ||
        (statusFilter === 'SCHEDULED' && !item.isLive && !item.hasReplay);

      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        item.matchId.toLowerCase().includes(q) ||
        item.team1Name.toLowerCase().includes(q) ||
        item.team2Name.toLowerCase().includes(q) ||
        (item.playerName && item.playerName.toLowerCase().includes(q)) ||
        (item.playerUsername && item.playerUsername.toLowerCase().includes(q));

      return matchDay && matchStatus && matchQuery;
    });
  }, [allVideoItems, selectedDay, statusFilter, searchQuery]);

  // Group filtered items by Day Number
  const groupedByDay = React.useMemo(() => {
    const map = new Map<number, VideoItem[]>();
    filteredItems.forEach((item) => {
      const list = map.get(item.dayNumber) || [];
      list.push(item);
      map.set(item.dayNumber, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filteredItems]);

  const handleCopyLink = (matchId: string) => {
    const url = `${window.location.origin}/matches/${matchId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedMatchId(matchId);
      setTimeout(() => setCopiedMatchId(null), 2500);
    });
  };

  const handleWhatsAppShare = (match: VideoItem) => {
    const arenaUrl = `${window.location.origin}/matches/${match.matchId}`;
    const text = match.isLive
      ? `🔴 WATCH LIVE on CBOT Arena: Day ${match.dayNumber} - ${match.team1Name} vs ${match.team2Name}! ${arenaUrl}`
      : `🎬 WATCH MATCH REPLAY: Day ${match.dayNumber} - ${match.team1Name} vs ${match.team2Name} on CBOT Arena! ${arenaUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 min-h-screen">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/40 bg-card p-6 sm:p-10 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <img src="/logo.png" alt="CBOT Logo" className="h-10 w-10 object-contain drop-shadow-md" />
              <Badge variant="carrom" className="font-extrabold px-3 py-1 text-xs">
                🏆 Bicentennial 200th Edition Video Hub
              </Badge>
              {liveCount > 0 && (
                <Badge className="bg-rose-600 text-white font-black text-xs px-3 py-1 gap-1.5 animate-pulse shadow-lg shadow-rose-600/40">
                  <Radio className="h-3.5 w-3.5" /> 🔴 {liveCount} MATCH{liveCount > 1 ? 'ES' : ''} LIVE NOW
                </Badge>
              )}
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Live Broadcasts &amp; Match Replays
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-2xl leading-relaxed">
              Watch official carrom broadcasts of all 8 participating teams day-wise across all 20 tournament days. Stream live games, replay recorded matches, or save full recordings locally.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/30 text-center shadow-lg min-w-[100px]">
              <div className="text-2xl font-black text-amber-400">{allVideoItems.length}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Total Matches</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 text-center shadow-lg min-w-[100px]">
              <div className="text-2xl font-black text-emerald-400">{recordedCount}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Saved Videos</div>
            </div>
          </div>
        </div>

        {/* Live Ticker Alert */}
        {liveCount > 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/80 to-amber-950/80 border border-rose-500/50 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-rose-500 animate-ping shrink-0" />
              <p className="text-xs sm:text-sm font-black text-white">
                🔴 Active broadcasts currently streaming live! Tap any live match card to enter the arena broadcast.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setStatusFilter('LIVE')}
              className="h-8 px-4 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shrink-0"
            >
              Filter Live Only
            </Button>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 border-amber-500/20 bg-slate-900/90 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 w-full md:w-80">
            <Search className="h-4 w-4 text-amber-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by player, team, or match ID..."
              className="bg-transparent border-none text-xs font-semibold text-white focus:outline-none w-full placeholder:text-slate-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-xs text-slate-400 hover:text-white">
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Status:
            </span>
            <Button
              size="sm"
              variant={statusFilter === 'ALL' ? 'carrom' : 'outline'}
              onClick={() => setStatusFilter('ALL')}
              className="text-xs font-bold h-8 px-3 rounded-xl"
            >
              All Matches ({allVideoItems.length})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'LIVE' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('LIVE')}
              className={`text-xs font-bold h-8 px-3 rounded-xl gap-1.5 ${
                statusFilter === 'LIVE' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'border-rose-500/40 text-rose-400'
              }`}
            >
              <Radio className="h-3 w-3" /> Live ({liveCount})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'RECORDED' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('RECORDED')}
              className={`text-xs font-bold h-8 px-3 rounded-xl gap-1.5 ${
                statusFilter === 'RECORDED' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border-emerald-500/40 text-emerald-400'
              }`}
            >
              <Video className="h-3 w-3" /> Replays ({recordedCount})
            </Button>
          </div>
        </div>

        {/* Day Selector Horizontal Scroll Pills */}
        <div className="space-y-1.5 pt-2 border-t border-white/10">
          <div className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Select Tournament Day:
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <Button
              size="sm"
              variant={selectedDay === 'ALL' ? 'carrom' : 'ghost'}
              onClick={() => setSelectedDay('ALL')}
              className="h-7 px-3 text-xs font-black rounded-lg shrink-0"
            >
              All Days (1-20)
            </Button>
            {OFFICIAL_MONUMENTS_DATA.map((m) => (
              <Button
                key={m.day}
                size="sm"
                variant={selectedDay === m.day ? 'carrom' : 'ghost'}
                onClick={() => setSelectedDay(m.day)}
                className="h-7 px-2.5 text-xs font-extrabold rounded-lg shrink-0"
              >
                Day {m.day}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Day-Wise Video Matches List */}
      {groupedByDay.length === 0 ? (
        <div className="text-center py-16 space-y-4 bg-slate-900/50 rounded-3xl border border-white/10 p-8">
          <AlertCircle className="h-12 w-12 text-slate-500 mx-auto" />
          <h3 className="text-lg font-bold text-white">No match videos found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            No matches matched your selected day or search filter. Try clearing your search query or selecting "All Days".
          </p>
          <Button
            size="sm"
            onClick={() => {
              setSelectedDay('ALL');
              setStatusFilter('ALL');
              setSearchQuery('');
            }}
            variant="outline"
            className="rounded-xl text-xs font-bold"
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="space-y-10">
          {groupedByDay.map(([dayNum, matches]) => {
            const scheduleInfo = OFFICIAL_MONUMENTS_DATA.find((s) => s.day === dayNum);

            return (
              <div key={dayNum} className="space-y-4 animate-in fade-in duration-300">
                {/* Day Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b-2 border-amber-500/30">
                  <div className="flex items-center gap-3">
                    <div className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-sm tracking-wider shadow-md">
                      DAY {dayNum}
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                        {scheduleInfo?.title || `Bicentennial Monument ${dayNum}`}
                      </h2>
                      <p className="text-[11px] font-mono text-amber-400/80">
                        {scheduleInfo?.timeRange}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-slate-400 border-white/10 text-xs font-mono self-start sm:self-auto">
                    {matches.length} Official Match{matches.length > 1 ? 'es' : ''}
                  </Badge>
                </div>

                {/* Match Cards Grid for this Day */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {matches.map((m) => {
                    const t1Key = m.team1Name.toUpperCase();
                    const t2Key = m.team2Name.toUpperCase();
                    const t1Info = TEAMS_INFO[t1Key] || {
                      name: m.team1Name,
                      logo: '/logo.png',
                      color: 'text-amber-400',
                      border: 'border-white/10',
                      bg: 'bg-slate-900',
                    };
                    const t2Info = TEAMS_INFO[t2Key] || {
                      name: m.team2Name,
                      logo: '/logo.png',
                      color: 'text-emerald-400',
                      border: 'border-white/10',
                      bg: 'bg-slate-900',
                    };

                    const matchUrl = `/matches/${m.matchId}`;

                    return (
                      <Card
                        key={m.matchId}
                        className={`p-5 rounded-3xl bg-slate-900/90 border transition-all space-y-4 shadow-xl hover:border-amber-500/50 ${
                          m.isLive ? 'border-rose-500/60 ring-2 ring-rose-500/30' : 'border-white/10'
                        }`}
                      >
                        {/* Top Card Header */}
                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[11px] font-bold text-slate-400 border-white/10">
                              #{m.matchId}
                            </Badge>
                            {m.playerName && (
                              <span className="text-xs font-black text-amber-300 truncate max-w-[140px] sm:max-w-[180px]">
                                👤 {m.playerName}
                              </span>
                            )}
                          </div>

                          {/* Status Badge */}
                          {m.isLive ? (
                            <Badge className="bg-rose-600 text-white font-black text-xs px-2.5 py-1 gap-1.5 animate-pulse shadow-lg shadow-rose-600/40">
                              <Radio className="h-3 w-3" /> 🔴 LIVE NOW
                            </Badge>
                          ) : m.hasReplay ? (
                            <Badge className="bg-emerald-600/90 text-white font-black text-xs px-2.5 py-1 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> 🎬 REPLAY READY
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400 border-white/20 text-xs font-bold">
                              📅 SCHEDULED
                            </Badge>
                          )}
                        </div>

                        {/* Matchup Team Versus Card */}
                        <div className="grid grid-cols-3 items-center gap-3 text-center py-1">
                          {/* Team 1 */}
                          <div className="space-y-1.5 flex flex-col items-center">
                            <div className="h-14 w-14 rounded-2xl bg-slate-950 border-2 border-white/10 p-1 flex items-center justify-center shadow-lg">
                              <img src={t1Info.logo} alt={t1Info.name} className="h-full w-full object-contain rounded-xl" />
                            </div>
                            <span className="text-xs font-black text-white leading-tight line-clamp-2">
                              {t1Info.name}
                            </span>
                          </div>

                          {/* Center Score / VS */}
                          <div className="space-y-1">
                            <div className="text-xs font-black uppercase text-slate-500">VS</div>
                            {m.status === 'COMPLETED' || m.isLive ? (
                              <div className="text-xl font-black text-amber-400 font-mono">
                                {m.score1} : {m.score2}
                              </div>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-500">Upcoming</span>
                            )}
                          </div>

                          {/* Team 2 */}
                          <div className="space-y-1.5 flex flex-col items-center">
                            <div className="h-14 w-14 rounded-2xl bg-slate-950 border-2 border-white/10 p-1 flex items-center justify-center shadow-lg">
                              <img src={t2Info.logo} alt={t2Info.name} className="h-full w-full object-contain rounded-xl" />
                            </div>
                            <span className="text-xs font-black text-white leading-tight line-clamp-2">
                              {t2Info.name}
                            </span>
                          </div>
                        </div>

                        {/* Replay Reason Pill (if restream comment exists) */}
                        {m.replayReason && (
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 italic flex items-center gap-1.5">
                            <span className="font-black text-amber-400 not-italic shrink-0">💬 Reason:</span>
                            <span className="truncate">"{m.replayReason}"</span>
                          </div>
                        )}

                        {/* Retention Notice (72 Hours) */}
                        {m.hasReplay && m.expiresAt && (
                          <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-slate-400 px-1">
                            <Clock className="h-3 w-3 text-amber-400 shrink-0" />
                            <span>Retention Expiry: {new Date(m.expiresAt).toLocaleDateString()} {new Date(m.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST</span>
                          </div>
                        )}

                        {/* Action Buttons Row */}
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
                          <Link href={matchUrl} className="flex-1 min-w-[140px]">
                            <Button
                              size="sm"
                              className={`w-full font-black text-xs rounded-xl gap-1.5 shadow-md ${
                                m.isLive
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                                  : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                              }`}
                            >
                              {m.isLive ? <Radio className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-slate-950" />}
                              <span>{m.isLive ? 'Watch Live Stream' : 'Watch Match Video'}</span>
                              <ExternalLink className="h-3 w-3 opacity-80" />
                            </Button>
                          </Link>

                          {m.videoUrl && (
                            <a
                              href={m.videoUrl}
                              download={`cbot_match_${m.matchId}.webm`}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors border border-white/10"
                              title="Download Match Video (.webm)"
                            >
                              <Download className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="hidden sm:inline">Save</span>
                            </a>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleWhatsAppShare(m)}
                            className="h-8 px-2.5 text-xs font-bold rounded-xl border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                            title="Share on WhatsApp"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyLink(m.matchId)}
                            className="h-8 px-2.5 text-xs font-bold rounded-xl border-white/20 text-slate-300 hover:text-white"
                            title="Copy Match Link"
                          >
                            {copiedMatchId === m.matchId ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
