'use client';

import * as React from 'react';
import {
  Play,
  ExternalLink,
  Video,
  X,
  ChevronDown,
  ChevronUp,
  Youtube,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export type PlayerStreamInfo = {
  playerName: string;
  dayNumber: number;
  editionNumber?: number | null;
  youtubeVideoId: string | null;
  youtubeUrl: string | null;
  status?: string;
  teamName?: string | null;
};

export type MatchVideoPlayerProps = {
  players: string[];
  dayNumber: number;
  editionNumber?: number;
  matchTitle?: string;
  team1Name?: string;
  team2Name?: string;
  activePlayer?: string | null;
  onSelectPlayer?: (playerName: string) => void;
  onClose?: () => void;
  isModal?: boolean;
};

export function MatchVideoPlayer({
  players,
  dayNumber,
  editionNumber,
  matchTitle,
  team1Name,
  team2Name,
  activePlayer,
  onSelectPlayer,
  onClose,
  isModal = false,
}: MatchVideoPlayerProps) {
  // Resolve active player against players array (case-insensitive)
  const resolveTargetPlayer = React.useCallback(
    (target?: string | null): string => {
      if (!target || !target.trim()) return players[0] || '';
      const normTarget = target.trim().toLowerCase();
      const found = players.find(
        (p) => p.trim().toLowerCase() === normTarget
      );
      if (found) return found;
      const partial = players.find((p) => {
        const normP = p.trim().toLowerCase();
        return normP.includes(normTarget) || normTarget.includes(normP);
      });
      return partial || target.trim();
    },
    [players]
  );

  const [selectedPlayer, setSelectedPlayer] = React.useState<string>(() =>
    resolveTargetPlayer(activePlayer)
  );
  const [streamMap, setStreamMap] = React.useState<Record<string, PlayerStreamInfo>>({});
  const [loading, setLoading] = React.useState(true);
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  // Sync selectedPlayer whenever activePlayer or players change
  React.useEffect(() => {
    if (activePlayer) {
      const resolved = resolveTargetPlayer(activePlayer);
      setSelectedPlayer(resolved);
      setIsCollapsed(false);
    }
  }, [activePlayer, resolveTargetPlayer]);

  // Helper to look up stream in any map
  const getStreamFromMap = React.useCallback(
    (map: Record<string, PlayerStreamInfo>, playerName: string): PlayerStreamInfo | null => {
      if (!playerName) return null;
      if (map[playerName]) return map[playerName];
      const target = playerName.trim().toLowerCase();
      const entry = Object.entries(map).find(
        ([k]) => k.trim().toLowerCase() === target
      );
      if (entry) return entry[1];
      const partial = Object.entries(map).find(([k]) => {
        const normK = k.trim().toLowerCase();
        return normK.includes(target) || target.includes(normK);
      });
      return partial ? partial[1] : null;
    },
    []
  );

  // Fetch streams for all players in this match
  React.useEffect(() => {
    if (!players || players.length === 0) return;
    let cancelled = false;
    setLoading(true);

    const fetchStreams = async () => {
      try {
        const query = new URLSearchParams({
          day: String(dayNumber),
          players: players.join(','),
        });
        if (editionNumber) query.set('edition', String(editionNumber));
        if (team1Name || team2Name) {
          query.set('teams', [team1Name, team2Name].filter(Boolean).join(','));
        }

        const res = await fetch(`/api/videos/match?${query.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch streams');
        const data = await res.json();
        if (!cancelled && data.success && data.streams) {
          const map = data.streams as Record<string, PlayerStreamInfo>;
          setStreamMap(map);

          // If activePlayer was not explicitly set or if current selectedPlayer has no video,
          // prefer selecting the first player in this match who has a video available
          setSelectedPlayer((prev) => {
            if (activePlayer) {
              return resolveTargetPlayer(activePlayer);
            }
            const currentHasVid = Boolean(getStreamFromMap(map, prev)?.youtubeVideoId);
            if (currentHasVid) return prev;
            const firstWithVid = players.find((p) =>
              Boolean(getStreamFromMap(map, p)?.youtubeVideoId)
            );
            return firstWithVid || prev;
          });
        }
      } catch (e) {
        console.error('Error loading match streams:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStreams();
    return () => {
      cancelled = true;
    };
  }, [players.join(','), dayNumber, editionNumber, team1Name, team2Name, activePlayer, getStreamFromMap, resolveTargetPlayer]);

  // Robust case-insensitive stream lookup
  const getStreamForPlayer = React.useCallback(
    (playerName: string): PlayerStreamInfo | null => {
      return getStreamFromMap(streamMap, playerName);
    },
    [streamMap, getStreamFromMap]
  );

  const currentStream = getStreamForPlayer(selectedPlayer);
  const vidId = currentStream?.youtubeVideoId;
  const youtubeUrl =
    currentStream?.youtubeUrl ||
    (vidId ? `https://www.youtube.com/watch?v=${vidId}` : null) ||
    `https://www.youtube.com/results?search_query=Carrom+Balu+CBOT+Edition+${editionNumber || 205}+${encodeURIComponent(selectedPlayer)}+Day+${dayNumber}`;

  const handleSelect = (playerName: string) => {
    setSelectedPlayer(playerName);
    onSelectPlayer?.(playerName);
    setIsCollapsed(false);
  };

  const content = (
    <div className="rounded-2xl border border-amber-500/40 bg-slate-950 overflow-hidden shadow-2xl space-y-0">
      {/* Top Header Bar */}
      <div className="px-3.5 sm:px-4 py-2.5 bg-gradient-to-r from-amber-950/60 via-card to-background border-b border-border/60 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="carrom" className="text-[10px] font-black uppercase px-2 py-0.5 flex items-center gap-1 shadow-xs">
            <Video className="h-3 w-3" /> Match Videos
          </Badge>
          <span className="text-xs font-black text-amber-300">
            Day {dayNumber}
            {matchTitle ? ` · ${matchTitle}` : ''}
          </span>
          <span className="text-[10px] text-muted-foreground font-semibold">
            ({players.length} Players in this Match)
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {!isModal && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              title={isCollapsed ? 'Expand video player' : 'Collapse video player'}
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              title="Close player"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Player Selector Bar - Multi-line Wrapped onto Next Line */}
          <div className="bg-muted/40 border-b border-border/40 px-3 sm:px-4 py-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Play className="h-2.5 w-2.5 text-amber-500 fill-amber-500" /> Watch Player:
              </span>
              <span className="text-[10px] text-muted-foreground font-semibold">
                Click any player to play their recording
              </span>
            </div>

            {/* Players wrapped onto next lines */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {players.map((pName) => {
                const isSelected =
                  selectedPlayer.trim().toLowerCase() === pName.trim().toLowerCase();
                const hasStream = Boolean(getStreamForPlayer(pName)?.youtubeVideoId);

                return (
                  <button
                    key={pName}
                    type="button"
                    onClick={() => handleSelect(pName)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 ring-2 ring-amber-400 font-extrabold'
                        : hasStream
                        ? 'bg-card text-foreground border border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/10'
                        : 'bg-card/60 text-muted-foreground border border-border/60 hover:text-foreground'
                    }`}
                  >
                    <span>{pName}</span>
                    {hasStream ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          isSelected ? 'bg-slate-950' : 'bg-emerald-400'
                        }`}
                        title="Recording stream available"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Video Player Display */}
          <div className="relative w-full aspect-video bg-black flex items-center justify-center">
            {vidId ? (
              <iframe
                src={`https://www.youtube.com/embed/${vidId}?autoplay=1&rel=0&modestbranding=1`}
                title={`${selectedPlayer} Match Video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-0"
              />
            ) : loading ? (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-2">
                <div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                <p className="text-xs font-bold text-muted-foreground">Loading video stream for {selectedPlayer}…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 max-w-md">
                <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Video className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-base font-black text-foreground">{selectedPlayer}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No recording uploaded yet for <strong className="text-amber-400">Edition {editionNumber || 205} · Day {dayNumber}</strong>.
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 mt-1">
                    Click any player with a <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mx-1 align-middle" /> green dot above to watch their match video.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black bg-red-600 hover:bg-red-500 text-white transition-colors shadow-md"
                  >
                    <Youtube className="h-3.5 w-3.5" /> Search YouTube for Edition {editionNumber || 205}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Video Info Footer */}
          <div className="px-3.5 sm:px-4 py-2.5 bg-card/90 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-extrabold text-amber-400 truncate">{selectedPlayer}</span>
              {currentStream?.teamName ? (
                <span className="text-[11px] font-semibold text-muted-foreground truncate">
                  ({currentStream.teamName})
                </span>
              ) : null}
              <span className="text-[10px] text-muted-foreground">
                · Edition {currentStream?.editionNumber || editionNumber || 205} · Day {dayNumber} Match
                {!vidId ? ' (Not recorded yet)' : ''}
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg bg-red-600/15 text-red-400 hover:bg-red-600/25 border border-red-500/30 transition-colors"
              >
                <Youtube className="h-3 w-3" /> Watch on YouTube <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (isModal) {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose?.()} className="max-w-4xl w-[96vw]">
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-slate-950 border border-amber-500/40 text-foreground shadow-2xl rounded-2xl">
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return content;
}
