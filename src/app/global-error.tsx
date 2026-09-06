'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RefreshCw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('Unhandled global exception:', error);
  }, [error]);

  return (
    <html>
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen flex items-center justify-center p-4">
        <div className="mx-auto max-w-md space-y-6 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30">
            <RefreshCw className="h-8 w-8 animate-spin-slow" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Something went wrong
          </h2>
          <p className="text-sm text-slate-400">
            A temporary client error occurred while loading this page. Click below to refresh or return to the main arena.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              onClick={() => reset()}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold gap-2 rounded-full px-6"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Link href="/">
              <Button variant="outline" className="gap-2 rounded-full border-slate-700 text-white px-6">
                <Home className="h-4 w-4" />
                Go to Home
              </Button>
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
