'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Film, ChevronLeft, ChevronRight, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getTeamPosterUrl } from '@/lib/supabase';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: i * 0.08 } }),
};

function Section({ id, children, className = '' }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`py-20 ${className}`}>
      {children}
    </section>
  );
}

function SectionHeader({ badge, title, sub }: { badge: string; title: string; sub?: string }) {
  return (
    <div className="text-center space-y-3 mb-14">
      <Badge variant="carrom" className="px-3 py-1 font-bold text-xs">{badge}</Badge>
      <h2 className="text-3xl sm:text-4xl font-black tracking-tight">{title}</h2>
      {sub && <p className="text-muted-foreground text-sm max-w-2xl mx-auto">{sub}</p>}
    </div>
  );
}

export default function HomeClient({
  teams,
  allTeams,
  players,
  matches,
  currentEditionName,
  editionPosterUrl,
  currentEdition,
}: {
  teams: any[];
  allTeams: any[];
  players: any[];
  matches: any[];
  currentEditionName: string | null;
  editionPosterUrl: string | null;
  currentEdition?: {
    id: string;
    title: string;
    theme?: string | null;
    bannerImage?: string | null;
    posterUrl?: string | null;
    number: number;
  } | null;
}) {
  const legacyVideos = [
    { id: 'mFV8W5HdJ3A', title: 'CBOT Intro', label: 'CBOT Intro' },
    { id: 'szimIRoO0jI', title: '25th Edition Closing Video', label: '25th Closing' },
    { id: '9i3_S7JpN74', title: '50th Edition Closing Video', label: '50th Closing' },
    { id: 'eMnF5vIAlPw', title: '100th Centenary Closing Video', label: '100th Centenary' },
  ];

  const [activeVideoIndex, setActiveVideoIndex] = React.useState(0);
  const activeVideo = legacyVideos[activeVideoIndex];

  const prevIndex = (activeVideoIndex - 1 + legacyVideos.length) % legacyVideos.length;
  const nextIndex = (activeVideoIndex + 1) % legacyVideos.length;
  const prevVideo = legacyVideos[prevIndex];
  const nextVideo = legacyVideos[nextIndex];

  // Build sequential YouTube playlist loop order starting from active video
  const playlistIds = [
    ...legacyVideos.slice(activeVideoIndex + 1).map(v => v.id),
    ...legacyVideos.slice(0, activeVideoIndex).map(v => v.id),
    activeVideo.id
  ].join(',');

  const iframeSrc = `https://www.youtube.com/embed/${activeVideo.id}?playlist=${playlistIds}&autoplay=1&mute=1&loop=1`;

  return (
    <div className="flex flex-col min-h-screen overflow-hidden">

      {/* HERO */}
      <section id="hero" className="relative pt-16 pb-24 lg:pt-24 lg:pb-32 carrom-grid-pattern overflow-hidden">
        {currentEdition?.bannerImage && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
            style={{ backgroundImage: `url(${currentEdition.bannerImage})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
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
                World's Premier Online<br />
                Carrom Arena.{' '}
                <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 bg-clip-text text-transparent block mt-2">
                  200+ Editions Strong.
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Founded by Carrom Balu in August 2020, CBOT has hosted over 200 competitive editions connecting players worldwide.
              </p>

              {/* Stats ticker */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 border-t border-border/50">
                {[
                  { val: '199', label: 'Editions Completed', color: 'text-amber-500' },
                  { val: '5,200+', label: 'Matches Played', color: 'text-foreground' },
                  { val: '1,850+', label: 'Queen Covers', color: 'text-pink-500' },
                  { val: '450+', label: 'Active Competitors', color: 'text-emerald-500' },
                ].map(s => (
                  <div key={s.label}>
                    <div className={`text-2xl sm:text-3xl font-black ${s.color}`}>{s.val}</div>
                    <div className="text-xs text-muted-foreground font-medium mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Edition highlight card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="lg:col-span-5"
            >
              <div className="relative mx-auto max-w-md flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <Badge variant="carrom" className="px-3 py-1.5 font-extrabold text-[10px] uppercase tracking-widest shadow-lg">
                    Current Edition
                  </Badge>
                  <div className="flex items-center gap-1.5 bg-emerald-500/90 backdrop-blur-sm text-white text-[10px] font-extrabold px-3 py-1.5 rounded-full shadow-lg">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping inline-block" />
                    IN PROGRESS
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-amber-500/60 via-amber-300/30 to-amber-600/40 blur-2xl pointer-events-none" />
                  <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500/70 to-amber-600 blur-sm opacity-70 pointer-events-none" />
                  <div className="relative rounded-2xl overflow-hidden border-2 border-amber-400/80 shadow-2xl shadow-amber-500/40 ring-2 ring-amber-500/30">
                    <img
                      src={editionPosterUrl || '/edition-poster.jpg'}
                      alt="Current Edition Poster"
                      className="w-full h-auto object-cover"
                      style={{ display: 'block' }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* TEAMS MARQUEE STRIP */}
      {(() => {
        const sourceTeams = (teams && teams.length > 0)
          ? teams
          : (allTeams && allTeams.length > 0)
          ? allTeams
          : [
              { id: '1', name: 'Vintage Strikers', tag: 'PRECISION', logo: getTeamPosterUrl('vintage-strikers.jpeg') },
              { id: '2', name: 'Boric Speedsters', tag: 'SPEED', logo: getTeamPosterUrl('boric-speedsters.jpeg') },
              { id: '3', name: 'Plywood Pioneers', tag: 'FOUNDATION', logo: getTeamPosterUrl('plywood-pioneers.jpeg') },
              { id: '4', name: 'Pocket Dynamos', tag: 'ACCURACY', logo: getTeamPosterUrl('pocket-dynamos.jpeg') },
              { id: '5', name: 'Vanilla Falcons', tag: 'STRATEGY', logo: getTeamPosterUrl('vanilla-falcons.jpeg') },
              { id: '6', name: 'Ebony Overlords', tag: 'DOMINANCE', logo: getTeamPosterUrl('ebony-overlords.jpeg') },
              { id: '7', name: 'Supernova Queen', tag: 'GLORY', logo: getTeamPosterUrl('supernova-queen.jpeg') },
              { id: '8', name: 'Lumen Pillar', tag: 'ILLUMINATION', logo: getTeamPosterUrl('lumen-pillar.jpeg') },
            ];

        const marqueeBaseItems = sourceTeams.map((t: any) => ({
          id: t.id || t.name,
          name: t.name,
          tag: t.tag || 'FRANCHISE',
          img: t.logo || t.posterUrl || getTeamPosterUrl(`${(t.name || 'team').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpeg`),
          border: 'border-amber-500/50',
          glow: 'shadow-amber-500/30',
        }));

        const marqueeItems = [...marqueeBaseItems, ...marqueeBaseItems, ...marqueeBaseItems];

        return (
          <div className="relative w-full overflow-hidden py-8 border-y border-amber-500/10 bg-gradient-to-r from-background via-amber-500/5 to-background">
            <div className="absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
            <div className="flex animate-marquee gap-5 w-max">
              {marqueeItems.map((team, i) => (
                <div
                  key={`${team.id}-${i}`}
                  className="relative flex-shrink-0 h-64 w-auto rounded-xl overflow-hidden cursor-pointer group transition-transform duration-300 hover:scale-105 hover:-translate-y-1"
                  title={team.name}
                >
                  <img
                    src={team.img}
                    alt={team.name}
                    className="h-64 w-auto object-contain rounded-xl"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none" />
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* HISTORY & 3D VIDEO CAROUSEL EMBED */}
      <Section id="history">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-10">
          <SectionHeader
            badge="CBOT History"
            title="The Legacy Since August 2020"
            sub="From an 8-team local online tournament by Balu Master to a nationwide digital esports ecosystem with 200+ completed editions."
          />

          {/* 3D Video Carousel Stage */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="w-full space-y-6"
          >
            {/* Milestone Navigation Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {legacyVideos.map((v, idx) => (
                <button
                  key={v.id}
                  onClick={() => setActiveVideoIndex(idx)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-extrabold transition-all ${
                    activeVideoIndex === idx
                      ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 scale-105'
                      : 'bg-card border border-border text-muted-foreground hover:border-amber-500/50 hover:text-white'
                  }`}
                >
                  <Film className="h-3.5 w-3.5" />
                  <span>{v.label}</span>
                </button>
              ))}
            </div>

            {/* 3D Stacking Video Frame Container with Smooth Motion Animations */}
            <div className="relative w-full flex items-center justify-center min-h-[260px] sm:min-h-[420px] lg:min-h-[500px] py-6 overflow-visible">
              
              <AnimatePresence mode="wait">
                {/* Previous Video Card (Left Behind with Full Title) */}
                <motion.div
                  key={`prev-${prevVideo.id}`}
                  initial={{ opacity: 0, x: -60, scale: 0.85 }}
                  animate={{ opacity: 0.8, x: 0, scale: 0.95 }}
                  exit={{ opacity: 0, x: -60, scale: 0.85 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  onClick={() => setActiveVideoIndex(prevIndex)}
                  className="absolute -left-3 sm:-left-8 lg:-left-16 z-10 w-5/12 max-w-[320px] sm:max-w-[380px] lg:max-w-[460px] aspect-video rounded-2xl overflow-hidden border-2 border-amber-500/50 bg-card shadow-2xl shadow-black/80 hover:opacity-100 cursor-pointer transition-all duration-300 hover:scale-100 group hidden sm:block"
                  title={`Click to play: ${prevVideo.title}`}
                >
                  <img
                    src={`https://img.youtube.com/vi/${prevVideo.id}/hqdefault.jpg`}
                    alt={prevVideo.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent group-hover:bg-slate-950/20 transition-all flex flex-col justify-between p-4">
                    <div className="flex items-center gap-1.5 bg-amber-500 text-slate-950 px-2.5 py-1 rounded-full text-[10px] font-black w-fit shadow-md">
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>PREVIOUS VIDEO</span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs sm:text-sm font-extrabold text-white drop-shadow-md leading-tight group-hover:text-amber-400 transition-colors">
                        {prevVideo.title}
                      </h4>
                      <p className="text-[10px] text-amber-300/90 font-bold flex items-center gap-1">
                        <PlayCircle className="h-3 w-3 inline text-amber-400" /> Click to play
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Active Main Video Frame (Center Front) */}
                <motion.div
                  key={`active-${activeVideo.id}`}
                  initial={{ opacity: 0, scale: 0.92, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -10 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="relative z-20 w-full max-w-3xl aspect-video rounded-2xl overflow-hidden border-2 border-amber-500/80 bg-card shadow-2xl shadow-amber-500/40"
                >
                  <iframe
                    className="w-full h-full"
                    src={iframeSrc}
                    title={activeVideo.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </motion.div>

                {/* Next Video Card (Right Behind with Full Title) */}
                <motion.div
                  key={`next-${nextVideo.id}`}
                  initial={{ opacity: 0, x: 60, scale: 0.85 }}
                  animate={{ opacity: 0.8, x: 0, scale: 0.95 }}
                  exit={{ opacity: 0, x: 60, scale: 0.85 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  onClick={() => setActiveVideoIndex(nextIndex)}
                  className="absolute -right-3 sm:-right-8 lg:-right-16 z-10 w-5/12 max-w-[320px] sm:max-w-[380px] lg:max-w-[460px] aspect-video rounded-2xl overflow-hidden border-2 border-amber-500/50 bg-card shadow-2xl shadow-black/80 hover:opacity-100 cursor-pointer transition-all duration-300 hover:scale-100 group hidden sm:block"
                  title={`Click to play: ${nextVideo.title}`}
                >
                  <img
                    src={`https://img.youtube.com/vi/${nextVideo.id}/hqdefault.jpg`}
                    alt={nextVideo.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent group-hover:bg-slate-950/20 transition-all flex flex-col justify-between p-4 text-right">
                    <div className="flex items-center gap-1.5 bg-amber-500 text-slate-950 px-2.5 py-1 rounded-full text-[10px] font-black w-fit shadow-md ml-auto">
                      <span>NEXT VIDEO</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs sm:text-sm font-extrabold text-white drop-shadow-md leading-tight group-hover:text-amber-400 transition-colors">
                        {nextVideo.title}
                      </h4>
                      <p className="text-[10px] text-amber-300/90 font-bold flex items-center justify-end gap-1">
                        Click to play <PlayCircle className="h-3 w-3 inline text-amber-400" />
                      </p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

            </div>
          </motion.div>
        </div>
      </Section>

    </div>
  );
}
