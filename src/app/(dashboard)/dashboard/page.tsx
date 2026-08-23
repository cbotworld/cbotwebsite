'use client';

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function DashboardRedirectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated' || !session?.user) {
      router.replace('/login');
      return;
    }

    const userRole = (session?.user as any)?.role || 'PLAYER';
    const hasCaptainDesk = Boolean((session?.user as any)?.hasCaptainDesk);

    if (userRole === 'ORGANIZER' || (userRole as string) === 'SUPER_ADMIN') {
      router.replace('/dashboard/organizer');
    } else if (userRole === 'CAPTAIN' || hasCaptainDesk) {
      router.replace('/dashboard/captain');
    } else {
      router.replace('/dashboard/player');
    }
  }, [session, status, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="h-10 w-10 rounded-full bg-amber-500/20 border-2 border-amber-500/50 animate-spin border-t-amber-500 mx-auto" />
        <p className="text-xs text-muted-foreground font-medium">Loading your dashboard…</p>
      </div>
    </div>
  );
}
