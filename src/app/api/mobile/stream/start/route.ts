import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stageConfigKey } from '@/lib/tournament-stages';

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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json().catch(() => ({}));
    const { matchId } = body;
    const requestedSlot = (body.slot || request.nextUrl.searchParams.get('slot') || '').trim().toUpperCase();
    const requestedEditionId = (body.editionId || request.nextUrl.searchParams.get('editionId') || '').trim() || undefined;
    const dayNumber = Number(body.dayNumber) || 1;

    // Direct Match Stream (by matchId)
    if (matchId && !matchId.startsWith('advance-')) {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { edition: true, team1: true, team2: true },
      });

      if (!match) {
        return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404, headers: corsHeaders });
      }

      // Check existing active stream
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
            dayNumber: existingStream.dayNumber || dayNumber,
            youtubeUrl: existingStream.youtubeUrl,
            youtubeVideoId: existingStream.youtubeVideoId,
            rtmpIngestionUrl: existingStream.rtmpIngestionUrl,
            streamKey: existingStream.streamKey,
            status: existingStream.status,
          },
        }, { headers: corsHeaders });
      }

      // Create new pending stream record
      return NextResponse.json({
        success: true,
        stream: {
          id: 'mobile-pending',
          matchId,
          dayNumber,
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
          dayNumber,
          playerName: user.name || user.username || 'Player',
          teamName: match.team1?.name || 'Team 1',
          opponentName: match.team2?.name || 'Team 2',
          isAdvancePlay: false,
        },
      }, { headers: corsHeaders });
    }

    // Advance Play Stream (by editionId or slot)
    let edition: any = null;
    if (requestedEditionId) {
      edition = await prisma.edition.findUnique({ where: { id: requestedEditionId } });
    } else if (requestedSlot === 'B') {
      edition = await prisma.edition.findFirst({ where: { slot: 'B' } });
    } else {
      edition = await prisma.edition.findFirst({ where: { slot: 'A', status: 'IN_PROGRESS' } });
    }

    if (!edition) {
      return NextResponse.json({ success: false, error: 'Edition not found' }, { status: 404, headers: corsHeaders });
    }

    let hasStages = false;
    const stageSetting = await prisma.systemSetting.findUnique({
      where: { key: stageConfigKey(edition.id) },
    });
    if (stageSetting?.value) {
      try {
        const parsed = JSON.parse(stageSetting.value);
        hasStages = Array.isArray(parsed?.stages) && parsed.stages.length > 0;
      } catch {}
    }

    if (!hasStages) {
      return NextResponse.json({
        success: false,
        error: 'Tournament stages and match schedules have not been configured for this edition yet.',
      }, { status: 400, headers: corsHeaders });
    }

    const participant = await prisma.editionParticipant.findFirst({
      where: { editionId: edition.id, userId },
      include: { team: true },
    });

    const isEnrolled = Boolean(
      participant &&
      (
        ['ENROLLED', 'QUALIFIED', 'REGISTERED'].includes(String(participant.status || '').toUpperCase()) ||
        ['PAID', 'VERIFIED', 'FREE', 'WAIVED'].includes(String(participant.paymentStatus || '').toUpperCase())
      )
    );

    if (!isEnrolled) {
      return NextResponse.json({
        success: false,
        error: 'Only enrolled players can go live for this edition. Please complete enrollment first.',
      }, { status: 403, headers: corsHeaders });
    }

    // Check existing active stream for this advance day
    const existingAdvanceStream = await prisma.liveStream.findFirst({
      where: {
        editionId: edition.id,
        playerId: userId,
        dayNumber,
        status: { in: ['CREATED', 'READY', 'LIVE'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingAdvanceStream) {
      return NextResponse.json({
        success: true,
        stream: {
          id: existingAdvanceStream.id,
          matchId: null,
          dayNumber: existingAdvanceStream.dayNumber || dayNumber,
          youtubeUrl: existingAdvanceStream.youtubeUrl,
          youtubeVideoId: existingAdvanceStream.youtubeVideoId,
          rtmpIngestionUrl: existingAdvanceStream.rtmpIngestionUrl,
          streamKey: existingAdvanceStream.streamKey,
          status: existingAdvanceStream.status,
        },
      }, { headers: corsHeaders });
    }

    return NextResponse.json({
      success: true,
      stream: {
        id: 'mobile-advance-pending',
        matchId: null,
        dayNumber,
        youtubeUrl: null,
        youtubeVideoId: null,
        rtmpIngestionUrl: 'rtmp://a.rtmp.youtube.com/live2',
        streamKey: null,
        status: 'READY',
      },
      matchDetails: {
        editionTitle: edition.title || 'Next Edition',
        editionNumber: edition.number || 0,
        matchId: null,
        dayNumber,
        playerName: user.name || user.username || 'Player',
        teamName: participant?.team?.name || 'TBD (Advance Play)',
        opponentName: 'TBD (Upcoming Opponent)',
        isAdvancePlay: true,
      },
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Mobile stream start error:', error);
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500, headers: corsHeaders });
  }
}
