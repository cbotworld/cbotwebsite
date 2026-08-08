export function Footer() {
  const exploreLinks = [
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
                CBOT
              </span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed max-w-sm">
              Founded by Carrom Balu in August 2020, CBOT reaches its monumental 200th edition connecting players worldwide.
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
            <ul className="space-y-2 text-xs text-muted-foreground/60">
              {exploreLinks.map(({ label }) => (
                <li key={label} className="cursor-default hover:text-muted-foreground/80 transition-colors">
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* About */}
          <div>
            <h4 className="font-bold text-foreground mb-3 text-xs uppercase tracking-wider text-amber-500">
              About
            </h4>
            <ul className="space-y-2 text-muted-foreground text-xs">
              <li><a href="#about" className="hover:text-amber-500 transition-colors">About CBOT</a></li>
              <li><a href="#history" className="hover:text-amber-500 transition-colors">History &amp; Videos</a></li>
            </ul>
          </div>

        </div>

        <div className="border-t border-border/40 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© 2026 CBOT (Carrom Balu Online Tournament). All rights reserved.</p>
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
