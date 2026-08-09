'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Search, Calendar, Crown, ArrowRight } from 'lucide-react';

export default function EditionsClient({ editions }: { editions: any[] }) {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredEditions = editions.filter((ed) => {
    if (!searchTerm.trim()) return true;
    const titleText = ed.title || ed.name || '';
    return titleText.toLowerCase().includes(searchTerm.toLowerCase().trim());
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <Badge variant="carrom" className="mb-2">CBOT Archive</Badge>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Tournament Editions Archive</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Browse full historic records of the Carrom Balu Online Tournament.
          </p>
        </div>
        <div className="text-right font-mono text-sm font-bold text-amber-500 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/30">
          Total Editions: {editions.length}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search edition title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Editions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredEditions.map((ed) => {
          return (
            <Card key={ed.id} className="overflow-hidden border-border hover:border-amber-500/60 hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="relative h-44 w-full overflow-hidden bg-slate-950">
                  <img
                    src={ed.bannerImage || ed.posterUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=1200'}
                    alt={ed.title || ed.name || 'Edition'}
                    className="h-full w-full object-cover opacity-85 hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3">
                    <Badge variant="carrom" className="font-extrabold text-xs shadow-md">
                      Edition #{ed.number}
                    </Badge>
                  </div>
                  <div className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black text-amber-400 border border-amber-500/30">
                    {ed.prizePool || 'Glory'}
                  </div>
                </div>

                <CardHeader className="space-y-2 p-5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-semibold">
                      <Calendar className="h-3.5 w-3.5 text-amber-500" /> 
                      {new Date(ed.tournamentStartDate || ed.startDate || Date.now()).toLocaleDateString()}
                    </span>
                    <span className="font-bold text-foreground">
                      {ed.teams?.length || 0} / {ed.maxTeams} Teams
                    </span>
                  </div>
                  <CardTitle className="text-lg leading-snug">{ed.title || ed.name}</CardTitle>
                </CardHeader>
              </div>

              <CardContent className="px-5 pb-5 pt-0 space-y-3">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-extrabold text-amber-500">{ed.status}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Format:</span>
                    <span className="font-semibold text-foreground">{ed.format.replace('_', ' ')}</span>
                  </div>
                </div>

                <Link href={`/tournaments/${ed.slug || ed.id}`} className="block">
                  <Button variant="outline" className="w-full text-xs font-bold justify-between">
                    <span>View Details</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
