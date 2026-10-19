import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_GOOGLE_CLIENT_ID, DEFAULT_GOOGLE_CLIENT_SECRET } from '@/lib/youtube-live';

export const revalidate = 0;
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PROTECTED_KEYWORDS = [
  'intro',
  'opening',
  'closing',
  'centenary',
  'promo',
  'trailer',
  'milestone',
  'highlight',
  'tutorial',
];

function isProtected(title = ''): boolean {
  const lower = title.toLowerCase();
  return PROTECTED_KEYWORDS.some((kw) => lower.includes(kw));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getYouTubeAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || DEFAULT_GOOGLE_CLIENT_SECRET;

  let refreshToken = process.env.YOUTUBE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;

  if (!refreshToken) {
    const dbSetting = await prisma.systemSetting.findUnique({
      where: { key: 'youtube_refresh_token' },
    });
    if (dbSetting?.value) {
      refreshToken = dbSetting.value;
    }
  }

  if (!clientId || !clientSecret || !refreshToken) {
    console.warn('[Cron Expiry] Missing OAuth credentials or refresh token.');
    return null;
  }

  try {
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
    return (tokenData.access_token as string) || null;
  } catch (err) {
    console.error('[Cron Expiry] Failed to refresh Google OAuth token:', err);
    return null;
  }
}

async function deleteYouTubeItem(id: string, token: string): Promise<boolean> {
  try {
    // 1. Try deleting video resource
    const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (vRes.status === 204 || vRes.status === 200 || vRes.status === 404) {
      return true;
    }

    // 2. Try deleting liveBroadcast resource if video delete is not found/supported
    const bRes = await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    return bRes.status === 204 || bRes.status === 200 || bRes.status === 404;
  } catch (err) {
    console.error(`[Cron Expiry] Error calling YouTube delete API for ${id}:`, err);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const defaultSecret = 'cbot_cron_secret_2026';
    const envSecret = process.env.CRON_SECRET;
    const querySecret = searchParams.get('secret');
    const authHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';

    const isAuthorized =
      isVercelCron ||
      (envSecret && (querySecret === envSecret || authHeader === envSecret)) ||
      querySecret === defaultSecret ||
      authHeader === defaultSecret;

    if (!isAuthorized) {
      console.warn('[Cron Expiry] Unauthorized execution attempt.');
      return NextResponse.json({ success: false, error: 'Unauthorized cron access' }, { status: 401 });
    }

    const now = new Date();
    // 30 days retention policy: any video older than 30 days from creation is eligible for deletion
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    console.log(`[Cron Expiry] Running automated 30-day YouTube cleanup. Cutoff: ${thirtyDaysAgo.toISOString()}`);

    const accessToken = await getYouTubeAccessToken();

    let ytDeletedCount = 0;
    let ytProtectedCount = 0;
    let ytScanErrors = 0;

    // Scan YouTube directly if OAuth token is valid
    if (accessToken) {
      let nextPageToken: string | undefined = undefined;

      try {
        do {
          const url = new URL('https://www.googleapis.com/youtube/v3/liveBroadcasts');
          url.searchParams.set('part', 'id,snippet,status');
          url.searchParams.set('broadcastStatus', 'all');
          url.searchParams.set('maxResults', '50');
          if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);

          const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const data = await res.json();

          if (data.error) {
            console.error('[Cron Expiry] Error fetching liveBroadcasts:', data.error);
            ytScanErrors++;
            break;
          }

          if (data.items && Array.isArray(data.items)) {
            for (const item of data.items) {
              const dateStr =
                item.snippet?.actualStartTime ||
                item.snippet?.scheduledStartTime ||
                item.snippet?.publishedAt;

              if (!dateStr) continue;

              const createdDate = new Date(dateStr);
              const isOrphanedReady =
                (item.status?.lifeCycleStatus === 'ready' || item.status?.lifeCycleStatus === 'created') &&
                createdDate < new Date(now.getTime() - 12 * 60 * 60 * 1000);

              if (createdDate < thirtyDaysAgo || isOrphanedReady) {
                const title = item.snippet?.title || '';
                if (isProtected(title)) {
                  ytProtectedCount++;
                  continue;
                }

                const deleted = await deleteYouTubeItem(item.id, accessToken);
                if (deleted) {
                  ytDeletedCount++;
                }
                // Throttle to respect YouTube rate limits
                await sleep(120);
              }
            }
          }

          nextPageToken = data.nextPageToken;
        } while (nextPageToken);
      } catch (scanErr) {
        console.error('[Cron Expiry] Error during YouTube direct scan:', scanErr);
      }
    } else {
      console.warn('[Cron Expiry] YouTube access token could not be obtained; skipping direct YouTube channel scan.');
    }

    // 2. Synchronize database: mark expired in Prisma
    const dbUpdateResult = await prisma.liveStream.updateMany({
      where: {
        status: { in: ['ARCHIVED', 'LIVE', 'ENDED', 'READY', 'CREATED'] },
        OR: [
          { expiresAt: { lte: now } },
          { createdAt: { lte: thirtyDaysAgo } },
        ],
      },
      data: {
        status: 'EXPIRED',
        youtubeUrl: null,
        youtubeEmbedUrl: null,
        streamKey: null,
        rtmpIngestionUrl: null,
      },
    });

    console.log(
      `[Cron Expiry] Finished cleanup: ${ytDeletedCount} YouTube videos deleted, ${ytProtectedCount} protected, ${dbUpdateResult.count} database records updated.`,
    );

    return NextResponse.json({
      success: true,
      cutoffDate: thirtyDaysAgo.toISOString(),
      youtubeDeleted: ytDeletedCount,
      youtubeProtected: ytProtectedCount,
      dbRecordsExpired: dbUpdateResult.count,
      executedAt: now.toISOString(),
    });
  } catch (error: any) {
    console.error('[Cron Expiry] Unhandled exception:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error' },
      { status: 500 },
    );
  }
}
