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

async function main() {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'youtube_refresh_token' },
  });
  const token = await getAccessToken(setting.value);

  // Check all active broadcasts
  for (const status of ['active', 'upcoming', 'all']) {
    const url = `https://www.googleapis.com/youtube/v3/liveBroadcasts?part=id,snippet,status&broadcastStatus=${status}&maxResults=50`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    console.log(`broadcastStatus=${status}: total on page = ${data.items?.length || 0}`);
    if (data.items) {
      for (const b of data.items) {
        if (status === 'upcoming' || b.status?.lifeCycleStatus !== 'complete') {
          console.log(`  [${b.id}] status: ${b.status?.lifeCycleStatus}, scheduled: ${b.snippet?.scheduledStartTime}, title: "${b.snippet?.title}"`);
        }
      }
      const statuses = data.items.map(b => b.status?.lifeCycleStatus);
      const counts = statuses.reduce((acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc; }, {});
      console.log(`  lifecycle counts:`, counts);
    }
  }
}

main().finally(() => prisma.$disconnect());
