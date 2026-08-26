// CBOT API Service for Mobile App
// Connects to the CBOT backend to manage match streams

const API_BASE = 'https://www.cbotworld.com'; // Production URL (with www. to avoid redirect)

export interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    name: string;
    username?: string;
    email: string;
    role: string;
  };
  team?: {
    id: string;
    name: string;
    tag: string;
    logo?: string | null;
  } | null;
  token?: string;
  error?: string;
}

export interface MatchDetails {
  matchId?: string;
  dayNumber: number;
  label: string;
  title: string;
  timeRange: string;
  editionTitle: string;
  editionNumber: number;
  playerName?: string;
  playerRole?: string;
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
}

export interface StreamSession {
  id: string;
  matchId: string;
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
  rtmpIngestionUrl: string | null;
  streamKey: string | null;
  status: string;
}

export async function loginPlayer(username: string, pin: string): Promise<LoginResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/mobile/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, pin }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function getPlayerMatches(token: string): Promise<{ success: boolean; matches?: MatchDetails[]; error?: string; team?: LoginResponse['team'] }> {
  try {
    const res = await fetch(`${API_BASE}/api/mobile/schedule`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success) {
      return { success: false, error: data.error || 'Failed to load schedule' };
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
    return { success: true, matches, team: data.team };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function getPlayerCombis(token: string): Promise<{
  success: boolean;
  canEdit?: boolean;
  team?: LoginResponse['team'] & { captainName?: string | null };
  days?: Array<{
    dayNumber: number;
    calendarDate?: string;
    revealed: boolean;
    locked: boolean;
    submittedAt?: string | null;
    rounds: Array<{ name?: string; players?: string[]; format?: string }>;
    opponent: {
      id: string;
      name: string;
      tag: string;
      logo?: string | null;
      captainName?: string | null;
    } | null;
    opponentRounds: Array<{ name?: string; players?: string[]; format?: string }>;
    events: Array<{
      index: number;
      name: string;
      format: string;
      myPlayers: string;
      opponentPlayers: string;
    }>;
  }>;
  warning?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/mobile/combis`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function getChannelVideos(
  token: string,
  opts?: { player?: string; day?: number | 'ALL' | null },
): Promise<{
  success: boolean;
  videos?: Array<{
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
  }>;
  days?: number[];
  count?: number;
  error?: string;
}> {
  try {
    const params = new URLSearchParams();
    if (opts?.player) params.set('player', opts.player);
    if (opts?.day && opts.day !== 'ALL') params.set('day', String(opts.day));
    const qs = params.toString();
    const res = await fetch(`${API_BASE}/api/mobile/videos${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function createStreamSession(matchId: string, token: string): Promise<{ success: boolean; stream?: StreamSession; matchDetails?: MatchDetails; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/mobile/stream/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ matchId }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function getStandings() {
  try {
    const res = await fetch(`${API_BASE}/api/mobile/standings?t=${Date.now()}`, {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error', blocks: [], players: [] };
  }
}

export async function getPlayerScores(token: string, dayNumber?: number) {
  try {
    const qs = dayNumber ? `?dayNumber=${dayNumber}` : '';
    const res = await fetch(`${API_BASE}/api/mobile/scores${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function submitPlayerScore(
  token: string,
  payload: {
    dayNumber: number;
    score?: number;
    slams?: number;
    boards?: Array<{ score: number; slams: number }>;
    rows?: Array<{
      userId: string;
      score?: number;
      slams?: number;
      boards?: Array<{ score: number; slams: number }>;
    }>;
    teamId?: string;
  },
) {
  try {
    const res = await fetch(`${API_BASE}/api/mobile/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function stopStreamSession(streamId: string, videoUrl: string | undefined, token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/mobile/stream/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ streamId, videoUrl }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}
