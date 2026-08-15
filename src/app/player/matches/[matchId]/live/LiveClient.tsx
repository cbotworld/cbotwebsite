'use client';

import * as React from 'react';
import Link from 'next/link';
import CanvasOverlayRenderer from '@/components/stream/CanvasOverlayRenderer';
import { createLiveStreamAction, startLiveStreamAction, stopLiveStreamAction } from '@/lib/actions/youtubeActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Radio, Play, Square, AlertCircle, CheckCircle2, ArrowLeft, Clock, Monitor, Share2, Youtube, ExternalLink, Key, Server, Eye, EyeOff, Copy, Check, Download, Loader2 } from 'lucide-react';
import MatchShareCard from '@/components/stream/MatchShareCard';
import { uploadMatchVideoToSupabase } from '@/lib/supabase';

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
  const [youtubeUrl, setYoutubeUrl] = React.useState<string | null>(null);
  const [youtubeVideoId, setYoutubeVideoId] = React.useState<string | null>(null);
  const [streamKey, setStreamKey] = React.useState<string | null>(null);
  const [rtmpIngestionUrl, setRtmpIngestionUrl] = React.useState<string | null>(null);
  const [showStreamKey, setShowStreamKey] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState(false);
  const [copiedServer, setCopiedServer] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [isSavingRecording, setIsSavingRecording] = React.useState(false);
  const [downloadUrl, setDownloadUrl] = React.useState<string | null>(null);
  const [initialized, setInitialized] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const canvasStreamRef = React.useRef<MediaStream | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);
  const [copied, setCopied] = React.useState(false);

  // Board-by-Board Scoring
  const [boards, setBoards] = React.useState([
    { boardNumber: 1, score: 0, slams: 0 },
    { boardNumber: 2, score: 0, slams: 0 },
    { boardNumber: 3, score: 0, slams: 0 },
  ]);

  const totalScore = React.useMemo(() => boards.reduce((acc, b) => acc + (b.score || 0), 0), [boards]);
  const totalSlams = React.useMemo(() => boards.reduce((acc, b) => acc + (b.slams || 0), 0), [boards]);

  const handleModifyBoardScore = (boardNum: number, delta: number) => {
    setBoards((prev) =>
      prev.map((b) => {
        if (b.boardNumber === boardNum) {
          return { ...b, score: Math.max(0, b.score + delta) };
        }
        return b;
      })
    );
  };

  const handleModifyBoardSlam = (boardNum: number, delta: number) => {
    setBoards((prev) =>
      prev.map((b) => {
        if (b.boardNumber === boardNum) {
          const newSlams = Math.max(0, b.slams + delta);
          const scoreDiff = delta > 0 ? 12 : (b.slams > 0 ? -12 : 0);
          return { ...b, slams: newSlams, score: Math.max(0, b.score + scoreDiff) };
        }
        return b;
      })
    );
  };

  const handleAddNewBoard = () => {
    setBoards((prev) => [
      ...prev,
      { boardNumber: prev.length + 1, score: 0, slams: 0 },
    ]);
  };

  const effectiveYoutubeUrl = React.useMemo(() => {
    if (youtubeUrl && !youtubeUrl.includes('cbot_yt_')) return youtubeUrl;
    if (youtubeVideoId && !youtubeVideoId.startsWith('cbot_yt_')) {
      return `https://www.youtube.com/watch?v=${youtubeVideoId}`;
    }
    return null;
  }, [youtubeUrl, youtubeVideoId]);

  const handleCopyLink = () => {
    const shareUrl = effectiveYoutubeUrl || `${window.location.origin}/matches/${matchDetails.matchId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyKey = () => {
    if (!streamKey) return;
    navigator.clipboard.writeText(streamKey).then(() => {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    });
  };

  const handleCopyServer = () => {
    const url = rtmpIngestionUrl || 'rtmp://a.rtmp.youtube.com/live2';
    navigator.clipboard.writeText(url).then(() => {
      setCopiedServer(true);
      setTimeout(() => setCopiedServer(false), 2500);
    });
  };

  // Initialize stream session
  React.useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const res = await createLiveStreamAction(matchDetails.matchId);
        if (res.success && res.stream) {
          setStreamId(res.stream.id);
          setStreamStatus(res.stream.status as any);
          if (res.stream.youtubeUrl) setYoutubeUrl(res.stream.youtubeUrl);
          if (res.stream.youtubeVideoId) setYoutubeVideoId(res.stream.youtubeVideoId);
          if (res.stream.streamKey) setStreamKey(res.stream.streamKey);
          if (res.stream.rtmpIngestionUrl) setRtmpIngestionUrl(res.stream.rtmpIngestionUrl);
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

        // Start In-Browser Recording with Full CBOT Overlays
        if (canvasStreamRef.current) {
          recordedChunksRef.current = [];
          try {
            const stream = canvasStreamRef.current;
            const mimeType = [
              'video/webm;codecs=vp9,opus',
              'video/webm;codecs=vp8,opus',
              'video/webm',
              'video/mp4',
            ].find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || '';

            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) {
                recordedChunksRef.current.push(e.data);
              }
            };
            recorder.start(1000);
            mediaRecorderRef.current = recorder;
          } catch (recErr) {
            console.warn('MediaRecorder initialization error:', recErr);
          }
        }
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
    if (!streamId) {
      setStreamStatus('ARCHIVED');
      return;
    }
    setLoading(true);
    setIsSavingRecording(true);
    setErrorMsg(null);
    try {
      // 1. Finalize in-browser recording
      let videoBlob: Blob | null = null;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          if (!mediaRecorderRef.current) return resolve();
          mediaRecorderRef.current.onstop = () => resolve();
          mediaRecorderRef.current.stop();
        });
        if (recordedChunksRef.current.length > 0) {
          videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const localUrl = URL.createObjectURL(videoBlob);
          setDownloadUrl(localUrl);
        }
      }

      // 2. Upload recording directly to Supabase storage
      let uploadedUrl: string | undefined = undefined;
      if (videoBlob && videoBlob.size > 0) {
        try {
          uploadedUrl = await uploadMatchVideoToSupabase(videoBlob, matchDetails.matchId);
        } catch (uploadErr) {
          console.warn('Video upload exception:', uploadErr);
        }
      }

      // 3. Stop stream and attach video URL in DB
      const res = await stopLiveStreamAction(streamId, uploadedUrl);
      if (res.success || res.error?.includes('not found')) {
        setStreamStatus('ARCHIVED');
      } else {
        setErrorMsg(res.error || 'Failed to stop stream.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to stop stream.');
    } finally {
      setLoading(false);
      setIsSavingRecording(false);
    }
  };

  const handleStreamReady = React.useCallback((s: MediaStream) => {
    canvasStreamRef.current = s;
  }, []);

  const handleStreamError = React.useCallback((msg: string) => {
    setErrorMsg(msg);
  }, []);

  const matchTime = matchDetails.scheduledTime
    ? new Date(matchDetails.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">

      {/* Top Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/dashboard/player">
            <Button variant="outline" size="sm" className="gap-2 text-xs font-bold rounded-xl">
              <ArrowLeft className="h-4 w-4" /> Back to My Dashboard
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="gap-2 text-xs font-bold rounded-xl border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
          >
            {copied ? (
              <span className="animate-pulse">Copied!</span>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" /> Copy Shareable Link
              </>
            )}
          </Button>
          {effectiveYoutubeUrl && (
            <a
              href={effectiveYoutubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-md shadow-red-600/20"
            >
              <Youtube className="h-3.5 w-3.5" />
              <span>Watch on YouTube</span>
              <ExternalLink className="h-3 w-3 opacity-80" />
            </a>
          )}
        </div>
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
            boards={boards}
            onStreamReady={handleStreamReady}
            onError={handleStreamError}
          />
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center text-xs font-semibold text-amber-300">
            💡 Position your camera so the complete Carrom board is clearly visible in landscape mode.
          </div>
        </div>

        {/* Real-time Board-by-Board Scorer (Player-Centric) */}
        <div className="rounded-2xl bg-white/5 border border-amber-500/30 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Scorer</div>
              <div className="text-base font-black text-amber-400">Player: {matchDetails.playerName}</div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-500/50 flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400">TOTAL SCORE:</span>
              <span className="text-sm font-black text-amber-400">{totalScore} pts</span>
              {totalSlams > 0 && (
                <span className="text-[10px] font-black text-sky-400 bg-sky-500/20 px-2 py-0.5 rounded-md">
                  ⚡ {totalSlams} Slam
                </span>
              )}
            </div>
          </div>

          {/* Board List */}
          <div className="space-y-2.5">
            {boards.map((board) => (
              <div
                key={board.boardNumber}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-white/10 gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-white min-w-[60px]">Board {board.boardNumber}</span>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-lg">
                    {board.score} pts
                  </span>
                  {board.slams > 0 && (
                    <span className="text-[10px] font-bold text-sky-400 bg-sky-500/20 px-2 py-0.5 rounded-md">
                      ⚡ {board.slams} Slam
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleModifyBoardScore(board.boardNumber, -1)}
                    className="h-8 px-2.5 text-xs font-black rounded-lg border-white/20 hover:bg-white/10"
                  >
                    -1
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleModifyBoardScore(board.boardNumber, 1)}
                    className="h-8 px-2.5 text-xs font-black rounded-lg bg-emerald-600/30 border-emerald-500/50 text-emerald-400 hover:bg-emerald-600/50"
                  >
                    +1
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleModifyBoardSlam(board.boardNumber, -1)}
                    disabled={board.slams === 0}
                    className="h-8 px-2 text-[11px] font-bold rounded-lg border-white/20 text-slate-400 disabled:opacity-40"
                  >
                    Slam -
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleModifyBoardSlam(board.boardNumber, 1)}
                    className="h-8 px-2.5 text-[11px] font-black rounded-lg bg-amber-600/30 border-amber-500/50 text-amber-300 hover:bg-amber-600/50"
                  >
                    ⚡ Slam +
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleAddNewBoard}
            className="w-full py-2.5 border-dashed border-amber-500/50 text-amber-400 hover:bg-amber-500/10 text-xs font-black rounded-xl"
          >
            ➕ ADD NEW BOARD (BOARD {boards.length + 1})
          </Button>
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
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Button
                onClick={handleStopLive}
                disabled={loading || isSavingRecording}
                className="w-full sm:w-auto bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-black text-sm px-8 py-3.5 rounded-2xl shadow-xl shadow-rose-600/30 gap-2 animate-pulse"
              >
                {isSavingRecording ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> SAVING MATCH RECORDING…
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 fill-white" /> END LIVE STREAM
                  </>
                )}
              </Button>
              {effectiveYoutubeUrl && (
                <a
                  href={effectiveYoutubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm transition-all shadow-xl shadow-red-600/30"
                >
                  <Youtube className="h-4 w-4" />
                  <span>Watch Live on YouTube</span>
                  <ExternalLink className="h-4 w-4 opacity-80" />
                </a>
              )}
            </div>
          )}
          {streamStatus === 'ARCHIVED' && (
            <div className="text-center space-y-3">
              <p className="text-xs text-emerald-400 font-bold">
                🎉 Match stream & recording saved! Available on CBOT Arena for 15 days.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  variant="outline"
                  className="text-xs font-bold rounded-xl border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => {
                    window.location.href = `/matches/${matchDetails.matchId}`;
                  }}
                >
                  View Public Match Recording
                </Button>
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    download={`cbot_match_${matchDetails.matchId}.webm`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Match Video
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Shareable Link Box Below Studio Video */}
      <MatchShareCard
        matchId={matchDetails.matchId}
        youtubeUrl={youtubeUrl}
        youtubeVideoId={youtubeVideoId}
        title={`${matchDetails.editionTitle} - ${matchDetails.teamName} vs ${matchDetails.opponentName}`}
        isLive={streamStatus === 'LIVE'}
      />

      {/* Optional Collapsible OBS / External App Settings */}
      {streamKey && !streamKey.startsWith('cbot-key') && (
        <details className="rounded-2xl bg-slate-950/60 border border-white/10 p-4 text-white text-xs group">
          <summary className="font-bold text-slate-400 cursor-pointer flex items-center justify-between select-none">
            <span className="flex items-center gap-2">
              <Server className="h-3.5 w-3.5 text-amber-400" />
              Advanced: External OBS / Camera Setup (Optional)
            </span>
            <span className="text-[10px] text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
          </summary>

          <div className="pt-4 mt-3 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400">Stream Server URL</label>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-white/10">
                <input
                  type="text"
                  readOnly
                  value={rtmpIngestionUrl || 'rtmp://a.rtmp.youtube.com/live2'}
                  className="bg-transparent text-xs font-mono text-slate-300 w-full outline-none truncate"
                />
                <Button onClick={handleCopyServer} variant="ghost" size="sm" className="h-6 px-2 text-[10px]">
                  {copiedServer ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400">Stream Key</label>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-white/10">
                <input
                  type={showStreamKey ? 'text' : 'password'}
                  readOnly
                  value={streamKey}
                  className="bg-transparent text-xs font-mono text-slate-300 w-full outline-none truncate"
                />
                <Button onClick={() => setShowStreamKey(!showStreamKey)} variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400">
                  {showStreamKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
                <Button onClick={handleCopyKey} variant="ghost" size="sm" className="h-6 px-2 text-[10px]">
                  {copiedKey ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
