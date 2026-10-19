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
  return data.access_token;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'youtube_refresh_token' },
  });
  const token = await getAccessToken(setting.value);

  const url = 'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=id,snippet,status&broadcastStatus=upcoming&maxResults=50';
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();

  const now = Date.now();
  const twelveHoursAgo = now - 12 * 60 * 60 * 1000;

  console.log(`Checking ${data.items?.length || 0} upcoming/ready broadcasts...`);
  let deletedCount = 0;

  for (const b of data.items || []) {
    const scheduledTime = new Date(b.snippet?.scheduledStartTime).getTime();
    if (scheduledTime > twelveHoursAgo) {
      console.log(`Skipping recent broadcast [${b.id}] "${b.snippet?.title}" scheduled at ${b.snippet?.scheduledStartTime}`);
      continue;
    }

    // Verify it has 0 duration
    const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${b.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const vData = await vRes.json();
    const duration = vData.items?.[0]?.contentDetails?.duration;

    if (duration && duration !== 'P0D') {
      console.log(`Skipping broadcast [${b.id}] "${b.snippet?.title}" with duration: ${duration}`);
      continue;
    }

    console.log(`Deleting orphaned ghost broadcast [${b.id}] "${b.snippet?.title}"...`);
    const dRes = await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts?id=${b.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (dRes.status === 204 || dRes.status === 200) {
      console.log(`Successfully deleted [${b.id}].`);
      deletedCount++;
    } else {
      console.warn(`Failed to delete [${b.id}]: HTTP ${dRes.status}`);
    }
    await sleep(300);
  }

  console.log(`Done. Cleaned up ${deletedCount} orphaned ghost broadcasts.`);
}

main().finally(() => prisma.$disconnect());
