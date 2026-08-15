import * as React from 'react';
import { getMatchLiveStreamAction } from '@/lib/actions/youtubeActions';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Radio, Play, Trophy, ShieldCheck, Clock, Lock, CheckCircle2, Video } from 'lucide-react';
import Link from 'next/link';
import MatchShareCard from '@/components/stream/MatchShareCard';

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

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 space-y-8">
      
      {/* Top Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="carrom">{editionTitle}</Badge>
            <Badge variant="outline" className="font-mono text-amber-400 font-bold border-amber-500/40">
              MATCH: {matchId.toUpperCase()}
            </Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Official CBOT Match Arena
          </h1>
        </div>

        <div>
          {stream?.status === 'LIVE' ? (
            <Badge className="bg-rose-600 text-white font-black text-xs px-3 py-1.5 gap-1.5 animate-pulse">
              <Radio className="h-3.5 w-3.5" /> 🔴 LIVE NOW
            </Badge>
          ) : stream?.status === 'ARCHIVED' && !isExpired ? (
            <Badge className="bg-emerald-600 text-white font-black text-xs px-3 py-1.5 gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> 🟢 RECORDING AVAILABLE
            </Badge>
          ) : isExpired ? (
            <Badge variant="secondary" className="font-black text-xs px-3 py-1.5 gap-1.5">
              <Lock className="h-3.5 w-3.5" /> VIDEO EXPIRED
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-400 border-amber-500/40 font-black text-xs px-3 py-1.5">
              MATCH SCHEDULED
            </Badge>
          )}
        </div>
      </div>

      {/* Main Score & Teams Card Header */}
      <div className="rounded-3xl border border-amber-500/40 bg-slate-950 p-6 sm:p-8 shadow-2xl text-white relative overflow-hidden space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
          
          {/* Team 1 */}
          <div className="sm:col-span-5 text-center space-y-2">
            <div className="h-16 w-16 rounded-2xl bg-slate-900 border-2 border-amber-500/40 p-1 mx-auto flex items-center justify-center">
              <img src={match?.team1?.logo || '/logo.png'} alt={team1Name} className="h-full w-full object-contain" />
            </div>
            <h2 className="text-xl font-black text-amber-400">{team1Name}</h2>
            <div className="text-4xl font-black font-mono">{match?.score1 ?? 0}</div>
          </div>

          {/* VS Divider */}
          <div className="sm:col-span-2 text-center">
            <span className="text-2xl font-black text-amber-500 italic bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/30">
              VS
            </span>
          </div>

          {/* Team 2 */}
          <div className="sm:col-span-5 text-center space-y-2">
            <div className="h-16 w-16 rounded-2xl bg-slate-900 border-2 border-amber-500/40 p-1 mx-auto flex items-center justify-center">
              <img src={match?.team2?.logo || '/logo.png'} alt={team2Name} className="h-full w-full object-contain" />
            </div>
            <h2 className="text-xl font-black text-emerald-400">{team2Name}</h2>
            <div className="text-4xl font-black font-mono">{match?.score2 ?? 0}</div>
          </div>

        </div>

        {/* Video Player Display Container */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Video className="h-4 w-4" /> CBOT Live Stream & Match Video
            </h3>
            {stream?.expiresAt && !isExpired && (
              <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Retention Expiry: {new Date(stream.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* 1. Live Stream or Archived Video Embed */}
          {stream && (stream.status === 'LIVE' || stream.status === 'ARCHIVED') && !isExpired ? (
            (stream.youtubeVideoId?.startsWith('cbot_yt_') || stream.youtubeEmbedUrl?.includes('cbot_yt_')) ? (
              /* Offline Testing / Sandbox Fallback Mode Screen */
              <div className="rounded-2xl border-2 border-amber-500/40 bg-slate-950 p-10 text-center space-y-4 shadow-2xl aspect-video flex flex-col items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 animate-pulse">
                  <Radio className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-extrabold text-amber-400 uppercase tracking-wide">SANDBOX FALLBACK MODE ACTIVE</h4>
                  <p className="text-xs text-slate-300 max-w-lg mx-auto leading-relaxed">
                    The YouTube Live API integration is running in offline testing/sandbox mode because the Google Channel API is not yet authorized or authorized credentials were bypassed.
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-md mx-auto leading-normal">
                    🔒 Player broadcast streams are active on local RTMP studio testkeys, but no public YouTube video exists. Administrators can complete YouTube authorization in the Admin portal to enable official public streams.
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border-2 border-amber-500/40 bg-slate-950 aspect-video shadow-2xl">
                <iframe
                  src={stream.youtubeEmbedUrl || `https://www.youtube.com/embed/${stream.youtubeVideoId}?autoplay=1`}
                  title={`CBOT ${matchId} Video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              </div>
            )
          ) : isExpired ? (
            /* 2. Expired Video Container */
            <div className="rounded-2xl border border-border bg-slate-900/90 p-10 text-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
                <Lock className="h-6 w-6" />
              </div>
              <h4 className="text-lg font-black text-slate-300">VIDEO EXPIRED</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Official CBOT 15-day public match video retention period has ended for this match.
              </p>
            </div>
          ) : (
            /* 3. Standby / Scheduled Match Container */
            <div className="rounded-2xl border border-amber-500/20 bg-slate-900/50 p-10 text-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                <Radio className="h-6 w-6" />
              </div>
              <h4 className="text-lg font-black text-amber-400">STREAM NOT YET STARTED</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                The live stream will appear here when the assigned player begins broadcasting from their player studio.
              </p>
            </div>
          )}

          {/* 4. Shareable Link Section Below Video Recording */}
          <MatchShareCard
            matchId={matchId}
            youtubeUrl={stream?.youtubeUrl}
            youtubeVideoId={stream?.youtubeVideoId}
            title={matchTitle}
            isLive={stream?.status === 'LIVE'}
          />
        </div>

      </div>

    </div>
  );
}
