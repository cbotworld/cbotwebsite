'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { unstable_noStore as noStore } from 'next/cache';

const RETENTION_DAYS = 15;

/**
 * Server Action to initialize a live stream for a match.
 * Performs strict authentication and authorization checks.
 */
export async function createLiveStreamAction(matchId: string, replayComment?: string) {
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
      return { success: false, error: 'Unable to initialize match stream session.' };
    }

    // 2. Verify authorization: player must belong to team1, team2, or be captain/organizer
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

    // 3. Check for an ACTIVE stream for this match (block duplicate live starts, allow replays)
    const existingActiveStream = await prisma.liveStream.findFirst({
      where: {
        matchId,
        playerId: userId,
        status: { in: ['CREATED', 'READY', 'LIVE'] }
      }
    });

    // If an active stream already exists (not a replay), return it UNLESS it was a mock sandbox stream
    if (existingActiveStream && !replayComment) {
      if (existingActiveStream.youtubeVideoId?.startsWith('cbot_yt_') || existingActiveStream.youtubeBroadcastId?.startsWith('cbot_yt_')) {
        await prisma.liveStream.delete({ where: { id: existingActiveStream.id } }).catch(() => {});
      } else {
        return {
          success: true,
          stream: existingActiveStream,
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
    }

    // 4. Create YouTube Broadcast Resources or CBOT Stream Identifier
    // Check if official Google OAuth credentials exist in environment or Database
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
              },
              contentDetails: {
                enableAutoStart: true,
                enableAutoStop: true,
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
        // Store replay reason if this is a replay stream
        ...(replayComment ? { streamNotes: `REPLAY: ${replayComment}` } : {}),
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
export async function startLiveStreamAction(streamId: string) {
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

    const updatedStream = await prisma.liveStream.update({
      where: { id: streamId },
      data: {
        status: 'LIVE',
        streamStartedAt: new Date(),
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
export async function stopLiveStreamAction(streamId: string, recordedVideoUrl?: string) {
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
    // Expiry = EndedAt + 15 days
    const expiresAt = new Date(endedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

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

    // Mark match as COMPLETED if needed
    await prisma.match.update({
      where: { id: stream.matchId },
      data: { status: 'COMPLETED' }
    }).catch(() => {});

    // Transition YouTube Live Broadcast to complete on YouTube if applicable
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

    return { success: true, stream: updatedStream };
  } catch (error: any) {
    console.error('Failed to stop live stream:', error);
    return { success: false, error: error?.message || 'Error stopping stream' };
  }
}

/**
 * Server Action to get live stream info for a match
 */
export async function getMatchLiveStreamAction(matchId: string) {
  noStore();
  try {
    const stream = await prisma.liveStream.findFirst({
      where: { matchId },
      orderBy: { createdAt: 'desc' },
      include: {
        player: { select: { id: true, name: true, username: true, image: true } },
        team: { select: { id: true, name: true, tag: true, logo: true } },
        edition: { select: { id: true, title: true, number: true } },
      }
    });

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
