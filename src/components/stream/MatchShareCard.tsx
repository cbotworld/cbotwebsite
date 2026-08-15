'use client';

import * as React from 'react';
import { Share2, ExternalLink, Copy, Check, Youtube, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MatchShareCardProps {
  matchId: string;
  youtubeUrl?: string | null;
  youtubeVideoId?: string | null;
  title?: string;
  isLive?: boolean;
}

export default function MatchShareCard({
  matchId,
  youtubeUrl,
  youtubeVideoId,
  title = 'CBOT Match Stream',
  isLive = false,
}: MatchShareCardProps) {
  const [copiedYt, setCopiedYt] = React.useState(false);
  const [copiedArena, setCopiedArena] = React.useState(false);

  // Determine effective YouTube link (ignore sandbox mock IDs)
  const effectiveYoutubeUrl = React.useMemo(() => {
    if (youtubeUrl && !youtubeUrl.includes('cbot_yt_')) return youtubeUrl;
    if (youtubeVideoId && !youtubeVideoId.startsWith('cbot_yt_')) {
      return `https://www.youtube.com/watch?v=${youtubeVideoId}`;
    }
    return null;
  }, [youtubeUrl, youtubeVideoId]);

  // Determine effective CBOT Arena URL
  const arenaUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/matches/${matchId}`
    : `https://www.cbotworld.com/matches/${matchId}`;

  const primaryShareUrl = effectiveYoutubeUrl || arenaUrl;

  const handleCopyYt = () => {
    if (!effectiveYoutubeUrl) return;
    navigator.clipboard.writeText(effectiveYoutubeUrl).then(() => {
      setCopiedYt(true);
      setTimeout(() => setCopiedYt(false), 2500);
    });
  };

  const handleCopyArena = () => {
    navigator.clipboard.writeText(arenaUrl).then(() => {
      setCopiedArena(true);
      setTimeout(() => setCopiedArena(false), 2500);
    });
  };

  const handleWhatsAppShare = () => {
    const text = isLive
      ? `🔴 Watch Live: ${title} on CBOT World! ${primaryShareUrl}`
      : `🎬 Watch Match Video: ${title} on CBOT World! ${primaryShareUrl}`;
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
              Shareable Stream & Video Link
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {effectiveYoutubeUrl ? 'Direct YouTube live stream & match recording links' : 'Share this match page with friends & viewers'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {effectiveYoutubeUrl && (
            <a
              href={effectiveYoutubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-lg shadow-red-600/20"
            >
              <Youtube className="h-4 w-4" />
              <span>{isLive ? 'Watch on YouTube Live' : 'Watch on YouTube'}</span>
              <ExternalLink className="h-3 w-3 opacity-75" />
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

      {/* Links Display & Copy Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* YouTube Link Field */}
        {effectiveYoutubeUrl ? (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/80 border border-red-500/30">
            <div className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-black shrink-0 flex items-center gap-1">
              <Youtube className="h-3 w-3" /> YOUTUBE
            </div>
            <input
              type="text"
              readOnly
              value={effectiveYoutubeUrl}
              className="bg-transparent text-[11px] font-mono text-slate-300 w-full outline-none select-all truncate"
            />
            <Button
              onClick={handleCopyYt}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] font-bold rounded-lg text-slate-300 hover:text-white shrink-0"
            >
              {copiedYt ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Check className="h-3 w-3" /> Copied
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Copy className="h-3 w-3" /> Copy
                </span>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/80 border border-amber-500/20 text-muted-foreground text-[11px]">
            <span className="italic">YouTube video link active upon live broadcast</span>
          </div>
        )}

        {/* CBOT Arena Link Field */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/80 border border-amber-500/30">
          <div className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-[10px] font-black shrink-0">
            CBOT ARENA
          </div>
          <input
            type="text"
            readOnly
            value={arenaUrl}
            className="bg-transparent text-[11px] font-mono text-slate-300 w-full outline-none select-all truncate"
          />
          <Button
            onClick={handleCopyArena}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] font-bold rounded-lg text-slate-300 hover:text-white shrink-0"
          >
            {copiedArena ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="h-3 w-3" /> Copied
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Copy className="h-3 w-3" /> Copy
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
