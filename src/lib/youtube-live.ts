import { prisma } from '@/lib/prisma';

export type CreateBroadcastResult = {
  broadcastId: string;
  streamId: string;
  ingestionAddress: string;
  streamName: string;
  watchUrl: string;
  title: string;
};

function youtubeError(payload: any, fallback: string): never {
  const reason = payload?.error?.errors?.[0]?.reason;
  const message = payload?.error?.message || fallback;

  if (reason === 'concurrentBroadcastsExceedLimit') {
    throw new Error('Too many live streams on this channel right now. Try again later.');
  }
  if (reason === 'userBroadcastsExceedLimit') {
    throw new Error('Too many scheduled or live broadcasts on this channel. End old streams first.');
  }
  if (reason === 'userRequestsExceedRateLimit') {
    throw new Error('YouTube rate limit reached. Please wait and try again.');
  }

  throw new Error(message);
}

async function getYouTubeCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  let refreshToken =
    process.env.YOUTUBE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN || '';

  if (!refreshToken) {
    const stored = await prisma.systemSetting.findUnique({
      where: { key: 'youtube_refresh_token' },
    });
    refreshToken = stored?.value || '';
  }

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'YouTube is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN (or authorize the channel in organizer admin).',
    );
  }

  return { clientId, clientSecret, refreshToken };
}

async function getAccessToken() {
  const { clientId, clientSecret, refreshToken } = await getYouTubeCredentials();
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || 'Failed to refresh YouTube access token.');
  }
  return tokenData.access_token as string;
}

function ytHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

export type BroadcastDetails = {
  name: string;
  day: string;
  teamName?: string;
  opponentName?: string;
  teamTag?: string;
  opponentTag?: string;
  stage?: string;
  editionTitle?: string;
  timeRange?: string;
  endIso?: string;
};

function formatIst(date: Date) {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
  return `${formatted} IST`;
}

function shortIstTime(date: Date) {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace(/\s/g, '')
    .toLowerCase();
  return `${time} IST`;
}

function firstFittingTitle(candidates: string[]) {
  const fit = candidates.find((value) => value.length > 0 && value.length <= 100);
  return (fit || candidates[candidates.length - 1] || 'CBOT Live').slice(0, 100);
}

function buildBroadcastCopy(details: BroadcastDetails) {
  const name = details.name.trim();
  const day = details.day.trim();
  const teamName = details.teamName?.trim() || '';
  const opponentName = details.opponentName?.trim() || '';
  const teamTag = details.teamTag?.trim() || '';
  const opponentTag = details.opponentTag?.trim() || '';
  const stage = details.stage?.trim() || '';
  const editionTitle = details.editionTitle?.trim() || 'CBOT 200th Edition';
  const timeRange = details.timeRange?.trim() || '';
  const matchLine = teamName && opponentName ? `${teamName} vs ${opponentName}` : teamName || opponentName;
  const shortMatch =
    teamTag && opponentTag ? `${teamTag} vs ${opponentTag}` : matchLine;

  const startedAt = new Date();
  const startedStamp = formatIst(startedAt);
  const startedShort = shortIstTime(startedAt);
  const dayEnd = details.endIso ? new Date(details.endIso) : null;
  const dayEndValid = dayEnd && !Number.isNaN(dayEnd.getTime()) ? dayEnd : null;
  const beforeCutoff = dayEndValid ? startedAt.getTime() < dayEndValid.getTime() : null;

  const title = firstFittingTitle(
    [
      `${editionTitle} • ${name} • ${matchLine} • ${day} • ${startedShort}`,
      `${name} • ${matchLine} • ${day} • ${startedShort}`,
      `${name} • ${shortMatch} • ${day} • ${startedShort}`,
      `${name} • ${day} • ${startedShort}`,
    ].filter((value, index, all) => all.indexOf(value) === index),
  );

  const description = [
    editionTitle,
    '',
    `Player: ${name}`,
    matchLine ? `Match: ${matchLine}` : null,
    stage ? `Stage: ${stage}` : null,
    `Day: ${day}`,
    timeRange ? `Window: ${timeRange}` : null,
    '',
    `Started: ${startedStamp}`,
    dayEndValid ? `Day ends: ${formatIst(dayEndValid)}` : null,
    beforeCutoff === null ? null : `Before 8pm cutoff: ${beforeCutoff ? 'YES' : 'NO'}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { title, description, matchLine, beforeCutoff };
}

export async function createLiveSession(details: BroadcastDetails): Promise<CreateBroadcastResult> {
  const accessToken = await getAccessToken();
  const { title, description } = buildBroadcastCopy(details);
  const scheduledStartTime = new Date().toISOString();

  const broadcastRes = await fetch(
    'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails',
    {
      method: 'POST',
      headers: ytHeaders(accessToken),
      body: JSON.stringify({
        snippet: { title, description, scheduledStartTime },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false,
        },
        contentDetails: {
          enableAutoStart: true,
          enableAutoStop: true,
          enableDvr: true,
          recordFromStart: true,
        },
      }),
    },
  );
  const broadcast = await broadcastRes.json();
  if (!broadcast.id) youtubeError(broadcast, 'Failed to create YouTube broadcast.');

  const streamRes = await fetch('https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn', {
    method: 'POST',
    headers: ytHeaders(accessToken),
    body: JSON.stringify({
      snippet: { title: `${title} stream` },
      cdn: {
        frameRate: '30fps',
        ingestionType: 'rtmp',
        resolution: '720p',
      },
    }),
  });
  const stream = await streamRes.json();
  if (!stream.id) youtubeError(stream, 'Failed to create YouTube stream.');

  const bindRes = await fetch(
    `https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${broadcast.id}&streamId=${stream.id}&part=id,snippet,contentDetails,status`,
    {
      method: 'POST',
      headers: ytHeaders(accessToken),
    },
  );
  const bound = await bindRes.json();
  if (bound.error) youtubeError(bound, 'Failed to bind YouTube broadcast.');

  const ingestionAddress = stream.cdn?.ingestionInfo?.ingestionAddress as string | undefined;
  const streamName = stream.cdn?.ingestionInfo?.streamName as string | undefined;
  if (!ingestionAddress || !streamName) {
    throw new Error('YouTube did not return complete stream credentials.');
  }

  const secureIngestion = ingestionAddress.replace(/^rtmp:\/\//i, 'rtmps://');

  return {
    broadcastId: broadcast.id,
    streamId: stream.id,
    ingestionAddress: secureIngestion,
    streamName,
    watchUrl: `https://www.youtube.com/watch?v=${broadcast.id}`,
    title,
  };
}

export async function transitionBroadcast(broadcastId: string, status: 'live' | 'complete') {
  const accessToken = await getAccessToken();
  const maxAttempts = status === 'live' ? 12 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=${status}&id=${encodeURIComponent(broadcastId)}&part=id,status`,
      {
        method: 'POST',
        headers: ytHeaders(accessToken),
      },
    );
    const data = await res.json();
    if (!data.error) return;
    if (status !== 'live' || attempt === maxAttempts - 1) {
      youtubeError(data, `Failed to set broadcast ${status}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
