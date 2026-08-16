'use client';

import * as React from 'react';
import Link from 'next/link';
import CanvasOverlayRenderer from '@/components/stream/CanvasOverlayRenderer';
import { createLiveStreamAction, startLiveStreamAction, stopLiveStreamAction } from '@/lib/actions/youtubeActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Radio, Play, Square, AlertCircle, CheckCircle2, ArrowLeft, Clock, 
  Share2, ExternalLink, Download, Loader2, Plus, Minus, Trash2, Video, 
  ChevronUp, ChevronDown, MessageCircle, Copy, Check, Sparkles, X, Trophy
} from 'lucide-react';
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
  
  // UI Interactive States (Overlay DOM - Not captured by video canvas)
  const [isScoreDrawerOpen, setIsScoreDrawerOpen] = React.useState(false);
  const [showShareModal, setShowShareModal] = React.useState(false);
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

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/matches/${matchDetails.matchId}`
    : `https://www.cbotworld.com/matches/${matchDetails.matchId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleWhatsAppShare = () => {
    const text = streamStatus === 'LIVE'
      ? `🔴 Watch Live: ${matchDetails.playerName} (${matchDetails.teamName}) vs ${matchDetails.opponentName} on CBOT Arena! ${shareUrl}`
      : `🎬 Watch Match: ${matchDetails.teamName} vs ${matchDetails.opponentName} on CBOT Arena! ${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
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

      // 2. Upload recording directly to CBOT Storage
      let uploadedUrl: string | undefined = undefined;
      if (videoBlob && videoBlob.size > 0) {
        try {
          const fd = new FormData();
          fd.append('video', videoBlob, `match_${matchDetails.matchId}.webm`);
          fd.append('matchId', matchDetails.matchId);
          if (streamId) fd.append('streamId', streamId);

          const upRes = await fetch('/api/stream/upload-recording', {
            method: 'POST',
            body: fd,
          });
          const upData = await upRes.json();
          if (upData.success && upData.url) {
            uploadedUrl = upData.url;
          }
        } catch (uploadErr) {
          console.warn('Server recording upload error:', uploadErr);
        }
      }

      // 3. Stop stream and attach video URL in DB
      const res = await stopLiveStreamAction(streamId, uploadedUrl);
      if (res.success || res.error?.includes('not found') || uploadedUrl) {
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

  // Lock screen to landscape if supported on mobile devices
  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'screen' in window && (window.screen as any).orientation?.lock) {
        (window.screen as any).orientation.lock('landscape').catch(() => {});
      }
    } catch (e) {}
  }, []);

  return (
    <div className="fixed inset-0 w-screen h-screen z-50 bg-black text-white select-none overflow-hidden flex items-center justify-center">
      
      {/* Immersive Edge-to-Edge Fullscreen Camera Studio Container */}
      <div className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center group">

        {/* 1. Underlying High-Definition Video Canvas */}
        <div className="absolute inset-0 w-full h-full flex items-center justify-center">
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

        {/* 2. Floating Top Bar (Controls on Video) */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
          <div className="flex items-center gap-2 pointer-events-auto">
            <Link href="/dashboard/player">
              <Button size="sm" variant="ghost" className="h-9 px-3 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-xl text-white font-bold text-xs gap-1.5 border border-white/10">
                <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </Link>
            {streamStatus === 'LIVE' ? (
              <Badge className="bg-rose-600 text-white font-black text-xs px-3 py-1.5 gap-1.5 animate-pulse shadow-lg shadow-rose-600/30">
                <Radio className="h-3.5 w-3.5" /> 🔴 LIVE {elapsed}
              </Badge>
            ) : streamStatus === 'ARCHIVED' ? (
              <Badge className="bg-emerald-600 text-white font-black text-xs px-3 py-1.5 gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> RECORDING SAVED
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-black/60 backdrop-blur-md text-amber-400 border-amber-500/50 font-black text-xs px-3 py-1.5">
                {loading && !initialized ? 'INITIALIZING…' : 'READY TO GO LIVE'}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <Button
              size="sm"
              onClick={() => setShowShareModal(true)}
              className="h-9 px-3 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-xl text-amber-400 font-bold text-xs gap-1.5 border border-amber-500/30"
            >
              <Share2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Share Match</span>
            </Button>
            <a
              href={`/matches/${matchDetails.matchId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl inline-flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
            >
              <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Public Page</span>
            </a>
          </div>
        </div>

        {/* 3. Floating Center Action Buttons (Start / Saved state on video) */}
        {streamStatus !== 'LIVE' && streamStatus !== 'ARCHIVED' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-[2px] z-10 p-4 text-center">
            <Button
              onClick={handleStartLive}
              disabled={loading || !streamId}
              size="lg"
              className="h-16 px-10 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-lg shadow-2xl shadow-amber-500/50 hover:scale-105 transition-all gap-3 border-2 border-white/20"
            >
              <Play className="h-6 w-6 fill-slate-950" />
              {loading && !initialized ? 'INITIALIZING STUDIO…' : 'START LIVE MATCH'}
            </Button>
            <p className="text-xs font-semibold text-slate-300 mt-3 drop-shadow-md">
              Tap to broadcast your Carrom board with live score overlays
            </p>
          </div>
        )}

        {streamStatus === 'ARCHIVED' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-10 p-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-white uppercase">Match Video Saved to CBOT Arena!</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Your match has concluded and is saved with all Carrom board overlays.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                className="rounded-2xl border-amber-500/50 text-amber-400 hover:bg-amber-500/10 text-xs font-black px-5 py-3"
                onClick={() => {
                  window.location.href = `/matches/${matchDetails.matchId}`;
                }}
              >
                <Video className="h-4 w-4 mr-2" /> Watch Match Replay
              </Button>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download={`cbot_match_${matchDetails.matchId}.webm`}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/30"
                >
                  <Download className="h-4 w-4" /> Download Video
                </a>
              )}
            </div>
          </div>
        )}

        {/* 4. Floating Bottom Action Bar (On Video) */}
        {streamStatus === 'LIVE' && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
            {/* End Live Match Button */}
            <div className="pointer-events-auto">
              <Button
                onClick={handleStopLive}
                disabled={loading || isSavingRecording}
                className="h-12 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm shadow-xl shadow-rose-600/40 gap-2 border border-white/20 animate-pulse"
              >
                {isSavingRecording ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> SAVING MATCH…
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 fill-white" /> END MATCH
                  </>
                )}
              </Button>
            </div>

            {/* Scoreboard Drawer Toggle Button (Up Arrow) */}
            <div className="pointer-events-auto">
              <Button
                onClick={() => setIsScoreDrawerOpen(!isScoreDrawerOpen)}
                className="h-12 px-5 rounded-2xl bg-black/80 hover:bg-black text-amber-400 font-black text-xs gap-2 border-2 border-amber-500/60 backdrop-blur-xl shadow-2xl hover:scale-105 transition-all"
              >
                <span className="flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span>SCORE: {totalScore}</span>
                  {totalSlams > 0 && <span className="text-sky-400">⚡{totalSlams}</span>}
                </span>
                {isScoreDrawerOpen ? <ChevronDown className="h-4 w-4 text-white" /> : <ChevronUp className="h-4 w-4 text-white animate-bounce" />}
              </Button>
            </div>
          </div>
        )}

        {/* 5. Slide-Up Interactive Score Drawer (DOM Overlay - Not recorded on video canvas) */}
        {isScoreDrawerOpen && (
          <div className="absolute inset-x-0 bottom-0 max-h-[85%] bg-slate-950/95 backdrop-blur-2xl border-t-2 border-amber-500/60 p-4 sm:p-6 rounded-t-3xl shadow-2xl z-30 overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-300">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-400 animate-ping" />
                <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                  Update Board Scores & Slams
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-amber-500/10 border-amber-500/40 text-amber-400 font-mono font-bold text-xs">
                  Total: {totalScore} pts | ⚡ {totalSlams}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsScoreDrawerOpen(false)}
                  className="h-8 px-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 text-xs font-bold gap-1"
                >
                  <ChevronDown className="h-4 w-4" /> Collapse
                </Button>
              </div>
            </div>

            {/* Dynamic Boards List */}
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {boards.map((b) => (
                <div
                  key={b.boardNumber}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/90 border border-white/10"
                >
                  {/* Board Label */}
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black text-xs">
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

                  {/* Scoring Steppers */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Points (+1 / -1) */}
                    <div className="flex items-center gap-2 bg-black/60 p-1.5 rounded-2xl border border-white/10">
                      <span className="text-[11px] font-black text-slate-300 px-1">Pts:</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleModifyBoardScore(b.boardNumber, -1)}
                        disabled={b.score <= 0}
                        className="h-8 w-8 p-0 rounded-xl text-white border-white/10 hover:bg-white/20 text-sm font-black"
                      >
                        -1
                      </Button>
                      <span className="w-8 text-center font-mono font-black text-amber-400 text-base">
                        {b.score}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleModifyBoardScore(b.boardNumber, 1)}
                        className="h-8 w-8 p-0 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm"
                      >
                        +1
                      </Button>
                    </div>

                    {/* Slams (+1 / -1) */}
                    <div className="flex items-center gap-2 bg-black/60 p-1.5 rounded-2xl border border-white/10">
                      <span className="text-[11px] font-black text-sky-400 px-1">Slam:</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleModifyBoardSlam(b.boardNumber, -1)}
                        disabled={b.slams <= 0}
                        className="h-8 w-8 p-0 rounded-xl text-white border-white/10 hover:bg-white/20 text-sm font-black"
                      >
                        -1
                      </Button>
                      <span className="w-8 text-center font-mono font-black text-sky-400 text-base">
                        {b.slams}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleModifyBoardSlam(b.boardNumber, 1)}
                        className="h-8 w-8 p-0 rounded-xl bg-sky-500 hover:bg-sky-600 text-slate-950 font-black text-sm"
                      >
                        ⚡+1
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Board & Collapse Footer */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddNewBoard}
                className="flex-1 py-3 border-dashed border-amber-500/60 text-amber-400 hover:bg-amber-500/10 text-xs font-black rounded-xl gap-2"
              >
                <Plus className="h-4 w-4" /> ADD BOARD {boards.length + 1}
              </Button>
              <Button
                size="sm"
                onClick={() => setIsScoreDrawerOpen(false)}
                className="py-3 px-6 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {/* 6. On-Video Share Modal (No scrolling needed) */}
        {showShareModal && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-40 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-amber-400 font-black text-sm uppercase">
                  <Share2 className="h-4 w-4" /> Share Match Stream
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowShareModal(false)}
                  className="h-7 w-7 p-0 rounded-full text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-xs text-slate-300">
                Anyone with this link can watch your match live or replay the recording on CBOT Arena:
              </p>

              {/* 1-Click Link Copy */}
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-white/10">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="bg-transparent text-xs font-mono text-slate-300 w-full outline-none truncate select-all"
                />
                <Button
                  size="sm"
                  onClick={handleCopyLink}
                  className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shrink-0"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="ml-1">{copied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  onClick={handleWhatsAppShare}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-lg shadow-emerald-600/30"
                >
                  <MessageCircle className="h-4 w-4" /> Share WhatsApp
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowShareModal(false)}
                  className="w-full py-2.5 rounded-xl border-white/20 text-slate-300 hover:text-white text-xs font-bold"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

