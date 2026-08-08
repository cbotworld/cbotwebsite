'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Trophy, Shield, Users, UserCheck, Flame, Crown, ArrowRight, Play, Award, Zap, CheckCircle2, Radio, Calendar, Star, History, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { MOCK_EDITIONS, MOCK_HALL_OF_FAME, MOCK_MATCHES, MOCK_TEAMS } from '@/lib/mock-data';

export default function HomePage() {
  const liveMatches = MOCK_MATCHES.filter((m) => m.status === 'LIVE');
  const recentEditions = MOCK_EDITIONS.slice(0, 3);
  const featuredChampions = MOCK_HALL_OF_FAME;

  const timelineEvents = [
    { year: 'Aug 2020', title: 'CBOT Founded', desc: 'Balu Master organizes CBOT Edition #1 with 8 inaugural teams.' },
    { year: 'May 2022', title: 'Edition #50 Milestone', desc: 'Crossed 50 competitive editions and introduced standard queen cover verification.' },
    { year: 'Nov 2023', title: 'Centennial Edition #100', desc: '100th edition with ₹1,00,000 prize pool and 16 top state rosters.' },
    { year: 'May 2026', title: 'Historic Bicentennial #200', desc: 'Landmark 200th edition hosted with 32 teams and live video streaming.' },
    { year: 'Aug 2026', title: 'Edition #205 & Next Gen Portal', desc: 'Current active edition with automated role-based match score validation.' },
  ];

  return (
    <div className="flex flex-col min-h-screen overflow-hidden">

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 lg:pt-24 lg:pb-32 carrom-grid-pattern overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background pointer-events-none" />
        
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Hero Text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-7 space-y-6 text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-500 backdrop-blur-md">
                <Crown className="h-4 w-4 text-amber-400" />
                <span>Celebrating 200+ Editions Since August 2020</span>
              </div>

              <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-none">
                World's Premier Online Carrom Arena.{' '}
                <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 bg-clip-text text-transparent block mt-2">
                  200+ Editions Strong.
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                Founded by Carrom Balu in August 2020, CBOT has hosted over 200 competitive editions connecting players worldwide.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                <Link href="/editions">
                  <Button size="lg" variant="carrom" className="w-full sm:w-auto shadow-xl font-bold">
                    <Trophy className="h-5 w-5 mr-2" /> Explore 200+ Editions
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-xl font-bold">
                    Register as Player <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="ghost" className="w-full sm:w-auto text-muted-foreground hover:text-foreground">
                    Log In
                  </Button>
                </Link>
              </div>

              {/* Community Statistics Ticker */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 border-t border-border/50">
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-500">200+</div>
                  <div className="text-xs text-muted-foreground font-medium mt-0.5">Editions Completed</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-foreground">5,200+</div>
                  <div className="text-xs text-muted-foreground font-medium mt-0.5">Matches Played</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-pink-500">1,850+</div>
                  <div className="text-xs text-muted-foreground font-medium mt-0.5">Queen Covers</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-500">450+</div>
                  <div className="text-xs text-muted-foreground font-medium mt-0.5">Active Competitors</div>
                </div>
              </div>
            </motion.div>

            {/* Right Current Edition Highlight Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="lg:col-span-5"
            >
              <div className="relative mx-auto max-w-md rounded-3xl border border-amber-500/30 bg-gradient-to-b from-card via-card/80 to-card p-6 shadow-2xl backdrop-blur-xl">
                
                <div className="text-center space-y-4">
                  <Badge variant="carrom" className="px-3 py-1 font-bold text-xs uppercase tracking-wider">
                    Current Edition #205
                  </Badge>

                  <h3 className="text-2xl font-black">Grand Masters Cup 2026</h3>
                  <p className="text-xs text-muted-foreground">
                    16 Teams • ₹2,00,000 Prize Pool • Single Elimination Format
                  </p>

                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-amber-500">Edition Status:</span>
                      <span className="text-emerald-500">IN PROGRESS</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Live Board 1:</span>
                      <span className="font-mono font-bold text-foreground">Striker Kings 14 - 16 Queen Chargers</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Link href="/tournaments/tour_1" className="flex-1">
                      <Button variant="carrom" className="w-full text-xs font-bold rounded-xl">
                        View Live Bracket Tree
                      </Button>
                    </Link>
                    <Link href="/live">
                      <Button variant="outline" size="icon" className="rounded-xl" title="Watch Live Stream">
                        <Radio className="h-4 w-4 text-rose-500 animate-pulse" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Historical Timeline Section (August 2020 to Present) */}
      <section className="py-20 bg-muted/20 border-y border-border/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-16">
            <Badge variant="outline" className="px-3 py-1 font-bold">CBOT History</Badge>
            <h2 className="text-3xl font-black tracking-tight">The Legacy Since August 2020</h2>
            <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
              From a 8-team local online tournament organized by Balu Master in August 2020 to a nationwide digital esports ecosystem with over 200+ completed editions.
            </p>
          </div>

          <div className="relative border-l-2 border-amber-500/30 ml-4 sm:ml-32 space-y-8">
            {timelineEvents.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative pl-8 sm:pl-10"
              >
                <div className="absolute -left-[17px] top-1.5 h-8 w-8 rounded-full bg-card border-2 border-amber-500 flex items-center justify-center text-amber-500 font-bold text-xs shadow-md">
                  <History className="h-4 w-4" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                  <h3 className="text-lg font-extrabold text-foreground">{item.title}</h3>
                  <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full w-fit">
                    {item.year}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Champions / Hall of Fame Preview */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <Badge variant="carrom" className="mb-2">Hall of Fame</Badge>
              <h2 className="text-3xl font-black tracking-tight">Featured CBOT Champions</h2>
            </div>
            <Link href="/hall-of-fame">
              <Button variant="outline" className="gap-2 text-xs font-bold">
                View Full Hall of Fame <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredChampions.map((champ) => (
              <Card key={champ.id} className="p-6 border-amber-500/30 hover:border-amber-500 hover:shadow-xl transition-all text-center space-y-4">
                <Avatar src={champ.avatar} fallback={champ.name} size="xl" className="mx-auto ring-4 ring-amber-500/40" />
                <div>
                  <h3 className="font-extrabold text-lg">{champ.name}</h3>
                  <p className="text-xs text-amber-500 font-bold mt-0.5">{champ.title}</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 text-xs font-semibold text-foreground">
                  🏆 {champ.editionsWon} Editions Won • Inducted {champ.inductionYear}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{champ.achievement}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Registration Banner */}
      <section className="py-16 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-3xl font-black tracking-tight">Ready to Enter CBOT Edition #205?</h2>
            <p className="text-sm font-semibold text-slate-900 max-w-xl">
              Register your team captain account or sign up as an individual competitor to participate in upcoming tournaments.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/register">
              <Button size="lg" className="bg-slate-950 text-amber-400 hover:bg-slate-900 font-extrabold shadow-xl">
                Register Team Now
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" className="bg-slate-950/90 text-white hover:bg-slate-950 hover:text-amber-400 font-extrabold border border-slate-900 shadow-xl transition-all">
                Log In
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
