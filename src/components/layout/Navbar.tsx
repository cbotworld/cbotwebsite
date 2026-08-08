'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Shield, Users, UserCheck, Menu, X, LayoutDashboard, ChevronDown, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { UserRole } from '@/types';

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

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

  const getDashboardHref = (role: UserRole) => {
    switch (role) {
      case 'ORGANIZER': return '/dashboard/organizer';
      case 'CAPTAIN':   return '/dashboard/captain';
      case 'PLAYER':    return '/dashboard/player';
      default:          return '/dashboard/player';
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group shrink-0">
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
          {session?.user && (
            <Link href={getDashboardHref(userRole)}>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 rounded-full gap-1.5 text-xs font-bold px-3 h-8"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-amber-500" />
                Dashboard
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
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold hover:bg-muted transition-colors"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 text-amber-500" /> My Dashboard
                  </Link>
                  <button
                    onClick={() => { setUserMenuOpen(false); signOut({ callbackUrl: '/' }); }}
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
                onClick={() => { setMobileMenuOpen(false); signOut({ callbackUrl: '/' }); }}
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
