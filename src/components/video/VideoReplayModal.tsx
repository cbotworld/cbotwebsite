'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ExternalLink, Video, X, Trophy, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type VideoReplayModalProps = {
  isOpen: boolean;
  onClose: () => void;
  videoUrl?: string | null;
  youtubeVideoId?: string | null;
  playerName?: string | null;
  dayNumber?: number | null;
  teamName?: string | null;
  matchTitle?: string | null;
};

export function extractYouTubeId(urlOrId?: string | null): string | null {
  if (!urlOrId) return null;
  const clean = urlOrId.trim();
  if (!clean.includes('/') && !clean.includes('?') && clean.length >= 8 && clean.length <= 16) {
    return clean;
  }
  const match = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|(?:embed|v)\/))([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

export function VideoReplayModal({
  isOpen,
  onClose,
  videoUrl,
  youtubeVideoId,
  playerName,
  dayNumber,
  teamName,
  matchTitle,
}: VideoReplayModalProps) {
  const vidId = youtubeVideoId || extractYouTubeId(videoUrl);
  const directWatchUrl = vidId ? `https://www.youtube.com/watch?v=${vidId}` : videoUrl;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] sm:w-full p-0 overflow-hidden bg-slate-950 border border-amber-500/40 text-foreground shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b border-border/60 bg-gradient-to-r from-amber-950/40 via-card to-background">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {dayNumber ? (
              <Badge variant="carrom" className="text-[10px] font-black uppercase px-2 py-0.5">
                Day {dayNumber}
              </Badge>
            ) : null}
            {teamName ? (
              <Badge variant="outline" className="text-[10px] font-bold border-amber-500/30 text-amber-300">
                {teamName}
              </Badge>
            ) : null}
            <Badge variant="secondary" className="text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
              <Video className="h-3 w-3" /> Live Match Video
            </Badge>
          </div>

          <DialogTitle className="text-base sm:text-lg font-black text-foreground flex items-center justify-between gap-2">
            <span>{playerName ? `${playerName}'s Match Recording` : 'Player Match Stream'}</span>
          </DialogTitle>

          <DialogDescription className="text-xs text-muted-foreground">
            {matchTitle || (playerName && dayNumber ? `Day ${dayNumber} match stream and score replay for ${playerName}.` : 'Official tournament video stream replay.')}
          </DialogDescription>
        </DialogHeader>

        {/* Video Player Frame */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center">
          {vidId ? (
            <iframe
              src={`https://www.youtube.com/embed/${vidId}?autoplay=1&rel=0&modestbranding=1`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0"
            />
          ) : (
            <div className="p-8 text-center text-muted-foreground space-y-2">
              <Video className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-semibold">Video stream replay is currently processing or unavailable.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-border/60 bg-card/60 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs text-muted-foreground">
            {playerName ? <span className="font-bold text-foreground">{playerName}</span> : null}
            {dayNumber ? ` · Day ${dayNumber}` : ''}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {directWatchUrl ? (
              <a
                href={directWatchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-red-600 hover:bg-red-500 text-white transition-colors shadow-md"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Watch on YouTube
              </a>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs font-bold border-border hover:bg-muted"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
