'use client';

import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { Radio, Volume2, VolumeX, Maximize, Minimize, Loader2, Sparkles, Trophy, Users, RefreshCw, CheckCircle2, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface WebRTCLiveViewerProps {
  matchId: string;
  player1Name?: string;
  player2Name?: string;
  team1Name?: string;
  team2Name?: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export default function WebRTCLiveViewer({
  matchId,
  player1Name = 'Player 1',
  player2Name = 'Player 2',
  team1Name = 'Team 1',
  team2Name = 'Team 2',
}: WebRTCLiveViewerProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const peerRef = React.useRef<RTCPeerConnection | null>(null);
  const [hasStream, setHasStream] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(true);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [latestSnapshot, setLatestSnapshot] = React.useState<string | null>(null);
  const [liveScores, setLiveScores] = React.useState<{ totalScore: number; totalSlams: number } | null>(null);
  const [viewerCount, setViewerCount] = React.useState(1);
  const [connectionStatus, setConnectionStatus] = React.useState<'connecting' | 'connected' | 'waiting'>('connecting');
  const [finishedVideoUrl, setFinishedVideoUrl] = React.useState<string | null>(null);
  const viewerIdRef = React.useRef<string>(`v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

  React.useEffect(() => {
    const channelName = `cbot_match_${matchId}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    const cleanupPeer = () => {
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
    };

    const setupPeer = () => {
      cleanupPeer();
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerRef.current = pc;

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
            videoRef.current.muted = true;
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
              playPromise.catch((e) => console.warn('AutoPlay play error:', e));
            }
          }
          setHasStream(true);
          setConnectionStatus('connected');
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channel.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: {
              target: 'broadcaster',
              sender: viewerIdRef.current,
              candidate: event.candidate,
            },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnectionStatus('connected');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setConnectionStatus('waiting');
        }
      };

      return pc;
    };

    // Listen for broadcaster events
    channel
      .on('broadcast', { event: 'stream-offer' }, async ({ payload }) => {
        if (payload.target && payload.target !== viewerIdRef.current) return;
        try {
          const pc = setupPeer();
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          channel.send({
            type: 'broadcast',
            event: 'stream-answer',
            payload: {
              target: payload.sender || 'broadcaster',
              sender: viewerIdRef.current,
              answer: answer,
            },
          });
        } catch (err) {
          console.warn('WebRTC offer error:', err);
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.target && payload.target !== viewerIdRef.current) return;
        if (peerRef.current && payload.candidate) {
          try {
            await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) {
            console.warn('Error adding ICE candidate:', e);
          }
        }
      })
      .on('broadcast', { event: 'stream-frame' }, ({ payload }) => {
        // High-speed fallback live frame only if WebRTC not connected
        if (payload.frame && !hasStream) {
          setLatestSnapshot(payload.frame);
          setConnectionStatus('connected');
        }
        if (payload.scores) {
          setLiveScores(payload.scores);
        }
      })
      .on('broadcast', { event: 'score-update' }, ({ payload }) => {
        if (payload.scores) {
          setLiveScores(payload.scores);
        }
      })
      .on('broadcast', { event: 'match-ended' }, ({ payload }: { payload: any }) => {
        if (payload?.videoUrl) {
          setFinishedVideoUrl(payload.videoUrl);
          setHasStream(false);
          setConnectionStatus('connected');
        }
      })
      .on('broadcast', { event: 'broadcaster-live' }, () => {
        // Broadcaster signaled active, request offer
        channel.send({
          type: 'broadcast',
          event: 'viewer-join',
          payload: { viewerId: viewerIdRef.current },
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Announce presence to broadcaster
          channel.send({
            type: 'broadcast',
            event: 'viewer-join',
            payload: { viewerId: viewerIdRef.current },
          });
        }
      });

    // Re-request offer every 4 seconds if not yet connected
    const retryInterval = setInterval(() => {
      if (!hasStream) {
        channel.send({
          type: 'broadcast',
          event: 'viewer-join',
          payload: { viewerId: viewerIdRef.current },
        });
      }
    }, 4000);

    // Auto-resume video playback and reconnect WebRTC on tab visibility change
    const handleViewerFocus = () => {
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
      if (!hasStream) {
        channel.send({
          type: 'broadcast',
          event: 'viewer-join',
          payload: { viewerId: viewerIdRef.current },
        });
      }
    };

    document.addEventListener('visibilitychange', handleViewerFocus);
    window.addEventListener('focus', handleViewerFocus);
    window.addEventListener('pageshow', handleViewerFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleViewerFocus);
      window.removeEventListener('focus', handleViewerFocus);
      window.removeEventListener('pageshow', handleViewerFocus);
      clearInterval(retryInterval);
      cleanupPeer();
      supabase.removeChannel(channel);
    };
  }, [matchId, hasStream]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative rounded-3xl overflow-hidden border-2 border-amber-500/40 bg-slate-950 aspect-video shadow-2xl flex items-center justify-center group select-none"
    >
      {/* 0. Instant Match Replay (When Match Ends) */}
      {finishedVideoUrl && (
        <div className="relative w-full h-full bg-black flex items-center justify-center">
          <video
            src={finishedVideoUrl}
            controls
            autoPlay
            playsInline
            className="h-full w-full object-contain bg-black"
          />
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
            <Badge className="bg-emerald-600 text-white font-black text-xs px-3 py-1.5 gap-1.5 shadow-lg shadow-emerald-600/30">
              <CheckCircle2 className="h-3.5 w-3.5" /> REPLAY READY (72H RETENTION)
            </Badge>
            <a
              href={finishedVideoUrl}
              download={`cbot_match_${matchId}.webm`}
              className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          </div>
        </div>
      )}

      {/* 1. Live WebRTC Video Element */}
      {!finishedVideoUrl && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className={`h-full w-full object-contain bg-black ${hasStream ? 'block' : 'hidden'}`}
        />
      )}

      {/* 2. Real-Time Snapshot Stream Fallback */}
      {!finishedVideoUrl && !hasStream && latestSnapshot && (
        <img
          src={latestSnapshot}
          alt="Live Match Feed"
          className="h-full w-full object-contain bg-black"
        />
      )}

      {/* 3. Connecting / Waiting State */}
      {!finishedVideoUrl && !hasStream && !latestSnapshot && (
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-500 animate-pulse">
            <Radio className="h-8 w-8" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-lg font-black text-white uppercase tracking-wider flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              Connecting to Live Match Stream…
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Connecting directly to the player's studio camera and real-time scoreboard.
            </p>
          </div>
        </div>
      )}

      {/* Minimal Floating Controls (Mute & Fullscreen) */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/70 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <Button
          size="sm"
          variant="ghost"
          onClick={toggleMute}
          className="h-8 w-8 p-0 rounded-xl text-white hover:bg-white/20"
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={toggleFullscreen}
          className="h-8 w-8 p-0 rounded-xl text-white hover:bg-white/20"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
