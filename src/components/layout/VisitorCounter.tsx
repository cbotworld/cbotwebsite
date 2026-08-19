'use client';

import * as React from 'react';
import { Eye } from 'lucide-react';
import { useVisitorCount } from './VisitorCounterProvider';

export function VisitorCounter() {
  const { count: visitorCount } = useVisitorCount();

  return (
    <div
      title="Total Website Views"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-card/95 border border-amber-500/30 shadow-md text-xs font-bold text-foreground transition-all duration-500 group shrink-0 hover:border-amber-500/50"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <Eye className="h-3.5 w-3.5 text-amber-500 group-hover:scale-110 transition-transform shrink-0" />
      <span className="font-black text-amber-400 tracking-wide font-mono text-xs sm:text-sm">
        {visitorCount !== null ? visitorCount.toLocaleString('en-IN') : '...'}
      </span>
    </div>
  );
}
