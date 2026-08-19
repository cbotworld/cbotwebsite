'use client';

import * as React from 'react';

const CACHE_KEY = 'cbot_visitor_count_v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

type VisitorContextValue = {
  count: number | null;
};

const VisitorContext = React.createContext<VisitorContextValue>({ count: null });

function readCachedCount(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { count, at } = JSON.parse(raw) as { count: number; at: number };
    if (typeof count !== 'number' || Date.now() - at >= CACHE_TTL_MS) return null;
    return count;
  } catch {
    return null;
  }
}

function writeCachedCount(count: number) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ count, at: Date.now() }));
  } catch {
    // ignore quota errors
  }
}

export function VisitorCounterProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = React.useState<number | null>(() => readCachedCount());

  React.useEffect(() => {
    let cancelled = false;

    async function sync() {
      const cached = readCachedCount();
      if (cached !== null) {
        setCount(cached);
        return;
      }

      try {
        const hasVisited = sessionStorage.getItem('cbot_visited');
        const res = await fetch('/api/visitors', {
          method: hasVisited ? 'GET' : 'POST',
        });

        if (!hasVisited) {
          sessionStorage.setItem('cbot_visited', 'true');
        }

        if (!res.ok || cancelled) return;

        const data = await res.json();
        if (typeof data.count === 'number') {
          setCount(data.count);
          writeCachedCount(data.count);
        }
      } catch (err) {
        console.error('Failed to sync visitor count', err);
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, []);

  return <VisitorContext.Provider value={{ count }}>{children}</VisitorContext.Provider>;
}

export function useVisitorCount() {
  return React.useContext(VisitorContext);
}
