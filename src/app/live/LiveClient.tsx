'use client';

import * as React from 'react';
import { MOCK_MATCHES, MOCK_TOURNAMENTS } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Radio, Crown, Play, Trophy, Volume2, ShieldCheck, Flame } from 'lucide-react';
import Link from 'next/link';
import { DEFAULT_WEBSITE_CMS } from '@/lib/website-cms';

export function LiveClient({
  shortName = DEFAULT_WEBSITE_CMS.site.shortName,
  editionLabel = DEFAULT_WEBSITE_CMS.site.editionLabel,
}: {
  shortName?: string;
  editionLabel?: string;
}) {
  const liveMatch = MOCK_MATCHES.find((m) => m.status === 'LIVE') || MOCK_MATCHES[2];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-3 w-3 rounded-full bg-rose-600 animate-ping" />
            <Badge variant="warning" className="font-bold uppercase tracking-wider">
              <Radio className="h-3.5 w-3.5 mr-1 animate-pulse" /> Official {shortName} Broadcast Desk
            </Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Live Matches & Stream Arena</h1>
        </div>
      </div>

      {/* Main Broadcast Video / Stream Player Graphic Card */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/40 bg-slate-950 p-6 sm:p-10 shadow-2xl text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent pointer-events-none" />

        <div className="relative space-y-6">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <Badge variant="carrom">{shortName} {editionLabel} • Board 1</Badge>
              <span className="text-xs text-amber-400 font-mono">1080p 60fps Live Stream</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <Radio className="h-4 w-4 animate-pulse" /> 1,420 Viewers Online
            </div>
          </div>

          {/* Live Score Graphic Box */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            
            {/* Team 1 */}
            <div className="sm:col-span-5 text-center space-y-2">
              <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl overflow-hidden bg-slate-950 p-2 border-2 border-amber-500/50 shadow-2xl mx-auto flex items-center justify-center">
                <img src={liveMatch.team1?.logo || '/logo.png'} alt={liveMatch.team1?.name} className="h-full w-full object-contain" />
              </div>
              <h3 className="text-xl font-extrabold">{liveMatch.team1?.name}</h3>
              <div className="text-4xl font-black text-amber-400 font-mono">{liveMatch.score1}</div>
              <div className="text-xs text-pink-400 font-semibold flex items-center justify-center gap-1">
                <Crown className="h-3.5 w-3.5" /> {liveMatch.queenStrikes1} Queens Covered
              </div>
            </div>

            {/* VS Center Divider */}
            <div className="sm:col-span-2 text-center">
              <span className="text-2xl font-black text-amber-500 italic bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/30">
                VS
              </span>
              <div className="text-[11px] text-slate-400 mt-3 font-semibold">Board 3 Final Frame</div>
            </div>

            {/* Team 2 */}
            <div className="sm:col-span-5 text-center space-y-2">
              <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl overflow-hidden bg-slate-950 p-2 border-2 border-amber-500/50 shadow-2xl mx-auto flex items-center justify-center">
                <img src={liveMatch.team2?.logo || '/logo.png'} alt={liveMatch.team2?.name} className="h-full w-full object-contain" />
              </div>
              <h3 className="text-xl font-extrabold">{liveMatch.team2?.name}</h3>
              <div className="text-4xl font-black text-amber-400 font-mono">{liveMatch.score2}</div>
              <div className="text-xs text-pink-400 font-semibold flex items-center justify-center gap-1">
                <Crown className="h-3.5 w-3.5" /> {liveMatch.queenStrikes2} Queens Covered
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <p className="text-xs text-slate-300">
              Live commentary hosted by <span className="text-amber-400 font-bold">Balu Master</span>. Referee verified stream.
            </p>
            <Link href="/tournaments/tour_1">
              <Button variant="carrom" className="font-bold text-xs">
                Open Full Interactive Bracket <Play className="h-3.5 w-3.5 ml-1 fill-slate-950" />
              </Button>
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
