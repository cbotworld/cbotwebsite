import { Shield, Trophy, Award } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-border/40 bg-card/60 backdrop-blur-md pt-12 pb-8 text-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">

          {/* Brand Column */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Carrom Balu Logo" className="h-10 w-10 object-contain drop-shadow-md" />
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent">
                CBOT Esports
              </span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Carrom Balu Online Tournament (CBOT) is the premier digital competitive Carrom platform connecting players, team captains, and tournament organizers worldwide.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-foreground mb-3 text-xs uppercase tracking-wider text-amber-500">
              Explore
            </h4>
            <ul className="space-y-2 text-muted-foreground text-xs">
              <li><a href="#hero" className="hover:text-amber-500 transition-colors">Home</a></li>
              <li><a href="#editions" className="hover:text-amber-500 transition-colors">Tournament Editions</a></li>
              <li><a href="#fixtures" className="hover:text-amber-500 transition-colors">Match Fixtures</a></li>
              <li><a href="#rankings" className="hover:text-amber-500 transition-colors">Player Rankings</a></li>
              <li><a href="#teams" className="hover:text-amber-500 transition-colors">Teams Directory</a></li>
            </ul>
          </div>

          {/* Tournament Roles */}
          <div>
            <h4 className="font-bold text-foreground mb-3 text-xs uppercase tracking-wider text-amber-500">
              Tournament Roles
            </h4>
            <ul className="space-y-2 text-muted-foreground text-xs">
              <li className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-amber-500" />
                <span>Organizer: Fixture &amp; Score Approval</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-emerald-500" />
                <span>Captain: Team &amp; Roster Submissions</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-blue-500" />
                <span>Player: Personal Match Schedule</span>
              </li>
            </ul>
          </div>

          {/* Info */}
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
