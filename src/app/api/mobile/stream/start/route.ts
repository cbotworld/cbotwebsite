import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Mobile App - Start Stream Session
 * POST /api/mobile/stream/start
 * Body: { matchId }
 * Headers: Authorization: Bearer <token>
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    let userId: string;
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      userId = decoded.split(':')[0];
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const { matchId } = await request.json();
    if (!matchId) {
      return NextResponse.json({ success: false, error: 'matchId is required' }, { status: 400 });
    }

    // Check if there is already an active stream for this match
    const existingStream = await prisma.liveStream.findFirst({
      where: {
        matchId,
        playerId: userId,
        status: { in: ['CREATED', 'READY', 'LIVE'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingStream) {
      return NextResponse.json({
        success: true,
        stream: {
          id: existingStream.id,
          matchId: existingStream.matchId,
          youtubeUrl: existingStream.youtubeUrl,
          youtubeVideoId: existingStream.youtubeVideoId,
          rtmpIngestionUrl: existingStream.rtmpIngestionUrl,
          streamKey: existingStream.streamKey,
          status: existingStream.status,
        },
      });
    }

    // Create a new stream session using the existing YouTube actions logic
    // Import and call createLiveStreamAction equivalent
    const { createLiveStreamAction } = await import('@/lib/actions/youtubeActions');

    // We need to simulate a session for the server action
    // For mobile, we'll directly create the stream
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        edition: true,
        participants: {
          include: { team: true, user: true }
        }
      }
    });

    if (!match) {
      return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 401 });
    }

    const playerParticipant = match.participants.find(p => p.userId === userId);
    const opponentParticipant = match.participants.find(p => p.userId !== userId);

    return NextResponse.json({
      success: true,
      stream: {
        id: 'mobile-pending',
        matchId: match.id,
        youtubeUrl: null,
        youtubeVideoId: null,
        rtmpIngestionUrl: 'rtmp://a.rtmp.youtube.com/live2',
        streamKey: null,
        status: 'READY',
      },
      matchDetails: {
        editionTitle: match.edition?.title || 'CBOT Edition',
        editionNumber: match.edition?.number || 0,
        matchId: match.id,
        playerName: user.name || 'Player',
        teamName: playerParticipant?.team?.name || 'Team 1',
        opponentName: opponentParticipant?.team?.name || 'Team 2',
      },
    });
  } catch (error: any) {
    console.error('Mobile stream start error:', error);
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 });
  }
}
