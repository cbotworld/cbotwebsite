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
  User,
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

const DAY_SCHEDULE_TITLES: Record<number, { title: string; timeRange: string }> = {
  1: { title: 'BICENTENNIAL MONUMENT 1', timeRange: '9TH AUG 9 PM TO 10TH AUG 8 PM' },
  2: { title: 'BICENTENNIAL MONUMENT 2', timeRange: '10TH AUG 8 PM TO 11TH AUG 8 PM' },
  3: { title: 'BICENTENNIAL MONUMENT 3', timeRange: '11TH AUG 8 PM TO 12TH AUG 8 PM' },
  4: { title: 'BICENTENNIAL MONUMENT 4', timeRange: '12TH AUG 8 PM TO 13TH AUG 8 PM' },
  5: { title: 'BICENTENNIAL MONUMENT 5', timeRange: '13TH AUG 8 PM TO 14TH AUG 8 PM' },
  6: { title: 'BICENTENNIAL MONUMENT 6', timeRange: '14TH AUG 8 PM TO 15TH AUG 8 PM' },
  7: { title: 'BICENTENNIAL MONUMENT 7', timeRange: '15TH AUG 8 PM TO 16TH AUG 8 PM' },
  8: { title: 'BICENTENNIAL MONUMENT 8', timeRange: '16TH AUG 8 PM TO 17TH AUG 8 PM' },
  9: { title: 'BICENTENNIAL MONUMENT 9', timeRange: '17TH AUG 8 PM TO 18TH AUG 8 PM' },
  10: { title: 'BICENTENNIAL MONUMENT 10', timeRange: '18TH AUG 8 PM TO 19TH AUG 8 PM' },
  11: { title: 'BICENTENNIAL MONUMENT 11', timeRange: '19TH AUG 8 PM TO 20TH AUG 8 PM' },
  12: { title: 'BICENTENNIAL MONUMENT 12', timeRange: '20TH AUG 8 PM TO 21ST AUG 8 PM' },
  13: { title: 'BICENTENNIAL MONUMENT 13', timeRange: '21ST AUG 8 PM TO 22ND AUG 8 PM' },
  14: { title: 'BICENTENNIAL MONUMENT 14', timeRange: '22ND AUG 8 PM TO 23RD AUG 8 PM' },
  15: { title: 'BICENTENNIAL MONUMENT 15', timeRange: '23RD AUG 8 PM TO 24TH AUG 8 PM' },
  16: { title: 'BICENTENNIAL MONUMENT 16', timeRange: '24TH AUG 8 PM TO 25TH AUG 8 PM' },
  17: { title: 'BICENTENNIAL MONUMENT 17', timeRange: '25TH AUG 8 PM TO 26TH AUG 8 PM' },
  18: { title: 'BICENTENNIAL MONUMENT 18', timeRange: '26TH AUG 8 PM TO 27TH AUG 8 PM' },
  19: { title: 'BICENTENNIAL MONUMENT 19', timeRange: '27TH AUG 8 PM TO 28TH AUG 8 PM' },
  20: { title: 'BICENTENNIAL MONUMENT 20', timeRange: '28TH AUG 8 PM TO 29TH AUG 8 PM' },
};

export interface PlayerRecording {
  streamId: string;
  playerName: string;
  playerUsername?: string;
  playerTeamName?: string;
  status: 'LIVE' | 'ARCHIVED' | 'READY' | 'CREATED';
  isLive: boolean;
  hasReplay: boolean;
  videoUrl: string | null;
  youtubeVideoId: string | null;
  replayReason: string | null;
  expiresAt: string | null;
  recordedAt: string | null;
}

export interface ScheduledMatchItem {
  matchId: string;
  dayNumber: number;
  team1Name: string;
  team2Name: string;
  score1: number;
  score2: number;
  status: string; // 'LIVE' | 'COMPLETED' | 'SCHEDULED' | 'READY'
  scheduledTime: string | null;
  tableNumber: number;
  playerRecordings: PlayerRecording[];
}

export default function VideosClient({
  initialMatches = [],
  initialStreams = [],
}: {
  initialMatches: any[];
  initialStreams: any[];
}) {
  const [selectedDay, setSelectedDay] = React.useState<number | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | 'LIVE' | 'RECORDED' | 'SCHEDULED'>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [copiedMatchId, setCopiedMatchId] = React.useState<string | null>(null);

  // Group DB matches and associate player recordings
  const scheduledMatches: ScheduledMatchItem[] = React.useMemo(() => {
    const matchMap = new Map<string, ScheduledMatchItem>();

    // 1. Process all matches that exist in the database
    initialMatches.forEach((m: any) => {
      let dayNumber = 1;
      const monMatch = m.id.match(/monument_(\d+)/i);
      if (monMatch) {
        dayNumber = parseInt(monMatch[1], 10);
      } else if (m.round) {
        dayNumber = m.round;
      }

      const t1Name = m.team1?.name || 'Team 1';
      const t2Name = m.team2?.name || 'Team 2';

      // Find all live stream recordings for this match
      const matchStreams: any[] = [];
      if (Array.isArray(m.liveStreams) && m.liveStreams.length > 0) {
        matchStreams.push(...m.liveStreams);
      }
      initialStreams.forEach((s: any) => {
        if (s.matchId === m.id && !matchStreams.some((ms) => ms.id === s.id)) {
          matchStreams.push(s);
        }
      });

      const playerRecordings: PlayerRecording[] = matchStreams.map((s: any) => {
        const isLive = s.status === 'LIVE';
        const rawVideoUrl = s.youtubeUrl || s.youtubeEmbedUrl || null;
        const isDirectVideo = !!rawVideoUrl && !rawVideoUrl.includes('cbot_yt_') && (rawVideoUrl.startsWith('http') || rawVideoUrl.startsWith('blob:') || rawVideoUrl.startsWith('/'));
        const hasReplay = isDirectVideo || (!!s.youtubeVideoId && !s.youtubeVideoId.startsWith('cbot_yt_')) || s.status === 'ARCHIVED';

        const replayReason = s.failureReason?.startsWith('REPLAY_REASON:')
          ? s.failureReason.replace('REPLAY_REASON:', '').trim()
          : null;

        return {
          streamId: s.id,
          playerName: s.player?.name || s.player?.username || 'Verified Player',
          playerUsername: s.player?.username,
          playerTeamName: s.team?.name,
          status: s.status as any,
          isLive,
          hasReplay,
          videoUrl: isDirectVideo ? rawVideoUrl : null,
          youtubeVideoId: s.youtubeVideoId || null,
          replayReason,
          expiresAt: s.expiresAt || null,
          recordedAt: s.recordedAt || s.createdAt || null,
        };
      });

      const hasLiveStream = playerRecordings.some((r) => r.isLive);
      const hasCompletedStream = playerRecordings.some((r) => r.hasReplay);

      const effectiveStatus = hasLiveStream
        ? 'LIVE'
        : m.status === 'COMPLETED' || hasCompletedStream
        ? 'COMPLETED'
        : m.status || 'SCHEDULED';

      matchMap.set(m.id, {
        matchId: m.id,
        dayNumber,
        team1Name: t1Name,
        team2Name: t2Name,
        score1: m.score1 || 0,
        score2: m.score2 || 0,
        status: effectiveStatus,
        scheduledTime: m.scheduledTime ? new Date(m.scheduledTime).toISOString() : null,
        tableNumber: m.tableNumber || 1,
        playerRecordings,
      });
    });

    // 2. Also process any standalone streams that might belong to matches
    initialStreams.forEach((s: any) => {
      if (!matchMap.has(s.matchId)) {
        let dayNumber = 1;
        const monMatch = s.matchId.match(/monument_(\d+)/i);
        if (monMatch) dayNumber = parseInt(monMatch[1], 10);

        const isLive = s.status === 'LIVE';
        const rawVideoUrl = s.youtubeUrl || s.youtubeEmbedUrl || null;
        const isDirectVideo = !!rawVideoUrl && !rawVideoUrl.includes('cbot_yt_') && (rawVideoUrl.startsWith('http') || rawVideoUrl.startsWith('blob:') || rawVideoUrl.startsWith('/'));
        const hasReplay = isDirectVideo || (!!s.youtubeVideoId && !s.youtubeVideoId.startsWith('cbot_yt_')) || s.status === 'ARCHIVED';

        const replayReason = s.failureReason?.startsWith('REPLAY_REASON:')
          ? s.failureReason.replace('REPLAY_REASON:', '').trim()
          : null;

        const recording: PlayerRecording = {
          streamId: s.id,
          playerName: s.player?.name || s.player?.username || 'Verified Player',
          playerUsername: s.player?.username,
          playerTeamName: s.team?.name,
          status: s.status as any,
          isLive,
          hasReplay,
          videoUrl: isDirectVideo ? rawVideoUrl : null,
          youtubeVideoId: s.youtubeVideoId || null,
          replayReason,
          expiresAt: s.expiresAt || null,
          recordedAt: s.recordedAt || s.createdAt || null,
        };

        matchMap.set(s.matchId, {
          matchId: s.matchId,
          dayNumber,
          team1Name: s.match?.team1?.name || s.team?.name || 'Team 1',
          team2Name: s.match?.team2?.name || 'Opponent',
          score1: s.match?.score1 || 0,
          score2: s.match?.score2 || 0,
          status: isLive ? 'LIVE' : hasReplay ? 'COMPLETED' : 'SCHEDULED',
          scheduledTime: null,
          tableNumber: 1,
          playerRecordings: [recording],
        });
      }
    });

    return Array.from(matchMap.values()).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [initialMatches, initialStreams]);

  // Extract ONLY the unique days that actually have scheduled matches in DB
  const availableScheduledDays = React.useMemo(() => {
    const daysSet = new Set<number>();
    scheduledMatches.forEach((m) => daysSet.add(m.dayNumber));
    return Array.from(daysSet).sort((a, b) => a - b);
  }, [scheduledMatches]);

  // Real Database Counts
  const totalMatchesCount = scheduledMatches.length;
  const totalLiveCount = scheduledMatches.filter((m) => m.status === 'LIVE' || m.playerRecordings.some((r) => r.isLive)).length;
  const totalSavedVideosCount = scheduledMatches.reduce((acc, m) => acc + m.playerRecordings.filter((r) => r.hasReplay && !r.isLive).length, 0);

  // Filtered List
  const filteredMatches = React.useMemo(() => {
    return scheduledMatches.filter((m) => {
      const matchDay = selectedDay === 'ALL' || m.dayNumber === selectedDay;
      const isMatchLive = m.status === 'LIVE' || m.playerRecordings.some((r) => r.isLive);
      const isMatchRecorded = m.playerRecordings.some((r) => r.hasReplay && !r.isLive) || m.status === 'COMPLETED';

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'LIVE' && isMatchLive) ||
        (statusFilter === 'RECORDED' && isMatchRecorded) ||
        (statusFilter === 'SCHEDULED' && !isMatchLive && !isMatchRecorded);

      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        m.matchId.toLowerCase().includes(q) ||
        m.team1Name.toLowerCase().includes(q) ||
        m.team2Name.toLowerCase().includes(q) ||
        m.playerRecordings.some(
          (r) =>
            r.playerName.toLowerCase().includes(q) ||
            (r.playerUsername && r.playerUsername.toLowerCase().includes(q)) ||
            (r.playerTeamName && r.playerTeamName.toLowerCase().includes(q))
        );

      return matchDay && matchStatus && matchQuery;
    });
  }, [scheduledMatches, selectedDay, statusFilter, searchQuery]);

  // Group filtered matches strictly by scheduled Day Number
  const groupedByDay = React.useMemo(() => {
    const map = new Map<number, ScheduledMatchItem[]>();
    filteredMatches.forEach((m) => {
      const list = map.get(m.dayNumber) || [];
      list.push(m);
      map.set(m.dayNumber, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filteredMatches]);

  const handleCopyLink = (matchId: string) => {
    const url = `${window.location.origin}/matches/${matchId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedMatchId(matchId);
      setTimeout(() => setCopiedMatchId(null), 2500);
    });
  };

  const handleWhatsAppShare = (match: ScheduledMatchItem, player?: PlayerRecording) => {
    const arenaUrl = `${window.location.origin}/matches/${match.matchId}`;
    const pInfo = player?.playerName ? ` (Recorded by ${player.playerName})` : '';
    const text = player?.isLive || match.status === 'LIVE'
      ? `🔴 WATCH LIVE on CBOT Arena: Day ${match.dayNumber} - ${match.team1Name} vs ${match.team2Name}${pInfo}! ${arenaUrl}`
      : `🎬 WATCH MATCH REPLAY: Day ${match.dayNumber} - ${match.team1Name} vs ${match.team2Name}${pInfo} on CBOT Arena! ${arenaUrl}`;
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
              {totalLiveCount > 0 && (
                <Badge className="bg-rose-600 text-white font-black text-xs px-3 py-1 gap-1.5 animate-pulse shadow-lg shadow-rose-600/40">
                  <Radio className="h-3.5 w-3.5" /> 🔴 {totalLiveCount} MATCH{totalLiveCount > 1 ? 'ES' : ''} LIVE NOW
                </Badge>
              )}
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Live Broadcasts &amp; Match Replays
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-2xl leading-relaxed">
              Watch official carrom match recordings and live broadcasts recorded by each player daily. Stream live games, replay recorded matches, or save full recordings locally.
            </p>
          </div>

          {/* Actual Real Stats Pills */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/30 text-center shadow-lg min-w-[100px]">
              <div className="text-2xl font-black text-amber-400">{totalMatchesCount}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Scheduled Matches</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 text-center shadow-lg min-w-[100px]">
              <div className="text-2xl font-black text-emerald-400">{totalSavedVideosCount}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Saved Videos</div>
            </div>
          </div>
        </div>

        {/* Live Ticker Alert */}
        {totalLiveCount > 0 && (
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
              placeholder="Search by player name, team, or match ID..."
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
              All Matches ({totalMatchesCount})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'LIVE' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('LIVE')}
              className={`text-xs font-bold h-8 px-3 rounded-xl gap-1.5 ${
                statusFilter === 'LIVE' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'border-rose-500/40 text-rose-400'
              }`}
            >
              <Radio className="h-3 w-3" /> Live ({totalLiveCount})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'RECORDED' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('RECORDED')}
              className={`text-xs font-bold h-8 px-3 rounded-xl gap-1.5 ${
                statusFilter === 'RECORDED' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border-emerald-500/40 text-emerald-400'
              }`}
            >
              <Video className="h-3 w-3" /> Replays ({totalSavedVideosCount})
            </Button>
          </div>
        </div>

        {/* Dynamic Day Selector: ONLY shows days that have actual scheduled matches in DB */}
        <div className="space-y-1.5 pt-2 border-t border-white/10">
          <div className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Scheduled Tournament Days ({availableScheduledDays.length}):
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <Button
              size="sm"
              variant={selectedDay === 'ALL' ? 'carrom' : 'ghost'}
              onClick={() => setSelectedDay('ALL')}
              className="h-7 px-3 text-xs font-black rounded-lg shrink-0"
            >
              All Scheduled Days ({availableScheduledDays.length})
            </Button>
            {availableScheduledDays.map((dayNum) => (
              <Button
                key={dayNum}
                size="sm"
                variant={selectedDay === dayNum ? 'carrom' : 'ghost'}
                onClick={() => setSelectedDay(dayNum)}
                className="h-7 px-3 text-xs font-extrabold rounded-lg shrink-0"
              >
                Day {dayNum}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Day-Wise Video Matches List */}
      {groupedByDay.length === 0 ? (
        <div className="text-center py-16 space-y-4 bg-slate-900/50 rounded-3xl border border-white/10 p-8">
          <AlertCircle className="h-12 w-12 text-slate-500 mx-auto" />
          <h3 className="text-lg font-bold text-white">No scheduled matches found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            No matches matched your selected filter. Try clearing your search query or selecting "All Scheduled Days".
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
            const scheduleInfo = DAY_SCHEDULE_TITLES[dayNum] || {
              title: `BICENTENNIAL MONUMENT ${dayNum}`,
              timeRange: `DAY ${dayNum} MATCHES`,
            };

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
                        {scheduleInfo.title}
                      </h2>
                      <p className="text-[11px] font-mono text-amber-400/80">
                        {scheduleInfo.timeRange}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-slate-400 border-white/10 text-xs font-mono self-start sm:self-auto">
                    {matches.length} Scheduled Match{matches.length > 1 ? 'es' : ''}
                  </Badge>
                </div>

                {/* Match Cards Grid for this Day */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

                    const isMatchLive = m.status === 'LIVE' || m.playerRecordings.some((r) => r.isLive);
                    const matchUrl = `/matches/${m.matchId}`;

                    return (
                      <Card
                        key={m.matchId}
                        className={`p-5 rounded-3xl bg-slate-900/90 border transition-all space-y-4 shadow-xl hover:border-amber-500/50 ${
                          isMatchLive ? 'border-rose-500/60 ring-2 ring-rose-500/30' : 'border-white/10'
                        }`}
                      >
                        {/* Top Card Header: Match ID + Table + Status */}
                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[11px] font-bold text-slate-400 border-white/10">
                              #{m.matchId}
                            </Badge>
                            <span className="text-[11px] font-bold text-slate-400">
                              Table #{m.tableNumber}
                            </span>
                          </div>

                          {/* Match Status Badge */}
                          {isMatchLive ? (
                            <Badge className="bg-rose-600 text-white font-black text-xs px-2.5 py-1 gap-1.5 animate-pulse shadow-lg shadow-rose-600/40">
                              <Radio className="h-3 w-3" /> 🔴 LIVE NOW
                            </Badge>
                          ) : m.status === 'COMPLETED' ? (
                            <Badge className="bg-emerald-600/90 text-white font-black text-xs px-2.5 py-1 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> 🎬 MATCH COMPLETED
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

                          {/* Center VS Badge */}
                          <div className="flex flex-col items-center justify-center">
                            <span className="px-3 py-1 rounded-full bg-slate-950 border border-white/15 text-xs font-black uppercase tracking-wider text-amber-400 shadow-md">
                              VS
                            </span>
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

                        {/* PLAYER RECORDINGS SECTION: Clearly highlights each player's video */}
                        <div className="pt-2 border-t border-white/10 space-y-2.5">
                          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400">
                            <span className="flex items-center gap-1.5 text-amber-400">
                              <User className="h-3.5 w-3.5" /> Player Video Recordings ({m.playerRecordings.length})
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">Daily Match Studio</span>
                          </div>

                          {m.playerRecordings.length === 0 ? (
                            <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/5 text-center space-y-1">
                              <p className="text-xs text-slate-400 font-medium">
                                No player recording started yet for this match.
                              </p>
                              <span className="text-[10.5px] text-slate-500">
                                Assigned players will broadcast and record their match feed live.
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {m.playerRecordings.map((rec) => (
                                <div
                                  key={rec.streamId}
                                  className="p-3 rounded-2xl bg-slate-950/90 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner"
                                >
                                  {/* Player Identity & Badge */}
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-black text-amber-300 flex items-center gap-1">
                                        👤 {rec.playerName}
                                      </span>
                                      {rec.playerTeamName && (
                                        <Badge variant="outline" className="text-[10px] text-slate-300 border-white/20 py-0 px-2">
                                          {rec.playerTeamName}
                                        </Badge>
                                      )}
                                      {rec.isLive ? (
                                        <Badge className="bg-rose-600 text-white font-black text-[10px] px-2 py-0.5 gap-1 animate-pulse">
                                          <Radio className="h-2.5 w-2.5" /> LIVE NOW
                                        </Badge>
                                      ) : rec.hasReplay ? (
                                        <Badge className="bg-emerald-600 text-white font-black text-[10px] px-2 py-0.5 gap-1">
                                          <CheckCircle2 className="h-2.5 w-2.5" /> REPLAY READY
                                        </Badge>
                                      ) : null}
                                    </div>

                                    {/* Verification Reason (if player restreamed) */}
                                    {rec.replayReason && (
                                      <p className="text-[10.5px] text-amber-400/90 italic">
                                        "{rec.replayReason}"
                                      </p>
                                    )}

                                    {/* 72h Retention Expiry */}
                                    {rec.expiresAt && (
                                      <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                                        <Clock className="h-2.5 w-2.5 text-amber-400" />
                                        <span>Expires: {new Date(rec.expiresAt).toLocaleDateString()}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Actions for this Player's Recording */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Link href={matchUrl} className="flex-1 sm:flex-initial">
                                      <Button
                                        size="sm"
                                        className={`h-8 px-3 text-xs font-black rounded-xl gap-1 shadow-md ${
                                          rec.isLive
                                            ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                                            : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                                        }`}
                                      >
                                        {rec.isLive ? <Radio className="h-3 w-3" /> : <Play className="h-3 w-3 fill-slate-950" />}
                                        <span>{rec.isLive ? 'Watch Live' : 'Watch Video'}</span>
                                      </Button>
                                    </Link>

                                    {rec.videoUrl && (
                                      <a
                                        href={rec.videoUrl}
                                        download={`cbot_${rec.playerName.replace(/\s+/g, '_')}_${m.matchId}.webm`}
                                        className="h-8 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1 border border-white/10 shadow-sm"
                                        title="Download Player Video (.webm)"
                                      >
                                        <Download className="h-3.5 w-3.5 text-emerald-400" />
                                        <span className="hidden sm:inline">Save</span>
                                      </a>
                                    )}

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleWhatsAppShare(m, rec)}
                                      className="h-8 px-2 text-xs font-bold rounded-xl border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                                      title="Share Player Recording on WhatsApp"
                                    >
                                      <MessageCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Card Footer: Global Match Actions */}
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                          <Link href={matchUrl} className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1">
                            <span>Open Match Arena Studio</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyLink(m.matchId)}
                            className="h-7 px-2 text-xs font-bold text-slate-400 hover:text-white gap-1"
                            title="Copy Match Link"
                          >
                            {copiedMatchId === m.matchId ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            <span>{copiedMatchId === m.matchId ? 'Copied' : 'Share Link'}</span>
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
