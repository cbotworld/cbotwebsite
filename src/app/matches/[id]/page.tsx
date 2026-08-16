import * as React from 'react';
import { getMatchLiveStreamAction } from '@/lib/actions/youtubeActions';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Radio, Trophy, ShieldCheck, Clock, Lock, CheckCircle2, Video, Download, ArrowLeft } from 'lucide-react';
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

  const videoUrl = stream?.youtubeUrl || stream?.youtubeEmbedUrl;
  const isDirectVideo = videoUrl && (videoUrl.includes('supabase.co') || videoUrl.endsWith('.webm') || videoUrl.endsWith('.mp4') || videoUrl.startsWith('blob:'));

  return (
    <div className="min-h-screen bg-slate-950 text-white py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <Link href="/tournaments">
            <Button variant="outline" size="sm" className="gap-2 text-xs font-bold rounded-xl border-white/15 hover:bg-white/5">
              <ArrowLeft className="h-4 w-4" /> Back to Tournaments
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="carrom" className="text-xs font-black">{editionTitle}</Badge>
            {stream?.status === 'LIVE' ? (
              <Badge className="bg-rose-600 text-white font-black text-xs px-3 py-1 gap-1.5 animate-pulse">
                <Radio className="h-3 w-3" /> 🔴 LIVE NOW
              </Badge>
            ) : stream?.status === 'ARCHIVED' ? (
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
            <div className="text-3xl sm:text-4xl font-black font-mono text-white">{match?.score1 ?? 0}</div>
          </div>

          {/* Center VS & Details */}
          <div className="space-y-2">
            <div className="text-xs font-black uppercase tracking-widest text-slate-400">Match ID: {matchId}</div>
            <div className="text-2xl sm:text-3xl font-black text-slate-600">VS</div>
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
            <div className="text-3xl sm:text-4xl font-black font-mono text-white">{match?.score2 ?? 0}</div>
          </div>

        </div>

        {/* Video Player Display Container */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Video className="h-4 w-4" /> CBOT Arena Match Video
            </h3>
            {stream?.expiresAt && !isExpired && (
              <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Retention Expiry: {new Date(stream.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Video / Status Logic */}
          {stream && (stream.status === 'LIVE' || stream.status === 'ARCHIVED') && !isExpired ? (
            stream.status === 'ARCHIVED' ? (
              /* ARCHIVED / COMPLETED MATCH */
              isDirectVideo ? (
                /* Native High-Performance HTML5 Video Player for Recorded CBOT Matches */
                <div className="space-y-3">
                  <div className="relative rounded-3xl overflow-hidden border-2 border-amber-500/40 bg-slate-950 aspect-video shadow-2xl flex items-center justify-center">
                    <video
                      src={videoUrl}
                      controls
                      playsInline
                      className="h-full w-full object-contain bg-black"
                    />
                  </div>
                  <div className="flex justify-end">
                    <a
                      href={videoUrl}
                      download={`cbot_match_${matchId}.webm`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-white/15 hover:border-amber-500/40 text-white text-xs font-bold transition-all shadow-md"
                    >
                      <Download className="h-3.5 w-3.5 text-amber-400" />
                      <span>Download Match Video</span>
                    </a>
                  </div>
                </div>
              ) : (
                /* Match Completed / Saved Notice */
                <div className="rounded-3xl border-2 border-emerald-500/40 bg-slate-950 p-10 text-center space-y-4 shadow-2xl aspect-video flex flex-col items-center justify-center">
                  <div className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-extrabold text-white uppercase tracking-wide">🎉 MATCH COMPLETED & SAVED</h4>
                    <p className="text-xs text-slate-300 max-w-lg mx-auto leading-relaxed">
                      This match has concluded. Live scoring data and recorded match overlays are saved to CBOT Arena.
                    </p>
                  </div>
                </div>
              )
            ) : (
              /* Native Real-Time In-Browser Live Video Stream for Spectators */
              <WebRTCLiveViewer
                matchId={matchId}
                player1Name={team1Name}
                player2Name={team2Name}
                team1Name={team1Name}
                team2Name={team2Name}
              />
            )
          ) : isExpired ? (
            /* Expired Video Container */
            <div className="rounded-3xl border border-border bg-slate-900/90 p-10 text-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
                <Lock className="h-6 w-6" />
              </div>
              <h4 className="text-lg font-black text-slate-300">VIDEO EXPIRED</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Official CBOT 15-day public match video retention period has ended for this match.
              </p>
            </div>
          ) : (
            /* Standby / Scheduled Match Container */
            <div className="rounded-3xl border border-amber-500/20 bg-slate-900/50 p-10 text-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                <Radio className="h-6 w-6" />
              </div>
              <h4 className="text-lg font-black text-amber-400">MATCH NOT YET STARTED</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                The match broadcast will appear here when the assigned player begins the session from their Player Studio.
              </p>
            </div>
          )}
        </div>

        {/* Shareable Match Link Box */}
        <MatchShareCard
          matchId={matchId}
          title={matchTitle}
          isLive={stream?.status === 'LIVE'}
        />

        {/* Security & Authenticity Notice */}
        <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-4 text-xs text-slate-300 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">Official CBOT Match Verification</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Match recorded with official CBOT overlay certification. Stored on high-performance cloud storage with 15-day retention.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
