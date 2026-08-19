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
 * Server Action to initialize a live stream for a match.
 * Performs strict authentication and authorization checks.
 */
export async function createLiveStreamAction(matchId: string, replayComment?: string, deviceSessionId?: string) {
  noStore();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return { success: false, error: 'Unauthorized: Please log in to stream.' };
    }

    const userId = (session.user as any).id;
    const userName = (session.user as any).name || session.user.email || 'Player';

    // 1. Fetch match details with team & edition information
    let match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        edition: true,
        team1: {
          include: {
            captain: true,
            members: true,
          }
        },
        team2: {
          include: {
            captain: true,
            members: true,
          }
        },
      }
    });

    if (!match) {
      // Find active edition
      let activeEdition = await prisma.edition.findFirst({ orderBy: { number: 'desc' } });
      if (!activeEdition) {
        const orgUser = await prisma.user.findFirst({ where: { role: { in: ['ORGANIZER', 'SUPER_ADMIN'] } } });
        activeEdition = await prisma.edition.create({
          data: {
            number: 200,
            title: 'Cornerstones of Carrom',
            slug: 'cornerstones-of-carrom',
            theme: '200th Edition',
            organizerId: orgUser?.id || userId,
          }
        });
      }

      // Find user's participant team
      const participant = await prisma.editionParticipant.findFirst({
        where: { userId, editionId: activeEdition.id },
        include: { team: true }
      });

      let team1Id = participant?.teamId || null;
      let team2Id = null;
      let roundNum = 4;
      let scheduledTime = new Date();

      // Check if it is a monument match
      const monMatch = matchId.match(/monument_(\d+)/i);
      if (monMatch && participant?.team) {
        const monNum = parseInt(monMatch[1], 10);
        roundNum = monNum;
        
        const monuments = [
          { num: 1, startIso: '2026-08-09T21:00:00+05:30', matches: [{ t1: 'PLYWOOD PIONEERS', t2: 'SUPERNOVA QUEEN' }, { t1: 'POCKET DYNAMOS', t2: 'LUMEN PILLAR' }, { t1: 'VANILLA FALCONS', t2: 'VINTAGE STRIKERS' }, { t1: 'EBONY OVERLORDS', t2: 'BORIC SPEEDSTERS' }] },
          { num: 2, startIso: '2026-08-10T20:00:00+05:30', matches: [{ t1: 'PLYWOOD PIONEERS', t2: 'VINTAGE STRIKERS' }, { t1: 'LUMEN PILLAR', t2: 'BORIC SPEEDSTERS' }, { t1: 'SUPERNOVA QUEEN', t2: 'EBONY OVERLORDS' }, { t1: 'POCKET DYNAMOS', t2: 'VANILLA FALCONS' }] },
          { num: 3, startIso: '2026-08-11T20:00:00+05:30', matches: [{ t1: 'PLYWOOD PIONEERS', t2: 'EBONY OVERLORDS' }, { t1: 'BORIC SPEEDSTERS', t2: 'VANILLA FALCONS' }, { t1: 'VINTAGE STRIKERS', t2: 'POCKET DYNAMOS' }, { t1: 'LUMEN PILLAR', t2: 'SUPERNOVA QUEEN' }] },
          { num: 4, startIso: '2026-08-12T20:00:00+05:30', matches: [{ t1: 'PLYWOOD PIONEERS', t2: 'VANILLA FALCONS' }, { t1: 'EBONY OVERLORDS', t2: 'POCKET DYNAMOS' }, { t1: 'BORIC SPEEDSTERS', t2: 'SUPERNOVA QUEEN' }, { t1: 'VINTAGE STRIKERS', t2: 'LUMEN PILLAR' }] },
          { num: 5, startIso: '2026-08-13T20:00:00+05:30', matches: [{ t1: 'PLYWOOD PIONEERS', t2: 'LUMEN PILLAR' }, { t1: 'SUPERNOVA QUEEN', t2: 'VINTAGE STRIKERS' }, { t1: 'POCKET DYNAMOS', t2: 'BORIC SPEEDSTERS' }, { t1: 'VANILLA FALCONS', t2: 'EBONY OVERLORDS' }] },
          { num: 6, startIso: '2026-08-14T20:00:00+05:30', matches: [{ t1: 'PLYWOOD PIONEERS', t2: 'BORIC SPEEDSTERS' }, { t1: 'VINTAGE STRIKERS', t2: 'EBONY OVERLORDS' }, { t1: 'LUMEN PILLAR', t2: 'VANILLA FALCONS' }, { t1: 'SUPERNOVA QUEEN', t2: 'POCKET DYNAMOS' }] },
          { num: 7, startIso: '2026-08-15T20:00:00+05:30', matches: [{ t1: 'PLYWOOD PIONEERS', t2: 'POCKET DYNAMOS' }, { t1: 'VANILLA FALCONS', t2: 'SUPERNOVA QUEEN' }, { t1: 'EBONY OVERLORDS', t2: 'LUMEN PILLAR' }, { t1: 'BORIC SPEEDSTERS', t2: 'VINTAGE STRIKERS' }] },
        ];
        
        const currentMon = monuments.find(m => m.num === monNum);
        if (currentMon) {
          scheduledTime = new Date(currentMon.startIso);
          const teamNameUpper = participant.team.name.toUpperCase().trim();
          const fix = currentMon.matches.find(
            f => f.t1.toUpperCase() === teamNameUpper || f.t2.toUpperCase() === teamNameUpper
          );
          if (fix) {
            const oppName = fix.t1.toUpperCase() === teamNameUpper ? fix.t2 : fix.t1;
            const dbOppTeam = await prisma.team.findFirst({
              where: { 
                editionId: activeEdition.id,
                name: { equals: oppName, mode: 'insensitive' }
              }
            });
            if (dbOppTeam) {
              const dbT1 = await prisma.team.findFirst({
                where: {
                  editionId: activeEdition.id,
                  name: { equals: fix.t1, mode: 'insensitive' }
                }
              });
              const dbT2 = await prisma.team.findFirst({
                where: {
                  editionId: activeEdition.id,
                  name: { equals: fix.t2, mode: 'insensitive' }
                }
              });
              if (dbT1 && dbT2) {
                team1Id = dbT1.id;
                team2Id = dbT2.id;
              }
            }
          }
        }
      }

      if (!team1Id || !team2Id) {
        const otherTeam = await prisma.team.findFirst({
          where: participant?.teamId ? { NOT: { id: participant.teamId } } : {}
        });
        team1Id = participant?.teamId || otherTeam?.id || null;
        team2Id = otherTeam?.id || team1Id || null;
      }

      if (team1Id && team2Id) {
        match = await prisma.match.create({
          data: {
            id: matchId,
            editionId: activeEdition.id,
            team1Id,
            team2Id,
            status: 'LIVE',
            scheduledTime,
            tableNumber: 1,
            matchNumber: 1,
            round: roundNum,
          },
          include: {
            edition: true,
            team1: { include: { captain: true, members: true } },
            team2: { include: { captain: true, members: true } },
          }
        });
      }
    }

    if (!match) {
      return { success: false, error: 'Match not found.' };
    }

    // 2. Authorization check: User must be in team1, team2, or be organizer/admin
    const isTeam1Member = match.team1?.members?.some((m) => m.userId === userId) || match.team1?.captainId === userId;
    const isTeam2Member = match.team2?.members?.some((m) => m.userId === userId) || match.team2?.captainId === userId;
    const isOrganizer = (session.user as any).role === 'ORGANIZER' || (session.user as any).role === 'SUPER_ADMIN';

    if (!isTeam1Member && !isTeam2Member && !isOrganizer) {
      return { success: false, error: 'Unauthorized: You are not an assigned player in this match.' };
    }

    // Determine player's team
    const playerTeamId = isTeam1Member ? match.team1Id : isTeam2Member ? match.team2Id : match.team1Id;
    const playerTeamName = isTeam1Member ? match.team1?.name : isTeam2Member ? match.team2?.name : 'Team';
    const opponentTeamName = isTeam1Member ? (match.team2?.name || 'Opponent') : (match.team1?.name || 'Opponent');

    // 3. Block simultaneous live streams: Player cannot go live in multiple matches at once
    const activeStreamElsewhere = await prisma.liveStream.findFirst({
      where: {
        playerId: userId,
        status: 'LIVE',
        NOT: { matchId }
      }
    });

    if (activeStreamElsewhere) {
      return {
        success: false,
        error: `You are already live in another match (#${activeStreamElsewhere.matchId}). Please end your active broadcast before starting a new one.`
      };
    }

    // 4. Max 8 Stream Attempts Limit per player for this match
    const previousAttemptsCount = await prisma.liveStream.count({
      where: {
        matchId,
        playerId: userId,
        status: { in: ['ARCHIVED', 'LIVE'] }
      }
    });

    const existingActiveStream = await prisma.liveStream.findFirst({
      where: {
        matchId,
        playerId: userId,
        status: { in: ['CREATED', 'READY', 'LIVE'] }
      }
    });

    // 5. Block simultaneous live stream on another device for the same match
    if (existingActiveStream && existingActiveStream.status === 'LIVE' && deviceSessionId && existingActiveStream.streamKey) {
      const isDifferentDevice = existingActiveStream.streamKey !== deviceSessionId;
      const isRecentlyStarted = existingActiveStream.streamStartedAt && (Date.now() - new Date(existingActiveStream.streamStartedAt).getTime() < 90 * 60 * 1000);
      if (isDifferentDevice && isRecentlyStarted) {
        return {
          success: false,
          error: '🔒 Active on Another Device: This match is currently being streamed from another phone/device. Simultaneous streaming from two devices is not permitted.'
        };
      }
    }

    if (!existingActiveStream && previousAttemptsCount >= 8) {
      return {
        success: false,
        error: 'Maximum stream attempts reached (8/8). Each player is permitted a maximum of 8 live stream attempts per match.'
      };
    }

    // If an active stream already exists for this match, return it
    if (existingActiveStream) {
      if (replayComment) {
        await prisma.liveStream.update({
          where: { id: existingActiveStream.id },
          data: { failureReason: `REPLAY_REASON: ${replayComment}` }
        }).catch(() => {});
      }
      return {
        success: true,
        stream: existingActiveStream,
        attemptsCount: Math.min(8, previousAttemptsCount + 1),
        matchDetails: {
          editionTitle: match.edition?.title || 'Edition #200',
          editionNumber: match.edition?.number || 200,
          matchId: match.id,
          playerName: userName,
          teamName: playerTeamName,
          opponentName: opponentTeamName,
        }
      };
    }

    const { googleClientId, googleClientSecret, googleRefreshToken } = await getYouTubeOAuthCredentials();

    let youtubeBroadcastId: string | null = null;
    let youtubeStreamId: string | null = null;
    let youtubeVideoId: string | null = null;
    let youtubeUrl: string | null = null;
    let youtubeEmbedUrl: string | null = null;
    let rtmpIngestionUrl: string | null = null;
    let streamKey: string | null = null;

    if (googleClientId && googleClientSecret && googleRefreshToken) {
      try {
        // Exchange refresh token for access token server-side
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
          // Construct YouTube broadcast title (strictly max 100 characters allowed by YouTube API)
          const rawTitle = `CBOT ${match.edition?.title || 'Edition #200'} - ${match.id} - ${userName} (${playerTeamName}) vs ${opponentTeamName}`;
          const safeTitle = rawTitle.length > 95 ? rawTitle.slice(0, 92) + '...' : rawTitle;

          // 1) Insert Live Broadcast
          const broadcastRes = await fetch('https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              snippet: {
                title: safeTitle,
                description: `Official CBOT Match Stream\nPlayer: ${userName}\nTeam: ${playerTeamName}\nOpponent: ${opponentTeamName}\nWatch live at https://www.cbotworld.com/`,
                scheduledStartTime: new Date().toISOString(),
              },
              status: {
                privacyStatus: 'unlisted',
                selfDeclaredMadeForKids: false,
                embeddable: true,
              },
              contentDetails: {
                enableAutoStart: true,
                enableAutoStop: true,
                enableEmbed: true,
                enableDvr: true,
                recordFromStart: true,
              }
            }),
          });

          const broadcastData = await broadcastRes.json();
          if (broadcastData.id) {
            youtubeBroadcastId = broadcastData.id;
            youtubeVideoId = broadcastData.id;
            youtubeUrl = `https://www.youtube.com/watch?v=${broadcastData.id}`;
            youtubeEmbedUrl = `https://www.youtube.com/embed/${broadcastData.id}?autoplay=1&live=1`;
          } else {
            console.error('YouTube liveBroadcasts insert failed:', broadcastData);
          }

          // 2) Insert Live Stream
          const streamRes = await fetch('https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              snippet: { title: `CBOT Stream - ${match.id} - ${userName}` },
              cdn: {
                ingestionType: 'rtmp',
                resolution: '720p',
                frameRate: '30fps',
              }
            }),
          });

          const streamData = await streamRes.json();
          if (streamData.id) {
            youtubeStreamId = streamData.id;
            rtmpIngestionUrl = streamData.cdn?.ingestionInfo?.ingestionAddress || 'rtmp://a.rtmp.youtube.com/live2';
            streamKey = streamData.cdn?.ingestionInfo?.streamName || null;
          }

          // 3) Bind Broadcast to Stream
          if (youtubeBroadcastId && youtubeStreamId) {
            await fetch(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${youtubeBroadcastId}&streamId=${youtubeStreamId}&part=id`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${accessToken}` },
            });
          }
        }
      } catch (ytErr) {
        console.error('Server-side YouTube API exception:', ytErr);
      }
    }

    // Fallback URL generation if YouTube API keys are pending
    if (!youtubeBroadcastId) {
      const generatedId = `cbot_yt_${match.id.toLowerCase()}_${Date.now().toString(36)}`;
      youtubeBroadcastId = generatedId;
      youtubeVideoId = generatedId;
      youtubeUrl = `https://www.youtube.com/watch?v=${generatedId}`;
      youtubeEmbedUrl = `https://www.youtube.com/embed/${generatedId}?autoplay=1&live=1`;
      rtmpIngestionUrl = 'rtmp://a.rtmp.youtube.com/live2';
      streamKey = `cbot-key-${match.id}-${userId}`;
    }

    // 5. Create LiveStream record in Prisma DB
    const newStream = await prisma.liveStream.create({
      data: {
        editionId: match.editionId,
        matchId: match.id,
        playerId: userId,
        teamId: playerTeamId,
        youtubeBroadcastId,
        youtubeStreamId,
        youtubeVideoId,
        youtubeUrl,
        youtubeEmbedUrl,
        rtmpIngestionUrl,
        streamKey,
        status: 'READY',
        scheduledAt: new Date(),
        failureReason: replayComment ? `REPLAY_REASON: ${replayComment}` : null,
      }
    });

    // Update match status to READY or LIVE if needed
    await prisma.match.update({
      where: { id: match.id },
      data: { status: 'READY' }
    });

    return {
      success: true,
      stream: newStream,
      matchDetails: {
        editionTitle: match.edition?.title || 'Edition #200',
        editionNumber: match.edition?.number || 200,
        matchId: match.id,
        playerName: userName,
        teamName: playerTeamName || 'Team 1',
        opponentName: opponentTeamName || 'Team 2',
      }
    };
  } catch (error: any) {
    console.error('Failed to create live stream action:', error);
    return { success: false, error: error?.message || 'Server error creating live stream.' };
  }
}

/**
 * Server Action to start streaming (transitions status from READY -> LIVE)
 */
export async function startLiveStreamAction(streamId: string, deviceSessionId?: string) {
  noStore();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return { success: false, error: 'Unauthorized' };
    }

    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId }
    });

    if (!stream) {
      return { success: false, error: 'Live stream not found.' };
    }

    // Check if another device is already live
    if (stream.status === 'LIVE' && stream.streamKey && deviceSessionId && stream.streamKey !== deviceSessionId) {
      const isRecentlyStarted = stream.streamStartedAt && (Date.now() - new Date(stream.streamStartedAt).getTime() < 90 * 60 * 1000);
      if (isRecentlyStarted) {
        return {
          success: false,
          error: '🔒 Active on Another Device: This match is already live on your other device.'
        };
      }
    }

    const updatedStream = await prisma.liveStream.update({
      where: { id: streamId },
      data: {
        status: 'LIVE',
        streamStartedAt: stream.streamStartedAt || new Date(),
        ...(deviceSessionId ? { streamKey: deviceSessionId } : {}),
      }
    });

    // Mark Match as LIVE in DB
    await prisma.match.update({
      where: { id: stream.matchId },
      data: { status: 'LIVE' }
    });

    return { success: true, stream: updatedStream };
  } catch (error: any) {
    console.error('Failed to start live stream:', error);
    return { success: false, error: error?.message || 'Error starting live stream' };
  }
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
