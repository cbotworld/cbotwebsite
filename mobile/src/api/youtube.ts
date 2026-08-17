import { config } from '../config';

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
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-App-Key': config.appApiKey,
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed (${response.status})`);
  }
  return data;
}

export function createBroadcast(name: string, day: string) {
  return request<BroadcastSession>('/broadcasts', {
    method: 'POST',
    body: JSON.stringify({ name, day }),
  });
}

export function goLive(broadcastId: string) {
  return request<{ ok: boolean; status: string }>(`/broadcasts/${broadcastId}/go-live`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function endBroadcast(broadcastId: string) {
  return request<{ ok: boolean; status: string }>(`/broadcasts/${broadcastId}/end`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
