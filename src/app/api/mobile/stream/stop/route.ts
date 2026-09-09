import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const RETENTION_DAYS = 15;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * Mobile App - Stop Stream Session
 * POST /api/mobile/stream/stop
 * Body: { streamId, videoUrl? }
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

    const { streamId, videoUrl } = await request.json();

    if (!streamId) {
      return NextResponse.json({ success: false, error: 'streamId is required' }, { status: 400, headers: corsHeaders });
    }

    let stream = await prisma.liveStream.findUnique({ where: { id: streamId } });

    if (!stream) {
      stream = await prisma.liveStream.findFirst({
        where: {
          playerId: userId,
          status: { in: ['CREATED', 'READY', 'LIVE'] }
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!stream) {
      return NextResponse.json({ success: true, message: 'Stream already ended.' }, { headers: corsHeaders });
    }

    const endedAt = new Date();
    const expiresAt = new Date(endedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

    await prisma.liveStream.update({
      where: { id: stream.id },
      data: {
        status: 'ARCHIVED',
        streamEndedAt: endedAt,
        recordedAt: endedAt,
        expiresAt,
        ...(videoUrl ? { youtubeUrl: videoUrl, youtubeEmbedUrl: videoUrl } : {}),
      },
    });

    if (stream.matchId) {
      await prisma.match.update({
        where: { id: stream.matchId },
        data: { status: 'COMPLETED' },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, message: 'Stream ended and match completed.' }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Mobile stream stop error:', error);
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500, headers: corsHeaders });
  }
}
