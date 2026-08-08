'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Shield, Users, UserCheck, Menu, X, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { UserRole } from '@/types';

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

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
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <img
            src="/logo.png"
            alt="CBOT Logo"
            className="h-10 w-10 object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
          />
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-wider bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 bg-clip-text text-transparent leading-none">
              CBOT
            </span>
            <span className="text-[7.5px] sm:text-[8px] font-bold text-amber-500/90 tracking-widest uppercase mt-0.5 whitespace-nowrap">
              Carrom Balu Online Tournament
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
            <div className="flex items-center gap-2">
              <Link href={getDashboardHref(userRole)}>
                <Avatar
                  src={(userRole === 'ORGANIZER' || (userRole as string) === 'ADMIN') ? '/logo.png' : (session.user.image || undefined)}
                  fallback={session.user.name || 'User'}
                  size="md"
                  className="ring-2 ring-amber-500/40 cursor-pointer hover:scale-105 transition-transform p-0.5 bg-black/50"
                />
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-xs text-muted-foreground hover:text-foreground h-8 px-2.5"
              >
                Sign Out
              </Button>
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
          <div className="text-[11px] font-bold text-muted-foreground uppercase px-1 tracking-wider">
            Dashboards
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            <Link href="/dashboard/organizer" onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs hover:bg-muted text-amber-500 font-semibold bg-amber-500/5 border border-amber-500/20">
              <Shield className="h-4 w-4" /> Organizer Dashboard
            </Link>
            <Link href="/dashboard/captain" onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs hover:bg-muted text-emerald-500 font-semibold bg-emerald-500/5 border border-emerald-500/20">
              <Users className="h-4 w-4" /> Captain Dashboard
            </Link>
            <Link href="/dashboard/player" onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs hover:bg-muted text-blue-500 font-semibold bg-blue-500/5 border border-blue-500/20">
              <UserCheck className="h-4 w-4" /> Player Dashboard
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
