import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('authorization');
    const secretParam = searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET || 'cbot_cron_secret_2026';

    // Verify secret parameter or authorization header for cron execution security
    if (secretParam !== expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      console.warn('[Cron Expiry] Unauthorized execution attempt.');
      return NextResponse.json({ success: false, error: 'Unauthorized cron access' }, { status: 401 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    console.log(`[Cron Expiry] Checking for expired or 30-day old match live streams at ${now.toISOString()}...`);

    // Find all streams where either:
    // 1. Explicit expiresAt date has passed, OR
    // 2. Stream was created more than 30 days ago (Policy III.E.4 compliance)
    const expiredStreams = await prisma.liveStream.findMany({
      where: {
        status: { in: ['ARCHIVED', 'LIVE', 'ENDED', 'READY', 'CREATED'] },
        OR: [
          { expiresAt: { lte: now } },
          { createdAt: { lte: thirtyDaysAgo } },
        ],
      },
    });

    console.log(`[Cron Expiry] Found ${expiredStreams.length} streams to delete/expire.`);

    let processedCount = 0;
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    let googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!googleRefreshToken) {
      const dbSetting = await prisma.systemSetting.findUnique({
        where: { key: 'youtube_refresh_token' }
      });
      if (dbSetting?.value) {
        googleRefreshToken = dbSetting.value;
      }
    }

    // Refresh Google OAuth token to interact with YouTube API if needed
    let accessToken: string | null = null;
    if (googleClientId && googleClientSecret && googleRefreshToken) {
      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            refresh_token: googleRefreshToken,
            grant_type: 'refresh_token',
          }),
        });
        const tokenData = await tokenRes.json();
        accessToken = tokenData.access_token || null;
      } catch (e) {
        console.error('[Cron Expiry] Google OAuth refresh error:', e);
      }
    }

    for (const stream of expiredStreams) {
      // 1. Optionally delete or set privacy to private on YouTube if valid video ID exists
      if (accessToken && stream.youtubeVideoId && !stream.youtubeVideoId.startsWith('cbot_yt_')) {
        try {
          // Attempt to delete video or set private
          await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${stream.youtubeVideoId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });
        } catch (ytErr) {
          console.error(`[Cron Expiry] YouTube API deletion error for video ${stream.youtubeVideoId}:`, ytErr);
        }
      }

      // 2. Mark as EXPIRED or delete stream record in Prisma DB after 30 days
      await prisma.liveStream.update({
        where: { id: stream.id },
        data: {
          status: 'EXPIRED',
          youtubeUrl: null,
          youtubeEmbedUrl: null,
          streamKey: null,
          rtmpIngestionUrl: null,
        },
      });

      processedCount++;
    }

    return NextResponse.json({
      success: true,
      processedCount,
      message: `Successfully processed 30-day automated cleanup for ${processedCount} streams.`,
      executedAt: now.toISOString(),
    });
  } catch (error: any) {
    console.error('[Cron Expiry] Unhandled exception:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
