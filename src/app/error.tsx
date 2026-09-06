'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RefreshCw, Home, Trophy, Sparkles, Target, ShieldAlert, Award } from 'lucide-react';

const CARROM_PRO_TIPS = [
  "💡 Pro Tip: A clean striker release and consistent board powder make all the difference in tight combi matches.",
  "⚡ Champion's Rule: Master the rebound angle to pocket tough edge coins when the center is blocked.",
  "🎯 Focus Tip: Take a steady breath before executing high-pressure queen cover shots.",
  "🏆 CBOT Spirit: Every great striker misses a pocket occasionally — what matters is the next winning strike!"
];

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [tipIndex, setTipIndex] = React.useState(0);

  React.useEffect(() => {
    console.error('Unhandled client exception:', error);
    // Pick a random tip on mount
    setTipIndex(Math.floor(Math.random() * CARROM_PRO_TIPS.length));
  }, [error]);

  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="relative mx-auto max-w-lg w-full rounded-3xl border border-amber-500/30 bg-gradient-to-b from-card via-card/90 to-background p-8 sm:p-10 shadow-2xl shadow-amber-500/10 backdrop-blur-xl">
        {/* Glow effect */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Animated Badge & Striker Icon */}
        <div className="relative mb-6 inline-flex flex-col items-center">
          <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/30 ring-4 ring-amber-500/20">
            <Target className="h-10 w-10 animate-pulse" />
            <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 border-2 border-amber-400 text-amber-400 shadow">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
          </div>
          <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <ShieldAlert className="h-3 w-3 text-amber-400" /> Tactical Timeout
          </span>
        </div>

        {/* Engaging Player Header */}
        <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
          Missed the Pocket! 🎯
        </h2>
        
        <p className="mt-3 text-sm text-slate-300 sm:text-base leading-relaxed font-medium">
          Even champion strikers hit the rim sometimes! A brief technical carom occurred while loading your match data.
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          Chalk your striker, take a quick breath, and jump right back into the arena.
        </p>

        {/* Interactive Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={() => reset()}
            size="lg"
            className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black shadow-lg shadow-amber-500/25 gap-2 rounded-2xl px-7 py-6 text-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <RefreshCw className="h-4 w-4 stroke-[2.5]" />
            Chalk Striker & Strike Again
          </Button>

          <Link href="/" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto gap-2 rounded-2xl border-border/80 hover:border-amber-500/40 hover:bg-amber-500/10 font-bold px-6 py-6 text-sm"
            >
              <Home className="h-4 w-4" />
              Return to Arena
            </Button>
          </Link>
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 text-xs font-bold text-muted-foreground">
          <Link href="/dashboard/player" className="hover:text-amber-400 transition-colors flex items-center gap-1">
            <Trophy className="h-3 w-3 text-amber-400" /> Player Dashboard
          </Link>
          <span>•</span>
          <Link href="/combis" className="hover:text-amber-400 transition-colors flex items-center gap-1">
            <Award className="h-3 w-3 text-amber-400" /> Combis & Scores
          </Link>
        </div>

        {/* Pro Tip Box */}
        <div className="mt-8 rounded-2xl border border-border/60 bg-background/50 p-4 text-left">
          <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
            {CARROM_PRO_TIPS[tipIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}

