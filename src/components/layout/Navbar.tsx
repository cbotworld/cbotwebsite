'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Shield, Users, UserCheck, Menu, X, LayoutDashboard, ChevronDown, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { VisitorCounter } from '@/components/layout/VisitorCounter';
import { UserRole } from '@/types';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [editionMenuOpen, setEditionMenuOpen] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [isNavigatingHome, setIsNavigatingHome] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const editionMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    setIsNavigating(false);
    setIsNavigatingHome(false);
    setIsSigningOut(false);
  }, [pathname]);

  React.useEffect(() => {
    if (session?.user) {
      router.prefetch('/dashboard/organizer');
      router.prefetch('/dashboard/captain');
      router.prefetch('/dashboard/player');
    }
  }, [session, router]);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (editionMenuRef.current && !editionMenuRef.current.contains(e.target as Node)) {
        setEditionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const userRole: UserRole = (session?.user as any)?.role || 'PLAYER';

  const getDashboardHref = (role: UserRole) => {
    switch (role) {
      case 'ORGANIZER': return '/dashboard/organizer';
      case 'CAPTAIN':   return '/dashboard/captain';
      case 'PLAYER':    return '/dashboard/player';
      default:          return '/dashboard/player';
    }
  };

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    setIsSigningOut(true);
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/90 backdrop-blur-md">
      {/* Whole Screen Centered Loading Overlay via Portal */}
      {mounted && (isNavigating || isNavigatingHome || isSigningOut) && createPortal(
        <div className="fixed inset-0 z-[99999] bg-background/90 backdrop-blur-xl flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-150">
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
              {isSigningOut ? 'Signing Out…' : isNavigatingHome ? 'Loading Home Screen…' : 'Loading Dashboard…'}
            </h3>
            <p className="text-xs text-muted-foreground font-semibold">
              {isSigningOut
                ? 'Ending your secure CBOT session and redirecting to login'
                : isNavigatingHome
                ? 'Connecting to CBOT Arena Home & Active Tournaments'
                : 'Fetching live tournament statistics, player data, and schedules'}
            </p>
          </div>
        </div>,
        document.body
      )}

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Brand Logo */}
        <Link
          href="/"
          onClick={() => {
            if (pathname === '/') return;
            setIsNavigatingHome(true);
          }}
          className="flex items-center gap-3 group shrink-0"
        >
          <img
            src="/logo.png"
            alt="CBOT Logo"
            className="h-10 sm:h-11 w-10 sm:w-11 object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
          />
          <div className="flex flex-col justify-center gap-1">
            <span className="text-xl sm:text-2xl font-black tracking-wider bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 bg-clip-text text-transparent leading-none">
              CBOT
            </span>
            <span className="text-[9px] sm:text-[10.5px] font-extrabold text-amber-500/90 tracking-wider uppercase leading-none whitespace-nowrap">
              Connect Carrom Enthusiasts Worldwide
            </span>
          </div>
        </Link>

        {/* Desktop Right Actions */}
        <div className="hidden sm:flex items-center gap-2.5 shrink-0">
          {/* 200th Edition Dropdown */}
          <div className="relative" ref={editionMenuRef}>
            <button
              onClick={() => setEditionMenuOpen(!editionMenuOpen)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-400 transition-all group shadow-sm"
            >
              <span className="text-amber-400">🏆</span>
              <span>200th Edition</span>
              <ChevronDown className={`h-3.5 w-3.5 text-amber-400 transition-transform duration-200 ${editionMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {editionMenuOpen && (
              <div className="absolute right-0 sm:left-0 top-full mt-2 w-64 rounded-2xl border border-amber-500/40 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden z-50 animate-in slide-in-from-top-2 duration-150 p-1.5 space-y-1">
                <div className="px-3 py-2 border-b border-border/40">
                  <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">CBOT 200th Edition</div>
                  <div className="text-xs font-bold text-foreground">Bicentennial Monuments</div>
                </div>

                <Link
                  href="/edition-200-schedule"
                  onClick={() => setEditionMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all group"
                >
                  <span>📅</span> Match Schedule
                </Link>

                <Link
                  href="/edition-200-combis"
                  onClick={() => setEditionMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all group"
                >
                  <span>⚔️</span> Daily Team Combis
                </Link>
              </div>
            )}
          </div>

          <VisitorCounter />

          {session?.user && (
            <Link
              href={getDashboardHref(userRole)}
              onClick={() => {
                const target = getDashboardHref(userRole);
                if (pathname === target || pathname.startsWith('/dashboard')) return;
                setIsNavigating(true);
              }}
            >
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 rounded-full gap-1.5 text-xs font-bold px-3 h-8"
              >
                {isNavigating ? (
                  <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                ) : (
                  <LayoutDashboard className="h-3.5 w-3.5 text-amber-500" />
                )}
                {isNavigating ? 'Loading…' : 'Dashboard'}
              </Button>
            </Link>
          )}

          {session?.user ? (
            <div className="relative" ref={userMenuRef}>
              {/* Trigger Button */}
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted transition-all hover:border-amber-500/40 group"
              >
                <Avatar
                  fallback={session.user.name || 'U'}
                  size="sm"
                  className="ring-2 ring-amber-500/40 group-hover:ring-amber-500/70 transition-all"
                />
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-xs font-black text-foreground whitespace-nowrap">
                    {session.user.name}
                  </span>
                  <span className="text-[9px] text-amber-500 font-bold uppercase tracking-widest">
                    {(userRole as string) === 'ORGANIZER' ? 'Organizer' : (userRole as string) === 'CAPTAIN' ? 'Captain' : 'Player'}
                  </span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-border bg-card shadow-2xl shadow-black/30 overflow-hidden z-50 animate-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-3 border-b border-border bg-muted/30">
                    <div className="text-xs font-black text-foreground">{session.user.name}</div>
                    <div className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mt-0.5">
                      {(userRole as string) === 'ORGANIZER' ? '🛡️ Organizer' : (userRole as string) === 'CAPTAIN' ? '👑 Captain' : '👤 Player'}
                    </div>
                  </div>
                  <Link
                    href={getDashboardHref(userRole)}
                    onClick={() => {
                      setUserMenuOpen(false);
                      const target = getDashboardHref(userRole);
                      if (pathname === target || pathname.startsWith('/dashboard')) return;
                      setIsNavigating(true);
                    }}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold hover:bg-muted transition-colors"
                  >
                    {isNavigating ? <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" /> : <LayoutDashboard className="h-3.5 w-3.5 text-amber-500" />}
                    {isNavigating ? 'Loading Dashboard…' : 'My Dashboard'}
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="font-semibold text-xs h-8 px-3">
                  Log In
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Toggle */}
        <div className="flex items-center gap-2 sm:hidden">
          <VisitorCounter />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-b border-border bg-background/95 backdrop-blur-xl p-4 space-y-3 animate-in slide-in-from-top-4 shadow-xl">
          <div className="space-y-1.5 border-b border-border/60 pb-3">
            <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-1">
              🏆 200th Edition
            </div>
            <Link
              href="/edition-200-schedule"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/30"
            >
              <span>📅</span> Match Schedule
            </Link>

            <Link
              href="/edition-200-combis"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/30"
            >
              <span>⚔️</span> Daily Team Combis
            </Link>
          </div>
          {session?.user && (
            <div className="flex items-center gap-3 pb-2 border-b border-border">
              <Avatar fallback={session.user.name || 'U'} size="md" />
              <div>
                <div className="text-xs font-black text-foreground">{session.user.name}</div>
                <div className="text-[10px] text-amber-500 font-bold uppercase">{(userRole as string) === 'ORGANIZER' ? '🛡️ Organizer' : (userRole as string) === 'CAPTAIN' ? '👑 Captain' : '👤 Player'}</div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-1.5">
            <Link href={getDashboardHref(userRole)} onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs hover:bg-muted text-amber-500 font-semibold bg-amber-500/5 border border-amber-500/20">
              <LayoutDashboard className="h-4 w-4" /> My Dashboard
            </Link>
          </div>

          <div className="pt-1 grid grid-cols-2 gap-2">
            {session?.user ? (
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="col-span-2 justify-center text-xs font-semibold"
              >
                Sign Out
              </Button>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full justify-center text-xs font-semibold">Log In</Button>
                </Link>

              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
