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
  Users,
  Shield,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DEFAULT_WEBSITE_CMS } from '@/lib/website-cms';

export const TEAMS_DATA: Record<string, {
  name: string;
  tag: string;
  captain: string;
  logo: string;
  color: string;
  border: string;
  bg: string;
}> = {
  'BORIC SPEEDSTERS': {
    name: 'Boric Speedsters',
    tag: 'BS',
    captain: 'BALU',
    logo: '/api/storage/teams/boric-speedsters.jpeg',
    color: 'text-cyan-400',
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-500/10',
  },
  'EBONY OVERLORDS': {
    name: 'Ebony Overlords',
    tag: 'EO',
    captain: 'LALIT',
    logo: '/api/storage/teams/ebony-overlords.jpeg',
    color: 'text-purple-400',
    border: 'border-purple-500/40',
    bg: 'bg-purple-500/10',
  },
  'PLYWOOD PIONEERS': {
    name: 'Plywood Pioneers',
    tag: 'PP',
    captain: 'ABHIJIT',
    logo: '/api/storage/teams/plywood-pioneers.jpeg',
    color: 'text-amber-400',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
  },
  'SUPERNOVA QUEEN': {
    name: 'Supernova Queen',
    tag: 'SQ',
    captain: 'MOKSHA P',
    logo: '/api/storage/teams/supernova-queen.jpeg',
    color: 'text-pink-400',
    border: 'border-pink-500/40',
    bg: 'bg-pink-500/10',
  },
  'POCKET DYNAMOS': {
    name: 'Pocket Dynamos',
    tag: 'PD',
    captain: 'KIRAN BHAT',
    logo: '/api/storage/teams/pocket-dynamos.jpeg',
    color: 'text-sky-400',
    border: 'border-sky-500/40',
    bg: 'bg-sky-500/10',
  },
  'VANILLA FALCONS': {
    name: 'Vanilla Falcons',
    tag: 'VF',
    captain: 'VAIBHAV JOIL',
    logo: '/api/storage/teams/vanilla-falcons.jpeg',
    color: 'text-emerald-400',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
  },
  'VINTAGE STRIKERS': {
    name: 'Vintage Strikers',
    tag: 'VS',
    captain: 'SHYAM SUNDAR',
    logo: '/api/storage/teams/vintage-strikers.jpeg',
    color: 'text-orange-400',
    border: 'border-orange-500/40',
    bg: 'bg-orange-500/10',
  },
  'LUMEN PILLAR': {
    name: 'Lumen Pillar',
    tag: 'LP',
    captain: 'GURMIT SINGH',
    logo: '/api/storage/teams/lumen-pillar.jpeg',
    color: 'text-yellow-400',
    border: 'border-yellow-500/40',
    bg: 'bg-yellow-500/10',
  },
};

export interface CleanPlayerVideo {
  streamId: string;
  matchId: string;
  dayNumber: number;
  playerName: string;
  playerUsername?: string;
  playerAvatar?: string;
  teamKey: string;
  teamName: string;
  teamTag: string;
  teamLogo: string;
  teamColor: string;
  status: 'LIVE' | 'ARCHIVED' | 'READY' | 'CREATED';
  isLive: boolean;
  hasReplay: boolean;
  videoUrl: string | null;
  youtubeVideoId: string | null;
  replayReason: string | null;
  recordedAt: string | null;
  expiresAt: string | null;
}

export default function VideosClient({
  initialMatches = [],
  initialStreams = [],
  badgeText = DEFAULT_WEBSITE_CMS.pages.videos.badge,
}: {
  initialMatches: any[];
  initialStreams: any[];
  badgeText?: string;
}) {
  const [selectedDay, setSelectedDay] = React.useState<number | 'ALL'>('ALL');
  const [selectedTeam, setSelectedTeam] = React.useState<string | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | 'LIVE' | 'RECORDED'>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [copiedStreamId, setCopiedStreamId] = React.useState<string | null>(null);

  // Compile all player recordings across streams and matches
  const playerVideos: CleanPlayerVideo[] = React.useMemo(() => {
    const list: CleanPlayerVideo[] = [];
    const seenIds = new Set<string>();

    const allStreamObjects: any[] = [...initialStreams];

    initialMatches.forEach((m: any) => {
      if (Array.isArray(m.liveStreams)) {
        m.liveStreams.forEach((ls: any) => {
          if (!allStreamObjects.some((s) => s.id === ls.id)) {
            allStreamObjects.push(ls);
          }
        });
      }
    });

    allStreamObjects.forEach((s: any) => {
      if (seenIds.has(s.id)) return;
      seenIds.add(s.id);

      // Extract day number
      let dayNumber = 1;
      const matchId = s.matchId || s.match?.id || '';
      const monMatch = matchId.match(/monument_(\d+)/i);
      if (monMatch) {
        dayNumber = parseInt(monMatch[1], 10);
      } else if (s.match?.round) {
        dayNumber = s.match.round;
      }

      // Determine Player details
      const playerName = s.player?.name || s.player?.username || 'Verified Player';
      const playerUsername = s.player?.username;
      const playerAvatar = s.player?.image;

      // Determine Team details
      let teamKey = '';
      if (s.team?.name) {
        teamKey = s.team.name.toUpperCase();
      } else if (s.match?.team1?.name) {
        teamKey = s.match.team1.name.toUpperCase();
      }

      // Check if matchId contains team name (e.g. monument_7_BORIC_SPEEDSTERS)
      if (!teamKey && matchId) {
        for (const k of Object.keys(TEAMS_DATA)) {
          const cleanK = k.replace(/\s+/g, '_');
          if (matchId.toUpperCase().includes(cleanK)) {
            teamKey = k;
            break;
          }
        }
      }

      const teamInfo = TEAMS_DATA[teamKey] || {
        name: s.team?.name || 'CBOT Team',
        tag: s.team?.tag || 'CBOT',
        captain: '',
        logo: s.team?.logo || '/logo.png',
        color: 'text-amber-400',
        border: 'border-white/15',
        bg: 'bg-slate-900',
      };

      const isLive = s.status === 'LIVE';
      const rawVideoUrl = s.youtubeUrl || s.youtubeEmbedUrl || null;
      const isDirectVideo = !!rawVideoUrl && !rawVideoUrl.includes('cbot_yt_') && (rawVideoUrl.startsWith('http') || rawVideoUrl.startsWith('blob:') || rawVideoUrl.startsWith('/'));
      const hasReplay = isDirectVideo || (!!s.youtubeVideoId && !s.youtubeVideoId.startsWith('cbot_yt_')) || s.status === 'ARCHIVED';

      // STRICT REQUIREMENT: If there is no active live stream and no recording, do not show here!
      if (!isLive && !hasReplay) {
        return;
      }

      const replayReason = s.failureReason?.startsWith('REPLAY_REASON:')
        ? s.failureReason.replace('REPLAY_REASON:', '').trim()
        : null;

      list.push({
        streamId: s.id,
        matchId,
        dayNumber,
        playerName,
        playerUsername,
        playerAvatar,
        teamKey: teamKey || 'CBOT',
        teamName: teamInfo.name,
        teamTag: teamInfo.tag,
        teamLogo: teamInfo.logo,
        teamColor: teamInfo.color,
        status: s.status as any,
        isLive,
        hasReplay,
        videoUrl: isDirectVideo ? rawVideoUrl : null,
        youtubeVideoId: s.youtubeVideoId || null,
        replayReason,
        recordedAt: s.recordedAt || s.createdAt || null,
        expiresAt: s.expiresAt || null,
      });
    });

    return list.sort((a, b) => {
      // Live first, then newest recorded
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return b.dayNumber - a.dayNumber;
    });
  }, [initialMatches, initialStreams]);

  // Statistics
  const liveCount = playerVideos.filter((v) => v.isLive).length;
  const recordedCount = playerVideos.filter((v) => v.hasReplay && !v.isLive).length;

  // Filtered List
  const filteredVideos = React.useMemo(() => {
    return playerVideos.filter((v) => {
      const matchDay = selectedDay === 'ALL' || v.dayNumber === selectedDay;
      const matchTeam =
        selectedTeam === 'ALL' ||
        v.teamKey.toUpperCase() === selectedTeam.toUpperCase() ||
        v.teamName.toUpperCase().includes(selectedTeam.toUpperCase());

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'LIVE' && v.isLive) ||
        (statusFilter === 'RECORDED' && v.hasReplay && !v.isLive);

      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        v.playerName.toLowerCase().includes(q) ||
        (v.playerUsername && v.playerUsername.toLowerCase().includes(q)) ||
        v.teamName.toLowerCase().includes(q) ||
        v.matchId.toLowerCase().includes(q);

      return matchDay && matchTeam && matchStatus && matchQuery;
    });
  }, [playerVideos, selectedDay, selectedTeam, statusFilter, searchQuery]);

  // Group filtered videos Team-Wise
  const groupedByTeam = React.useMemo(() => {
    const map = new Map<string, CleanPlayerVideo[]>();
    filteredVideos.forEach((v) => {
      const key = v.teamName || 'CBOT Players';
      const list = map.get(key) || [];
      list.push(v);
      map.set(key, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredVideos]);

  // Group filtered videos Day-Wise
  const groupedByDay = React.useMemo(() => {
    const map = new Map<number, CleanPlayerVideo[]>();
    filteredVideos.forEach((v) => {
      const list = map.get(v.dayNumber) || [];
      list.push(v);
      map.set(v.dayNumber, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filteredVideos]);

  // Unique Days with recordings
  const recordedDays = React.useMemo(() => {
    const set = new Set<number>();
    playerVideos.forEach((v) => set.add(v.dayNumber));
    return Array.from(set).sort((a, b) => a - b);
  }, [playerVideos]);

  const handleCopyLink = (matchId: string, streamId: string) => {
    const url = `${window.location.origin}/matches/${matchId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedStreamId(streamId);
      setTimeout(() => setCopiedStreamId(null), 2500);
    });
  };

  const handleWhatsAppShare = (v: CleanPlayerVideo) => {
    const arenaUrl = `${window.location.origin}/matches/${v.matchId}`;
    const text = v.isLive
      ? `🔴 WATCH LIVE on CBOT Arena: ${v.playerName} (${v.teamName}) - Day ${v.dayNumber}! ${arenaUrl}`
      : `🎬 WATCH MATCH REPLAY: ${v.playerName} (${v.teamName}) - Day ${v.dayNumber} on CBOT Arena! ${arenaUrl}`;
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
                {badgeText}
              </Badge>
              {liveCount > 0 && (
                <Badge className="bg-rose-600 text-white font-black text-xs px-3 py-1 gap-1.5 animate-pulse shadow-lg shadow-rose-600/40">
                  <Radio className="h-3.5 w-3.5" /> 🔴 {liveCount} PLAYER{liveCount > 1 ? 'S' : ''} LIVE NOW
                </Badge>
              )}
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Player Match Videos &amp; Broadcasts
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-2xl leading-relaxed">
              Watch official carrom match recordings and live broadcasts recorded by each player daily. Filter by team or tournament day to stream live games or download recorded videos.
            </p>
          </div>

          {/* Quick Stats Pills */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-rose-500/30 text-center shadow-lg min-w-[100px]">
              <div className="text-2xl font-black text-rose-400">{liveCount}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Live Streams</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 text-center shadow-lg min-w-[100px]">
              <div className="text-2xl font-black text-emerald-400">{recordedCount}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Match Videos</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-5 border-amber-500/20 bg-slate-900/90 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 w-full md:w-80 shadow-inner">
            <Search className="h-4 w-4 text-amber-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by player name or team..."
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
              All Videos ({playerVideos.length})
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
              <Video className="h-3 w-3" /> Recorded Replays ({recordedCount})
            </Button>
          </div>
        </div>

        {/* 1. Team Selector Filter Bar (Only teams with active live or recorded videos) */}
        {groupedByTeam.length > 1 && (
          <div className="space-y-1.5 pt-3 border-t border-white/10">
            <div className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Filter by Team:
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <Button
                size="sm"
                variant={selectedTeam === 'ALL' ? 'carrom' : 'ghost'}
                onClick={() => setSelectedTeam('ALL')}
                className="h-8 px-3.5 text-xs font-black rounded-xl shrink-0"
              >
                All Teams ({groupedByTeam.length})
              </Button>
              {groupedByTeam.map(([tName, tVideos]) => {
                const tInfo = Object.values(TEAMS_DATA).find((t) => t.name === tName);
                return (
                  <button
                    key={tName}
                    onClick={() => setSelectedTeam(selectedTeam === tName ? 'ALL' : tName)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 border ${
                      selectedTeam === tName
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border-white/10'
                    }`}
                  >
                    {tInfo?.logo && <img src={tInfo.logo} alt={tName} className="h-4 w-4 rounded-full object-contain" />}
                    <span>{tName} ({tVideos.length})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Day Selector Filter Bar (Only days with active live or recorded videos) */}
        {recordedDays.length > 1 && (
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <div className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Filter by Tournament Day:
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <Button
                size="sm"
                variant={selectedDay === 'ALL' ? 'carrom' : 'ghost'}
                onClick={() => setSelectedDay('ALL')}
                className="h-7 px-3 text-xs font-black rounded-lg shrink-0"
              >
                All Days ({recordedDays.length})
              </Button>
              {recordedDays.map((dayNum) => (
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
        )}
      </Card>

      {/* Videos List Grouped Team-Wise */}
      {filteredVideos.length === 0 ? (
        <div className="text-center py-16 space-y-4 bg-slate-900/50 rounded-3xl border border-white/10 p-8">
          <Video className="h-12 w-12 text-slate-500 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Match Recordings Available Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            When players start their match broadcasts or complete recordings in the Player Studio, their videos will appear here automatically.
          </p>
          {(selectedDay !== 'ALL' || selectedTeam !== 'ALL' || statusFilter !== 'ALL' || searchQuery) && (
            <Button
              size="sm"
              onClick={() => {
                setSelectedDay('ALL');
                setSelectedTeam('ALL');
                setStatusFilter('ALL');
                setSearchQuery('');
              }}
              variant="outline"
              className="rounded-xl text-xs font-bold"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {groupedByTeam.map(([teamName, videos]) => {
            const teamInfo = Object.values(TEAMS_DATA).find((t) => t.name === teamName) || {
              name: teamName,
              tag: 'CBOT',
              captain: '',
              logo: '/logo.png',
              color: 'text-amber-400',
              border: 'border-white/15',
              bg: 'bg-slate-900',
            };

            return (
              <div key={teamName} className="space-y-4 animate-in fade-in duration-300">
                {/* Team Group Header */}
                <div className="flex items-center justify-between pb-3 border-b-2 border-amber-500/30">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-slate-950 border border-white/10 p-1 flex items-center justify-center shadow-md">
                      <img src={teamInfo.logo} alt={teamInfo.name} className="h-full w-full object-contain rounded-xl" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide flex items-center gap-2">
                        <span>{teamInfo.name}</span>
                        <Badge variant="outline" className="text-[10px] text-slate-400 border-white/10">
                          {teamInfo.tag}
                        </Badge>
                      </h2>
                      {teamInfo.captain && (
                        <p className="text-[11px] font-mono text-amber-400/80">
                          Captain: {teamInfo.captain}
                        </p>
                      )}
                    </div>
                  </div>

                  <Badge variant="outline" className="text-slate-400 border-white/10 text-xs font-mono">
                    {videos.length} Video{videos.length > 1 ? 's' : ''}
                  </Badge>
                </div>

                {/* Player Video Cards Grid for this Team */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {videos.map((v) => {
                    const matchUrl = `/matches/${v.matchId}`;

                    return (
                      <Card
                        key={v.streamId}
                        className={`p-5 rounded-3xl bg-slate-900/90 border transition-all space-y-4 shadow-xl hover:border-amber-500/50 flex flex-col justify-between ${
                          v.isLive ? 'border-rose-500/60 ring-2 ring-rose-500/30' : 'border-white/10'
                        }`}
                      >
                        {/* Top: Day Badge + Status */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <Badge className="bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-0.5 shadow-md">
                              DAY {v.dayNumber}
                            </Badge>

                            {v.isLive ? (
                              <Badge className="bg-rose-600 text-white font-black text-xs px-2.5 py-0.5 gap-1.5 animate-pulse shadow-lg shadow-rose-600/40">
                                <Radio className="h-3 w-3" /> 🔴 LIVE NOW
                              </Badge>
                            ) : v.hasReplay ? (
                              <Badge className="bg-emerald-600/90 text-white font-black text-xs px-2.5 py-0.5 gap-1">
                                <CheckCircle2 className="h-3 w-3" /> 🎬 REPLAY READY
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-400 border-white/20 text-[11px] font-bold">
                                INITIALIZED
                              </Badge>
                            )}
                          </div>

                          {/* Player Identity Block */}
                          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/80 border border-white/5 shadow-inner">
                            <div className="h-12 w-12 rounded-2xl bg-slate-900 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black text-base shrink-0 shadow-md">
                              {v.playerName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-black text-white truncate">
                                {v.playerName}
                              </h3>
                              <p className="text-[11px] text-slate-400 font-medium truncate">
                                {v.teamName}
                              </p>
                              <div className="text-[10px] font-mono text-amber-400/80 truncate">
                                #{v.matchId}
                              </div>
                            </div>
                          </div>

                          {/* Rematch Reason Note (if any) */}
                          {v.replayReason && (
                            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 italic">
                              <span className="font-bold text-amber-400 not-italic">Note: </span>
                              "{v.replayReason}"
                            </div>
                          )}

                          {/* Retention Notice (72 Hours) */}
                          {v.expiresAt && v.hasReplay && (
                            <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-slate-400">
                              <Clock className="h-3 w-3 text-amber-400 shrink-0" />
                              <span>Expires: {new Date(v.expiresAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap mt-2">
                          <Link href={matchUrl} className="flex-1 min-w-[120px]">
                            <Button
                              size="sm"
                              className={`w-full font-black text-xs rounded-xl gap-1.5 shadow-md ${
                                v.isLive
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                                  : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                              }`}
                            >
                              {v.isLive ? <Radio className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-slate-950" />}
                              <span>{v.isLive ? 'Watch Live' : 'Watch Replay'}</span>
                              <ExternalLink className="h-3 w-3 opacity-80" />
                            </Button>
                          </Link>

                          {v.videoUrl && (
                            <a
                              href={v.videoUrl}
                              download={`cbot_${v.playerName.replace(/\s+/g, '_')}_day_${v.dayNumber}.webm`}
                              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors border border-white/10"
                              title="Download Match Video (.webm)"
                            >
                              <Download className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="hidden sm:inline">Save</span>
                            </a>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleWhatsAppShare(v)}
                            className="h-8 px-2.5 text-xs font-bold rounded-xl border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                            title="Share on WhatsApp"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyLink(v.matchId, v.streamId)}
                            className="h-8 px-2.5 text-xs font-bold rounded-xl border-white/20 text-slate-300 hover:text-white"
                            title="Copy Match Link"
                          >
                            {copiedStreamId === v.streamId ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
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
