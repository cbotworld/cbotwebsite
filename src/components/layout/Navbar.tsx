'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Menu, X, LayoutDashboard, ChevronDown, LogOut, Loader2, Home, Trophy, Calendar, Swords, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { VisitorCounter } from '@/components/layout/VisitorCounter';
import { CountryBanner } from '@/components/layout/CountryBanner';
import { UserRole } from '@/types';
import {
  PUBLIC_COMBIS_PATH,
  PUBLIC_SCHEDULE_PATH,
  PUBLIC_TEAMS_PLAYERS_PATH,
  PUBLIC_PLAYER_SCORES_PATH,
  PUBLIC_STANDINGS_PATH,
  isPublicCombisPath,
  isPublicSchedulePath,
  isPublicTeamsPlayersPath,
  isPublicPlayerScoresPath,
  isPublicStandingsPath,
  DEFAULT_WEBSITE_CMS,
} from '@/lib/website-cms';

export function Navbar({
  editionButtonLabel = DEFAULT_WEBSITE_CMS.nav.editionButtonLabel,
  editionButtonHref = PUBLIC_COMBIS_PATH,
  combisLabel = 'Daily Team Combis',
  combisHref = PUBLIC_COMBIS_PATH,
  scheduleLabel = 'Match Schedule',
  scheduleHref = PUBLIC_SCHEDULE_PATH,
  brandName = 'CBOT World',
  brandTagline = 'Connect Carrom Enthusiasts Worldwide',
  shortName = 'CBOT',
}: {
  editionButtonLabel?: string;
  editionButtonHref?: string;
  combisLabel?: string;
  combisHref?: string;
  scheduleLabel?: string;
  scheduleHref?: string;
  brandName?: string;
  brandTagline?: string;
  shortName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [isNavigatingHome, setIsNavigatingHome] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  if (pathname?.includes('/live')) {
    return null;
  }

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    setIsNavigating(false);
    setIsNavigatingHome(false);
    setIsSigningOut(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    router.prefetch(PUBLIC_PLAYER_SCORES_PATH);
    router.prefetch(PUBLIC_STANDINGS_PATH);
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
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const userRole: UserRole = (session?.user as any)?.role || 'PLAYER';
  const hasCaptainDesk = Boolean((session?.user as any)?.hasCaptainDesk);

  const getDashboardHref = (role: UserRole) => {
    switch (role) {
      case 'ORGANIZER': return '/dashboard/organizer';
      case 'CAPTAIN':   return '/dashboard/captain';
      case 'PLAYER':    return hasCaptainDesk ? '/dashboard/captain' : '/dashboard/player';
      default:          return '/dashboard/player';
    }
  };

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    setIsSigningOut(true);
    await signOut({ callbackUrl: '/login' });
  };

  // Determine active sub-pages for Google-style secondary nav. The organizer can
  // repoint these links from the CMS, so match the configured hrefs as well as
  // the legacy edition routes.
  const isEditionPage =
    isPublicCombisPath(pathname) ||
    isPublicSchedulePath(pathname) ||
    isPublicTeamsPlayersPath(pathname) ||
    isPublicPlayerScoresPath(pathname) ||
    isPublicStandingsPath(pathname) ||
    pathname === combisHref ||
    pathname === scheduleHref ||
    pathname === editionButtonHref ||
    pathname.includes('combis') ||
    pathname.includes('schedule') ||
    pathname.includes('combis') ||
    pathname.includes('schedule') ||
    pathname.includes('videos') ||
    pathname.includes('player-scores') ||
    pathname.includes('standings');
  const isCombisActive = isPublicCombisPath(pathname) || pathname === combisHref;
  const isScheduleActive = isPublicSchedulePath(pathname) || pathname === scheduleHref;
  const isTeamsPlayersActive = isPublicTeamsPlayersPath(pathname);
  const isPlayerScoresActive = isPublicPlayerScoresPath(pathname);
  const isStandingsActive = isPublicStandingsPath(pathname);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur-md">
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
                ? `Connecting to ${shortName} Arena Home & Active Tournaments`
                : 'Fetching live tournament statistics, player data, and schedules'}
            </p>
          </div>
        </div>,
        document.body
      )}

      {/* Main Top Header Navbar */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">

        {/* Brand Logo */}
        <Link
          href="/"
          onClick={() => {
            if (pathname === '/') return;
            setIsNavigatingHome(true);
          }}
          className="flex items-center gap-2.5 sm:gap-3 group shrink-0"
        >
          <img
            src="/logo.png"
            alt="CBOT Logo"
            className="h-9 sm:h-11 w-9 sm:w-11 object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
          />
          <div className="flex flex-col justify-center leading-tight">
            <span className="text-lg sm:text-2xl font-black tracking-wider bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 bg-clip-text text-transparent leading-none">
              {brandName}
            </span>
            <span className="hidden min-[420px]:block text-[8.5px] sm:text-[10.5px] font-extrabold text-amber-500/90 tracking-wider uppercase leading-none whitespace-nowrap mt-0.5">
              {brandTagline}
            </span>
          </div>
        </Link>

        {/* Desktop Right Actions */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {/* Current edition page direct link */}
          <Link
            href={editionButtonHref}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black transition-all group shadow-sm ${
              isEditionPage
                ? 'bg-amber-500 text-slate-950 border border-amber-400 shadow-amber-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-400'
            }`}
          >
            <span>🏆</span>
            <span>{editionButtonLabel}</span>
          </Link>

          <VisitorCounter />

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
                      if (pathname === target) return;
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

        {/* Mobile Toggle & Header Controls */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Country Flag Ticker Scroll Banner */}
      <CountryBanner />

      {/* Google-Style Secondary Sub-Navbar Bar (BEHAVIOR: Appears BELOW country scroll) */}
      {isEditionPage && (
        <div className="w-full border-t border-border/40 bg-card/90 backdrop-blur-xl px-3 sm:px-8 overflow-x-auto touch-scroll-x scrollbar-none shadow-md">
          <div className="mx-auto flex max-w-7xl items-center gap-4 sm:gap-8 text-xs sm:text-sm font-bold text-muted-foreground whitespace-nowrap pt-1">
            
            {/* Sub-Tab 1: Daily Team Combis */}
            <Link
              href={combisHref || PUBLIC_COMBIS_PATH}
              className={`relative py-2.5 px-1.5 flex items-center gap-1.5 sm:gap-2 transition-all ${
                isCombisActive
                  ? 'text-amber-400 font-black'
                  : 'hover:text-foreground'
              }`}
            >
              <span>⚔️</span>
              <span>{combisLabel}</span>
              {isCombisActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.9)] animate-in fade-in duration-200" />
              )}
            </Link>

            {/* Sub-Tab 2: Match Schedule */}
            <Link
              href={scheduleHref || PUBLIC_SCHEDULE_PATH}
              className={`relative py-2.5 px-1.5 flex items-center gap-1.5 sm:gap-2 transition-all ${
                isScheduleActive
                  ? 'text-amber-400 font-black'
                  : 'hover:text-foreground'
              }`}
            >
              <span>📅</span>
              <span>{scheduleLabel}</span>
              {isScheduleActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.9)] animate-in fade-in duration-200" />
              )}
            </Link>

            {/* Sub-Tab 3: Teams & Players */}
            <Link
              href={PUBLIC_TEAMS_PLAYERS_PATH}
              className={`relative py-2.5 px-1.5 flex items-center gap-1.5 sm:gap-2 transition-all ${
                isTeamsPlayersActive
                  ? 'text-amber-400 font-black'
                  : 'hover:text-foreground'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Teams &amp; Players</span>
              {isTeamsPlayersActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.9)] animate-in fade-in duration-200" />
              )}
            </Link>
            <Link
              href={PUBLIC_PLAYER_SCORES_PATH}
              className={`relative py-2.5 px-1.5 flex items-center gap-1.5 sm:gap-2 transition-all ${
                isPlayerScoresActive ? 'text-amber-400 font-black' : 'hover:text-foreground'
              }`}
            >
              <span>🎯</span>
              <span>Player Scores</span>
              {isPlayerScoresActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.9)] animate-in fade-in duration-200" />
              )}
            </Link>
            <Link
              href={PUBLIC_STANDINGS_PATH}
              className={`relative py-2.5 px-1.5 flex items-center gap-1.5 sm:gap-2 transition-all ${
                isStandingsActive ? 'text-amber-400 font-black' : 'hover:text-foreground'
              }`}
            >
              <Trophy className="h-3.5 w-3.5" />
              <span>Standings</span>
              {isStandingsActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.9)] animate-in fade-in duration-200" />
              )}
            </Link>
          </div>
        </div>
      )}

      {/* Enhanced Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-amber-500/30 bg-background/98 backdrop-blur-2xl p-4 space-y-4 animate-in slide-in-from-top-4 shadow-2xl z-50 max-h-[85vh] overflow-y-auto touch-scroll-y overscroll-contain">
          {session?.user && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
              <Avatar fallback={session.user.name || 'U'} size="md" className="ring-2 ring-amber-500/50" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-foreground truncate">{session.user.name}</div>
                <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                  {(userRole as string) === 'ORGANIZER' ? '🛡️ Organizer' : (userRole as string) === 'CAPTAIN' ? '👑 Captain' : '👤 Player'}
                </div>
              </div>
            </div>
          )}

          {/* Quick Navigation Section */}
          <div className="space-y-2 border-b border-border/50 pb-3">
            <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-1">
              🏆 {editionButtonLabel}
            </div>
            <div className="grid grid-cols-2 min-[440px]:grid-cols-3 gap-2">
              <Link
                href={combisHref || PUBLIC_COMBIS_PATH}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-[11px] font-extrabold transition-all border text-center ${
                  isCombisActive
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                }`}
              >
                <span>⚔️</span> Combis
              </Link>
              <Link
                href={scheduleHref || PUBLIC_SCHEDULE_PATH}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-[11px] font-extrabold transition-all border text-center ${
                  isScheduleActive
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                }`}
              >
                <span>📅</span> Schedule
              </Link>
              <Link
                href={PUBLIC_TEAMS_PLAYERS_PATH}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-[11px] font-extrabold transition-all border text-center ${
                  isTeamsPlayersActive
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                }`}
              >
                <Users className="h-3.5 w-3.5 shrink-0" /> Teams
              </Link>
              <Link
                href={PUBLIC_PLAYER_SCORES_PATH}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-[11px] font-extrabold transition-all border text-center ${
                  isPlayerScoresActive
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                }`}
              >
                <span>🎯</span> Scores
              </Link>
              <Link
                href={PUBLIC_STANDINGS_PATH}
                onClick={() => setMobileMenuOpen(false)}
                className={`col-span-2 min-[440px]:col-span-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-[11px] font-extrabold transition-all border text-center ${
                  isStandingsActive
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                }`}
              >
                <Trophy className="h-3.5 w-3.5 shrink-0" /> Table
              </Link>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">
              Main Menu
            </div>
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                pathname === '/' ? 'bg-amber-500/20 text-amber-400 font-black' : 'hover:bg-muted text-foreground'
              }`}
            >
              <Home className="h-4 w-4 text-amber-400" /> {shortName} Arena Home
            </Link>

            {session?.user ? (
              <Link
                href={getDashboardHref(userRole)}
                onClick={() => {
                  setMobileMenuOpen(false);
                  const target = getDashboardHref(userRole);
                  if (pathname === target) return;
                  setIsNavigating(true);
                }}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 transition-all"
              >
                <LayoutDashboard className="h-4 w-4 text-amber-400" />
                <span>My Dashboard</span>
              </Link>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 justify-center"
              >
                <span>🔑</span> Log In to CBOT
              </Link>
            )}
          </div>

          {session?.user && (
            <div className="pt-2 border-t border-border/50">
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="w-full justify-center text-xs font-black border-rose-500/40 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 h-9 rounded-xl"
              >
                <LogOut className="h-4 w-4 mr-2" /> Sign Out
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
