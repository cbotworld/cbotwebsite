import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '857312173626-97fujm4mo4srp18mlvasmbfvfrfma2ap.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';

async function getAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Failed to refresh token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function main() {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'youtube_refresh_token' },
  });

  if (!setting?.value) {
    console.error('No youtube_refresh_token found in database!');
    return;
  }

  console.log('Refreshing YouTube access token...');
  const token = await getAccessToken(setting.value);
  console.log('Access token retrieved successfully.');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  console.log(`Cutoff date (30 days ago): ${thirtyDaysAgo.toISOString()}\n`);

  // 1. Fetch broadcasts
  console.log('--- Fetching Live Broadcasts ---');
  let nextPageToken = undefined;
  const broadcasts = [];

  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/liveBroadcasts');
    url.searchParams.set('part', 'id,snippet,status');
    url.searchParams.set('broadcastStatus', 'all');
    url.searchParams.set('maxResults', '50');
    if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (data.error) {
      console.error('Error fetching broadcasts:', data.error);
      break;
    }

    if (data.items) {
      broadcasts.push(...data.items);
    }
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  console.log(`Total live broadcasts found on channel: ${broadcasts.length}`);

  const olderBroadcasts = broadcasts.filter((b) => {
    const dateStr = b.snippet?.actualStartTime || b.snippet?.scheduledStartTime || b.snippet?.publishedAt;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d < thirtyDaysAgo;
  });

  const recentBroadcasts = broadcasts.filter((b) => !olderBroadcasts.includes(b));

  console.log(`- Broadcasts older than 30 days: ${olderBroadcasts.length}`);
  console.log(`- Broadcasts within last 30 days: ${recentBroadcasts.length}\n`);

  if (olderBroadcasts.length > 0) {
    console.log('Broadcasts older than 30 days:');
    olderBroadcasts.forEach((b, idx) => {
      const dateStr = b.snippet?.actualStartTime || b.snippet?.scheduledStartTime || b.snippet?.publishedAt;
      console.log(`[${idx + 1}] ID: ${b.id} | Date: ${dateStr} | Status: ${b.status?.lifeCycleStatus} | Title: "${b.snippet?.title}"`);
    });
  }

  // Also check upload playlist videos
  console.log('\n--- Fetching Channel Videos from Uploads Playlist ---');
  const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const channelData = await channelRes.json();
  const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

  if (uploadsPlaylistId) {
    console.log(`Uploads Playlist ID: ${uploadsPlaylistId}`);
    let playlistPageToken = undefined;
    const videos = [];

    do {
      const pUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
      pUrl.searchParams.set('part', 'snippet,contentDetails');
      pUrl.searchParams.set('playlistId', uploadsPlaylistId);
      pUrl.searchParams.set('maxResults', '50');
      if (playlistPageToken) pUrl.searchParams.set('pageToken', playlistPageToken);

      const pRes = await fetch(pUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const pData = await pRes.json();

      if (pData.items) {
        videos.push(...pData.items);
      }
      playlistPageToken = pData.nextPageToken;
    } while (playlistPageToken);

    console.log(`Total videos/uploads found on channel: ${videos.length}`);

    const olderVideos = videos.filter((v) => {
      const d = new Date(v.snippet?.publishedAt);
      return d < thirtyDaysAgo;
    });

    console.log(`- Videos older than 30 days: ${olderVideos.length}`);
    console.log(`- Videos within last 30 days: ${videos.length - olderVideos.length}`);

    if (olderVideos.length > 0) {
      console.log('\nVideos older than 30 days:');
      olderVideos.forEach((v, idx) => {
        console.log(`[${idx + 1}] Video ID: ${v.contentDetails?.videoId} | Published: ${v.snippet?.publishedAt} | Title: "${v.snippet?.title}"`);
      });
    }
  }
}

main().finally(() => prisma.$disconnect());
