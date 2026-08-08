'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Lock, UserCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { UserRole } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // Prefetch target dashboards in background to eliminate route transit latency
    router.prefetch('/dashboard/organizer');
    router.prefetch('/dashboard/captain');
    router.prefetch('/dashboard/player');
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const res = await signIn('credentials', {
      username,
      pin,
      redirect: false,
    });

    if (res?.ok) {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        const role = sessionData?.user?.role || 'PLAYER';

        if (role === 'ORGANIZER' || role === 'SUPER_ADMIN') {
          router.replace('/dashboard/organizer');
        } else if (role === 'CAPTAIN') {
          router.replace('/dashboard/captain');
        } else {
          router.replace('/dashboard/player');
        }
      } catch (e) {
        router.replace('/dashboard');
      }
    } else {
      setErrorMsg('Invalid Username or 4-Digit PIN. Please verify your credentials and try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 carrom-grid-pattern">
      <Card className="w-full max-w-md border-amber-500/30 shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-2 text-center">
          <img src="/logo.png" alt="Carrom Balu Official Logo" className="mx-auto h-20 w-20 object-contain drop-shadow-xl" />
          <CardTitle className="text-2xl font-black">CBOT Portal Login</CardTitle>
          <CardDescription className="text-xs">
            Enter your unique Username and 4-digit PIN
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2 font-bold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold block mb-1">Unique Username</label>
              <div className="relative">
                <UserCheck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 font-mono"
                  placeholder="e.g. balumaster"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">4-Digit Security PIN</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="pl-9 font-mono tracking-widest text-lg font-bold"
                  placeholder="••••"
                  required
                />
              </div>
            </div>

            <Button type="submit" variant="carrom" className="w-full font-bold justify-center" disabled={loading}>
              {loading ? 'Verifying Credentials...' : 'Log In with Username & PIN'} <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
