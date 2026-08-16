'use client';

import * as React from 'react';
import Link from 'next/link';
import CanvasOverlayRenderer from '@/components/stream/CanvasOverlayRenderer';
import { createLiveStreamAction, startLiveStreamAction, stopLiveStreamAction } from '@/lib/actions/youtubeActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Radio, Play, Square, AlertCircle, CheckCircle2, ArrowLeft, Clock, Monitor, Share2, ExternalLink, Download, Loader2, Plus, Minus, Trash2, Video } from 'lucide-react';
import MatchShareCard from '@/components/stream/MatchShareCard';
import { uploadMatchVideoToSupabase, supabase } from '@/lib/supabase';

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
          return { ...b, slams: Math.max(0, b.slams + delta) };
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

  const handleRemoveBoard = (boardNum: number) => {
    setBoards((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((b) => b.boardNumber !== boardNum);
      return filtered.map((b, idx) => ({ ...b, boardNumber: idx + 1 }));
    });
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/matches/${matchDetails.matchId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
          if (res.stream.streamStartedAt) {
            setStreamStartedAt(new Date(res.stream.streamStartedAt));
          }
        } else {
          setErrorMsg(res.error || 'Failed to initialize match studio.');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Network error initializing match studio.');
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

        // Start in-browser recorder
        if (canvasStreamRef.current) {
          recordedChunksRef.current = [];
          const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm';
          const recorder = new MediaRecorder(canvasStreamRef.current, { mimeType });
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              recordedChunksRef.current.push(e.data);
            }
          };
          recorder.start(1000);
          mediaRecorderRef.current = recorder;
        }
      } else {
        setErrorMsg(res.error || 'Failed to start match stream.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start match stream.');
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

  // Elapsed Timer
  const [elapsed, setElapsed] = React.useState('00:00:00');
  React.useEffect(() => {
    if (streamStatus !== 'LIVE' || !streamStartedAt) {
      return;
    }
    const interval = setInterval(() => {
      const diff = Math.floor((new Date().getTime() - streamStartedAt.getTime()) / 1000);
      const h = Math.floor(diff / 3600).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setElapsed(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [streamStatus, streamStartedAt]);

  const handleStreamReady = React.useCallback((stream: MediaStream) => {
    canvasStreamRef.current = stream;
  }, []);

  // Native WebRTC & Realtime Broadcaster to Spectators
  React.useEffect(() => {
    if (streamStatus !== 'LIVE') return;

    const channelName = `cbot_match_${matchDetails.matchId}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    const peerConnections = new Map<string, RTCPeerConnection>();

    const createPeerForViewer = async (viewerId: string) => {
      if (!canvasStreamRef.current) return;
      if (peerConnections.has(viewerId)) {
        peerConnections.get(viewerId)?.close();
        peerConnections.delete(viewerId);
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      peerConnections.set(viewerId, pc);

      // Add live canvas stream tracks
      canvasStreamRef.current.getTracks().forEach((track) => {
        if (canvasStreamRef.current) {
          pc.addTrack(track, canvasStreamRef.current);
        }
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channel.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: {
              target: viewerId,
              sender: 'broadcaster',
              candidate: event.candidate,
            },
          });
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({
          type: 'broadcast',
          event: 'stream-offer',
          payload: {
            target: viewerId,
            sender: 'broadcaster',
            offer: offer,
          },
        });
      } catch (err) {
        console.warn('Error creating WebRTC offer for viewer:', err);
      }
    };

    channel
      .on('broadcast', { event: 'viewer-join' }, ({ payload }: { payload: any }) => {
        if (payload?.viewerId) {
          createPeerForViewer(payload.viewerId);
        }
      })
      .on('broadcast', { event: 'stream-answer' }, async ({ payload }: { payload: any }) => {
        if (payload?.sender && peerConnections.has(payload.sender) && payload.answer) {
          try {
            const pc = peerConnections.get(payload.sender);
            if (pc && pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
            }
          } catch (e) {
            console.warn('Error setting remote answer:', e);
          }
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }: { payload: any }) => {
        if (payload?.sender && peerConnections.has(payload.sender) && payload.candidate) {
          try {
            const pc = peerConnections.get(payload.sender);
            if (pc) {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            }
          } catch (e) {
            console.warn('Error adding ICE candidate:', e);
          }
        }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'broadcaster-live',
            payload: { matchId: matchDetails.matchId },
          });
        }
      });

    // Frame & score snapshot broadcast every 1.5 seconds as fallback
    const snapshotInterval = setInterval(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
      if (canvas) {
        try {
          const frame = canvas.toDataURL('image/jpeg', 0.6);
          channel.send({
            type: 'broadcast',
            event: 'stream-frame',
            payload: {
              frame,
              scores: { totalScore, totalSlams },
            },
          });
        } catch (e) {}
      }
    }, 1500);

    return () => {
      clearInterval(snapshotInterval);
      peerConnections.forEach((pc) => pc.close());
      peerConnections.clear();
      supabase.removeChannel(channel);
    };
  }, [streamStatus, matchDetails.matchId, totalScore, totalSlams]);

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
          <a
            href={`/matches/${matchDetails.matchId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-colors shadow-md shadow-amber-500/20"
          >
            <Radio className="h-3.5 w-3.5" />
            <span>Open Public Match Page</span>
            <ExternalLink className="h-3 w-3 opacity-80" />
          </a>
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
              <span className="text-xs font-black text-amber-400 uppercase tracking-wider">Official CBOT Match Studio</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Live Match Broadcast Studio</h1>
          </div>
          {streamStatus === 'LIVE' ? (
            <Badge className="bg-rose-600 text-white font-black text-xs px-3 py-1.5 gap-1.5 animate-pulse">
              <Radio className="h-3.5 w-3.5" /> 🔴 LIVE BROADCASTING
            </Badge>
          ) : streamStatus === 'ARCHIVED' ? (
            <Badge className="bg-emerald-600 text-white font-black text-xs px-3 py-1.5 gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> MATCH VIDEO SAVED
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-400 border-amber-500/50 font-black text-xs px-3 py-1.5">
              {loading && !initialized ? 'INITIALIZING…' : 'READY TO STREAM'}
            </Badge>
          )}
        </div>

        {/* Player & Match Identity */}
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

            {/* Match Info */}
            <div className="p-4 flex flex-col items-center justify-center gap-1.5 text-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Board Match</div>
              <div className="text-xs font-black text-white">Table #{matchDetails.tableNumber}</div>
              {matchTime && (
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Clock className="h-3 w-3" /> {matchTime}
                </div>
              )}
              {streamStatus === 'LIVE' && (
                <div className="text-sm font-black font-mono text-rose-400 mt-1">
                  ⏱ {elapsed}
                </div>
              )}
            </div>

            {/* Opponent Team */}
            <div className="p-4 flex flex-col items-center gap-2">
              {matchDetails.opponentLogo ? (
                <img src={matchDetails.opponentLogo} alt={matchDetails.opponentName} className="w-10 h-10 rounded-lg object-contain bg-white/5 border border-white/10" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center font-black text-white text-sm">
                  {matchDetails.opponentName[0]}
                </div>
              )}
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Opponent</div>
              <div className="text-sm font-black text-white text-center leading-tight">{matchDetails.opponentName}</div>
            </div>
          </div>
        </div>

        {/* Live Video Canvas Overlay Renderer */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5 text-amber-400" /> Live Match Camera & Live Overlays
            </span>
            {streamStatus === 'LIVE' && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" /> Recording Live Match Video
              </span>
            )}
          </div>

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
            onError={(err) => setErrorMsg(err)}
          />
        </div>

        {/* Board-by-Board Live Scorer */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-black text-amber-400 uppercase tracking-wide">
                Live Carrom Board Scorer
              </h3>
              <p className="text-[11px] text-slate-400">
                Update board scores and slams in real-time — live overlays update automatically
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs font-black border-amber-500/40 text-amber-300">
                Total Score: <span className="ml-1 text-white font-mono">{totalScore}</span>
              </Badge>
              <Badge variant="outline" className="text-xs font-black border-yellow-500/40 text-yellow-300">
                Slams: <span className="ml-1 text-white font-mono">⚡ {totalSlams}</span>
              </Badge>
            </div>
          </div>

          {/* Dynamic Boards List */}
          <div className="space-y-3">
            {boards.map((b) => (
              <div
                key={b.boardNumber}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-white/10 hover:border-amber-500/30 transition-colors"
              >
                {/* Board Label */}
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs">
                    BOARD {b.boardNumber}
                  </span>
                  {boards.length > 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveBoard(b.boardNumber)}
                      className="h-7 w-7 p-0 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Score Controls */}
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Points (+1 / -1) */}
                  <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
                    <span className="text-[11px] font-bold text-slate-400 px-1.5">Points:</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleModifyBoardScore(b.boardNumber, -1)}
                      disabled={b.score <= 0}
                      className="h-7 w-7 p-0 rounded-lg text-slate-300 hover:text-white border-white/10"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-mono font-black text-amber-300 text-sm">
                      {b.score}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleModifyBoardScore(b.boardNumber, 1)}
                      className="h-7 w-7 p-0 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black border-none"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Slam (+1 / -1) */}
                  <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
                    <span className="text-[11px] font-bold text-yellow-400/90 px-1.5">Slam:</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleModifyBoardSlam(b.boardNumber, -1)}
                      disabled={b.slams <= 0}
                      className="h-7 w-7 p-0 rounded-lg text-slate-300 hover:text-white border-white/10"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-mono font-black text-yellow-300 text-sm">
                      {b.slams}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleModifyBoardSlam(b.boardNumber, 1)}
                      className="h-7 w-7 p-0 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-black border-none"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddNewBoard}
              className="w-full py-3 border-dashed border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:border-amber-400 text-xs font-black rounded-xl transition-all gap-2"
            >
              <Plus className="h-4 w-4" /> ADD BOARD (BOARD {boards.length + 1})
            </Button>
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
              {loading && !initialized ? 'INITIALIZING…' : 'START LIVE MATCH'}
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
                    <Square className="h-4 w-4 fill-white" /> END LIVE MATCH
                  </>
                )}
              </Button>
            </div>
          )}
          {streamStatus === 'ARCHIVED' && (
            <div className="text-center space-y-3">
              <p className="text-xs text-emerald-400 font-bold">
                🎉 Match video recording saved! Available on CBOT Arena for 15 days.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  variant="outline"
                  className="text-xs font-bold rounded-xl border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => {
                    window.location.href = `/matches/${matchDetails.matchId}`;
                  }}
                >
                  <Video className="h-3.5 w-3.5 mr-1" /> View Public Match Replay
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

      {/* Shareable Link Box */}
      <MatchShareCard
        matchId={matchDetails.matchId}
        title={`${matchDetails.editionTitle} - ${matchDetails.teamName} vs ${matchDetails.opponentName}`}
        isLive={streamStatus === 'LIVE'}
      />
    </div>
  );
}
