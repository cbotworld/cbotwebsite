'use client';

import Link from 'next/link';
import { Home, Compass, Trophy, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="relative mx-auto max-w-lg w-full rounded-3xl border border-amber-500/30 bg-gradient-to-b from-card via-card/90 to-background p-8 sm:p-10 shadow-2xl shadow-amber-500/10 backdrop-blur-xl">
        {/* Glow effect */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Icon */}
        <div className="relative mb-6 inline-flex flex-col items-center">
          <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/30 ring-4 ring-amber-500/20">
            <Compass className="h-10 w-10 animate-spin-slow" />
          </div>
          <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Out of Bounds · 404
          </span>
        </div>

        {/* Heading & Description */}
        <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
          Coin Off the Board! 🎯
        </h2>
        <p className="mt-3 text-sm text-slate-300 leading-relaxed font-medium">
          The pocket or tournament match you were aiming for isn't on this table. Let's redirect your striker to the main arena!
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black shadow-lg shadow-amber-500/25 gap-2 rounded-2xl px-7 py-6 text-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Home className="h-4 w-4" />
              Return to Arena
            </Button>
          </Link>
          <Link href="/combis" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto gap-2 rounded-2xl border-border/80 hover:border-amber-500/40 hover:bg-amber-500/10 font-bold px-6 py-6 text-sm"
            >
              <Award className="h-4 w-4 text-amber-400" />
              View Combis
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

