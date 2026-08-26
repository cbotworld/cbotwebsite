export const WEBSITE_CMS_KEY = 'website_cms';

export type HeroStat = {
  value: string;
  label: string;
  color: 'amber' | 'foreground' | 'pink' | 'emerald';
};

export type EliteSponsor = {
  id: string;
  name: string;
  logoUrl: string;
  websiteUrl?: string;
  layout: 'round' | 'rect';
  accent: 'emerald' | 'rose' | 'sky' | 'amber';
  posterUrl?: string;
  sortOrder: number;
};

export type SpecialThanksChip = {
  id: string;
  text: string;
  sortOrder: number;
};

export type NamedSponsor = {
  id: string;
  name: string;
  imageUrl?: string;
  sortOrder: number;
};

export type SpecialSponsor = NamedSponsor & {
  accent: 'emerald' | 'teal';
};

export type LegacyYoutubeVideo = {
  id: string;
  youtubeId: string;
  title: string;
  label: string;
  sortOrder: number;
};

export type WebsiteHeroCms = {
  badgeText: string;
  headlineLine1: string;
  headlineLine2: string;
  headlineAccent: string;
  description: string;
  stats: HeroStat[];
  bannerImage: string;
  posterUrl: string;
  currentEditionBadge: string;
  ctaButtonText: string;
  ctaButtonLink: string;
};

export type WebsiteSponsorsCms = {
  sectionBadge: string;
  sectionTitle: string;
  sectionDescription: string;
  eliteSponsors: EliteSponsor[];
  specialThanks: SpecialThanksChip[];
};

export type WebsiteSpecialSponsorsCms = {
  sectionBadge: string;
  sectionTitle: string;
  sectionDescription: string;
  sponsors: SpecialSponsor[];
};

export type WebsiteGoldSponsorsCms = {
  sectionBadge: string;
  sectionTitle: string;
  sectionDescription: string;
  sponsors: NamedSponsor[];
};

export type WebsiteLegacyCms = {
  sectionBadge: string;
  sectionTitle: string;
  sectionDescription: string;
  videos: LegacyYoutubeVideo[];
};

export type WebsiteNavCms = {
  editionButtonLabel: string;
  editionButtonHref: string;
  combisLabel: string;
  combisHref: string;
  scheduleLabel: string;
  scheduleHref: string;
};

/**
 * Site-wide brand tokens. These are composed into page titles, metadata and
 * chrome so renaming an edition only has to happen in one place.
 */
export type WebsiteSiteCms = {
  brandName: string;
  shortName: string;
  brandTagline: string;
  organizationName: string;
  founderName: string;
  editionLabel: string;
  editionSeriesName: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  ogUrl: string;
  whatsappNumber: string;
  whatsappMessage: string;
};

export type WebsitePageHeading = {
  badge: string;
  title: string;
  subtitle: string;
};

export type WebsitePagesCms = {
  schedule: WebsitePageHeading;
  combis: WebsitePageHeading;
  videos: WebsitePageHeading;
  fixtures: WebsitePageHeading;
  about: WebsitePageHeading;
  editions: WebsitePageHeading;
  leaderboard: WebsitePageHeading;
  hallOfFame: WebsitePageHeading;
  teamsPlayers: WebsitePageHeading;
  playerScores: WebsitePageHeading;
  standings: WebsitePageHeading;
};

export type WebsiteFooterCms = {
  brandDescription: string;
  exploreHeading: string;
  exploreSoonLabel: string;
  governanceHeading: string;
  governanceText: string;
  footerSponsorLabel: string;
  footerSponsorName: string;
  footerSponsorLogoUrl: string;
  footerSponsorLink: string;
  copyrightText: string;
  developerCredit: string;
  developerUrl: string;
  developerLogoUrl: string;
};

/** Canonical public URLs — keep these stable even if CMS labels change. */
export const PUBLIC_COMBIS_PATH = '/combis';
export const PUBLIC_SCHEDULE_PATH = '/schedule';
export const PUBLIC_TEAMS_PLAYERS_PATH = '/teams-and-players';
export const PUBLIC_PLAYER_SCORES_PATH = '/player-scores';
export const PUBLIC_STANDINGS_PATH = '/standings';

const COMBIS_PATH_ALIASES = new Set([
  PUBLIC_COMBIS_PATH,
  '/edition-200-combis',
  '/editions/200th-combis',
  '/edition-test-combis',
]);
const SCHEDULE_PATH_ALIASES = new Set([
  PUBLIC_SCHEDULE_PATH,
  '/edition-200-schedule',
  '/editions/200th-schedule',
  '/edition-test-schedule',
]);

function pathOnly(pathname?: string | null) {
  return (pathname || '').split('?')[0];
}

export function isPublicCombisPath(pathname?: string | null) {
  const path = pathOnly(pathname);
  return COMBIS_PATH_ALIASES.has(path) || /^\/edition-[^/]+-combis$/.test(path);
}

export function isPublicSchedulePath(pathname?: string | null) {
  const path = pathOnly(pathname);
  return SCHEDULE_PATH_ALIASES.has(path) || /^\/edition-[^/]+-schedule$/.test(path);
}

export function isPublicTeamsPlayersPath(pathname?: string | null) {
  const path = (pathname || '').split('?')[0];
  return path === PUBLIC_TEAMS_PLAYERS_PATH;
}

export function isPublicPlayerScoresPath(pathname?: string | null) {
  return pathOnly(pathname) === PUBLIC_PLAYER_SCORES_PATH;
}

export function isPublicStandingsPath(pathname?: string | null) {
  return pathOnly(pathname) === PUBLIC_STANDINGS_PATH;
}

export function pinPublicNavHrefs(nav: WebsiteNavCms): WebsiteNavCms {
  const editionHref = (nav.editionButtonHref || '').trim();
  // Combis/schedule hrefs are CMS-editable labels but must stay on canonical routes.
  // Player Scores and Standings have no WebsiteNavCms href fields — Navbar uses
  // PUBLIC_PLAYER_SCORES_PATH / PUBLIC_STANDINGS_PATH so CMS cannot 404 those pages.
  return {
    ...nav,
    combisHref: PUBLIC_COMBIS_PATH,
    scheduleHref: PUBLIC_SCHEDULE_PATH,
    editionButtonHref:
      !editionHref || isPublicCombisPath(editionHref) || isPublicSchedulePath(editionHref)
        ? PUBLIC_COMBIS_PATH
        : editionHref,
  };
}

export type WebsiteCmsContent = {
  site: WebsiteSiteCms;
  pages: WebsitePagesCms;
  hero: WebsiteHeroCms;
  nav: WebsiteNavCms;
  sponsors: WebsiteSponsorsCms;
  specialSponsors: WebsiteSpecialSponsorsCms;
  goldSponsors: WebsiteGoldSponsorsCms;
  legacy: WebsiteLegacyCms;
  footer: WebsiteFooterCms;
};

const DEFAULT_GOLD_SPONSORS: NamedSponsor[] = [
  { id: 'scrapplique', name: 'Scrapplique Galore', imageUrl: '/sponsors/scrapplique-galore-logo.png', sortOrder: 0 },
  { id: 'packiya', name: 'Packiya', sortOrder: 1 },
  { id: 'abhijit', name: 'Abhijit', sortOrder: 2 },
  { id: 'manoj', name: 'Manoj PS', sortOrder: 3 },
  { id: 'mahesh', name: 'Mahesh TN', sortOrder: 4 },
  { id: 'kumar', name: 'Kumar A', sortOrder: 5 },
  { id: 'ramesh', name: 'Ramesh', sortOrder: 6 },
  { id: 'vinod', name: 'Vinod', sortOrder: 7 },
  { id: 'din', name: 'Din', sortOrder: 8 },
  { id: 'krishnamurthy', name: 'Krishnamurthy', sortOrder: 9 },
  { id: 'rakesh', name: 'Rakesh', sortOrder: 10 },
  { id: 'srivishnu', name: 'Srivishnu', sortOrder: 11 },
  { id: 'neela', name: 'Neela', sortOrder: 12 },
  { id: 'lalit', name: 'Lalit', sortOrder: 13 },
  { id: 'lalit-friends', name: 'Lalit Friends', sortOrder: 14 },
  { id: 'umesh', name: 'UMESH N', sortOrder: 15 },
  { id: 'roopa', name: 'Roopa', sortOrder: 16 },
  { id: 'praveen', name: 'Praveen', sortOrder: 17 },
];

export const DEFAULT_WEBSITE_CMS: WebsiteCmsContent = {
  site: {
    brandName: 'CBOT World',
    shortName: 'CBOT',
    brandTagline: 'Connect Carrom Enthusiasts Worldwide',
    organizationName: 'Carrom Balu Online Tournament',
    founderName: 'Carrom Balu',
    editionLabel: '200th Edition',
    editionSeriesName: 'Cornerstones of Carrom',
    metaTitle: 'CBOT World - Carrom Balu Online Tournament',
    metaDescription:
      'The ultimate online Carrom esports tournament platform for Organizers, Captains, and Players. Live brackets, automated match scoring, and global leaderboards.',
    metaKeywords:
      'Carrom, CBOT, CBOT World, Carrom Balu, Online Tournament, Esports, Match Scoring, Tournament Brackets',
    ogUrl: 'https://cbot.gg',
    whatsappNumber: '6594519986',
    whatsappMessage:
      'Hi Carrom Balu! I would like to know more about CBOT (Carrom Balu Online Tournament).',
  },
  pages: {
    schedule: {
      badge: '✨ 200th Edition',
      title: 'Official Match Fixtures',
      subtitle: 'Carrom Balu Online Tournament',
    },
    combis: {
      badge: 'Official Combis & Lineups',
      title: 'BICENTENNIAL DAILY TEAM COMBIS',
      subtitle: 'Submitted by Captains • Auto-Published Every Day at 9:30 PM IST',
    },
    videos: {
      badge: '🏆 Bicentennial 200th Edition Video Center',
      title: 'Live & Recorded Match Videos | CBOT 200th Bicentennial Edition',
      subtitle:
        'Watch all official live streams and recorded match videos day-wise across all 20 tournament days of the CBOT 200th Edition.',
    },
    fixtures: {
      badge: 'Official Fixtures & Public Schedule',
      title: 'Cornerstones of Carrom (Edition #200) Schedule',
      subtitle:
        'Inspect upcoming round-robin, league group, qualifier, and finals fixtures, plus table numbers and time slots.',
    },
    about: {
      badge: 'About Carrom Balu Online Tournament',
      title: 'Pioneering Competitive Online Carrom Since August 2020',
      subtitle: '',
    },
    editions: {
      badge: 'CBOT Archive',
      title: 'Tournament Editions Archive',
      subtitle: 'Browse full historic records of the Carrom Balu Online Tournament.',
    },
    leaderboard: {
      badge: 'Global Rankings',
      title: 'Carrom Balu Champions',
      subtitle: 'Official player ELO ratings, queen strike statistics, and team win-rate leaderboards.',
    },
    hallOfFame: {
      badge: 'Hall of Fame',
      title: 'Legendary Champions',
      subtitle:
        'Honoring the greatest strikers, captains, and visionaries in the history of the Carrom Balu Online Tournament.',
    },
    teamsPlayers: {
      badge: 'Rosters',
      title: 'Teams & Players',
      subtitle: 'Every franchise and every registered player in the current edition.',
    },
    playerScores: {
      badge: 'Day scores',
      title: 'Player Scores',
      subtitle: 'Published at 8:00 PM IST each match day so captains can set combis.',
    },
    standings: {
      badge: 'Points tables',
      title: 'Team Standings',
      subtitle: 'Separate tables per stage, plus golf-style player ranking.',
    },
  },
  nav: {
    editionButtonLabel: '200th Edition',
    editionButtonHref: PUBLIC_COMBIS_PATH,
    combisLabel: 'Daily Team Combis',
    combisHref: PUBLIC_COMBIS_PATH,
    scheduleLabel: 'Match Schedule',
    scheduleHref: PUBLIC_SCHEDULE_PATH,
  },
  hero: {
    badgeText: 'Celebrating 200th Edition',
    headlineLine1: "World's Premier Online",
    headlineLine2: 'Carrom Arena.',
    headlineAccent: '200th Edition.',
    description:
      'Founded by Carrom Balu in August 2020, CBOT World reaches its monumental 200th edition connecting players worldwide.',
    stats: [
      { value: '200th', label: 'Edition Milestone', color: 'amber' },
      { value: '12,000+', label: 'Matches Played', color: 'foreground' },
      { value: '2,000+', label: 'Slams', color: 'pink' },
      { value: '100+', label: 'Active Participants', color: 'emerald' },
    ],
    bannerImage: '',
    posterUrl: '',
    currentEditionBadge: 'Current Edition',
    ctaButtonText: 'View Bicentennial Monuments Schedule (200th Edition)',
    ctaButtonLink: PUBLIC_SCHEDULE_PATH,
  },
  sponsors: {
    sectionBadge: '💎 Official Elite Sponsors',
    sectionTitle: 'Powering CBOT 200th Edition',
    sectionDescription:
      'Our elite sponsors make this milestone tournament possible — supporting communities, sports talent, & cultural empowerment.',
    eliteSponsors: [
      {
        id: 'neelamani',
        name: 'Neelamani Foundation',
        logoUrl: '/sponsors/neelamani-logo.jpg',
        layout: 'round',
        accent: 'emerald',
        posterUrl: '/sponsors/neelamani-poster.jpg',
        sortOrder: 0,
      },
      {
        id: 'synco',
        name: 'SYNCO Sports',
        logoUrl: '/sponsors/synco-logo.png',
        websiteUrl: 'https://syncoshop.com/',
        layout: 'rect',
        accent: 'rose',
        sortOrder: 1,
      },
      {
        id: 'siscaa',
        name: 'SISCAA Carrom',
        logoUrl: '/sponsors/siscaa-logo.png',
        websiteUrl: 'https://siscaasports.com/',
        layout: 'rect',
        accent: 'sky',
        sortOrder: 2,
      },
    ],
    specialThanks: [
      { id: 'muthu', text: 'Special Thank you to Muthu Kumar Sir', sortOrder: 0 },
      { id: 'lalit', text: 'Special Thank you to Lalit', sortOrder: 1 },
    ],
  },
  specialSponsors: {
    sectionBadge: '🌟 Special Sponsor',
    sectionTitle: '360° Support to CBOT',
    sectionDescription: 'Thank you for your incredible 360-degree support to the CBOT community.',
    sponsors: [
      {
        id: 'srikranthi',
        name: 'Srikranthi',
        imageUrl: '/sponsors/srikranthi.jpg',
        accent: 'emerald',
        sortOrder: 0,
      },
      {
        id: 'ak-chari',
        name: 'AK Chari',
        imageUrl: '/sponsors/ak-chari.jpg',
        accent: 'teal',
        sortOrder: 1,
      },
    ],
  },
  goldSponsors: {
    sectionBadge: '🥇 Gold Sponsors',
    sectionTitle: 'Our Gold Sponsors',
    sectionDescription: 'Proud supporters powering CBOT 200th Edition. Thank you for your generous contributions!',
    sponsors: DEFAULT_GOLD_SPONSORS,
  },
  legacy: {
    sectionBadge: 'CBOT - Carrom Balu Online Tournament',
    sectionTitle: 'The Legacy Since 2020',
    sectionDescription:
      'With a thought of 1 tournament, CBOT continued with back-to-back non-stop editions driven by huge response and demand - crossing 50th, 100th, and 150th edition milestones to reach the monumental 200th edition with support from sponsors, players, and brands.',
    videos: [
      { id: 'v1', youtubeId: '_VRKmVVM-00', title: '200th Edition Launch Video', label: '200th Launch', sortOrder: 0 },
      { id: 'v2', youtubeId: 'mFV8W5HdJ3A', title: 'CBOT Intro', label: 'CBOT Intro', sortOrder: 1 },
      { id: 'v3', youtubeId: 'szimIRoO0jI', title: '25th Edition Closing Video', label: '25th Closing', sortOrder: 2 },
      { id: 'v4', youtubeId: '9i3_S7JpN74', title: '50th Edition Closing Video', label: '50th Closing', sortOrder: 3 },
      { id: 'v5', youtubeId: 'eMnF5vIAlPw', title: '100th Centenary Closing Video', label: '100th Centenary', sortOrder: 4 },
    ],
  },
  footer: {
    brandDescription:
      'Founded by Carrom Balu in August 2020, CBOT World reaches its monumental 200th edition connecting players worldwide.',
    exploreHeading: 'Explore',
    exploreSoonLabel: 'Soon',
    governanceHeading: 'Tournament Governance',
    governanceText:
      'Official CBOT tournaments are founded and governed by founder Carrom Balu under strict grounds of sportsmanship, transparency, and fair play.',
    footerSponsorLabel: 'Official Elite Sponsor',
    footerSponsorName: 'Neelamani Foundation',
    footerSponsorLogoUrl: '/sponsors/neelamani-logo.jpg',
    footerSponsorLink: '/#sponsors',
    copyrightText: '© 2026 CBOT World (Carrom Balu Online Tournament). All rights reserved.',
    developerCredit: 'Designed and developed by',
    developerUrl: 'https://www.tectangle.com/',
    developerLogoUrl: '/tectangle-logo.png',
  },
};

export function sponsorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  const word = parts[0] || '?';
  return word.slice(0, 2).toUpperCase();
}

export function statColorClass(color: HeroStat['color']) {
  switch (color) {
    case 'amber':
      return 'text-amber-500';
    case 'pink':
      return 'text-pink-500';
    case 'emerald':
      return 'text-emerald-500';
    default:
      return 'text-foreground';
  }
}

export function sponsorAccentClasses(accent: EliteSponsor['accent']) {
  switch (accent) {
    case 'rose':
      return {
        border: 'border-rose-400/50 group-hover:border-rose-400',
        shadow: 'shadow-rose-500/30',
        labelBorder: 'border-rose-500/40 group-hover:border-rose-400',
        labelText: 'text-rose-400',
      };
    case 'sky':
      return {
        border: 'border-sky-400/50 group-hover:border-sky-400',
        shadow: 'shadow-sky-500/30',
        labelBorder: 'border-sky-500/40 group-hover:border-sky-400',
        labelText: 'text-sky-400',
      };
    case 'amber':
      return {
        border: 'border-amber-400/50 group-hover:border-amber-400',
        shadow: 'shadow-amber-500/30',
        labelBorder: 'border-amber-500/40 group-hover:border-amber-400',
        labelText: 'text-amber-400',
      };
    default:
      return {
        border: 'border-emerald-500/50 group-hover:border-emerald-400',
        shadow: 'shadow-emerald-500/30',
        labelBorder: 'border-emerald-500/40 group-hover:border-emerald-400',
        labelText: 'text-emerald-400',
      };
  }
}

export function specialSponsorAccentClasses(accent: SpecialSponsor['accent']) {
  if (accent === 'teal') {
    return {
      ring: 'border-teal-500/50 group-hover:border-teal-400 group-hover:shadow-teal-400/30',
      shadow: 'shadow-teal-500/20',
      glow: 'from-teal-400/20 via-emerald-400/15 to-teal-400/20',
      text: 'text-teal-400 group-hover:text-teal-300',
    };
  }
  return {
    ring: 'border-emerald-500/50 group-hover:border-emerald-400 group-hover:shadow-emerald-400/30',
    shadow: 'shadow-emerald-500/20',
    glow: 'from-emerald-400/20 via-teal-400/15 to-emerald-400/20',
    text: 'text-emerald-400 group-hover:text-emerald-300',
  };
}

function mergeSection<T extends object>(defaults: T, patch?: Partial<T>): T {
  return { ...defaults, ...(patch || {}) };
}

export function parseWebsiteCms(raw: string | null | undefined): WebsiteCmsContent {
  if (!raw) return DEFAULT_WEBSITE_CMS;
  try {
    const parsed = JSON.parse(raw) as Partial<WebsiteCmsContent>;
    return {
      site: mergeSection(DEFAULT_WEBSITE_CMS.site, parsed.site),
      pages: {
        schedule: mergeSection(DEFAULT_WEBSITE_CMS.pages.schedule, parsed.pages?.schedule),
        combis: mergeSection(DEFAULT_WEBSITE_CMS.pages.combis, parsed.pages?.combis),
        videos: mergeSection(DEFAULT_WEBSITE_CMS.pages.videos, parsed.pages?.videos),
        fixtures: mergeSection(DEFAULT_WEBSITE_CMS.pages.fixtures, parsed.pages?.fixtures),
        about: mergeSection(DEFAULT_WEBSITE_CMS.pages.about, parsed.pages?.about),
        editions: mergeSection(DEFAULT_WEBSITE_CMS.pages.editions, parsed.pages?.editions),
        leaderboard: mergeSection(DEFAULT_WEBSITE_CMS.pages.leaderboard, parsed.pages?.leaderboard),
        hallOfFame: mergeSection(DEFAULT_WEBSITE_CMS.pages.hallOfFame, parsed.pages?.hallOfFame),
        teamsPlayers: mergeSection(DEFAULT_WEBSITE_CMS.pages.teamsPlayers, parsed.pages?.teamsPlayers),
        playerScores: mergeSection(DEFAULT_WEBSITE_CMS.pages.playerScores, parsed.pages?.playerScores),
        standings: mergeSection(DEFAULT_WEBSITE_CMS.pages.standings, parsed.pages?.standings),
      },
      nav: pinPublicNavHrefs(mergeSection(DEFAULT_WEBSITE_CMS.nav, parsed.nav)),
      hero: {
        ...mergeSection(DEFAULT_WEBSITE_CMS.hero, parsed.hero),
        ctaButtonLink: isPublicSchedulePath((parsed.hero?.ctaButtonLink || '').trim())
          ? PUBLIC_SCHEDULE_PATH
          : isPublicCombisPath((parsed.hero?.ctaButtonLink || '').trim())
            ? PUBLIC_COMBIS_PATH
            : parsed.hero?.ctaButtonLink || DEFAULT_WEBSITE_CMS.hero.ctaButtonLink,
      },
      sponsors: {
        ...mergeSection(DEFAULT_WEBSITE_CMS.sponsors, parsed.sponsors),
        eliteSponsors:
          parsed.sponsors?.eliteSponsors?.length
            ? parsed.sponsors.eliteSponsors
            : DEFAULT_WEBSITE_CMS.sponsors.eliteSponsors,
        specialThanks:
          parsed.sponsors?.specialThanks?.length
            ? parsed.sponsors.specialThanks
            : DEFAULT_WEBSITE_CMS.sponsors.specialThanks,
      },
      specialSponsors: {
        ...mergeSection(DEFAULT_WEBSITE_CMS.specialSponsors, parsed.specialSponsors),
        sponsors:
          parsed.specialSponsors?.sponsors?.length
            ? parsed.specialSponsors.sponsors
            : DEFAULT_WEBSITE_CMS.specialSponsors.sponsors,
      },
      goldSponsors: {
        ...mergeSection(DEFAULT_WEBSITE_CMS.goldSponsors, parsed.goldSponsors),
        sponsors:
          parsed.goldSponsors?.sponsors?.length
            ? parsed.goldSponsors.sponsors
            : DEFAULT_WEBSITE_CMS.goldSponsors.sponsors,
      },
      legacy: {
        ...mergeSection(DEFAULT_WEBSITE_CMS.legacy, parsed.legacy),
        videos:
          parsed.legacy?.videos?.length ? parsed.legacy.videos : DEFAULT_WEBSITE_CMS.legacy.videos,
      },
      footer: mergeSection(DEFAULT_WEBSITE_CMS.footer, parsed.footer),
    };
  } catch {
    return DEFAULT_WEBSITE_CMS;
  }
}

export function newCmsId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function extractYoutubeId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z0-9_-]{6,}$/.test(trimmed) && !trimmed.includes('/')) return trimmed;
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./i, '').replace(/^m\./i, '').toLowerCase();
    if (host === 'youtu.be') {
      return url.pathname.split('/').filter(Boolean)[0] || trimmed;
    }
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const v = url.searchParams.get('v');
      if (v) return v;
      const parts = url.pathname.split('/').filter(Boolean);
      for (const key of ['embed', 'shorts', 'live', 'v']) {
        const idx = parts.indexOf(key);
        if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
      }
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

export function youtubeWatchUrl(youtubeId: string): string {
  const id = extractYoutubeId(youtubeId);
  if (!id) return '';
  if (id.includes('/') || /\s/.test(id)) return youtubeId;
  return `https://www.youtube.com/watch?v=${id}`;
}
