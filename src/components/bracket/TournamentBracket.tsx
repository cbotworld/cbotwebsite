'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Match } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Trophy, Crown, Flame, Play, Clock, CheckCircle2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface TournamentBracketProps {
  matches: Match[];
  onSelectMatch?: (match: Match) => void;
}

export function TournamentBracket({ matches, onSelectMatch }: TournamentBracketProps) {
  const [selectedMatch, setSelectedMatch] = React.useState<Match | null>(null);

  // Group matches by round
  const roundsMap = React.useMemo(() => {
    const map: Record<number, Match[]> = {};
    matches.forEach((match) => {
      if (!map[match.round]) map[match.round] = [];
      map[match.round].push(match);
    });
    return map;
  }, [matches]);

  const rounds = Object.keys(roundsMap)
    .map(Number)
    .sort((a, b) => a - b);

  const getRoundName = (round: number, totalRounds: number) => {
    if (round === totalRounds) return 'Grand Finals';
    if (round === totalRounds - 1) return 'Semi Finals';
    if (round === totalRounds - 2) return 'Quarter Finals';
    return `Round ${round}`;
  };

  const handleMatchClick = (match: Match) => {
    setSelectedMatch(match);
    if (onSelectMatch) onSelectMatch(match);
  };

  return (
    <div className="w-full overflow-x-auto touch-scroll-x pb-6">
      <div className="min-w-[850px] flex items-stretch justify-around gap-8 p-4">
        {rounds.map((roundNum, roundIdx) => {
          const roundMatches = roundsMap[roundNum];
          const isFinal = roundNum === rounds.length;

          return (
            <div key={roundNum} className="flex-1 flex flex-col justify-around relative">
              {/* Round Header */}
              <div className="mb-6 text-center">
                <Badge
                  variant={isFinal ? 'carrom' : 'outline'}
                  className="px-4 py-1 text-xs uppercase tracking-wider font-bold shadow-sm"
                >
                  {isFinal && <Trophy className="h-3.5 w-3.5 mr-1 text-amber-500 inline" />}
                  {getRoundName(roundNum, rounds.length)}
                </Badge>
              </div>

              {/* Match Cards List in this round */}
              <div className="flex flex-col justify-around flex-1 space-y-8">
                {roundMatches.map((match, matchIdx) => {
                  const isMatchLive = match.status === 'LIVE';
                  const isCompleted = match.status === 'COMPLETED';

                  const isTeam1Winner = match.winnerId && match.winnerId === match.team1Id;
                  const isTeam2Winner = match.winnerId && match.winnerId === match.team2Id;

                  return (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: roundIdx * 0.1 + matchIdx * 0.05 }}
                      onClick={() => handleMatchClick(match)}
                      className={`relative cursor-pointer rounded-2xl border transition-all duration-300 p-3.5 ${
                        isMatchLive
                          ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20 ring-2 ring-amber-500/50'
                          : isCompleted
                          ? 'border-border/80 bg-card hover:border-amber-500/50 hover:shadow-md'
                          : 'border-dashed border-border bg-card/40 hover:bg-card'
                      }`}
                    >
                      {/* Live Badge indicator */}
                      {isMatchLive && (
                        <div className="absolute -top-3 left-4 flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-black text-slate-950 shadow-sm animate-pulse">
                          <Play className="h-2.5 w-2.5 fill-slate-950" /> LIVE MATCH
                        </div>
                      )}

                      {/* Match Header Info */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2.5 px-1">
                        <span className="font-semibold">Table #{match.tableNumber || 1}</span>
                        <span>{match.scheduledTime ? new Date(match.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}</span>
                      </div>

                      {/* Team 1 Row */}
                      <div
                        className={`flex items-center justify-between p-2 rounded-xl transition-colors ${
                          isTeam1Winner ? 'bg-amber-500/15 border border-amber-500/30 font-bold' : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar
                            src={match.team1?.logo}
                            fallback={match.team1?.tag || 'T1'}
                            size="sm"
                          />
                          <span className="truncate text-sm font-semibold">
                            {match.team1?.name || 'TBD'}
                          </span>
                          {match.queenStrikes1 > 0 && (
                            <span className="flex items-center text-[10px] font-bold text-pink-500 bg-pink-500/10 px-1.5 py-0.5 rounded-full" title={`${match.queenStrikes1} Queen Strikes`}>
                              <Crown className="h-3 w-3 mr-0.5" />
                              {match.queenStrikes1}
                            </span>
                          )}
                        </div>
                        <span className={`text-base font-mono font-extrabold ${isTeam1Winner ? 'text-amber-500' : 'text-foreground'}`}>
                          {match.score1}
                        </span>
                      </div>

                      {/* Divider */}
                      <div className="my-1 border-t border-border/50" />

                      {/* Team 2 Row */}
                      <div
                        className={`flex items-center justify-between p-2 rounded-xl transition-colors ${
                          isTeam2Winner ? 'bg-amber-500/15 border border-amber-500/30 font-bold' : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar
                            src={match.team2?.logo}
                            fallback={match.team2?.tag || 'T2'}
                            size="sm"
                          />
                          <span className="truncate text-sm font-semibold">
                            {match.team2?.name || 'TBD'}
                          </span>
                          {match.queenStrikes2 > 0 && (
                            <span className="flex items-center text-[10px] font-bold text-pink-500 bg-pink-500/10 px-1.5 py-0.5 rounded-full" title={`${match.queenStrikes2} Queen Strikes`}>
                              <Crown className="h-3 w-3 mr-0.5" />
                              {match.queenStrikes2}
                            </span>
                          )}
                        </div>
                        <span className={`text-base font-mono font-extrabold ${isTeam2Winner ? 'text-amber-500' : 'text-foreground'}`}>
                          {match.score2}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Match Details Preview Dialog */}
      {selectedMatch && (
        <Dialog open={!!selectedMatch} onOpenChange={() => setSelectedMatch(null)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Match Details #{selectedMatch.matchNumber}
            </DialogTitle>
            <DialogDescription>
              Table #{selectedMatch.tableNumber} • Round {selectedMatch.round}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center">
              <div>
                <Avatar src={selectedMatch.team1?.logo} fallback={selectedMatch.team1?.tag || 'T1'} size="lg" className="mx-auto mb-2" />
                <div className="font-bold text-sm">{selectedMatch.team1?.name}</div>
                <div className="text-2xl font-black text-amber-500 mt-1">{selectedMatch.score1}</div>
                <div className="text-xs text-pink-500 mt-1 flex items-center justify-center gap-1">
                  <Crown className="h-3.5 w-3.5" /> {selectedMatch.queenStrikes1} Queens
                </div>
              </div>

              <div>
                <Avatar src={selectedMatch.team2?.logo} fallback={selectedMatch.team2?.tag || 'T2'} size="lg" className="mx-auto mb-2" />
                <div className="font-bold text-sm">{selectedMatch.team2?.name}</div>
                <div className="text-2xl font-black text-amber-500 mt-1">{selectedMatch.score2}</div>
                <div className="text-xs text-pink-500 mt-1 flex items-center justify-center gap-1">
                  <Crown className="h-3.5 w-3.5" /> {selectedMatch.queenStrikes2} Queens
                </div>
              </div>
            </div>

            {selectedMatch.proofNotes && (
              <div className="p-3 rounded-xl bg-muted text-xs space-y-1">
                <span className="font-bold text-foreground block">Referee Notes / Official Summary:</span>
                <p className="text-muted-foreground">{selectedMatch.proofNotes}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setSelectedMatch(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
