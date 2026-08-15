// CBOT API Service for Mobile App
// Connects to the CBOT backend to manage match streams

const API_BASE = 'https://cbotworld.com'; // Production URL

export interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  token?: string;
  error?: string;
}

export interface MatchDetails {
  matchId: string;
  editionTitle: string;
  editionNumber: number;
  playerName: string;
  teamName: string;
  teamLogo: string | null;
  opponentName: string;
  opponentLogo: string | null;
  scheduledTime: string | null;
  tableNumber: number;
  status: string;
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

export async function getPlayerMatches(token: string): Promise<{ success: boolean; matches?: MatchDetails[]; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/mobile/matches`, {
      headers: { 'Authorization': `Bearer ${token}` },
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
