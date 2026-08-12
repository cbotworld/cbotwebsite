import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('authorization');
    const secretParam = searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET || 'cbot-cron-secret-key-2026';

    // Verify secret parameter or authorization header for cron execution security
    if (secretParam !== expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      console.warn('[Cron Expiry] Unauthorized execution attempt.');
      return NextResponse.json({ success: false, error: 'Unauthorized cron access' }, { status: 401 });
    }

    const now = new Date();
    console.log(`[Cron Expiry] Checking for expired match live streams at ${now.toISOString()}...`);

    // Find all ARCHIVED or LIVE streams whose 15-day expiry date has passed
    const expiredStreams = await prisma.liveStream.findMany({
      where: {
        status: { in: ['ARCHIVED', 'LIVE', 'ENDED'] },
        expiresAt: { lte: now }
      }
    });

    console.log(`[Cron Expiry] Found ${expiredStreams.length} streams to expire.`);

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

    // Optional: Call YouTube API to set privacyStatus to 'private' if tokens exist
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
      // 1. If YouTube Video ID exists, attempt setting privacy to private
      if (accessToken && stream.youtubeVideoId && !stream.youtubeVideoId.startsWith('cbot_yt_')) {
        try {
          await fetch('https://www.googleapis.com/youtube/v3/videos?part=status', {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: stream.youtubeVideoId,
              status: { privacyStatus: 'private' }
            }),
          });
        } catch (ytErr) {
          console.error(`[Cron Expiry] Failed to update YouTube privacy for video ${stream.youtubeVideoId}:`, ytErr);
        }
      }

      // 2. Mark stream as EXPIRED in Prisma DB
      await prisma.liveStream.update({
        where: { id: stream.id },
        data: { status: 'EXPIRED' }
      });

      processedCount++;
    }

    return NextResponse.json({
      success: true,
      processedCount,
      message: `Successfully processed 15-day expiry for ${processedCount} streams.`,
      executedAt: now.toISOString(),
    });
  } catch (error: any) {
    console.error('[Cron Expiry] Unhandled exception:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
