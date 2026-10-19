import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '857312173626-97fujm4mo4srp18mlvasmbfvfrfma2ap.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';

// Titles matching these keywords will NEVER be deleted
const PROTECTED_KEYWORDS = [
  'intro',
  'opening',
  'closing',
  'centenary',
  'promo',
  'trailer',
  'milestone',
  'highlight',
  'tutorial'
];

function isProtected(title = '') {
  const lower = title.toLowerCase();
  return PROTECTED_KEYWORDS.some((kw) => lower.includes(kw));
}

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function deleteItem(id, token) {
  // First attempt: videos.delete
  const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (vRes.status === 204 || vRes.status === 200) {
    return { success: true, method: 'video' };
  }

  // If not found as a video or failed, try liveBroadcasts.delete
  const bRes = await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts?id=${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (bRes.status === 204 || bRes.status === 200) {
    return { success: true, method: 'broadcast' };
  }

  if (vRes.status === 404 && bRes.status === 404) {
    return { success: true, method: 'already_deleted' };
  }

  const errData = await vRes.text().catch(() => '');
  return { success: false, status: vRes.status, error: errData };
}

async function main() {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'youtube_refresh_token' },
  });

  if (!setting?.value) {
    console.error('No youtube_refresh_token found in database!');
    return;
  }

  console.log('🔄 Refreshing YouTube access token...');
  let token = await getAccessToken(setting.value);
  console.log('✅ Access token active.');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  console.log(`📅 Cutoff date (30 days ago): ${thirtyDaysAgo.toISOString()}\n`);

  console.log('🔍 Fetching all live broadcasts from channel...');
  let nextPageToken = undefined;
  const allBroadcasts = [];

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
      allBroadcasts.push(...data.items);
    }
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  console.log(`📊 Total broadcasts retrieved: ${allBroadcasts.length}`);

  // Filter items older than 30 days
  const candidateItems = allBroadcasts.filter((b) => {
    const dateStr = b.snippet?.actualStartTime || b.snippet?.scheduledStartTime || b.snippet?.publishedAt;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d < thirtyDaysAgo;
  });

  console.log(`🎯 Broadcasts older than 30 days: ${candidateItems.length}`);

  const toDelete = [];
  const protectedItems = [];

  for (const item of candidateItems) {
    const title = item.snippet?.title || '';
    if (isProtected(title)) {
      protectedItems.push(item);
    } else {
      toDelete.push(item);
    }
  }

  if (protectedItems.length > 0) {
    console.log(`\n🛡️ Protected ${protectedItems.length} milestone/channel videos from deletion:`);
    protectedItems.forEach((p) => console.log(`   - PRESERVED: "${p.snippet?.title}" (ID: ${p.id})`));
  }

  console.log(`\n🚀 Starting deletion of ${toDelete.length} live match/practice videos...`);

  let deletedCount = 0;
  let failedCount = 0;
  let tokenRefreshTimer = Date.now();

  for (let i = 0; i < toDelete.length; i++) {
    const item = toDelete[i];
    const title = item.snippet?.title || 'Untitled';
    const dateStr = item.snippet?.actualStartTime || item.snippet?.scheduledStartTime || item.snippet?.publishedAt;

    // Refresh access token every 45 minutes if running long
    if (Date.now() - tokenRefreshTimer > 45 * 60 * 1000) {
      console.log('🔄 Refreshing access token during batch...');
      token = await getAccessToken(setting.value);
      tokenRefreshTimer = Date.now();
    }

    try {
      const res = await deleteItem(item.id, token);
      if (res.success) {
        deletedCount++;
        if ((i + 1) % 25 === 0 || i === toDelete.length - 1) {
          console.log(`[${i + 1}/${toDelete.length}] Progress: ${deletedCount} deleted, ${failedCount} errors. (Last: "${title.slice(0, 50)}...")`);
        }
      } else {
        failedCount++;
        console.warn(`⚠️ Failed to delete ${item.id} ("${title}"): Status ${res.status}`);
      }
    } catch (err) {
      failedCount++;
      console.error(`❌ Error deleting ${item.id}:`, err.message || err);
    }

    // Rate-limit throttle (150ms delay between deletes)
    await sleep(150);
  }

  console.log('\n========================================');
  console.log('🎉 Cleanup Finished!');
  console.log(`- Successfully deleted: ${deletedCount}`);
  console.log(`- Protected/Preserved: ${protectedItems.length}`);
  console.log(`- Failed: ${failedCount}`);
  console.log('========================================');
}

main().finally(() => prisma.$disconnect());
