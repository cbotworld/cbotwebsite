import * as React from 'react';
import { getMatchLiveStreamAction } from '@/lib/actions/youtubeActions';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Radio, Trophy, ShieldCheck, Clock, Lock, CheckCircle2, Video, Download, ArrowLeft, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import MatchShareCard from '@/components/stream/MatchShareCard';
import WebRTCLiveViewer from '@/components/stream/WebRTCLiveViewer';

interface MatchPageProps {
  params: Promise<{ id: string }>;
}

export default async function PublicMatchPage({ params }: MatchPageProps) {
  const resolvedParams = await params;
  const matchId = resolvedParams.id;

  // 1. Fetch match data from Prisma
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      edition: true,
      team1: true,
      team2: true,
      winner: true,
    }
  });

  // 2. Fetch live stream data for this match
  const streamResult = await getMatchLiveStreamAction(matchId);
  const stream = streamResult.stream;
  const isExpired = streamResult.isExpired || stream?.status === 'EXPIRED';

  const team1Name = match?.team1?.name || 'Team 1';
  const team2Name = match?.team2?.name || 'Team 2';
  const editionTitle = match?.edition?.title || 'Edition #200';
  const matchTitle = `${editionTitle} - ${team1Name} vs ${team2Name} (${matchId})`;

  const rawVideoUrl = stream?.youtubeUrl || stream?.youtubeEmbedUrl;
  const isYouTubeVideo = !!stream?.youtubeVideoId && !stream.youtubeVideoId.startsWith('cbot_yt_');
  const isDirectVideo = !!rawVideoUrl && (rawVideoUrl.startsWith('http') || rawVideoUrl.startsWith('blob:') || rawVideoUrl.startsWith('/')) && !rawVideoUrl.includes('cbot_yt_');
  const videoUrl = isDirectVideo ? rawVideoUrl : null;
  const hasReplay = isYouTubeVideo || isDirectVideo;
  const replayReason = stream?.failureReason?.startsWith('REPLAY_REASON:') 
    ? stream.failureReason.replace('REPLAY_REASON:', '').trim() 
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <Link href="/edition-200-videos">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-bold rounded-xl border-white/15 hover:bg-white/5">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="carrom" className="text-xs font-black">{editionTitle}</Badge>
            {stream?.status === 'LIVE' ? (
              <Badge className="bg-rose-600 text-white font-black text-xs px-3 py-1 gap-1.5 animate-pulse">
                <Radio className="h-3 w-3" /> 🔴 LIVE NOW
              </Badge>
            ) : stream?.status === 'ARCHIVED' || match?.status === 'COMPLETED' ? (
              <Badge className="bg-emerald-600 text-white font-black text-xs px-3 py-1 gap-1.5">
                <CheckCircle2 className="h-3 w-3" /> MATCH COMPLETED
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-400 border-amber-500/40 text-xs font-bold">
                SCHEDULED MATCH
              </Badge>
            )}
          </div>
        </div>

        {/* Match Header Scoreboard Card */}
        <div className="rounded-3xl bg-slate-900/90 border border-amber-500/30 p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden grid grid-cols-3 items-center gap-4">
          
          {/* Team 1 */}
          <div className="space-y-2">
            <div className="h-16 w-16 rounded-2xl bg-slate-900 border-2 border-amber-500/40 p-1 mx-auto flex items-center justify-center shadow-lg">
              <img src={match?.team1?.logo || '/logo.png'} alt={team1Name} className="h-full w-full object-contain" />
            </div>
            <h2 className="text-sm sm:text-base font-black text-amber-400 leading-tight">{team1Name}</h2>
          </div>

          {/* Center VS & Details */}
          <div className="space-y-2">
            <div className="text-xs font-black uppercase tracking-widest text-slate-400">Match ID: {matchId}</div>
            <div className="text-2xl sm:text-3xl font-black text-slate-500 font-mono">VS</div>
            {match?.tableNumber && (
              <Badge variant="outline" className="border-amber-500/30 text-amber-300/80 text-[11px] font-bold">
                Table #{match.tableNumber}
              </Badge>
            )}
            {match?.winnerId && (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-400 text-xs font-black">
                <Trophy className="h-3.5 w-3.5" /> Winner: {match.winnerId === match.team1Id ? team1Name : team2Name}
              </div>
            )}
          </div>

          {/* Team 2 */}
          <div className="space-y-2">
            <div className="h-16 w-16 rounded-2xl bg-slate-900 border-2 border-amber-500/40 p-1 mx-auto flex items-center justify-center shadow-lg">
              <img src={match?.team2?.logo || '/logo.png'} alt={team2Name} className="h-full w-full object-contain" />
            </div>
            <h2 className="text-sm sm:text-base font-black text-emerald-400 leading-tight">{team2Name}</h2>
          </div>

        </div>

        {/* Replay / Rematch Reason Comment Box */}
        {replayReason && (
          <div className="flex items-start gap-3.5 p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-200 shadow-xl">
            <div className="h-9 w-9 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400 mt-0.5 shadow-md">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">Player Rematch / Replay Reason:</span>
                <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-500/40 py-0 px-2 font-mono">Verified Reason</Badge>
              </div>
              <p className="text-xs sm:text-sm text-white italic leading-relaxed font-medium">
                "{replayReason}"
              </p>
            </div>
          </div>
        )}

        {/* Video Player Display Container */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Video className="h-4 w-4" /> CBOT Arena Match Video
            </h3>
            {stream?.expiresAt && !isExpired && (
              <span className="text-[11px] font-mono text-amber-400/90 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span>72h Retention: Available until {new Date(stream.expiresAt).toLocaleDateString()} {new Date(stream.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST</span>
              </span>
            )}
          </div>

          {/* Video / Status Logic */}
          {stream?.status === 'LIVE' ? (
            /* Native Real-Time In-Browser Live Video Stream for Spectators */
            <WebRTCLiveViewer
              matchId={matchId}
              player1Name={team1Name}
              player2Name={team2Name}
              team1Name={team1Name}
              team2Name={team2Name}
            />
          ) : (stream?.status === 'ARCHIVED' || match?.status === 'COMPLETED') && !isExpired ? (
            /* ARCHIVED / COMPLETED MATCH */
            hasReplay ? (
              /* Native High-Performance HTML5 Video Player or YouTube Archive */
              <div className="space-y-3">
                <div className="relative rounded-3xl overflow-hidden border-2 border-amber-500/40 bg-slate-950 aspect-video shadow-2xl flex items-center justify-center">
                  {isYouTubeVideo ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${stream?.youtubeVideoId}?autoplay=1`}
                      title="CBOT Match Replay"
                      className="w-full h-full border-none"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={videoUrl || ''}
                      controls
                      autoPlay
                      playsInline
                      preload="auto"
                      className="h-full w-full object-contain bg-black"
                    >
                      {videoUrl && <source src={videoUrl} type="video/webm" />}
                      {videoUrl && <source src={videoUrl} type="video/mp4" />}
                      Your browser does not support native video playback. Please use the download button below to watch this match recording.
                    </video>
                  )}
                </div>
                {/* Audience Local Save / Download Box */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg">
                  <div className="space-y-0.5 text-center sm:text-left">
                    <div className="text-xs font-black text-white flex items-center justify-center sm:justify-start gap-1.5">
                      <span>💾 Save Match Video Locally</span>
                      <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/40">Free Download</Badge>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Download this match recording to keep on your device for future reference before the 72-hour retention period ends.
                    </p>
                  </div>
                  {videoUrl && (
                    <a
                      href={videoUrl}
                      download={`cbot_match_${matchId}.webm`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black transition-all shadow-lg shadow-amber-500/25 shrink-0 hover:scale-[1.02]"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Match Video (.webm)</span>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              /* Match Completed / Saved Notice with Video Refresh */
              <div className="rounded-3xl border-2 border-emerald-500/40 bg-slate-950 p-10 text-center space-y-4 shadow-2xl aspect-video flex flex-col items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-extrabold text-white uppercase tracking-wide">🎉 MATCH COMPLETED &amp; SCORES SAVED</h4>
                  <p className="text-xs text-slate-300 max-w-lg mx-auto leading-relaxed">
                    This match broadcast has concluded and official scores are locked in CBOT Arena.
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-3">
                  <a
                    href={`/matches/${matchId}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition-all shadow-md"
                  >
                    <span>🔄 Refresh Video Player</span>
                  </a>
                  <Link
                    href="/edition-200-videos"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all border border-white/10"
                  >
                    <span>🎬 All Match Videos</span>
                  </Link>
                </div>
              </div>
            )
          ) : (
            /* Scheduled State */
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-12 text-center space-y-3">
              <Clock className="h-10 w-10 text-amber-400 mx-auto opacity-80" />
              <h4 className="text-base font-bold text-white uppercase">Match Scheduled</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                This match has not started yet. When the player begins broadcasting, the live camera feed and scoring overlays will appear here automatically.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
