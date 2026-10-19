'use client';

import * as React from 'react';
import { Crown, Search, Users, Target, Play } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { DEFAULT_WEBSITE_CMS, type WebsitePageHeading } from '@/lib/website-cms';
import { toStorageProxyUrl } from '@/lib/supabase';

export type RosterMember = {
  id: string;
  name: string;
  username: string;
  image?: string;
  isCaptain: boolean;
  grade?: string | null;
  target?: number | null;
};

export type RosterTeam = {
  id: string;
  name: string;
  tag: string;
  logo: string;
  description: string;
  isSpoc: boolean;
  captainName: string | null;
  members: RosterMember[];
};

export default function TeamsAndPlayersClient({
  pageCms = DEFAULT_WEBSITE_CMS.pages.teamsPlayers,
  editionTitle,
  mainTeams,
  spocTeams,
}: {
  pageCms?: WebsitePageHeading;
  editionTitle: string;
  mainTeams: RosterTeam[];
  spocTeams: RosterTeam[];
}) {
  const [query, setQuery] = React.useState('');
  const q = query.trim().toLowerCase();

  const matches = (team: RosterTeam) => {
    if (!q) return true;
    if (team.name.toLowerCase().includes(q) || team.tag.toLowerCase().includes(q)) return true;
    return team.members.some(
      (m) => m.name.toLowerCase().includes(q) || m.username.toLowerCase().includes(q),
    );
  };

  const visibleMain = mainTeams.filter(matches);
  const visibleSpoc = spocTeams.filter(matches);
  const teamCount = mainTeams.length + spocTeams.length;
  const playerCount = [...mainTeams, ...spocTeams].reduce((sum, t) => sum + t.members.length, 0);

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-border pb-4 sm:pb-6">
        <div>
          <Badge variant="carrom" className="mb-2">
            {pageCms.badge}
          </Badge>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">{pageCms.title}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 max-w-2xl">{pageCms.subtitle}</p>
          <p className="text-[11px] sm:text-xs font-bold text-amber-500 mt-2 uppercase tracking-wider">
            {editionTitle} · {teamCount} teams · {playerCount} players
          </p>
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a team or player"
            className="pl-9 h-10 text-xs sm:text-sm font-semibold"
          />
        </div>
      </div>

      <TeamSection title="Tournament teams" teams={visibleMain} empty={mainTeams.length === 0} query={q} />
      {spocTeams.length > 0 ? (
        <TeamSection title="SPOC exhibition teams" teams={visibleSpoc} empty={false} query={q} />
      ) : null}
    </div>
  );
}

function TeamSection({
  title,
  teams,
  empty,
  query,
}: {
  title: string;
  teams: RosterTeam[];
  empty: boolean;
  query: string;
}) {
  if (empty) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 sm:p-10 text-center text-muted-foreground">
        <Users className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-3 text-amber-500/40" />
        <div className="font-black text-sm sm:text-base">No teams yet</div>
        <p className="text-xs mt-1">The organizer has not published franchises for this edition.</p>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 sm:p-8 text-center text-xs sm:text-sm text-muted-foreground">
        No {title.toLowerCase()} match “{query}”.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-black uppercase tracking-widest text-amber-500">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {teams.map((team) => (
          <article
            key={team.id}
            className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4 hover:border-amber-500/40 transition-colors"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-13 w-13 sm:h-16 sm:w-16 rounded-xl overflow-hidden bg-slate-950 border border-amber-500/40 p-1 sm:p-1.5 shrink-0">
                <img src={toStorageProxyUrl(team.logo)} alt={team.name} className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black truncate">{team.name}</h3>
                  <Badge variant="carrom" className="text-[10px] sm:text-xs">{team.tag}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {team.captainName ? `Captain: ${team.captainName}` : 'Captain not assigned'}
                  {' · '}
                  {team.members.length} {team.members.length === 1 ? 'player' : 'players'}
                </p>
              </div>
            </div>

            {team.description ? (
              <p className="text-xs text-muted-foreground leading-relaxed">{team.description}</p>
            ) : null}

            <div className="border-t border-border/60 pt-3 space-y-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Team members
              </div>
              {team.members.length === 0 ? (
                <p className="text-xs text-muted-foreground">No players assigned yet.</p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {team.members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 min-w-0"
                    >
                      <Avatar fallback={member.name} size="sm" className="h-7 w-7 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{member.name}</div>
                        {member.username ? (
                          <div className="text-[10px] text-muted-foreground truncate">@{member.username}</div>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-1">
                          {member.grade ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/35">
                              {member.grade}
                            </span>
                          ) : null}
                          {member.target !== null && member.target !== undefined && Number(member.target) >= 0 ? (
                            Number(member.target) > 0 ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/35">
                                <Target className="h-2.5 w-2.5" />
                                Target {member.target}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted/40 text-muted-foreground border border-border/50">
                                <Target className="h-2.5 w-2.5 opacity-60" />
                                No target
                              </span>
                            )
                          ) : null}
                        </div>
                        {member.isCaptain ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider text-amber-400">
                            <Crown className="h-3 w-3" /> Captain
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                            Player
                          </span>
                        )}
                        <Link
                          href={`/videos?player=${encodeURIComponent(member.name)}`}
                          className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/25 hover:bg-violet-500/20 transition-colors"
                          title={`Watch ${member.name}'s videos`}
                        >
                          <Play className="h-2.5 w-2.5 fill-violet-400" /> Watch
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
