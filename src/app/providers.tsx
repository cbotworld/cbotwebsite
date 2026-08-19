'use client';

import * as React from 'react';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { VisitorCounterProvider } from '@/components/layout/VisitorCounterProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false}>
      <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false} disableTransitionOnChange>
        <VisitorCounterProvider>{children}</VisitorCounterProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
