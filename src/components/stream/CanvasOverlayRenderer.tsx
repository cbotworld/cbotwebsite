'use client';

import * as React from 'react';
import { Camera, RefreshCw, AlertCircle, Video, ShieldCheck, CheckCircle2, Maximize, Minimize, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CanvasOverlayRendererProps {
  playerName: string;
  editionTitle: string;
  matchId: string;
  teamName: string;
  opponentName: string;
  isStreaming: boolean;
  streamStartedAt?: Date | null;
  onStreamReady?: (stream: MediaStream) => void;
  onError?: (errMessage: string) => void;
}

function formatIST(date: Date): string {
  try {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };
    const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '';
    const day = get('day');
    const month = get('month').toUpperCase();
    const year = get('year');
    const hour = get('hour');
    const minute = get('minute');
    const second = get('second');
    return `${day} ${month} ${year} ${hour}:${minute}:${second} IST`;
  } catch {
    return date.toISOString().slice(0, 19).replace('T', ' ') + ' IST';
  }
}

export default function CanvasOverlayRenderer({
  playerName,
  editionTitle,
  matchId,
  teamName,
  opponentName,
  isStreaming,
  streamStartedAt,
  onStreamReady,
  onError,
}: CanvasOverlayRendererProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const animFrameIdRef = React.useRef<number | null>(null);

  const [cameraPermission, setCameraPermission] = React.useState<'granted' | 'denied' | 'pending'>('pending');
  const [facingMode, setFacingMode] = React.useState<'environment' | 'user'>('environment');
  const [currentTimeStr, setCurrentTimeStr] = React.useState<string>('');
  const [elapsedTimerStr, setElapsedTimerStr] = React.useState<string>('00:00:00');
  const [isPortrait, setIsPortrait] = React.useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);
  const [isMuted, setIsMuted] = React.useState<boolean>(true); // Muted by default

  // Handle Fullscreen Event Changes
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error('Error entering fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Error exiting fullscreen:', err);
      });
    }
  };

  const toggleMute = () => {
    setIsMuted((prev) => {
      const newMuted = !prev;
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !newMuted;
        }
      }
      return newMuted;
    });
  };

  // Monitor orientation/resize to detect portrait mode
  React.useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    
    // Lock screen orientation to landscape if supported
    if (window.screen && (window.screen as any).orientation && (window.screen as any).orientation.lock) {
      (window.screen as any).orientation.lock('landscape').catch(() => {});
    }

    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Update live clock in IST every second
  React.useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTimeStr(formatIST(now));

      if (isStreaming && streamStartedAt) {
        const startMs = new Date(streamStartedAt).getTime();
        const diffSecs = Math.max(0, Math.floor((now.getTime() - startMs) / 1000));
        const h = String(Math.floor(diffSecs / 3600)).padStart(2, '0');
        const m = String(Math.floor((diffSecs % 3600) / 60)).padStart(2, '0');
        const s = String(diffSecs % 60).padStart(2, '0');
        setElapsedTimerStr(`${h}:${m}:${s}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isStreaming, streamStartedAt]);

  const onStreamReadyRef = React.useRef(onStreamReady);
  onStreamReadyRef.current = onStreamReady;

  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;

  const isMutedRef = React.useRef(isMuted);
  isMutedRef.current = isMuted;

  // Request Camera & Microphone Stream
  const initCamera = React.useCallback(async (mode: 'environment' | 'user') => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode === 'environment' ? { ideal: 'environment' } : 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: { ideal: 1.7777777778 }
          },
          audio: true,
        });

        // Set initial muted state
        const audioTrack = mediaStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !isMutedRef.current;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          try {
            await videoRef.current.play();
          } catch (playErr: any) {
            // Ignore benign AbortError when play is interrupted by stream re-attachment
            if (playErr.name === 'AbortError' || playErr.message?.includes('aborted by the user agent')) {
              return;
            }
            console.warn('Video play warning:', playErr);
          }
        }

        setCameraPermission('granted');

        // Create Canvas Stream Pipeline
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const canvasStream = canvas.captureStream(30);

          // Add audio track to canvas stream
          const streamAudioTrack = mediaStream.getAudioTracks()[0];
          if (streamAudioTrack) {
            canvasStream.addTrack(streamAudioTrack);
          }

          if (onStreamReadyRef.current) {
            onStreamReadyRef.current(canvasStream);
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted by the user agent')) {
        return;
      }
      console.error('Camera initialization error:', err);
      setCameraPermission('denied');
      if (onErrorRef.current) {
        onErrorRef.current(err.message || 'Camera permission denied or camera not found.');
      }
    }
  }, []);

  React.useEffect(() => {
    initCamera(facingMode);
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode, initCamera]);

  // Toggle Camera Facing Mode (Rear <-> Front)
  const toggleCamera = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
  };

  // High-performance Canvas Rendering Loop
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isMounted = true;

    const renderFrame = () => {
      if (!isMounted) return;

      const width = 1280;
      const height = 720;

      // 1. Clear background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Camera Video Frame (preserving aspect ratio with cover scaling)
      if (video.readyState >= 2) {
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        
        // Calculate aspect-ratio preserving crop/scale parameters (Cover style)
        const scale = Math.max(width / videoWidth, height / videoHeight);
        const x = (width - videoWidth * scale) / 2;
        const y = (height - videoHeight * scale) / 2;
        
        ctx.drawImage(video, x, y, videoWidth * scale, videoHeight * scale);
      }

      // 3. Draw Framing Guidance Guidelines (if not live yet)
      if (!isStreaming) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.lineWidth = 4;
        ctx.setLineDash([12, 8]);
        ctx.strokeRect(100, 80, width - 200, height - 160);
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(width / 2 - 250, height / 2 - 25, 500, 50);

        ctx.font = '900 18px sans-serif';
        ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'center';
        ctx.fillText('POSITION CAMERA SO THE FULL CARROM BOARD IS VISIBLE', width / 2, height / 2 + 6);
      }

      // 4. Draw Top Gradient Header Banner
      const topGradient = ctx.createLinearGradient(0, 0, 0, 100);
      topGradient.addColorStop(0, 'rgba(2, 6, 23, 0.95)');
      topGradient.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = topGradient;
      ctx.fillRect(0, 0, width, 100);

      // Top Header Title: CBOT WORLD
      ctx.textAlign = 'left';
      ctx.font = '900 28px sans-serif';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('CBOT WORLD', 30, 45);

      ctx.font = '800 14px sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`OFFICIAL MATCH BROADCAST • ${editionTitle.toUpperCase()}`, 30, 68);

      // Top Right: Match / Day Label (shifted left to clear Rear Camera button)
      const matchLabel = (() => {
        if (!matchId) return 'DAY 4';
        const monMatch = matchId.match(/monument_(\d+)/i);
        if (monMatch) return `DAY ${monMatch[1]}`;
        if (matchId.startsWith('match_')) return `MATCH ${matchId.replace('match_', '#')}`;
        return matchId.toUpperCase();
      })();

      ctx.textAlign = 'right';
      ctx.font = '900 20px monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(matchLabel, width - 200, 45);

      // 5. Draw Bottom Gradient Footer Banner
      const bottomGradient = ctx.createLinearGradient(0, height - 130, 0, height);
      bottomGradient.addColorStop(0, 'rgba(2, 6, 23, 0)');
      bottomGradient.addColorStop(1, 'rgba(2, 6, 23, 0.95)');
      ctx.fillStyle = bottomGradient;
      ctx.fillRect(0, height - 130, width, 130);

      // Bottom Left: Player Name & Team Info
      ctx.textAlign = 'left';
      ctx.font = '900 24px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(playerName.toUpperCase(), 30, height - 60);

      ctx.font = '700 15px sans-serif';
      ctx.fillStyle = '#34d399';
      ctx.fillText(`${teamName.toUpperCase()}  VS  ${opponentName.toUpperCase()}`, 30, height - 32);

      // Bottom Right: Live Updating Timestamp & Timer
      ctx.textAlign = 'right';
      ctx.font = '900 18px monospace';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(currentTimeStr || '12 AUG 2026 21:30:00', width - 30, height - 60);

      if (isStreaming) {
        ctx.font = '900 16px monospace';
        const liveText = `LIVE  ${elapsedTimerStr}`;
        const textWidth = ctx.measureText(liveText).width;
        const textRight = width - 30;
        const textLeft = textRight - textWidth;

        // Red LIVE Dot (positioned cleanly to the left of LIVE with generous spacing)
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(textLeft - 14, height - 35, 6, 0, 2 * Math.PI);
        ctx.fill();

        // LIVE + Timer Text
        ctx.fillStyle = '#ef4444';
        ctx.fillText(liveText, textRight, height - 30);
      } else {
        ctx.font = '800 14px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('STANDBY • READY TO STREAM', width - 30, height - 30);
      }

      animFrameIdRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      isMounted = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [playerName, editionTitle, matchId, teamName, opponentName, isStreaming, currentTimeStr, elapsedTimerStr]);

  return (
    <div className="space-y-4">
      {/* Hidden Source Video Element */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="hidden"
      />

      {/* Main Responsive Stream Canvas Box */}
      <div ref={containerRef} className="relative rounded-3xl overflow-hidden border-2 border-amber-500/50 bg-slate-950 shadow-2xl aspect-video w-full">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="h-full w-full object-contain"
        />

        {/* Rotate to Landscape Prompt Overlay */}
        {isPortrait && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 z-20">
            <div className="h-16 w-16 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-400 animate-spin">
              <RefreshCw className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-amber-400">Rotate Device to Landscape</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Matches must be streamed in landscape orientation. Please turn your device sideways to continue.
              </p>
            </div>
          </div>
        )}

        {/* Camera Permission Overlay Warning */}
        {cameraPermission === 'denied' && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-400">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-rose-400">Camera Permission Required</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Please allow browser camera and microphone permissions to stream your CBOT match.
              </p>
            </div>
            <Button
              onClick={() => initCamera(facingMode)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl"
            >
              Retry Camera Permission
            </Button>
          </div>
        )}

        {/* Camera Control Action Bar */}
        {cameraPermission === 'granted' && (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            {/* Mute / Unmute Toggle Button */}
            <Button
              onClick={toggleMute}
              variant="outline"
              size="icon"
              className={`bg-slate-950/80 border-amber-500/40 hover:bg-amber-500/20 h-8 w-8 rounded-xl shadow-lg ${
                isMuted ? 'text-rose-500 hover:text-rose-400' : 'text-emerald-400 hover:text-emerald-300'
              }`}
              title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>

            {/* Fullscreen Button */}
            <Button
              onClick={toggleFullscreen}
              variant="outline"
              size="icon"
              className="bg-slate-950/80 border-amber-500/40 text-amber-400 hover:bg-amber-500/20 h-8 w-8 rounded-xl shadow-lg"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </Button>

            {/* Rear/Front Camera Toggle Button (Icon Only) */}
            <Button
              onClick={toggleCamera}
              variant="outline"
              size="icon"
              className="bg-slate-950/80 border-amber-500/40 text-amber-400 hover:bg-amber-500/20 h-8 w-8 rounded-xl shadow-lg"
              title={facingMode === 'environment' ? 'Switch to Front Camera' : 'Switch to Rear Camera'}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
