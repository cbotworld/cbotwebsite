'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Search, Crown } from 'lucide-react';

export default function PlayersClient({ initialPlayers }: { initialPlayers: any[] }) {
  const [search, setSearch] = React.useState('');

  const players = initialPlayers.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    const qClean = q.startsWith('@') ? q.substring(1) : q;
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(qClean) ||
      (u.rating !== undefined && u.rating !== null && String(u.rating).includes(q))
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <Badge variant="carrom" className="mb-2">CBOT Competitors</Badge>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Player Directory</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Registered Carrom players, captains, and master strikers.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by player name or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Players Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {players.map((p) => (
          <Card key={p.id} className="p-5 border-border hover:border-amber-500/50 hover:shadow-xl transition-all text-center space-y-3">
            <Avatar src={p.image} fallback={p.name} size="xl" className="mx-auto ring-4 ring-amber-500/30" />
            
            <div>
              <h3 className="font-extrabold text-base">{p.name}</h3>
              <Badge variant="outline" className="text-[10px] mt-1">{p.role}</Badge>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2">{p.bio}</p>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px]">ELO Rating</span>
                <span className="font-black text-amber-500 text-base">{p.rating}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Queens Covered</span>
                <span className="font-black text-pink-500 text-base flex items-center justify-center gap-0.5">
                  <Crown className="h-3 w-3" /> {p.queenStrikes || 0}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
