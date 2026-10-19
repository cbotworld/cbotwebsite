'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Film, ChevronLeft, ChevronRight, PlayCircle, Sparkles, Heart, ShieldCheck, Mail, X, ZoomIn } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { getTeamPosterUrl, toStorageProxyUrl } from '@/lib/supabase';
import {
  sponsorAccentClasses,
  specialSponsorAccentClasses,
  statColorClass,
  type WebsiteCmsContent,
} from '@/lib/website-cms';
import { SponsorAvatar } from '@/components/layout/SponsorAvatar';
import { withImageCacheBust } from '@/lib/safe-image-url';
import { currentCombiDayNumber } from '@/lib/combi-cutoff';

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
  websiteCms,
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
    tournamentStartDate?: string | null;
    dayDates?: string | null;
    totalDays?: number;
  } | null;
  websiteCms: WebsiteCmsContent;
}) {
  const hero = websiteCms.hero;
  const sponsorsCms = websiteCms.sponsors;
  const specialSponsorsCms = websiteCms.specialSponsors;
  const goldSponsorsCms = websiteCms.goldSponsors;
  const legacyCms = websiteCms.legacy;
  const rawPoster = editionPosterUrl || currentEdition?.posterUrl || hero.posterUrl || '/edition-poster.jpg';
  const heroPosterUrl = toStorageProxyUrl(withImageCacheBust(rawPoster));
  const heroBannerImage = hero.bannerImage || currentEdition?.bannerImage || null;

  const legacyVideos = React.useMemo(() => {
    const raw = Array.isArray(legacyCms.videos) ? legacyCms.videos : [];
    const list = raw
      .filter((v) => Boolean((v.youtubeId || '').trim()))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((v, idx) => ({
        id: (v.youtubeId || '').trim(),
        title: v.title || `Milestone Video ${idx + 1}`,
        label: v.label || `Video ${idx + 1}`,
        key: `${v.id || 'vid'}-${idx}-${(v.youtubeId || '').trim()}`,
      }));
    return list.length > 0
      ? list
      : [{ id: '_VRKmVVM-00', title: '200th Edition Launch Video', label: '200th Launch', key: 'default-0-_VRKmVVM-00' }];
  }, [legacyCms.videos]);

  const [activeVideoIndex, setActiveVideoIndex] = React.useState(0);

  const currentDayNumber = React.useMemo(
    () => currentCombiDayNumber(currentEdition?.totalDays || 15, new Date(), currentEdition?.dayDates),
    [currentEdition],
  );

  const [sponsorModalOpen, setSponsorModalOpen] = React.useState(false);
  const [activeSponsorPoster, setActiveSponsorPoster] = React.useState<string | null>(null);
  const activeVideo = legacyVideos[activeVideoIndex] || legacyVideos[0];

  const prevIndex = (activeVideoIndex - 1 + legacyVideos.length) % legacyVideos.length;
  const nextIndex = (activeVideoIndex + 1) % legacyVideos.length;
  const prevVideo = legacyVideos[prevIndex] || activeVideo;
  const nextVideo = legacyVideos[nextIndex] || activeVideo;

  // Build sequential YouTube playlist loop order starting from active video
  const playlistIds = [
    ...legacyVideos.slice(activeVideoIndex + 1).map((v) => v.id),
    ...legacyVideos.slice(0, activeVideoIndex).map((v) => v.id),
    activeVideo.id,
  ].join(',');

  const iframeSrc = `https://www.youtube.com/embed/${activeVideo.id}?playlist=${playlistIds}&autoplay=1&mute=1&loop=1`;

  return (
    <div className="flex flex-col min-h-screen overflow-hidden">

      {/* HERO */}
      <section id="hero" className="relative pt-16 pb-24 lg:pt-24 lg:pb-32 carrom-grid-pattern overflow-hidden">
        {heroBannerImage && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
            style={{ backgroundImage: `url(${heroBannerImage})` }}
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
                <span>{hero.badgeText}</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight sm:leading-none">
                {hero.headlineLine1}
                <br />
                {hero.headlineLine2}{' '}
                <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 bg-clip-text text-transparent block mt-1 sm:mt-2">
                  {hero.headlineAccent}
                </span>
              </h1>

              <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                {hero.description}
              </p>

              {/* Stats ticker */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-6 sm:pt-8 border-t border-border/50">
                {hero.stats.map((s) => (
                  <div key={s.label} className="p-2 sm:p-0 rounded-xl bg-card/40 sm:bg-transparent border border-border/30 sm:border-none">
                    <div className={`text-xl sm:text-3xl font-black ${statColorClass(s.color)}`}>{s.value}</div>
                    <div className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5">{s.label}</div>
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
                  <Badge variant="carrom" className="px-2.5 sm:px-3 py-1 sm:py-1.5 font-extrabold text-[9px] sm:text-[10px] uppercase tracking-widest shadow-lg">
                    {hero.currentEditionBadge}
                  </Badge>
                  <div className="flex items-center gap-1.5 bg-emerald-500/90 backdrop-blur-sm text-white text-[9px] sm:text-[10px] font-extrabold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-lg">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping inline-block" />
                    DAY {currentDayNumber} — IN PROGRESS
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-amber-500/60 via-amber-300/30 to-amber-600/40 blur-2xl pointer-events-none" />
                  <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500/70 to-amber-600 blur-sm opacity-70 pointer-events-none" />
                  <div className="relative rounded-2xl overflow-hidden border-2 border-amber-400/80 shadow-2xl shadow-amber-500/40 ring-2 ring-amber-500/30">
                    <img
                      src={heroPosterUrl}
                      alt="Current Edition Poster"
                      className="w-full h-auto object-cover"
                      style={{ display: 'block' }}
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.src.endsWith('/edition-poster.jpg')) {
                          target.src = '/edition-poster.jpg';
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <Link href={hero.ctaButtonLink || '/schedule'}>
                    <Button variant="carrom" className="w-full font-black text-xs h-10 shadow-lg shadow-amber-500/20 gap-2 border border-amber-400">
                      <span>📅</span> {hero.ctaButtonText}
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* TEAMS MARQUEE STRIP */}
      {(() => {
        const sourceTeams = teams && teams.length > 0 ? teams : [];
        if (sourceTeams.length === 0) return null;

        const marqueeBaseItems = sourceTeams.map((t: any) => ({
          id: t.id || t.name,
          name: t.name,
          tag: t.tag || 'FRANCHISE',
          img: toStorageProxyUrl(t.logo || t.posterUrl || ''),
          border: 'border-amber-500/50',
          glow: 'shadow-amber-500/30',
        }));

        const marqueeItems = [...marqueeBaseItems, ...marqueeBaseItems, ...marqueeBaseItems];

        return (
          <div className="relative w-full overflow-hidden py-6 sm:py-8 border-y border-amber-500/10 bg-gradient-to-r from-background via-amber-500/5 to-background">
            <div className="absolute left-0 top-0 h-full w-12 sm:w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 h-full w-12 sm:w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
            <div className="flex animate-marquee gap-3 sm:gap-5 w-max">
              {marqueeItems.map((team, i) => (
                <Link
                  href="/teams-and-players"
                  key={`${team.id}-${i}`}
                  className="relative flex-shrink-0 h-48 sm:h-64 w-auto rounded-xl overflow-hidden cursor-pointer group transition-transform duration-300 hover:scale-105 hover:-translate-y-1"
                  title={team.name}
                >
                  <img
                    src={team.img}
                    alt={team.name}
                    className="h-48 sm:h-64 w-auto object-contain rounded-xl"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.src.endsWith('/logo.png')) {
                        target.src = '/logo.png';
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none" />
                </Link>
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
              {sponsorsCms.sectionBadge}
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-500 bg-clip-text text-transparent">
              {sponsorsCms.sectionTitle}
            </h2>
            <p className="text-muted-foreground text-sm max-w-2xl mx-auto font-medium">
              {sponsorsCms.sectionDescription}
            </p>
          </div>

          {/* Shared Thank You Banner */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {sponsorsCms.specialThanks.map((chip, idx) => (
              <div
                key={chip.id ? `${chip.id}-${idx}` : `thanks-${idx}`}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/15 to-amber-500/20 border border-amber-400/40 shadow-lg shadow-amber-500/10"
              >
                <Heart className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
                <span className="text-sm font-black text-amber-300 tracking-wide">{chip.text}</span>
                <Heart className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
              </div>
            ))}
          </div>

          {/* Elite sponsor grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-center">
            {[...sponsorsCms.eliteSponsors]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((sponsor, idx) => {
                const accent = sponsorAccentClasses(sponsor.accent);
                const handleClick = () => {
                  if (sponsor.posterUrl) {
                    setActiveSponsorPoster(sponsor.posterUrl);
                    setSponsorModalOpen(true);
                  } else if (sponsor.websiteUrl) {
                    window.open(sponsor.websiteUrl, '_blank', 'noopener,noreferrer');
                  }
                };

                return (
                  <motion.div
                    key={sponsor.id ? `${sponsor.id}-${idx}` : `elite-${idx}`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClick}
                    className={`group relative flex flex-col items-center justify-center p-4 ${sponsor.websiteUrl || sponsor.posterUrl ? 'cursor-pointer' : ''}`}
                  >
                    <div className="flex flex-col items-center justify-center gap-4 w-full">
                      {sponsor.layout === 'round' ? (
                        <div className={`h-32 w-32 sm:h-40 sm:w-40 rounded-full border-4 ${accent.border} p-1 bg-slate-950 shadow-2xl ${accent.shadow} group-hover:scale-105 transition-all duration-300 flex items-center justify-center`}>
                          <img src={sponsor.logoUrl} alt={`${sponsor.name} Logo`} className="w-full h-full object-contain rounded-full drop-shadow-md" />
                        </div>
                      ) : (
                        <div className={`h-28 w-full max-w-[240px] sm:h-36 sm:w-64 rounded-2xl border-2 ${accent.border} p-2.5 sm:p-3 bg-white shadow-2xl ${accent.shadow} group-hover:scale-105 transition-all duration-300 flex items-center justify-center`}>
                          <img src={sponsor.logoUrl} alt={`${sponsor.name} Logo`} className="w-full h-full object-contain" />
                        </div>
                      )}
                      <div className={`py-1.5 px-4 sm:py-2 sm:px-5 rounded-xl bg-slate-950/90 border ${accent.labelBorder} text-center shadow-lg transition-colors`}>
                        <span className={`text-xs sm:text-base font-extrabold ${accent.labelText} tracking-wide`}>{sponsor.name}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
          </div>{/* /grid */}
        </div>
      </section>

      {/* SPECIAL SPONSOR SECTION */}
      <section id="special-sponsors" className="py-16 relative overflow-hidden bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent border-y border-emerald-500/10">
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-10">
          <div className="space-y-3">
            <Badge variant="carrom" className="px-4 py-1.5 font-extrabold text-xs tracking-widest uppercase shadow-lg bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
              {specialSponsorsCms.sectionBadge}
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 bg-clip-text text-transparent">
              {specialSponsorsCms.sectionTitle}
            </h2>
            <p className="text-sm sm:text-base font-semibold text-emerald-400/80 max-w-lg mx-auto">
              {specialSponsorsCms.sectionDescription}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-20">
            {[...specialSponsorsCms.sponsors]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((sponsor, idx) => {
                const accent = specialSponsorAccentClasses(sponsor.accent);
                return (
                  <motion.div
                    key={sponsor.id ? `${sponsor.id}-${idx}` : `special-${idx}`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    className="flex flex-col items-center gap-4 group"
                  >
                    <div className="relative">
                      <div className={`h-28 w-28 sm:h-36 sm:w-36 rounded-full border-4 ${accent.ring} overflow-hidden shadow-2xl ${accent.shadow} group-hover:scale-110 transition-all duration-500 flex items-center justify-center bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-emerald-600/10`}>
                        <SponsorAvatar name={sponsor.name} imageUrl={sponsor.imageUrl} />
                      </div>
                      <div className={`absolute -inset-4 rounded-full bg-gradient-to-r ${accent.glow} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10`} />
                    </div>
                    <div className="text-center mt-1">
                      <h3 className={`text-xl sm:text-2xl font-black leading-tight transition-colors ${accent.text}`}>{sponsor.name}</h3>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        </div>
      </section>


      {/* GOLD SPONSORS SECTION */}
      <section id="gold-sponsors" className="py-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-yellow-500/6 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center space-y-10">
          <div className="space-y-3">
            <Badge variant="carrom" className="px-4 py-1.5 font-extrabold text-xs tracking-widest uppercase shadow-lg bg-amber-500/20 text-amber-400 border-amber-500/40">
              {goldSponsorsCms.sectionBadge}
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
              {goldSponsorsCms.sectionTitle}
            </h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto font-medium">
              {goldSponsorsCms.sectionDescription}
            </p>
          </div>

          <div className="flex flex-wrap items-start justify-center gap-4 sm:gap-8">
            {[...goldSponsorsCms.sponsors]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((sponsor, idx) => (
                <motion.div
                  key={sponsor.id ? `${sponsor.id}-${idx}` : `gold-${idx}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.04 }}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="relative">
                    <div className="h-16 w-16 sm:h-24 sm:w-24 rounded-full border-2 border-amber-400/50 overflow-hidden bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-amber-600/20 flex items-center justify-center shadow-lg shadow-amber-500/10 group-hover:scale-110 group-hover:border-amber-400 group-hover:shadow-amber-400/30 transition-all duration-300">
                      <SponsorAvatar
                        name={sponsor.name}
                        imageUrl={sponsor.imageUrl}
                        size="gold"
                        imageClassName="object-contain rounded-full p-1 bg-white"
                      />
                    </div>
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-400/20 via-yellow-400/15 to-amber-400/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-amber-300/80 max-w-[80px] sm:max-w-[90px] text-center leading-tight group-hover:text-amber-300 transition-colors">
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
            badge={legacyCms.sectionBadge}
            title={legacyCms.sectionTitle}
            sub={legacyCms.sectionDescription}
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
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-3">
              {legacyVideos.map((v, idx) => (
                <button
                  key={v.key}
                  onClick={() => setActiveVideoIndex(idx)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-[11px] sm:text-xs font-extrabold transition-all ${
                    activeVideoIndex === idx
                      ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 scale-105'
                      : 'bg-card border border-border text-muted-foreground hover:border-amber-500/50 hover:text-white'
                  }`}
                >
                  <Film className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                  <span>{v.label}</span>
                </button>
              ))}
            </div>

            {/* 3D Stacking Video Frame Container with Smooth Motion Animations */}
            <div className="relative w-full flex items-center justify-center min-h-[260px] sm:min-h-[420px] lg:min-h-[500px] py-6 overflow-visible">
              
              <AnimatePresence>
                {/* Previous Video Card (Left Behind with Full Title) */}
                <motion.div
                  key={`prev-${prevVideo.key}-${prevIndex}`}
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
                  key={`active-${activeVideo.key}-${activeVideoIndex}`}
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
                  key={`next-${nextVideo.key}-${nextIndex}`}
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
              src={activeSponsorPoster || '/sponsors/neelamani-poster.jpg'}
              alt="Sponsor poster"
              className="w-full max-w-2xl h-auto object-contain max-h-[85vh] rounded-xl shadow-2xl"
            />
          </div>
        </div>
      </Dialog>

    </div>
  );
}
