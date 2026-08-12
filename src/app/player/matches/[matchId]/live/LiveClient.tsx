'use client';

import * as React from 'react';
import Link from 'next/link';
import CanvasOverlayRenderer from '@/components/stream/CanvasOverlayRenderer';
import { createLiveStreamAction, startLiveStreamAction, stopLiveStreamAction } from '@/lib/actions/youtubeActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Radio, Play, Square, AlertCircle, CheckCircle2, ArrowLeft, Clock, Monitor } from 'lucide-react';

interface MatchDetails {
  matchId: string;
  editionTitle: string;
  editionNumber: number;
  playerName: string;
  teamName: string;
  teamLogo: string | null;
  opponentName: string;
  opponentLogo: string | null;
  scheduledTime: string | null;
  tableNumber: number;
  status: string;
}

export default function PlayerMatchLiveClient({ matchDetails }: { matchDetails: MatchDetails }) {
  const [streamId, setStreamId] = React.useState<string | null>(null);
  const [streamStatus, setStreamStatus] = React.useState<'CREATED' | 'READY' | 'LIVE' | 'ENDED' | 'ARCHIVED' | 'FAILED'>('CREATED');
  const [streamStartedAt, setStreamStartedAt] = React.useState<Date | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [initialized, setInitialized] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const canvasStreamRef = React.useRef<MediaStream | null>(null);

  // Initialize stream session
  React.useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const res = await createLiveStreamAction(matchDetails.matchId);
        if (res.success && res.stream) {
          setStreamId(res.stream.id);
          setStreamStatus(res.stream.status as any);
          if (res.stream.streamStartedAt) {
            setStreamStartedAt(new Date(res.stream.streamStartedAt));
          }
        } else {
          // Stream session failed but we still render — allow manual retry
          setErrorMsg(res.error || null);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Connection error initializing stream.');
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };
    init();
  }, [matchDetails.matchId]);

  const handleStartLive = async () => {
    if (!streamId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await startLiveStreamAction(streamId);
      if (res.success) {
        setStreamStatus('LIVE');
        setStreamStartedAt(new Date());
      } else {
        setErrorMsg(res.error || 'Failed to start live stream.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start stream.');
    } finally {
      setLoading(false);
    }
  };

  const handleStopLive = async () => {
    if (!streamId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await stopLiveStreamAction(streamId);
      if (res.success) {
        setStreamStatus('ARCHIVED');
      } else {
        setErrorMsg(res.error || 'Failed to stop stream.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to stop stream.');
    } finally {
      setLoading(false);
    }
  };

  const matchTime = matchDetails.scheduledTime
    ? new Date(matchDetails.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">

      {/* Top Nav */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <Link href="/dashboard/player">
          <Button variant="outline" size="sm" className="gap-2 text-xs font-bold rounded-xl">
            <ArrowLeft className="h-4 w-4" /> Back to My Dashboard
          </Button>
        </Link>
        <Badge variant="carrom" className="text-xs font-black">{matchDetails.editionTitle}</Badge>
      </div>

      {/* Studio Card */}
      <div className="bg-slate-950 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-white relative overflow-hidden space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`h-3 w-3 rounded-full ${streamStatus === 'LIVE' ? 'bg-rose-500 animate-ping' : 'bg-amber-400'}`} />
              <span className="text-xs font-black text-amber-400 uppercase tracking-wider">Official CBOT Live Player Studio</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Match Broadcast Studio</h1>
          </div>
          {streamStatus === 'LIVE' ? (
            <Badge className="bg-rose-600 text-white font-black text-xs px-3 py-1.5 gap-1.5 animate-pulse">
              <Radio className="h-3.5 w-3.5" /> 🔴 LIVE BROADCASTING
            </Badge>
          ) : streamStatus === 'ARCHIVED' ? (
            <Badge className="bg-emerald-600 text-white font-black text-xs px-3 py-1.5 gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> STREAM SAVED
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-400 border-amber-500/50 font-black text-xs px-3 py-1.5">
              {loading && !initialized ? 'INITIALIZING…' : 'READY TO STREAM'}
            </Badge>
          )}
        </div>

        {/* Player & Match Identity — the core fix */}
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          {/* Player name row */}
          <div className="px-5 py-3 border-b border-white/5">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Streaming As</div>
            <div className="text-lg font-black text-white">{matchDetails.playerName}</div>
          </div>

          {/* Team vs Team */}
          <div className="grid grid-cols-3 divide-x divide-white/10">
            {/* My Team */}
            <div className="p-4 flex flex-col items-center gap-2">
              {matchDetails.teamLogo ? (
                <img src={matchDetails.teamLogo} alt={matchDetails.teamName} className="w-10 h-10 rounded-lg object-contain bg-white/5 border border-white/10" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-black text-amber-400 text-sm">
                  {matchDetails.teamName[0]}
                </div>
              )}
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-400/60">Your Team</div>
              <div className="text-sm font-black text-amber-400 text-center leading-tight">{matchDetails.teamName}</div>
            </div>

            {/* VS + time */}
            <div className="p-4 flex flex-col items-center justify-center gap-1">
              <div className="text-xl font-black text-slate-500">VS</div>
              {matchTime && (
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                  <Clock className="h-3 w-3" /> {matchTime}
                </div>
              )}
              {matchDetails.tableNumber && (
                <div className="text-[10px] text-slate-600">Table #{matchDetails.tableNumber}</div>
              )}
            </div>

            {/* Opponent */}
            <div className="p-4 flex flex-col items-center gap-2">
              {matchDetails.opponentLogo ? (
                <img src={matchDetails.opponentLogo} alt={matchDetails.opponentName} className="w-10 h-10 rounded-lg object-contain bg-white/5 border border-white/10" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-slate-500/20 border border-slate-500/30 flex items-center justify-center font-black text-slate-400 text-sm">
                  {matchDetails.opponentName[0]}
                </div>
              )}
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400/60">Opponent</div>
              <div className="text-sm font-black text-slate-300 text-center leading-tight">{matchDetails.opponentName}</div>
            </div>
          </div>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
            <div className="flex-1 font-semibold">{errorMsg}</div>
          </div>
        )}

        {/* Canvas Stream */}
        <div className="space-y-3">
          <CanvasOverlayRenderer
            playerName={matchDetails.playerName}
            editionTitle={matchDetails.editionTitle}
            matchId={matchDetails.matchId}
            teamName={matchDetails.teamName}
            opponentName={matchDetails.opponentName}
            isStreaming={streamStatus === 'LIVE'}
            streamStartedAt={streamStartedAt}
            onStreamReady={(s) => { canvasStreamRef.current = s; }}
            onError={(msg) => setErrorMsg(msg)}
          />
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center text-xs font-semibold text-amber-300">
            💡 Position your camera so the complete Carrom board is clearly visible in landscape mode.
          </div>
        </div>

        {/* Controls */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
          {streamStatus !== 'LIVE' && streamStatus !== 'ARCHIVED' && (
            <Button
              onClick={handleStartLive}
              disabled={loading || !streamId}
              className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm px-8 py-3.5 rounded-2xl shadow-xl shadow-amber-500/20 gap-2"
            >
              <Play className="h-4 w-4 fill-slate-950" />
              {loading && !initialized ? 'INITIALIZING…' : 'START LIVE STREAM'}
            </Button>
          )}
          {streamStatus === 'LIVE' && (
            <Button
              onClick={handleStopLive}
              disabled={loading}
              className="w-full sm:w-auto bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-black text-sm px-8 py-3.5 rounded-2xl shadow-xl shadow-rose-600/30 gap-2 animate-pulse"
            >
              <Square className="h-4 w-4 fill-white" /> END LIVE STREAM
            </Button>
          )}
          {streamStatus === 'ARCHIVED' && (
            <div className="text-center space-y-2">
              <p className="text-xs text-emerald-400 font-bold">
                🎉 Match stream saved! Available on CBOT for 15 days.
              </p>
              <Link href={`/matches/${matchDetails.matchId}`}>
                <Button variant="outline" className="text-xs font-bold rounded-xl border-amber-500/40 text-amber-400">
                  View Public Match Recording
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
