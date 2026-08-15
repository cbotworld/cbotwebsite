import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

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
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.slice(7);
    let userId: string;
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      userId = decoded.split(':')[0];
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401, headers: corsHeaders });
    }

    const { matchId } = await request.json();
    if (!matchId) {
      return NextResponse.json({ success: false, error: 'matchId is required' }, { status: 400, headers: corsHeaders });
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
      }, { headers: corsHeaders });
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        edition: true,
        team1: true,
        team2: true,
      },
    });

    if (!match) {
      return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404, headers: corsHeaders });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 401, headers: corsHeaders });
    }

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
        playerName: user.name || user.username || 'Player',
        teamName: match.team1?.name || 'Team 1',
        opponentName: match.team2?.name || 'Team 2',
      },
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Mobile stream start error:', error);
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500, headers: corsHeaders });
  }
}
