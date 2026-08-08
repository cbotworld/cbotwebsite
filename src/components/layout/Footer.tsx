import Link from 'next/link';
import { Trophy, Shield, Heart, Radio, Award } from 'lucide-react';

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
              Navigation
            </h4>
            <ul className="space-y-2 text-muted-foreground text-xs">
              <li>
                <Link href="/tournaments" className="hover:text-amber-500 transition-colors">
                  All Tournaments
                </Link>
              </li>
              <li>
                <Link href="/leaderboard" className="hover:text-amber-500 transition-colors">
                  Player Rankings
                </Link>
              </li>
              <li>
                <Link href="/dashboard/organizer" className="hover:text-amber-500 transition-colors">
                  Organizer Control Panel
                </Link>
              </li>
              <li>
                <Link href="/dashboard/captain" className="hover:text-amber-500 transition-colors">
                  Captain Roster Hub
                </Link>
              </li>
            </ul>
          </div>

          {/* Roles & Rules */}
          <div>
            <h4 className="font-bold text-foreground mb-3 text-xs uppercase tracking-wider text-amber-500">
              Tournament Roles
            </h4>
            <ul className="space-y-2 text-muted-foreground text-xs">
              <li className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-amber-500" />
                <span>Organizer: Fixture & Score Approval</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-emerald-500" />
                <span>Captain: Team & Roster Submissions</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-blue-500" />
                <span>Player: Personal Match Schedule</span>
              </li>
            </ul>
          </div>

          {/* Live Stream & Community */}
          <div>
            <h4 className="font-bold text-foreground mb-3 text-xs uppercase tracking-wider text-amber-500">
              Live & Community
            </h4>
            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-500">
                <Radio className="h-4 w-4 animate-pulse" /> Live Stream Room
              </div>
              <p className="text-[11px] text-muted-foreground">
                Watch grand finals and queen cover double strikes live on the official Carrom Balu broadcast feed.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border/40 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© 2026 CBOT (Carrom Balu Online Tournament). All rights reserved.</p>
          <p className="flex items-center gap-1">
            Engineered with <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500 inline" /> for Carrom Champions worldwide.
          </p>
        </div>
      </div>
    </footer>
  );
}
