'use client';

import * as React from 'react';
import { Eye } from 'lucide-react';

export function VisitorCounter() {
  const [visitorCount, setVisitorCount] = React.useState<number | null>(null);
  const [isUpdating, setIsUpdating] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    async function fetchLatestCount() {
      try {
        const res = await fetch('/api/visitors', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && typeof data.count === 'number') {
            setVisitorCount((prev) => {
              if (prev !== null && prev !== data.count) {
                setIsUpdating(true);
                setTimeout(() => setIsUpdating(false), 1000);
              }
              return data.count;
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch visitor count', err);
      }
    }

    async function initialRecordAndFetch() {
      try {
        const hasVisited = sessionStorage.getItem('cbot_visited');
        let res;
        if (!hasVisited) {
          sessionStorage.setItem('cbot_visited', 'true');
          res = await fetch('/api/visitors', { method: 'POST', cache: 'no-store' });
        } else {
          res = await fetch('/api/visitors', { cache: 'no-store' });
        }

        if (res.ok) {
          const data = await res.json();
          if (isMounted && typeof data.count === 'number') {
            setVisitorCount(data.count);
          }
        }
      } catch (err) {
        console.error('Failed to record visitor count', err);
      }
    }

    // 1. Initial hit
    initialRecordAndFetch();

    // 2. Poll every 10 seconds for live updates when other users visit
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchLatestCount();
      }
    }, 10000);

    // 3. Immediately refresh when user switches back to this tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchLatestCount();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div
      title="Total Website Views"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-card/95 border border-amber-500/30 shadow-md text-xs font-bold text-foreground transition-all duration-500 group shrink-0 ${
        isUpdating ? 'border-amber-400 ring-2 ring-amber-500/30 scale-105 bg-amber-500/10' : 'hover:border-amber-500/50'
      }`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <Eye className="h-3.5 w-3.5 text-amber-500 group-hover:scale-110 transition-transform shrink-0" />
      <span
        className={`font-black text-amber-400 tracking-wide font-mono text-xs sm:text-sm transition-transform duration-300 ${
          isUpdating ? 'scale-110 text-amber-300' : ''
        }`}
      >
        {visitorCount !== null ? visitorCount.toLocaleString('en-IN') : '...'}
      </span>
    </div>
  );
}
