'use client';

import * as React from 'react';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false} disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
