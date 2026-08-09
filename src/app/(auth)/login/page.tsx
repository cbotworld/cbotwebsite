'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Lock, UserCheck, ArrowRight, AlertCircle, Shield, FileText, CheckCircle2, HeartHandshake, Eye, Scale, Clock, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    // Only prefetch public routes. Prefetching protected routes before auth caches the redirect.
    router.prefetch('/');
  }, [router]);

  const executeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const cleanInput = username.trim().toLowerCase();
    
    // Pre-calculate target route for instant transit without extra fetch latency
    let targetRoute = '/dashboard/captain';
    if (['balumaster', 'carrombalu', 'balu', 'carrom_balu'].includes(cleanInput)) {
      targetRoute = '/dashboard/organizer';
    }

    const res = await signIn('credentials', {
      username,
      pin,
      redirect: false,
    });

    if (res?.ok) {
      router.replace(targetRoute);
    } else {
      setErrorMsg('Invalid Username or 4-Digit PIN. Please verify your credentials and try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 carrom-grid-pattern">
      {/* Whole Screen Hero Centered Loading Overlay via Portal */}
      {mounted && loading && createPortal(
        <div className="fixed inset-0 z-[99999] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-150">
          <div className="relative flex items-center justify-center p-6">
            <div className="h-44 w-44 sm:h-52 sm:w-52 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin shadow-[0_0_60px_rgba(245,158,11,0.35)]" />
            <img
              src="/logo.png"
              alt="Carrom Balu Official Logo"
              className="absolute h-32 w-32 sm:h-36 sm:w-36 object-contain drop-shadow-[0_0_35px_rgba(245,158,11,0.85)] animate-pulse"
            />
          </div>
          <div className="space-y-1.5 text-center max-w-sm px-4">
            <h3 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent tracking-wide">
              Verifying &amp; Logging In…
            </h3>
            <p className="text-xs text-muted-foreground font-semibold">
              Authenticating credentials &amp; loading your CBOT dashboard
            </p>
          </div>
        </div>,
        document.body
      )}

      <Card className="w-full max-w-md border-amber-500/30 shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-2 text-center">
          <img src="/logo.png" alt="Carrom Balu Official Logo" className="mx-auto h-20 w-20 object-contain drop-shadow-xl" />
          <CardTitle className="text-2xl font-black">CBOT Portal Login</CardTitle>
          <CardDescription className="text-xs">
            Enter your unique Username and 4-digit PIN
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2 font-bold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={executeLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold block mb-1">Unique Username</label>
              <div className="relative">
                <UserCheck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 font-mono"
                  placeholder="e.g. carrom balu"
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
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin text-amber-950" /> Verifying Credentials...
                </>
              ) : (
                <>
                  Log In with Username & PIN <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
