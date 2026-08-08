'use client';

import * as React from 'react';
import Link from 'next/link';
import { MOCK_TOURNAMENTS } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Trophy, Search, Filter, Calendar, Users, ArrowRight, ShieldCheck } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function TournamentsPage() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('ALL');
  const [formatFilter, setFormatFilter] = React.useState('ALL');

  const filteredTournaments = MOCK_TOURNAMENTS.filter((tour) => {
    const matchesSearch = tour.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tour.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || tour.status === statusFilter;
    const matchesFormat = formatFilter === 'ALL' || tour.format === formatFilter;
    return matchesSearch && matchesStatus && matchesFormat;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <Badge variant="carrom" className="mb-2">CBOT Tournaments</Badge>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Competitive Arena</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Browse active cups, upcoming blitz rounds, and national carrom championship brackets.
          </p>
        </div>
        <Link href="/dashboard/organizer">
          <Button variant="carrom" className="font-bold">
            + Create New Tournament
          </Button>
        </Link>
      </div>

      {/* Search & Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 p-4 rounded-2xl bg-card border border-border">
        <div className="relative sm:col-span-6">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tournaments by name, format, or rules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>

        <div className="sm:col-span-3">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="REGISTRATION_OPEN">Registration Open</option>
            <option value="COMPLETED">Completed</option>
          </Select>
        </div>

        <div className="sm:col-span-3">
          <Select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
            <option value="ALL">All Formats</option>
            <option value="SINGLE_ELIMINATION">Single Elimination</option>
            <option value="DOUBLE_ELIMINATION">Double Elimination</option>
            <option value="ROUND_ROBIN">Round Robin</option>
            <option value="SWISS">Swiss System</option>
          </Select>
        </div>
      </div>

      {/* Tournaments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredTournaments.map((tour) => (
          <Card key={tour.id} className="overflow-hidden border-border hover:border-amber-500/60 hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="relative h-48 w-full overflow-hidden bg-slate-950">
                <img
                  src={tour.bannerImage}
                  alt={tour.title}
                  className="h-full w-full object-cover opacity-85 hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                <div className="absolute top-3 left-3">
                  <Badge
                    variant={
                      tour.status === 'IN_PROGRESS'
                        ? 'warning'
                        : tour.status === 'REGISTRATION_OPEN'
                        ? 'success'
                        : 'secondary'
                    }
                    className="font-bold shadow-md"
                  >
                    {tour.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black text-amber-400 border border-amber-500/30">
                  {tour.prizePool}
                </div>
              </div>

              <CardHeader className="space-y-2 p-5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-wider">
                  <Trophy className="h-3.5 w-3.5" />
                  {tour.format.replace('_', ' ')}
                </div>
                <CardTitle className="text-xl leading-snug">{tour.title}</CardTitle>
                <CardDescription className="text-xs line-clamp-2">{tour.description}</CardDescription>
              </CardHeader>
            </div>

            <CardContent className="px-5 pb-5 pt-0 space-y-4">
              <div className="space-y-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-amber-500" /> Start Date:</span>
                  <span className="font-semibold text-foreground">{formatDate(tour.startDate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-emerald-500" /> Roster Count:</span>
                  <span className="font-semibold text-foreground">{tour.teams?.length || 0} / {tour.maxTeams} Teams</span>
                </div>
              </div>

              <Link href={`/tournaments/${tour.id}`} className="block">
                <Button variant="carrom" className="w-full text-xs font-bold justify-between">
                  <span>View Bracket & Fixtures</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
