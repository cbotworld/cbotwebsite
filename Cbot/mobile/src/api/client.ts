import { config } from "../config";
import { getSession } from "./website";

export type BroadcastSession = {
  broadcastId: string;
  streamId: string;
  ingestionAddress: string;
  streamName: string;
  watchUrl: string;
  title: string;
  rtmpUrl: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getSession()?.token;
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(config.appApiKey ? { "X-App-Key": config.appApiKey } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed (${response.status})`);
  }
  return data;
}

export type ScheduleDay = {
  dayNumber: number;
  label: string;
  title: string;
  timeRange: string;
  startIso: string;
  endIso: string;
  status: "live" | "completed" | "upcoming";
};

export type TournamentSchedule = {
  liveDay: number | null;
  liveLabel: string | null;
  days: ScheduleDay[];
};

export function getSchedule() {
  return request<TournamentSchedule & { ok?: boolean; now?: string }>("/schedule", {
    method: "GET",
  });
}

export type BroadcastPayload = {
  name: string;
  day: string;
  teamName?: string;
  opponentName?: string;
  teamTag?: string;
  opponentTag?: string;
  stage?: string;
  editionTitle?: string;
  editionSlot?: 'A' | 'B';
  editionId?: string;
  timeRange?: string;
  endIso?: string;
  playMode?: 'match' | 'practice' | 'tiebreak';
};

export function createBroadcast(payload: BroadcastPayload) {
  return request<BroadcastSession>("/broadcasts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function goLive(broadcastId: string) {
  return request<{ ok: boolean; status: string }>(`/broadcasts/${broadcastId}/go-live`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function endBroadcast(broadcastId: string) {
  return request<{ ok: boolean; status: string }>(`/broadcasts/${broadcastId}/end`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
