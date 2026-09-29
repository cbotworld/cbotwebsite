import { prisma } from '@/lib/prisma';
import { getWebsiteCmsSite } from '@/lib/website-cms-site';

export const DEFAULT_GOOGLE_CLIENT_ID = '857312173626-97fujm4mo4srp18mlvasmbfvfrfma2ap.apps.googleusercontent.com';
export const DEFAULT_GOOGLE_CLIENT_SECRET = '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';

export type CreateBroadcastResult = {
  broadcastId: string;
  streamId: string;
  ingestionAddress: string;
  streamName: string;
  watchUrl: string;
  title: string;
  channelIndex?: number;
  channelTitle?: string;
};

export type YouTubeChannelConfig = {
  channelIndex: number;
  label: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  channelTitle?: string;
  channelId?: string;
};

export function isYouTubeQuotaOrLimitError(error: any): boolean {
  if (!error) return false;
  const reason = String(error?.error?.errors?.[0]?.reason || error?.reason || '').toLowerCase();
  const message = String(error?.error?.message || error?.message || '').toLowerCase();
  const code = error?.error?.code || error?.status || error?.code;

  if (code === 403 || code === 429) return true;
  if (
    reason.includes('quota') ||
    reason.includes('limit') ||
    reason.includes('rate') ||
    reason.includes('exceed') ||
    reason.includes('forbidden') ||
    reason.includes('liveschedulingdisabled') ||
    reason.includes('livestreamingnotenabled') ||
    reason.includes('concurrentbroadcastsexceedlimit') ||
    reason.includes('userbroadcastsexceedlimit') ||
    reason.includes('userrequestsexceedratelimit')
  ) {
    return true;
  }
  if (
    message.includes('quota') ||
    message.includes('limit') ||
    message.includes('exceeded') ||
    message.includes('too many') ||
    message.includes('rate limit') ||
    message.includes('not enabled for live')
  ) {
    return true;
  }
  return false;
}

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

  const err: any = new Error(message);
  err.error = payload?.error;
  err.reason = reason;
  err.code = payload?.error?.code;
  throw err;
}

export async function getAllConfiguredYouTubeChannels(): Promise<YouTubeChannelConfig[]> {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: [
          'youtube_refresh_token',
          'youtube_channel_1_title',
          'youtube_channel_1_id',
          'youtube_client_id_1',
          'youtube_client_secret_1',
        ],
      },
    },
  });
  const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

  // Channel 1 (Primary official channel)
  const ch1RefreshToken =
    settingsMap.get('youtube_refresh_token') ||
    process.env.YOUTUBE_REFRESH_TOKEN ||
    process.env.GOOGLE_REFRESH_TOKEN ||
    '';
  const ch1ClientId =
    settingsMap.get('youtube_client_id_1') ||
    process.env.GOOGLE_CLIENT_ID ||
    DEFAULT_GOOGLE_CLIENT_ID;
  const ch1ClientSecret =
    settingsMap.get('youtube_client_secret_1') ||
    process.env.GOOGLE_CLIENT_SECRET ||
    DEFAULT_GOOGLE_CLIENT_SECRET;
  const ch1Title = settingsMap.get('youtube_channel_1_title') || 'CBOT World';
  const ch1Id = settingsMap.get('youtube_channel_1_id') || '';

  const channels: YouTubeChannelConfig[] = [];

  if (ch1RefreshToken) {
    channels.push({
      channelIndex: 1,
      label: 'Channel 1',
      clientId: ch1ClientId,
      clientSecret: ch1ClientSecret,
      refreshToken: ch1RefreshToken,
      channelTitle: ch1Title,
      channelId: ch1Id,
    });
  }

  return channels;
}

export async function getYouTubeChannelPool(): Promise<YouTubeChannelConfig[]> {
  const channels = await getAllConfiguredYouTubeChannels();
  if (channels.length === 0) return [];
  return channels.filter((c) => c.channelIndex === 1);
}

export async function getAccessTokenForChannel(channel: YouTubeChannelConfig): Promise<string> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: channel.clientId,
      client_secret: channel.clientSecret,
      refresh_token: channel.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(
      tokenData.error_description ||
        tokenData.error ||
        `Failed to refresh access token for YouTube ${channel.label}.`,
    );
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

function buildBroadcastCopy(details: BroadcastDetails, fallbackEditionTitle: string) {
  const name = details.name.trim();
  const day = details.day.trim();
  const teamName = details.teamName?.trim() || '';
  const opponentName = details.opponentName?.trim() || '';
  const teamTag = details.teamTag?.trim() || '';
  const opponentTag = details.opponentTag?.trim() || '';
  const stage = details.stage?.trim() || '';
  const editionTitle = details.editionTitle?.trim() || fallbackEditionTitle;
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

async function createLiveSessionOnChannel(
  channel: YouTubeChannelConfig,
  details: BroadcastDetails,
  broadcastCopy: { title: string; description: string },
): Promise<CreateBroadcastResult> {
  const accessToken = await getAccessTokenForChannel(channel);
  const { title, description } = broadcastCopy;
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
  if (!broadcast.id) youtubeError(broadcast, `Failed to create YouTube broadcast on ${channel.label}.`);

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
  if (!stream.id) youtubeError(stream, `Failed to create YouTube stream on ${channel.label}.`);

  const bindRes = await fetch(
    `https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${broadcast.id}&streamId=${stream.id}&part=id,snippet,contentDetails,status`,
    {
      method: 'POST',
      headers: ytHeaders(accessToken),
    },
  );
  const bound = await bindRes.json();
  if (bound.error) youtubeError(bound, `Failed to bind YouTube broadcast on ${channel.label}.`);

  const ingestionAddress = stream.cdn?.ingestionInfo?.ingestionAddress as string | undefined;
  const streamName = stream.cdn?.ingestionInfo?.streamName as string | undefined;
  if (!ingestionAddress || !streamName) {
    throw new Error(`YouTube did not return complete stream credentials on ${channel.label}.`);
  }

  const secureIngestion = ingestionAddress.replace(/^rtmp:\/\//i, 'rtmps://');

  return {
    broadcastId: broadcast.id,
    streamId: stream.id,
    ingestionAddress: secureIngestion,
    streamName,
    watchUrl: `https://www.youtube.com/watch?v=${broadcast.id}`,
    title,
    channelIndex: channel.channelIndex,
    channelTitle: channel.channelTitle,
  };
}

/**
 * Creates a YouTube live broadcast session with automatic silent quota/rate-limit failover across connected channels.
 */
export async function createLiveSession(details: BroadcastDetails): Promise<CreateBroadcastResult> {
  const channelPool = await getYouTubeChannelPool();
  if (channelPool.length === 0) {
    throw new Error(
      'YouTube is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_REFRESH_TOKEN (or authorize the channel in organizer admin).',
    );
  }

  const site = await getWebsiteCmsSite();
  const broadcastCopy = buildBroadcastCopy(details, `${site.shortName} ${site.editionLabel}`);

  let lastError: any = null;

  for (let i = 0; i < channelPool.length; i += 1) {
    const channel = channelPool[i];
    try {
      const session = await createLiveSessionOnChannel(channel, details, broadcastCopy);
      if (i > 0) {
        console.log(`[YouTube Live] Successfully failed over to ${channel.label} (${channel.channelTitle}).`);
      }
      return session;
    } catch (error: any) {
      lastError = error;
      const isQuotaOrLimit = isYouTubeQuotaOrLimitError(error);
      console.warn(
        `[YouTube Live] Attempt on ${channel.label} (${channel.channelTitle}) failed:`,
        error?.message || error,
        `(Quota/Limit: ${isQuotaOrLimit})`,
      );

      // If there's another channel in the pool and this was a quota/limit or channel-level failure, try next channel seamlessly
      if (i < channelPool.length - 1 && isQuotaOrLimit) {
        const nextChannel = channelPool[i + 1];
        console.warn(
          `[YouTube Live] Silently failing over from ${channel.label} to ${nextChannel.label} (${nextChannel.channelTitle})...`,
        );
        continue;
      }

      // If no more channels or non-recoverable, break
      break;
    }
  }

  throw lastError || new Error('Failed to create YouTube broadcast session across available channels.');
}

export type ChannelVideoItem = {
  youtubeVideoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  youtubeUrl: string;
  channelIndex?: number;
  channelTitle?: string;
};

export async function getAccessToken(): Promise<string> {
  const pool = await getYouTubeChannelPool();
  if (pool.length === 0) {
    throw new Error('No YouTube channel configured.');
  }
  return getAccessTokenForChannel(pool[0]);
}

/** Official CBOTWORLD channel uploads aggregated across all connected YouTube channels in the pool. */
export async function listOfficialChannelVideos(limit = 300): Promise<ChannelVideoItem[]> {
  try {
    const pool = await getAllConfiguredYouTubeChannels();
    if (pool.length === 0) return [];

    const allItems: ChannelVideoItem[] = [];
    const seenIds = new Set<string>();

    for (const channel of pool) {
      try {
        const accessToken = await getAccessTokenForChannel(channel);
        const chRes = await fetch(
          'https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&mine=true',
          { headers: ytHeaders(accessToken) },
        );
        const chData = await chRes.json();
        const uploads = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads as string | undefined;
        if (!uploads) continue;

        let pageToken = '';
        let countForChannel = 0;
        const maxPerChannel = Math.ceil(limit / Math.max(1, pool.length)) + 50;

        while (countForChannel < maxPerChannel) {
          const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
          url.searchParams.set('part', 'snippet,contentDetails');
          url.searchParams.set('playlistId', uploads);
          url.searchParams.set('maxResults', '50');
          if (pageToken) url.searchParams.set('pageToken', pageToken);

          const res = await fetch(url.toString(), { headers: ytHeaders(accessToken) });
          const data = await res.json();
          if (data.error) {
            console.warn(`[YouTube Live] Error fetching uploads for ${channel.label}:`, data.error?.message || data.error);
            break;
          }

          for (const it of data.items || []) {
            const id = it.contentDetails?.videoId || it.snippet?.resourceId?.videoId;
            if (!id || seenIds.has(id)) continue;
            seenIds.add(id);
            allItems.push({
              youtubeVideoId: id,
              title: it.snippet?.title || 'CBOT WORLD',
              publishedAt: it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt || '',
              thumbnailUrl:
                it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.medium?.url || null,
              youtubeUrl: `https://www.youtube.com/watch?v=${id}`,
              channelIndex: channel.channelIndex,
              channelTitle: channel.channelTitle,
            });
            countForChannel += 1;
          }

          pageToken = data.nextPageToken || '';
          if (!pageToken) break;
        }
      } catch (channelErr) {
        console.warn(`[YouTube Live] listOfficialChannelVideos skipped ${channel.label}:`, channelErr);
      }
    }

    // Sort aggregated videos newest first
    allItems.sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return tb - ta;
    });

    return allItems.slice(0, limit);
  } catch (error) {
    console.error('listOfficialChannelVideos:', error);
    return [];
  }
}

export async function transitionBroadcast(broadcastId: string, status: 'live' | 'complete') {
  const pool = await getYouTubeChannelPool();
  if (pool.length === 0) return;

  for (const channel of pool) {
    try {
      const accessToken = await getAccessTokenForChannel(channel);

      if (status === 'complete') {
        try {
          const res = await fetch(
            `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${encodeURIComponent(broadcastId)}&part=id,status`,
            {
              method: 'POST',
              headers: ytHeaders(accessToken),
            },
          );
          const data = await res.json();
          if (!data.error || String(data.error.message || '').toLowerCase().includes('redundant')) {
            return; // Successfully completed on this channel
          }
          if (data.error?.code === 404) {
            // Not on this channel, try next channel in pool
            continue;
          }
          console.warn(`YouTube complete transition on ${channel.label} warning:`, data.error);
        } catch (err) {
          console.warn(`YouTube complete transition on ${channel.label} error:`, err);
        }
        continue;
      }

      // status === 'live'
      const maxAttempts = 5;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const res = await fetch(
            `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=live&id=${encodeURIComponent(broadcastId)}&part=id,status`,
            {
              method: 'POST',
              headers: ytHeaders(accessToken),
            },
          );
          const data = await res.json();
          if (!data.error) return;

          const errMsg = String(data.error?.message || '').toLowerCase();
          const reason = String(data.error?.errors?.[0]?.reason || '').toLowerCase();
          if (errMsg.includes('redundant') || errMsg.includes('already') || reason.includes('redundant')) {
            return;
          }

          if (data.error?.code === 404) {
            // Broadcast not on this channel
            break;
          }

          if (attempt >= 1) {
            const checkRes = await fetch(
              `https://www.googleapis.com/youtube/v3/liveBroadcasts?id=${encodeURIComponent(broadcastId)}&part=status`,
              { headers: ytHeaders(accessToken) },
            );
            const checkData = await checkRes.json();
            const lifeCycle = checkData.items?.[0]?.status?.lifeCycleStatus;
            if (lifeCycle === 'live' || lifeCycle === 'liveStarting' || lifeCycle === 'testing' || lifeCycle === 'ready') {
              return;
            }
          }
        } catch (err) {
          console.warn(`YouTube live transition attempt ${attempt + 1} on ${channel.label} warning:`, err);
        }

        if (attempt === maxAttempts - 1) {
          console.log(`YouTube transition on ${channel.label} auto-start stream active.`);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (channelErr) {
      console.warn(`[YouTube Live] transitionBroadcast error on ${channel.label}:`, channelErr);
    }
  }
}
