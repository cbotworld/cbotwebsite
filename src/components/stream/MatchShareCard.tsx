'use client';

import * as React from 'react';
import { Share2, ExternalLink, Copy, Check, MessageCircle, Radio, Sparkles, Download, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MatchShareCardProps {
  matchId: string;
  youtubeUrl?: string | null;
  youtubeVideoId?: string | null;
  title?: string;
  isLive?: boolean;
  showWatchButton?: boolean;
}

export default function MatchShareCard({
  matchId,
  youtubeUrl,
  youtubeVideoId,
  title = 'CBOT Match Stream',
  isLive = false,
  showWatchButton = true,
}: MatchShareCardProps) {
  const [copiedArena, setCopiedArena] = React.useState(false);

  // Direct CBOT Arena Match URL
  const arenaUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/matches/${matchId}`
    : `https://www.cbotworld.com/matches/${matchId}`;

  const isDirectVideo = !!youtubeUrl && (youtubeUrl.startsWith('http') || youtubeUrl.startsWith('/')) && !youtubeUrl.includes('youtube.com');

  const handleCopyArena = () => {
    navigator.clipboard.writeText(arenaUrl).then(() => {
      setCopiedArena(true);
      setTimeout(() => setCopiedArena(false), 2500);
    });
  };

  const handleWhatsAppShare = () => {
    const text = isLive
      ? `🔴 Watch Live: ${title} on CBOT Arena! ${arenaUrl}`
      : `🎬 Watch Match Video: ${title} on CBOT Arena! ${arenaUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-amber-500/30 p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Share2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
              Shareable Match Link &amp; Recording
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Share this official link with spectators or download the recording locally
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {showWatchButton && (
            <a
              href={arenaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition-colors shadow-lg shadow-amber-500/20"
            >
              {isLive ? <Radio className="h-4 w-4" /> : <Video className="h-4 w-4" />}
              <span>{isLive ? 'Watch Live on Arena' : 'Watch Match Video'}</span>
              <ExternalLink className="h-3 w-3 opacity-75" />
            </a>
          )}

          {isDirectVideo && (
            <a
              href={youtubeUrl}
              download={`cbot_match_${matchId}.webm`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-lg shadow-emerald-600/20"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Video</span>
            </a>
          )}

          <Button
            onClick={handleWhatsAppShare}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs font-bold rounded-xl border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 h-8"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Share WhatsApp
          </Button>
        </div>
      </div>

      {/* Arena Link Display & 1-Click Copy Box */}
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-amber-500/30">
        <div className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[10px] font-black shrink-0 flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> CBOT ARENA LINK
        </div>
        <input
          type="text"
          readOnly
          value={arenaUrl}
          className="bg-transparent text-xs font-mono text-slate-300 w-full outline-none select-all truncate"
        />
        <Button
          onClick={handleCopyArena}
          size="sm"
          className="h-8 px-3 text-xs font-black rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 shrink-0 gap-1.5"
        >
          {copiedArena ? (
            <span className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Copied!
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Copy className="h-3.5 w-3.5" /> Copy Link
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
