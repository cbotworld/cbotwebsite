'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Film, ChevronLeft, ChevronRight, PlayCircle, Sparkles, Heart, ShieldCheck, Mail, X, ZoomIn } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
    { id: '_VRKmVVM-00', title: '200th Edition Launch Video', label: '200th Launch' },
    { id: 'mFV8W5HdJ3A', title: 'CBOT Intro', label: 'CBOT Intro' },
    { id: 'szimIRoO0jI', title: '25th Edition Closing Video', label: '25th Closing' },
    { id: '9i3_S7JpN74', title: '50th Edition Closing Video', label: '50th Closing' },
    { id: 'eMnF5vIAlPw', title: '100th Centenary Closing Video', label: '100th Centenary' },
  ];

  const [activeVideoIndex, setActiveVideoIndex] = React.useState(0);
  const [sponsorModalOpen, setSponsorModalOpen] = React.useState(false);
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
                <span>Celebrating 200th Edition</span>
              </div>

              <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-none">
                World's Premier Online<br />
                Carrom Arena.{' '}
                <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 bg-clip-text text-transparent block mt-2">
                  200th Edition.
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Founded by Carrom Balu in August 2020, CBOT reaches its monumental 200th edition connecting players worldwide.
              </p>

              {/* Stats ticker */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 border-t border-border/50">
                {[
                  { val: '200th', label: 'Edition Milestone', color: 'text-amber-500' },
                  { val: '12,000+', label: 'Matches Played', color: 'text-foreground' },
                  { val: '2,000+', label: 'Slams', color: 'text-pink-500' },
                  { val: '100+', label: 'Active Participants', color: 'text-emerald-500' },
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

      {/* OFFICIAL ELITE SPONSORS SECTION */}
      <section id="sponsors" className="py-16 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent relative border-y border-emerald-500/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center space-y-10">

          {/* Section Header */}
          <div className="space-y-3">
            <Badge variant="carrom" className="px-4 py-1.5 font-extrabold text-xs tracking-widest uppercase shadow-lg bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
              💎 Official Elite Sponsors
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-500 bg-clip-text text-transparent">
              Powering CBOT 200th Edition
            </h2>
            <p className="text-muted-foreground text-sm max-w-2xl mx-auto font-medium">
              Our elite sponsors make this milestone tournament possible — supporting communities, sports talent, &amp; cultural empowerment.
            </p>
          </div>

          {/* Shared Thank You Banner */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/15 to-amber-500/20 border border-amber-400/40 shadow-lg shadow-amber-500/10">
              <Heart className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
              <span className="text-sm font-black text-amber-300 tracking-wide">
                Special Thank you to Muthu Kumar Sir
              </span>
              <Heart className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
            </div>
            <div className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/15 to-amber-500/20 border border-amber-400/40 shadow-lg shadow-amber-500/10">
              <Heart className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
              <span className="text-sm font-black text-amber-300 tracking-wide">
                Special Thank you to Lalit
              </span>
              <Heart className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
            </div>
          </div>

          {/* Three-sponsor grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-center">

            {/* 1. ── Neelamani Foundation (Left Corner) ── */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSponsorModalOpen(true)}
              className="group relative cursor-pointer flex flex-col items-center justify-center p-4"
            >
              <div className="flex flex-col items-center justify-center gap-4 w-full">
                <div className="h-36 w-36 sm:h-40 sm:w-40 rounded-full border-4 border-emerald-500/50 p-1 bg-slate-950 shadow-2xl shadow-emerald-500/30 group-hover:scale-105 group-hover:border-emerald-400 transition-all duration-300 flex items-center justify-center">
                  <img
                    src="/sponsors/neelamani-logo.jpg"
                    alt="Neelamani Foundation Logo"
                    className="w-full h-full object-contain rounded-full drop-shadow-md"
                  />
                </div>
                <div className="py-2 px-5 rounded-xl bg-slate-950/90 border border-emerald-500/40 text-center shadow-lg group-hover:border-emerald-400 transition-colors">
                  <span className="text-sm sm:text-base font-extrabold text-emerald-400 tracking-wide">Neelamani Foundation</span>
                </div>
              </div>
            </motion.div>

            {/* 2. ── SYNCO (Center) ── */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.open('https://syncoshop.com/', '_blank', 'noopener,noreferrer')}
              className="group relative cursor-pointer flex flex-col items-center justify-center p-4"
            >
              <div className="flex flex-col items-center justify-center gap-4 w-full">
                <div className="h-32 w-56 sm:h-36 sm:w-64 rounded-2xl border-2 border-rose-400/50 p-3 bg-white shadow-2xl shadow-rose-500/30 group-hover:scale-105 group-hover:border-rose-400 transition-all duration-300 flex items-center justify-center">
                  <img
                    src="/sponsors/synco-logo.png"
                    alt="SYNCO Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="py-2 px-5 rounded-xl bg-slate-950/90 border border-rose-500/40 text-center shadow-lg group-hover:border-rose-400 transition-colors">
                  <span className="text-sm sm:text-base font-extrabold text-rose-400 tracking-wide">SYNCO Sports</span>
                </div>
              </div>
            </motion.div>

            {/* 3. ── SISCAA (Right Corner) ── */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.open('https://siscaasports.com/', '_blank', 'noopener,noreferrer')}
              className="group relative cursor-pointer flex flex-col items-center justify-center p-4"
            >
              <div className="flex flex-col items-center justify-center gap-4 w-full">
                <div className="h-32 w-56 sm:h-36 sm:w-64 rounded-2xl border-2 border-sky-400/50 p-3 bg-black shadow-2xl shadow-sky-500/30 group-hover:scale-105 group-hover:border-sky-400 transition-all duration-300 flex items-center justify-center">
                  <img
                    src="/sponsors/siscaa-logo.png"
                    alt="SISCAA Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="py-2 px-5 rounded-xl bg-slate-950/90 border border-sky-500/40 text-center shadow-lg group-hover:border-sky-400 transition-colors">
                  <span className="text-sm sm:text-base font-extrabold text-sky-400 tracking-wide">SISCAA Carrom</span>
                </div>
              </div>
            </motion.div>

          </div>{/* /grid */}
        </div>
      </section>

      {/* SPECIAL SPONSOR SECTION */}
      <section id="special-sponsors" className="py-16 relative overflow-hidden bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent border-y border-emerald-500/10">
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-10">
          <div className="space-y-3">
            <Badge variant="carrom" className="px-4 py-1.5 font-extrabold text-xs tracking-widest uppercase shadow-lg bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
              🌟 Special Sponsor
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 bg-clip-text text-transparent">
              360° Support to CBOT
            </h2>
            <p className="text-sm sm:text-base font-semibold text-emerald-400/80 max-w-lg mx-auto">
              Thank you for your incredible 360-degree support to the CBOT community.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-10 sm:gap-20">
            {/* Srikranthi */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center gap-4 group"
            >
              <div className="relative">
                <div className="h-28 w-28 sm:h-36 sm:w-36 rounded-full border-4 border-emerald-500/50 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-emerald-600/20 flex items-center justify-center shadow-2xl shadow-emerald-500/20 group-hover:scale-110 group-hover:border-emerald-400 group-hover:shadow-emerald-400/30 transition-all duration-500">
                  <span className="text-4xl sm:text-5xl font-black bg-gradient-to-br from-emerald-300 via-teal-400 to-emerald-500 bg-clip-text text-transparent select-none tracking-wide">
                    SK
                  </span>
                </div>
                <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-emerald-400/20 via-teal-400/15 to-emerald-400/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
              </div>
              <div className="text-center mt-1">
                <h3 className="text-xl sm:text-2xl font-black text-emerald-400 leading-tight group-hover:text-emerald-300 transition-colors">Srikranthi</h3>
              </div>
            </motion.div>

            {/* AK Chari */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex flex-col items-center gap-4 group"
            >
              <div className="relative">
                <div className="h-28 w-28 sm:h-36 sm:w-36 rounded-full border-4 border-teal-500/50 bg-gradient-to-br from-teal-500/20 via-emerald-500/10 to-teal-600/20 flex items-center justify-center shadow-2xl shadow-teal-500/20 group-hover:scale-110 group-hover:border-teal-400 group-hover:shadow-teal-400/30 transition-all duration-500">
                  <span className="text-4xl sm:text-5xl font-black bg-gradient-to-br from-teal-300 via-emerald-400 to-teal-500 bg-clip-text text-transparent select-none tracking-wide">
                    AK
                  </span>
                </div>
                <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-teal-400/20 via-emerald-400/15 to-teal-400/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
              </div>
              <div className="text-center mt-1">
                <h3 className="text-xl sm:text-2xl font-black text-teal-400 leading-tight group-hover:text-teal-300 transition-colors">AK Chari</h3>
              </div>
            </motion.div>
          </div>
        </div>
      </section>


      {/* GOLD SPONSORS SECTION */}
      <section id="gold-sponsors" className="py-16 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-yellow-500/6 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center space-y-10">
          {/* Header */}
          <div className="space-y-3">
            <Badge variant="carrom" className="px-4 py-1.5 font-extrabold text-xs tracking-widest uppercase shadow-lg bg-amber-500/20 text-amber-400 border-amber-500/40">
              🥇 Gold Sponsors
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
              Our Gold Sponsors
            </h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto font-medium">
              Proud supporters powering CBOT 200th Edition. Thank you for your generous contributions!
            </p>
          </div>

          {/* Sponsor Grid */}
          <div className="flex flex-wrap items-start justify-center gap-6 sm:gap-8">

            {/* Scrapplique Galore — Logo sponsor */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="relative">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full border-2 border-amber-400/70 p-1 bg-white shadow-xl shadow-amber-500/20 group-hover:scale-110 group-hover:border-amber-400 transition-all duration-300">
                  <img
                    src="/sponsors/scrapplique-galore-logo.png"
                    alt="Scrapplique Galore"
                    className="w-full h-full object-contain rounded-full"
                  />
                </div>
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-400/30 via-yellow-400/20 to-amber-400/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
              </div>
              <span className="text-xs font-bold text-amber-300 max-w-[90px] text-center leading-tight">Scrapplique Galore</span>
            </motion.div>

            {/* Individual sponsors with initials */}
            {[
              { name: 'Packiya',        initials: 'PK' },
              { name: 'Abhijit',        initials: 'AB' },
              { name: 'Manoj PS',       initials: 'MA' },
              { name: 'Mahesh TN',      initials: 'MA' },
              { name: 'Kumar A',        initials: 'KA' },
              { name: 'Ramesh',         initials: 'RA' },
              { name: 'Vinod',          initials: 'VI' },
              { name: 'Din',            initials: 'DI' },
              { name: 'Krishnamurthy',  initials: 'KR' },
              { name: 'Rakesh',         initials: 'RA' },
              { name: 'Srivishnu',      initials: 'SR' },
              { name: 'Neela',          initials: 'NE' },
              { name: 'Lalit',          initials: 'LA' },
              { name: 'Lalit Friends',  initials: 'LF' },
              { name: 'Umesh',          initials: 'UM' },
              { name: 'Roopa',          initials: 'RO' },
              { name: 'Praveen',        initials: 'PR' },
            ].map((sponsor, idx) => (
              <motion.div
                key={sponsor.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.04 }}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="relative">
                  <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full border-2 border-amber-400/50 bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-amber-600/20 flex items-center justify-center shadow-lg shadow-amber-500/10 group-hover:scale-110 group-hover:border-amber-400 group-hover:shadow-amber-400/30 transition-all duration-300">
                    <span className="text-xl sm:text-2xl font-black bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent select-none tracking-wide">
                      {sponsor.initials}
                    </span>
                  </div>
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-400/20 via-yellow-400/15 to-amber-400/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
                </div>
                <span className="text-xs font-bold text-amber-300/80 max-w-[80px] text-center leading-tight group-hover:text-amber-300 transition-colors">
                  {sponsor.name}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HISTORY & 3D VIDEO CAROUSEL EMBED */}
      <Section id="history">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-10">
          <SectionHeader
            badge="CBOT - Carrom Balu Online Tournament"
            title="The Legacy Since 2020"
            sub="With a thought of 1 tournament, CBOT continued with back-to-back non-stop editions driven by huge response and demand - crossing 50th, 100th, and 150th edition milestones to reach the monumental 200th edition with support from sponsors, players, and brands."
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

      {/* NEELAMANI FOUNDATION OFFICIAL POSTER POPUP MODAL */}
      <Dialog open={sponsorModalOpen} onOpenChange={setSponsorModalOpen}>
        <div className="relative flex flex-col max-h-[92vh] overflow-hidden -mx-6 -my-6 bg-black text-foreground rounded-2xl border border-border/40 shadow-2xl">
          {/* Floating Close Button */}
          <button
            onClick={() => setSponsorModalOpen(false)}
            className="absolute top-3 right-3 z-30 p-2 rounded-full bg-black/80 hover:bg-black text-white/80 hover:text-white border border-white/20 transition-all backdrop-blur-md cursor-pointer"
            title="Close Poster"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Full poster image only */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 flex items-center justify-center">
            <img
              src="/sponsors/neelamani-poster.jpg"
              alt="Neelamani Foundation Official Sponsor Poster"
              className="w-full max-w-2xl h-auto object-contain max-h-[85vh] rounded-xl shadow-2xl"
            />
          </div>
        </div>
      </Dialog>

    </div>
  );
}
