'use client';

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Shield, Users, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function DashboardRedirectPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const userRole = (session?.user as any)?.role || 'ORGANIZER';

  React.useEffect(() => {
    if (userRole === 'ORGANIZER') router.push('/dashboard/organizer');
    else if (userRole === 'CAPTAIN') router.push('/dashboard/captain');
    else if (userRole === 'PLAYER') router.push('/dashboard/player');
  }, [userRole, router]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-20 text-center space-y-8">
      <h1 className="text-3xl font-black">CBOT Dashboard Selector</h1>
      <p className="text-muted-foreground text-sm">
        Select your active role panel below to access your dashboard:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card onClick={() => router.push('/dashboard/organizer')} className="p-6 cursor-pointer border-amber-500/40 hover:bg-amber-500/10 transition-colors">
          <Shield className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <h3 className="font-bold">Organizer Control</h3>
        </Card>
        <Card onClick={() => router.push('/dashboard/captain')} className="p-6 cursor-pointer border-emerald-500/40 hover:bg-emerald-500/10 transition-colors">
          <Users className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <h3 className="font-bold">Captain Hub</h3>
        </Card>
        <Card onClick={() => router.push('/dashboard/player')} className="p-6 cursor-pointer border-blue-500/40 hover:bg-blue-500/10 transition-colors">
          <UserCheck className="h-8 w-8 text-blue-500 mx-auto mb-2" />
          <h3 className="font-bold">Player Profile</h3>
        </Card>
      </div>
    </div>
  );
}
