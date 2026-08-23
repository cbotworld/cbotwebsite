'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { unstable_noStore as noStore, unstable_cache } from 'next/cache';

const RETENTION_HOURS = 72; // 72 Hours Retention Window from Day End

const DEFAULT_GOOGLE_CLIENT_ID = '857312173626-97fujm4mo4srp18mlvasmbfvfrfma2ap.apps.googleusercontent.com';
const DEFAULT_GOOGLE_CLIENT_SECRET = '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';

async function getYouTubeOAuthCredentials() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || DEFAULT_GOOGLE_CLIENT_SECRET;
  let googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!googleRefreshToken) {
    const dbSetting = await prisma.systemSetting.findUnique({
      where: { key: 'youtube_refresh_token' }
    });
    if (dbSetting?.value) {
      googleRefreshToken = dbSetting.value;
    }
  }

  return { googleClientId, googleClientSecret, googleRefreshToken };
}

/**
 * Website streaming is disabled — Go Live is only available in the CBOT mobile app.
 */
export async function createLiveStreamAction(_matchId: string, _replayComment?: string, _deviceSessionId?: string) {
  noStore();
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !(session.user as any).id) {
    return { success: false, error: 'Unauthorized: Please log in to stream.' };
  }
  return { success: false, error: 'Go live is only available in the CBOT mobile app.' };
}

/**
 * Website streaming is disabled — Go Live is only available in the CBOT mobile app.
 */
export async function startLiveStreamAction(_streamId: string, _deviceSessionId?: string) {
  noStore();
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: 'Unauthorized' };
  }
  return { success: false, error: 'Go live is only available in the CBOT mobile app.' };
}

/**
 * Server Action to stop/end a live stream, store match video recording, and calculate 15-day expiry
 */
export async function stopLiveStreamAction(
  streamId: string,
  recordedVideoUrl?: string,
  finalScores?: { score1?: number; score2?: number; totalScore?: number; totalSlams?: number }
) {
  noStore();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const userId = (session.user as any).id;
    let stream = await prisma.liveStream.findUnique({
      where: { id: streamId }
    });

    if (!stream) {
      // Fallback: search by matchId or active session for this player
      stream = await prisma.liveStream.findFirst({
        where: {
          OR: [
            { matchId: streamId, playerId: userId },
            { playerId: userId, status: { in: ['CREATED', 'READY', 'LIVE'] } }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    // If stream truly doesn't exist anymore in DB, treat as gracefully closed
    if (!stream) {
      return { success: true, message: 'Stream session ended.' };
    }

    const isOwner = stream.playerId === userId;
    const isOrganizer = (session.user as any).role === 'ORGANIZER' || (session.user as any).role === 'SUPER_ADMIN';

    if (!isOwner && !isOrganizer) {
      return { success: false, error: 'Unauthorized to stop this stream.' };
    }

    const endedAt = new Date();
    
    // Calculate Day End Time (8:00 PM IST of the tournament day)
    // For 200th Edition: Day 1 ends Aug 10 8PM. Day X ends at (Aug 9 + X) at 20:00:00 IST (14:30:00 UTC).
    let dayEndTime = new Date(endedAt);
    const monMatch = stream.matchId ? stream.matchId.match(/monument_(\d+)/i) : null;
    if (monMatch) {
      const dayNum = parseInt(monMatch[1], 10);
      // Aug 9 + dayNum at 20:00:00 IST (14:30:00 UTC)
      dayEndTime = new Date(Date.UTC(2026, 7, 9 + dayNum, 14, 30, 0));
    } else {
      // General match: 8:00 PM IST (20:00 IST)
      dayEndTime.setHours(20, 0, 0, 0);
    }

    // 72-hour retention strictly begins from 8:00 PM of the tournament day
    const expiresAt = new Date(dayEndTime.getTime() + RETENTION_HOURS * 60 * 60 * 1000);

    const updatedStream = await prisma.liveStream.update({
      where: { id: stream.id },
      data: {
        status: 'ARCHIVED',
        streamEndedAt: endedAt,
        recordedAt: endedAt,
        expiresAt: expiresAt,
        ...(recordedVideoUrl ? {
          youtubeUrl: recordedVideoUrl,
          youtubeEmbedUrl: recordedVideoUrl,
        } : {}),
      }
    });

    // Mark match as COMPLETED and permanently freeze final match scores
    const matchUpdateData: any = { status: 'COMPLETED' };
    if (finalScores) {
      if (typeof finalScores.score1 === 'number') matchUpdateData.score1 = finalScores.score1;
      else if (typeof finalScores.totalScore === 'number') matchUpdateData.score1 = finalScores.totalScore;
      if (typeof finalScores.score2 === 'number') matchUpdateData.score2 = finalScores.score2;
      if (typeof finalScores.totalSlams === 'number') matchUpdateData.queenStrikes1 = finalScores.totalSlams;
    }

    await prisma.match.update({
      where: { id: stream.matchId },
      data: matchUpdateData,
    }).catch(() => {});

    // Transition YouTube Live Broadcast to complete on YouTube if applicable
    const { googleClientId, googleClientSecret, googleRefreshToken } = await getYouTubeOAuthCredentials();

    if (
      googleClientId &&
      googleClientSecret &&
      googleRefreshToken &&
      stream.youtubeBroadcastId &&
      !stream.youtubeBroadcastId.startsWith('cbot_yt_')
    ) {
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
        const accessToken = tokenData.access_token;

        if (accessToken) {
          await fetch(
            `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${stream.youtubeBroadcastId}&part=status`,
            {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${accessToken}` },
            }
          );
        }
      } catch (ytEndErr) {
        console.error('Error transitioning YouTube broadcast to complete:', ytEndErr);
      }
    }

    // Auto-upload recorded video to YouTube channel in background if recorded video exists
    if (recordedVideoUrl && recordedVideoUrl.startsWith('http')) {
      const matchInfo = await prisma.match.findUnique({
        where: { id: stream.matchId },
        include: { edition: true, team1: true, team2: true }
      }).catch(() => null);

      const matchTitle = `CBOT ${matchInfo?.edition?.title || 'Edition #200'} - ${stream.matchId} - ${matchInfo?.team1?.name || 'Team 1'} vs ${matchInfo?.team2?.name || 'Team 2'}`;

      // Trigger YouTube auto-upload asynchronously
      uploadRecordedVideoToYouTube({
        streamId: stream.id,
        videoUrl: recordedVideoUrl,
        title: matchTitle,
        description: `Official CBOT Match Recording\nEdition: ${matchInfo?.edition?.title || '200th Edition'}\nMatch: ${stream.matchId}\nWatch live tournaments at https://www.cbotworld.com/matches/${stream.matchId}`,
      }).then(res => {
        if (res.success) {
          console.log(`✅ Successfully auto-published match ${stream.matchId} to YouTube: ${res.url}`);
        } else {
          console.warn(`ℹ️ YouTube auto-upload notice for match ${stream.matchId}:`, res.error);
        }
      }).catch(err => {
        console.error('YouTube auto-upload background error:', err);
      });
    }

    return { success: true, stream: updatedStream };
  } catch (error: any) {
    console.error('Failed to stop live stream:', error);
    return { success: false, error: error?.message || 'Error stopping stream' };
  }
}

/**
 * Upload recorded match video buffer/URL directly to YouTube via YouTube Data API v3
 */
export async function uploadRecordedVideoToYouTube({
  streamId,
  videoUrl,
  title,
  description,
}: {
  streamId: string;
  videoUrl: string;
  title: string;
  description?: string;
}) {
  try {
    const { googleClientId, googleClientSecret, googleRefreshToken } = await getYouTubeOAuthCredentials();

    if (!googleClientId || !googleClientSecret || !googleRefreshToken) {
      return { success: false, error: 'YouTube OAuth credentials not configured.' };
    }

    // 1. Get access token
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
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return { success: false, error: 'Failed to retrieve YouTube access token.' };
    }

    // 2. Fetch video file from storage
    const videoFetchRes = await fetch(videoUrl);
    if (!videoFetchRes.ok) {
      return { success: false, error: 'Failed to fetch video file from storage.' };
    }

    const videoBuffer = await videoFetchRes.arrayBuffer();
    const contentType = videoFetchRes.headers.get('content-type') || 'video/webm';

    // 3. Initiate YouTube Resumable Upload
    const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': contentType,
        'X-Upload-Content-Length': videoBuffer.byteLength.toString(),
      },
      body: JSON.stringify({
        snippet: {
          title: title.length > 95 ? title.slice(0, 92) + '...' : title,
          description: description || 'Official CBOT Match Video\nhttps://www.cbotworld.com/',
          tags: ['CBOT', 'Carrom', 'Tournament', 'Live Stream', 'Match Replay'],
        },
        status: {
          privacyStatus: 'unlisted',
          selfDeclaredMadeForKids: false,
          embeddable: true,
        },
      }),
    });

    const uploadLocation = initRes.headers.get('location');
    if (!uploadLocation) {
      const errText = await initRes.text();
      return { success: false, error: `YouTube upload initialization failed: ${errText}` };
    }

    // 4. Upload binary to YouTube
    const uploadRes = await fetch(uploadLocation, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: videoBuffer,
    });

    const uploadData = await uploadRes.json();
    if (uploadData.id) {
      const youtubeVideoId = uploadData.id;
      const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;
      const youtubeEmbedUrl = `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1`;

      await prisma.liveStream.update({
        where: { id: streamId },
        data: {
          youtubeVideoId,
          youtubeUrl,
          youtubeEmbedUrl,
        }
      });

      return { success: true, videoId: youtubeVideoId, url: youtubeUrl };
    } else {
      return { success: false, error: JSON.stringify(uploadData) };
    }
  } catch (err: any) {
    console.error('YouTube Auto-Upload exception:', err);
    return { success: false, error: err.message || 'Auto-upload to YouTube failed' };
  }
}

/**
 * Server Action to get live stream info for a match
 */
export async function getMatchLiveStreamAction(matchId: string) {
  noStore();
  try {
    // 1. Check if there is an active LIVE stream
    let stream = await prisma.liveStream.findFirst({
      where: { matchId, status: 'LIVE' },
      orderBy: { createdAt: 'desc' },
      include: {
        player: { select: { id: true, name: true, username: true, image: true } },
        team: { select: { id: true, name: true, tag: true, logo: true } },
        edition: { select: { id: true, title: true, number: true } },
      }
    });

    // 2. If not LIVE, find the most recent stream that has a saved video replay URL
    if (!stream) {
      stream = await prisma.liveStream.findFirst({
        where: {
          matchId,
          status: 'ARCHIVED',
          youtubeUrl: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          player: { select: { id: true, name: true, username: true, image: true } },
          team: { select: { id: true, name: true, tag: true, logo: true } },
          edition: { select: { id: true, title: true, number: true } },
        }
      });
    }

    // 3. Fallback to latest stream
    if (!stream) {
      stream = await prisma.liveStream.findFirst({
        where: { matchId },
        orderBy: { createdAt: 'desc' },
        include: {
          player: { select: { id: true, name: true, username: true, image: true } },
          team: { select: { id: true, name: true, tag: true, logo: true } },
          edition: { select: { id: true, title: true, number: true } },
        }
      });
    }

    if (!stream) {
      return { success: true, stream: null };
    }

    // Check if stream is expired
    const now = new Date();
    const isExpired = stream.expiresAt && new Date(stream.expiresAt) <= now;

    if (isExpired && stream.status !== 'EXPIRED') {
      // Auto mark expired in DB
      await prisma.liveStream.update({
        where: { id: stream.id },
        data: { status: 'EXPIRED' }
      });
      stream.status = 'EXPIRED';
    }

    return {
      success: true,
      stream,
      isExpired,
    };
  } catch (error: any) {
    console.error('Error fetching match live stream:', error);
    return { success: false, error: 'Failed to fetch match stream' };
  }
}

/**
 * Server Action for Admin to fetch all Live Streams
 */
export async function getAdminLiveStreamsAction() {
  noStore();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || ((session.user as any).role !== 'ORGANIZER' && (session.user as any).role !== 'SUPER_ADMIN')) {
      return { success: false, error: 'Unauthorized: Admin access required', streams: [] };
    }

    const streams = await prisma.liveStream.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        player: { select: { id: true, name: true, username: true } },
        team: { select: { id: true, name: true, tag: true } },
        edition: { select: { id: true, title: true, number: true } },
        match: { select: { id: true, round: true, matchNumber: true, status: true } },
      }
    });

    return { success: true, streams };
  } catch (error: any) {
    console.error('Error fetching admin live streams:', error);
    return { success: false, error: 'Failed to fetch streams', streams: [] };
  }
}

/**
 * Server Action for Public/Players to fetch all live and recorded match videos
 */
async function fetchPublicDaywiseVideos() {
  try {
    const matches = await prisma.match.findMany({
      orderBy: { scheduledTime: 'asc' },
      include: {
        edition: true,
        team1: true,
        team2: true,
        winner: true,
        liveStreams: {
          orderBy: { createdAt: 'desc' },
          include: {
            player: { select: { id: true, name: true, username: true, image: true } },
            team: { select: { id: true, name: true, tag: true, logo: true } },
          }
        }
      }
    });

    const streams = await prisma.liveStream.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        player: { select: { id: true, name: true, username: true, image: true } },
        team: { select: { id: true, name: true, tag: true, logo: true } },
        edition: { select: { id: true, title: true, number: true } },
        match: {
          include: {
            team1: true,
            team2: true,
            winner: true,
          }
        },
      }
    });

    return {
      success: true,
      matches,
      streams,
    };
  } catch (error: any) {
    console.error('Error fetching public daywise videos:', error);
    return { success: false, error: error.message || 'Failed to fetch match videos', matches: [], streams: [] };
  }
}

export async function getPublicDaywiseVideosAction() {
  return unstable_cache(fetchPublicDaywiseVideos, ['public-daywise-videos'], {
    revalidate: 300,
  })();
}

/**
 * Server Action for Admin to manually expire a stream
 */
export async function expireLiveStreamAction(streamId: string) {
  noStore();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || ((session.user as any).role !== 'ORGANIZER' && (session.user as any).role !== 'SUPER_ADMIN')) {
      return { success: false, error: 'Unauthorized' };
    }

    const updated = await prisma.liveStream.update({
      where: { id: streamId },
      data: {
        status: 'EXPIRED',
        expiresAt: new Date(),
      }
    });

    return { success: true, stream: updated };
  } catch (error: any) {
    console.error('Error expiring stream:', error);
    return { success: false, error: error?.message || 'Failed to expire stream' };
  }
}
