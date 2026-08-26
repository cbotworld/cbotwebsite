import { config } from '../config';

export type MobileUser = {
  id: string;
  name: string;
  username?: string;
  role?: string;
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
  tableNumber: number;
  status: string;
  canGoLive: boolean;
  lockedReason?: string | null;
  prerequisiteDay?: number | null;
  hasYoutube?: boolean;
  latestYoutubeUrl?: string | null;
  latestYoutubeVideoId?: string | null;
  streamCount?: number;
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

type Session = {
  token: string;
  user: MobileUser;
  team: MobileTeam;
};

let session: Session | null = null;

export function getSession() {
  return session;
}

export function setSession(next: Session | null) {
  session = next;
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
  };
  setSession({ token: data.token, user, team: data.team || null });
  return { user, team: data.team || null, token: data.token };
}

export async function fetchPlayerSchedule() {
  const current = getSession();
  if (!current?.token) {
    throw new Error('Please log in.');
  }
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/schedule`, {
    headers: { Authorization: `Bearer ${current.token}` },
  });
  const data = await res.json();
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
    tableNumber: day.tableNumber || 1,
    status: day.status === 'live' ? 'LIVE' : day.status === 'completed' ? 'COMPLETED' : 'SCHEDULED',
    canGoLive: Boolean(day.canGoLive),
    lockedReason: day.lockedReason || null,
    prerequisiteDay: day.prerequisiteDay ?? null,
    hasYoutube: Boolean(day.hasYoutube),
    latestYoutubeUrl: day.latestYoutubeUrl || null,
    latestYoutubeVideoId: day.latestYoutubeVideoId || null,
    streamCount: day.streamCount || 0,
    myEvent: day.myEvent || null,
  }));
  return {
    matches,
    team: (data.team || current.team) as MobileTeam,
    warning: (data.warning as string | undefined) || undefined,
  };
}

export async function fetchPlayerCombis() {
  const current = getSession();
  if (!current?.token) {
    throw new Error('Please log in.');
  }
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/combis`, {
    headers: { Authorization: `Bearer ${current.token}` },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to load combis.');
  }
  return data as {
    success: true;
    canEdit: boolean;
    team: MobileTeam & { captainName?: string | null };
    days: Array<{
      dayNumber: number;
      calendarDate?: string;
      revealed: boolean;
      locked: boolean;
      opponent: {
        id: string;
        name: string;
        tag: string;
        logo?: string | null;
        captainName?: string | null;
      } | null;
      events: Array<{
        index: number;
        name: string;
        format: string;
        myPlayers: string;
        opponentPlayers: string;
      }>;
    }>;
  };
}

export type DayScoreInfo = {
  success: boolean;
  scores: Array<{
    dayNumber: number;
    score: number;
    slams: number;
    boards?: Array<{ score: number; slams: number }>;
  }>;
  days?: Array<{ dayNumber: number; windowOpen: boolean; windowReason?: string | null; submitted?: boolean }>;
  eligibleDay?: number | null;
  maxDay?: number;
  windowOpen?: boolean;
  windowReason?: string | null;
  published?: boolean;
  publishedDays?: Array<{ dayNumber: number; published: boolean }>;
  cutoffIso?: string;
  editionTitle?: string;
  target?: number;
  average?: number;
  error?: string;
};

export async function fetchPlayerScores(): Promise<DayScoreInfo> {
  const current = getSession();
  if (!current?.token) {
    throw new Error('Please log in.');
  }
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/scores`, {
    headers: { Authorization: `Bearer ${current.token}` },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to load scores.');
  }
  return data as DayScoreInfo;
}

export async function submitPlayerDayScore(
  dayNumber: number,
  score: number,
  slams: number,
  boards?: Array<{ score: number; slams: number }>,
) {
  const current = getSession();
  if (!current?.token) {
    throw new Error('Please log in.');
  }
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/scores`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${current.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dayNumber, score, slams, boards }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to save score.');
  }
  return data;
}

export async function fetchChannelVideos(opts?: { player?: string; day?: number | 'ALL' | null }) {
  const current = getSession();
  if (!current?.token) {
    throw new Error('Please log in.');
  }
  const params = new URLSearchParams();
  if (opts?.player) params.set('player', opts.player);
  if (opts?.day && opts.day !== 'ALL') params.set('day', String(opts.day));
  const qs = params.toString();
  const res = await fetch(`${config.websiteBaseUrl}/api/mobile/videos${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${current.token}` },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to load videos.');
  }
  return data as {
    success: true;
    days: number[];
    videos: Array<{
      id: string;
      dayNumber: number;
      playerName: string;
      teamName: string;
      isLive: boolean;
      youtubeUrl: string | null;
      thumbnailUrl?: string | null;
      title: string;
    }>;
    count: number;
  };
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
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to load standings.');
  return {
    edition: data.edition || null,
    blocks: Array.isArray(data.blocks) ? data.blocks : [],
    players: Array.isArray(data.players) ? data.players : [],
    placement: Array.isArray(data.placement) ? data.placement : [],
    stages: Array.isArray(data.stages) ? data.stages : [],
  };
}
