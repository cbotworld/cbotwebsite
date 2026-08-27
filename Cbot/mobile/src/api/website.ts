import { config } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MobileUser = {
  id: string;
  name: string;
  username?: string;
  role?: string;
  email?: string;
  bio?: string;
  city?: string;
  address?: string;
  pincode?: string;
  state?: string;
  country?: string;
  whatsApp?: string;
  age?: number | null;
  gender?: string;
  image?: string | null;
};

export type MobileTeam = {
  id: string;
  name: string;
  tag: string;
  logo?: string | null;
} | null;

export type MatchDetails = {
  matchId?: string;
  dayNumber: number;
  label: string;
  title: string;
  timeRange: string;
  editionTitle: string;
  editionNumber: number;
  teamName: string;
  teamTag?: string;
  teamLogo: string | null;
  opponentName: string;
  opponentTag?: string;
  opponentLogo: string | null;
  scheduledTime: string | null;
  calendarDate?: string;
  endIso?: string | null;
  tableNumber: number;
  status: string;
  canGoLive: boolean;
  canPracticeGoLive?: boolean;
  canTieBreakGoLive?: boolean;
  lockedReason?: string | null;
  prerequisiteDay?: number | null;
  hasYoutube?: boolean;
  latestYoutubeUrl?: string | null;
  streamCount?: number;
  stageName?: string;
  myEvent?: {
    revealed: boolean;
    selected: boolean;
    name: string;
    format: string;
    myPlayers: string[];
    oppPlayers: string[];
    myScore: number | null;
    oppScore: number | null;
    result: 'WIN' | 'LOSS' | 'TIE' | 'WALKOVER' | null;
    eventPts: number;
    scoresReady: boolean;
  } | null;
};

type PlayerTeamView = {
  id: string;
  name: string;
  tag: string;
  logo?: string | null;
  kind: 'MAIN' | 'SPOC';
  isCaptain: boolean;
};

type Session = {
  token: string;
  user: MobileUser;
  team: MobileTeam;
  playerTeams?: PlayerTeamView[];
  captainDesks?: Array<{ id: string; name: string; tag: string; logo?: string | null; kind: 'MAIN' | 'SPOC' }>;
};

const SESSION_KEY = 'cbot.mobile.session';

let session: Session | null = null;

export function getSession() {
  return session;
}

async function persistSession(next: Session | null) {
  try {
    if (!next) {
      await AsyncStorage.removeItem(SESSION_KEY);
    } else {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
    }
  } catch {
    // Storage failures should not block login/logout.
  }
}

export function setSession(next: Session | null) {
  session = next;
  void persistSession(next);
}

export async function restoreSession() {
  if (session?.token) return session;
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.token || !parsed?.user) return null;
    session = parsed;
    return session;
  } catch {
    return null;
  }
}

export async function fetchAppVersion(currentVersion: string): Promise<{
  updateAvailable: boolean;
  latestVersion: string | null;
  currentVersion: string | null;
  storeUrl: string;
}> {
  const params = new URLSearchParams({ current: currentVersion });
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/app-version?${params}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await readJson(res);
  if (!data.success) throw new Error(data.error || 'Could not check app version.');
  return {
    updateAvailable: Boolean(data.updateAvailable),
    latestVersion: data.latestVersion || null,
    currentVersion: data.currentVersion || currentVersion,
    storeUrl: data.storeUrl || 'https://play.google.com/store/apps/details?id=com.cbotworld',
  };
}

export async function loginPlayer(username: string, pin: string) {
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, pin }),
  });
  const data = await res.json();
  if (!data.success || !data.token || !data.user) {
    throw new Error(data.error || 'Invalid username or PIN.');
  }
  const user: MobileUser = {
    id: data.user.id,
    name: data.user.name || data.user.username || username,
    username: data.user.username,
    role: data.user.role,
    email: data.user.email || '',
    bio: data.user.bio || '',
    city: data.user.city || '',
    address: data.user.address || '',
    pincode: data.user.pincode || '',
    state: data.user.state || '',
    country: data.user.country || '',
    whatsApp: data.user.whatsApp || '',
    age: data.user.age ?? null,
    gender: data.user.gender || '',
    image: data.user.image || null,
  };
  setSession({
    token: data.token,
    user,
    team: data.team || null,
    playerTeams: Array.isArray(data.playerTeams) ? data.playerTeams : [],
    captainDesks: Array.isArray(data.captainDesks) ? data.captainDesks : [],
  });
  return { user, team: data.team || null, token: data.token };
}

function authHeaders() {
  const current = getSession();
  if (!current?.token) throw new Error('Please log in.');
  return {
    Authorization: `Bearer ${current.token}`,
    'Content-Type': 'application/json',
  };
}

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(res.ok ? 'Invalid server response.' : `Request failed (${res.status}). Deploy the latest website API.`);
  }
}

export type EditionStatsPayload = {
  wins: number;
  slams: number;
  averageBonuses: number;
  history?: Array<{ effectiveFrom: string; average: number }>;
  editionTitle?: string;
};

export type ProfilePayload = {
  user: MobileUser & {
    average?: number | null;
    target?: number | null;
    rating?: number | null;
    wins?: number;
    losses?: number;
    queenStrikes?: number;
    boardsWon?: number;
    isActivated?: boolean;
  };
  team: (MobileTeam & { isCaptain?: boolean; description?: string }) | null;
  editionStats?: EditionStatsPayload | null;
};

export async function fetchProfile(): Promise<ProfilePayload> {
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/profile`, { headers: authHeaders() });
  const data = await readJson(res);
  if (!data.success) throw new Error(data.error || 'Failed to load profile.');
  return { user: data.user, team: data.team || null, editionStats: data.editionStats || null };
}

export async function saveProfile(fields: {
  bio?: string;
  address?: string;
  pincode?: string;
  city?: string;
  state?: string;
  country?: string;
  whatsApp?: string;
  email?: string;
  age?: number | null;
  gender?: string;
}): Promise<ProfilePayload> {
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/profile`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(fields),
  });
  const data = await readJson(res);
  if (!data.success) throw new Error(data.error || 'Failed to save profile.');
  const current = getSession();
  if (current && data.user) {
    setSession({
      ...current,
      user: { ...current.user, ...data.user },
      team: data.team || current.team,
    });
  }
  return { user: data.user, team: data.team || null };
}

export async function changePin(currentPin: string, newPin: string) {
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/profile/pin`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ currentPin, newPin }),
  });
  const data = await readJson(res);
  if (!data.success) throw new Error(data.error || 'Failed to change PIN.');
  return data.message as string;
}

export type CombiMember = {
  id: string;
  name: string;
  username?: string;
  average?: number | null;
  target?: number | null;
  dayStats?: Record<string, {
    score: number | null;
    slams: number | null;
    boards?: Array<{ score?: number; slams?: number }>;
    average: number;
    hasAvgBonus: boolean | null;
    missingPrior?: boolean;
  }>;
};
export type CombiRoundMeta = { index: number; format: string; name: string; slots: number };
export type CombiDay = {
  dayNumber: number;
  calendarDate: string;
  cutoffIso: string | null;
  revealed?: boolean;
  locked: boolean;
  canEditScores?: boolean;
  submittedAt: string | null;
  rounds: Array<{ name?: string; players?: string[]; playerIds?: string[] }>;
  opponent?: {
    id: string;
    name: string;
    tag: string;
    logo?: string | null;
    captainName?: string | null;
  } | null;
  events?: Array<{
    index: number;
    name: string;
    format: string;
    myPlayers: string;
    opponentPlayers: string;
  }>;
};
export type CaptainDesk = {
  id: string;
  name: string;
  tag: string;
  logo?: string | null;
  kind: 'MAIN' | 'SPOC';
};

export type CombisPayload = {
  canEdit: boolean;
  warning?: string;
  isSpocTeam?: boolean;
  captainDesks?: CaptainDesk[];
  team: { id: string; name: string; tag: string; logo?: string | null; captainName?: string | null; kind?: 'MAIN' | 'SPOC' } | null;
  members: CombiMember[];
  roundsMeta: CombiRoundMeta[];
  days: CombiDay[];
};

export type ChannelVideo = {
  id: string;
  dayNumber: number;
  playerName: string;
  playerUsername?: string | null;
  teamName: string;
  teamTag?: string | null;
  teamLogo?: string | null;
  status: string;
  isLive: boolean;
  youtubeUrl: string | null;
  youtubeVideoId?: string | null;
  thumbnailUrl?: string | null;
  title: string;
  recordedAt?: string | null;
};

export async function fetchChannelVideos(opts?: { player?: string; day?: number | 'ALL' | null }): Promise<{
  videos: ChannelVideo[];
  days: number[];
  edition?: { id: string; title: string; number: number } | null;
}> {
  const params = new URLSearchParams();
  if (opts?.player) params.set('player', opts.player);
  if (opts?.day && opts.day !== 'ALL') params.set('day', String(opts.day));
  const qs = params.toString();
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/videos${qs ? `?${qs}` : ''}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await readJson(res);
  if (!data.success) throw new Error(data.error || 'Failed to load videos.');
  return {
    videos: Array.isArray(data.videos) ? data.videos : [],
    days: Array.isArray(data.days) ? data.days : [],
    edition: data.edition || null,
  };
}

export type PublicCombiEvent = {
  index: number;
  name: string;
  format: string;
  leftPlayers: string;
  rightPlayers: string;
};

export type PublicCombiMatch = {
  team1: { id: string; name: string; tag: string; logo?: string | null; captainName?: string | null };
  team2: { id: string; name: string; tag: string; logo?: string | null; captainName?: string | null };
  events: PublicCombiEvent[];
};

export type PublicCombiDay = {
  dayNumber: number;
  calendarDate: string;
  cutoffIso: string | null;
  revealed: boolean;
  title: string;
  matches: PublicCombiMatch[];
};

export async function fetchPublicCombis(): Promise<{ days: PublicCombiDay[] }> {
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/combis/public?t=${Date.now()}`, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  const data = await readJson(res);
  if (!data.success) throw new Error(data.error || 'Failed to load combis.');
  return { days: Array.isArray(data.days) ? data.days : [] };
}

export type StandingsPayload = {
  edition: { id: string; title: string; number: number } | null;
  blocks: any[];
  players: any[];
  placement: any[];
  stages: any[];
};

export async function fetchStandings(): Promise<StandingsPayload> {
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/standings?t=${Date.now()}`, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  const data = await readJson(res);
  if (!data.success) throw new Error(data.error || 'Failed to load standings.');
  return {
    edition: data.edition || null,
    blocks: Array.isArray(data.blocks) ? data.blocks : [],
    players: Array.isArray(data.players) ? data.players : [],
    placement: Array.isArray(data.placement) ? data.placement : [],
    stages: Array.isArray(data.stages) ? data.stages : [],
  };
}

export async function fetchCombis(opts?: { teamId?: string; desk?: 'MAIN' | 'SPOC' }): Promise<CombisPayload> {
  const params = new URLSearchParams();
  if (opts?.teamId) params.set('teamId', opts.teamId);
  if (opts?.desk) params.set('desk', opts.desk);
  const qs = params.toString();
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/combis${qs ? `?${qs}` : ''}`, { headers: authHeaders() });
  const data = await readJson(res);
  if (!data.success) throw new Error(data.error || 'Failed to load combis.');
  return {
    ...data,
    days: Array.isArray(data.days) ? data.days : [],
    members: Array.isArray(data.members) ? data.members : [],
    roundsMeta: Array.isArray(data.roundsMeta) ? data.roundsMeta : [],
    captainDesks: Array.isArray(data.captainDesks) ? data.captainDesks : [],
  };
}

export async function saveCombi(
  dayNumber: number,
  rounds: Array<{ name: string; players: string[]; playerIds: string[] }>,
  teamId?: string,
) {
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/combis`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ dayNumber, rounds, teamId }),
  });
  const data = await readJson(res);
  if (!data.success) throw new Error(data.error || 'Failed to save combi.');
  return data;
}

export async function fetchPlayerSchedule(opts?: { teamId?: string; view?: 'MAIN' | 'SPOC' }) {
  const current = getSession();
  if (!current?.token) {
    throw new Error('Please log in.');
  }
  const params = new URLSearchParams();
  if (opts?.teamId) params.set('teamId', opts.teamId);
  if (opts?.view) params.set('view', opts.view);
  const qs = params.toString();
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/schedule${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${current.token}` },
  });
  const data = await readJson(res);
  if (!data.success) {
    throw new Error(data.error || 'Failed to load schedule.');
  }
  const matches: MatchDetails[] = (data.days || []).map((day: any) => ({
    matchId: `day-${day.dayNumber}`,
    dayNumber: day.dayNumber,
    label: day.label || `Day ${day.dayNumber}`,
    title: day.title || '',
    timeRange: day.timeRange || '',
    editionTitle: day.editionTitle || data.team?.name || 'CBOT 200th Edition',
    editionNumber: day.editionNumber || 200,
    teamName: day.teamName,
    teamTag: day.teamTag,
    teamLogo: day.teamLogo || data.team?.logo || null,
    opponentName: day.opponentName,
    opponentTag: day.opponentTag,
    opponentLogo: day.opponentLogo || null,
    scheduledTime: day.startIso || null,
    calendarDate: day.calendarDate,
    endIso: day.endIso || null,
    tableNumber: day.tableNumber || 1,
    status: day.status === 'live' ? 'LIVE' : day.status === 'completed' ? 'COMPLETED' : 'SCHEDULED',
    canGoLive: Boolean(day.canGoLive),
    canPracticeGoLive: day.canPracticeGoLive !== false,
    canTieBreakGoLive: day.canTieBreakGoLive !== false,
    lockedReason: day.lockedReason || null,
    prerequisiteDay: typeof day.prerequisiteDay === 'number' ? day.prerequisiteDay : null,
    hasYoutube: Boolean(day.hasYoutube),
    latestYoutubeUrl: day.latestYoutubeUrl || null,
    streamCount: typeof day.streamCount === 'number' ? day.streamCount : 0,
    stageName: day.stageName || day.stageLabel || day.title || '',
    myEvent: day.myEvent || null,
  }));
  return {
    matches,
    team: (data.team || current.team) as MobileTeam,
    warning: (data.warning as string | undefined) || undefined,
    currentDay: typeof data.currentDay === 'number' ? data.currentDay : undefined,
    playableUntilDay: typeof data.playableUntilDay === 'number' ? data.playableUntilDay : undefined,
    playerTeams: Array.isArray(data.playerTeams) ? data.playerTeams : current.playerTeams || [],
    captainDesks: Array.isArray(data.captainDesks) ? data.captainDesks : current.captainDesks || [],
  };
}

export type EliteSponsor = {
  id: string;
  name: string;
  logoUrl: string;
  websiteUrl?: string;
  posterUrl?: string;
  layout: 'round' | 'rect';
  accent: 'emerald' | 'rose' | 'sky' | 'amber';
  sortOrder: number;
};

export type EliteSponsorsPayload = {
  sectionBadge: string;
  sectionTitle: string;
  eliteSponsors: EliteSponsor[];
};

export type DayScoreInfo = {
  success: boolean;
  scores: Array<{
    dayNumber: number;
    score: number;
    slams: number;
    boards?: Array<{ score?: number; slams?: number }>;
  }>;
  eligibleDay?: number | null;
  maxDay?: number;
  windowOpen?: boolean;
  windowReason?: string | null;
  published?: boolean;
  publishedDays?: Array<{ dayNumber: number; published: boolean }>;
  cutoffIso?: string;
  editionTitle?: string;
  target?: number | null;
  error?: string;
};

export async function fetchPlayerScores(): Promise<DayScoreInfo> {
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/scores`, {
    headers: authHeaders(),
  });
  const data = await readJson(res);
  if (!data.success) throw new Error(data.error || 'Failed to load scores.');
  return data as DayScoreInfo;
}

export async function submitPlayerDayScore(
  dayNumber: number,
  boards: Array<{ score: number; slams: number }>,
) {
  const total = boards.reduce((s, b) => s + b.score, 0);
  const slams = boards.reduce((s, b) => s + b.slams, 0);
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/scores`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ dayNumber, score: total, slams, boards }),
  });
  const data = await readJson(res);
  if (!data.success) throw new Error(data.error || 'Failed to save score.');
  return data;
}

export async function submitTeamDayScores(
  dayNumber: number,
  rows: Array<{ userId: string; score?: number; slams?: number; boards: Array<{ score: number; slams: number }> }>,
  teamId?: string,
) {
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/scores`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      dayNumber,
      teamId,
      rows: rows.map((r) => ({
        userId: r.userId,
        boards: r.boards,
        score: r.score ?? r.boards.reduce((s, b) => s + b.score, 0),
        slams: r.slams ?? r.boards.reduce((s, b) => s + b.slams, 0),
      })),
    }),
  });
  const data = await readJson(res);
  if (!data.success) throw new Error(data.error || 'Failed to save team scores.');
  return data;
}

export async function fetchEliteSponsors(): Promise<EliteSponsorsPayload> {
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/sponsors`, {
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await readJson(res);
  if (!data.success) throw new Error(data.error || 'Failed to load sponsors.');
  return {
    sectionBadge: typeof data.sectionBadge === 'string' ? data.sectionBadge : 'Official Elite Sponsors',
    sectionTitle: typeof data.sectionTitle === 'string' ? data.sectionTitle : '',
    eliteSponsors: Array.isArray(data.eliteSponsors) ? data.eliteSponsors : [],
  };
}
