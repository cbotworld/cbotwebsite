'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Footer() {
  const pathname = usePathname();
  if (pathname?.includes('/live')) {
    return null;
  }
  const exploreLinks = [
    { label: '200th Edition Schedule', href: '/edition-200-schedule', live: true },
    { label: 'Tournament Editions', href: '/editions', live: false },
    { label: 'Match Fixtures', href: '/fixtures', live: false },
    { label: 'Player Rankings', href: '/rankings', live: false },
    { label: 'Teams Directory', href: '/teams', live: false },
  ];

  return (
    <footer className="w-full border-t border-border/40 bg-card/60 backdrop-blur-md pt-12 pb-8 text-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">

          {/* Brand Column */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Carrom Balu Logo" className="h-10 w-10 object-contain drop-shadow-md" />
              <span className="text-lg font-black tracking-tight bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent">
                CBOT World
              </span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed max-w-sm">
              Founded by Carrom Balu in August 2020, CBOT World reaches its monumental 200th edition connecting players worldwide.
            </p>
          </div>

          {/* Explore — Coming Soon */}
          <div>
            <h4 className="font-bold text-foreground mb-3 text-xs uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
              Explore
              <span className="text-[9px] font-black tracking-widest text-amber-500/70 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-full leading-none uppercase">
                Soon
              </span>
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {exploreLinks.map(({ label, href, live }) => (
                <li key={label}>
                  {live ? (
                    <Link href={href} className="text-amber-400 font-bold hover:text-amber-300 transition-colors flex items-center gap-1">
                      <span>✨</span> {label}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground/60 cursor-default">{label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Founder & Tournament Governance */}
          <div className="space-y-3">
            <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-amber-500">
              Tournament Governance
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed max-w-sm font-semibold">
              Official CBOT tournaments are founded and governed by founder <strong>Carrom Balu</strong> under strict grounds of sportsmanship, transparency, and fair play.
            </p>
            <div className="pt-1">
              <a
                href="/#sponsors"
                className="inline-flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-400 transition-all text-xs font-bold text-emerald-400 group"
              >
                <img src="/sponsors/neelamani-logo.jpg" alt="Neelamani Foundation" className="h-7 w-7 rounded-full object-contain border border-emerald-500/50" />
                <div>
                  <div className="text-[10px] text-amber-400 font-extrabold uppercase leading-tight">Official Elite Sponsor</div>
                  <div className="group-hover:underline">Neelamani Foundation</div>
                </div>
              </a>
            </div>
          </div>

        </div>

        <div className="border-t border-border/40 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <p>© 2026 CBOT World (Carrom Balu Online Tournament). All rights reserved.</p>
            <div className="flex items-center gap-2 text-muted-foreground/60">
              <Link href="/privacy" className="hover:text-amber-500 transition-colors">Privacy Policy</Link>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs sm:text-sm text-muted-foreground">Designed and developed by</span>
            <a
              href="https://www.tectangle.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center transition-transform hover:scale-105"
              title="Visit Tectangle"
            >
              <img src="/tectangle-logo.png" alt="Tectangle" className="h-8 sm:h-10 w-auto object-contain drop-shadow-md" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
