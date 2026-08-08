'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Trophy,
  Shield,
  Users,
  UserCheck,
  Sparkles,
  Menu,
  X,
  LayoutDashboard,
  Target,
  Radio,
  Image,
  Newspaper,
  Info,
  Mail,
  Star,
  Flame,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { UserRole } from '@/types';

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [roleSelectOpen, setRoleSelectOpen] = React.useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = React.useState(false);

  const userRole: UserRole = (session?.user as any)?.role || 'ORGANIZER';

  const primaryNav = [
    { href: '/', label: 'Home', icon: Sparkles },
    { href: '/editions', label: 'Editions', icon: Trophy },
    { href: '/fixtures', label: 'Fixtures', icon: Flame },
    { href: '/rankings', label: 'Rankings', icon: Target },
    { href: '/teams', label: 'Teams', icon: Users },
    { href: '/players', label: 'Players', icon: UserCheck },
  ];

  const secondaryNav = [
    { href: '/about', label: 'About CBOT', icon: Info },
    { href: '/hall-of-fame', label: 'Hall of Fame', icon: Star },
    { href: '/live', label: 'Live Stream', icon: Radio },
    { href: '/gallery', label: 'Gallery', icon: Image },
    { href: '/news', label: 'News', icon: Newspaper },
    { href: '/contact', label: 'Contact', icon: Mail },
  ];

  const allNavLinks = [...primaryNav, ...secondaryNav];

  const getDashboardHref = (role: UserRole) => {
    switch (role) {
      case 'ORGANIZER':
        return '/dashboard/organizer';
      case 'CAPTAIN':
        return '/dashboard/captain';
      case 'PLAYER':
        return '/dashboard/player';
      default:
        return '/dashboard/player';
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <img
            src="/logo.png"
            alt="Carrom Balu Online Tournament Logo"
            className="h-10 w-10 object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
          />
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-wider bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 bg-clip-text text-transparent leading-none">
              CBOT
            </span>
            <span className="text-[8px] font-bold text-amber-500/90 tracking-widest uppercase mt-0.5">
              Carrom Balu Online
            </span>
          </div>
        </Link>

        {/* Desktop Primary Navigation Links */}
        <nav className="hidden xl:flex items-center gap-1 bg-muted/50 p-1 rounded-full border border-border/60">
          {primaryNav.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm shadow-amber-500/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            );
          })}

          {/* More Dropdown */}
          <div className="relative">
            <button
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 ${
                secondaryNav.some(item => item.href === pathname)
                  ? 'bg-amber-500/10 text-amber-500 font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
              }`}
            >
              More
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${moreMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {moreMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-48 rounded-2xl border border-border bg-card p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2"
                onMouseLeave={() => setMoreMenuOpen(false)}
              >
                {secondaryNav.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMoreMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-amber-500/10 text-amber-500 font-bold'
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Medium screens (lg to xl): Compact Navigation */}
        <nav className="hidden lg:flex xl:hidden items-center gap-1 bg-muted/50 p-1 rounded-full border border-border/60">
          {primaryNav.slice(0, 4).map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm shadow-amber-500/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            );
          })}
          <div className="relative">
            <button
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80"
            >
              More
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${moreMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {moreMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-48 rounded-2xl border border-border bg-card p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2"
                onMouseLeave={() => setMoreMenuOpen(false)}
              >
                {[...primaryNav.slice(4), ...secondaryNav].map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMoreMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-amber-500/10 text-amber-500 font-bold'
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* User Role & Action Area */}
        <div className="hidden sm:flex items-center gap-2.5 shrink-0">
          {/* Quick Role Dashboard Selector (Only visible after login) */}
          {session?.user && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRoleSelectOpen(!roleSelectOpen)}
                className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 rounded-full gap-1.5 text-xs font-bold px-3 h-8"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-amber-500" />
                Role: <span className="underline">{userRole}</span>
              </Button>

              {roleSelectOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2"
                  onMouseLeave={() => setRoleSelectOpen(false)}
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground border-b border-border/60 mb-1">
                    Switch Dashboard Role
                  </div>
                  <Link
                    href="/admin"
                    onClick={() => setRoleSelectOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold hover:bg-muted text-amber-500 bg-amber-500/10 mb-1"
                  >
                    <Shield className="h-4 w-4 text-amber-500" /> Admin Portal Center
                  </Link>
                  <Link
                    href="/dashboard/organizer"
                    onClick={() => setRoleSelectOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-muted text-amber-500"
                  >
                    <Shield className="h-4 w-4" /> Organizer Dashboard
                  </Link>
                  <Link
                    href="/dashboard/captain"
                    onClick={() => setRoleSelectOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-muted text-emerald-500"
                  >
                    <Users className="h-4 w-4" /> Captain Dashboard
                  </Link>
                  <Link
                    href="/dashboard/player"
                    onClick={() => setRoleSelectOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-muted text-blue-500"
                  >
                    <UserCheck className="h-4 w-4" /> Player Dashboard
                  </Link>
                </div>
              )}
            </div>
          )}

          <ThemeToggle />

          {session?.user ? (
            <div className="flex items-center gap-2">
              <Link href={getDashboardHref(userRole)}>
                <Avatar
                  src={session.user.image || undefined}
                  fallback={session.user.name || 'User'}
                  size="md"
                  className="ring-2 ring-amber-500/40 cursor-pointer hover:scale-105 transition-transform"
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
              <Link href="/register">
                <Button variant="carrom" size="sm" className="text-xs font-bold h-8 px-3.5 shadow-sm shadow-amber-500/20">
                  Register
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
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
        <div className="lg:hidden border-b border-border bg-background/95 backdrop-blur-xl p-4 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-top-4 shadow-xl">
          <div className="grid grid-cols-2 gap-1.5">
            {allNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  pathname === link.href
                    ? 'bg-amber-500 text-slate-950 font-extrabold'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <link.icon className="h-4 w-4 shrink-0" />
                {link.label}
              </Link>
            ))}
          </div>

          <div className="border-t border-border/80 pt-3 space-y-2">
            <div className="text-[11px] font-bold text-muted-foreground uppercase px-1 tracking-wider">
              Dashboards & Role Access
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <Link
                href="/dashboard/organizer"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs hover:bg-muted text-amber-500 font-semibold bg-amber-500/5 border border-amber-500/20"
              >
                <Shield className="h-4 w-4" /> Organizer Dashboard
              </Link>
              <Link
                href="/dashboard/captain"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs hover:bg-muted text-emerald-500 font-semibold bg-emerald-500/5 border border-emerald-500/20"
              >
                <Users className="h-4 w-4" /> Captain Dashboard
              </Link>
              <Link
                href="/dashboard/player"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs hover:bg-muted text-blue-500 font-semibold bg-blue-500/5 border border-blue-500/20"
              >
                <UserCheck className="h-4 w-4" /> Player Dashboard
              </Link>
            </div>

            <div className="pt-2 grid grid-cols-2 gap-2">
              {session?.user ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut({ callbackUrl: '/' });
                  }}
                  className="col-span-2 justify-center text-xs font-semibold"
                >
                  Sign Out
                </Button>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full justify-center text-xs font-semibold">
                      Log In
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="carrom" className="w-full justify-center text-xs font-bold">
                      Register
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
