import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Mobile App - Get Player's Matches
 * GET /api/mobile/matches
 * Headers: Authorization: Bearer <token>
 */
export async function GET(request: NextRequest) {
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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 401 });
    }

    // Find matches where this player is a participant
    const participants = await prisma.matchParticipant.findMany({
      where: { userId: userId },
      include: {
        match: {
          include: {
            edition: true,
            participants: {
              include: {
                team: true,
                user: true,
              }
            }
          }
        },
        team: true,
      },
      orderBy: { match: { scheduledAt: 'desc' } },
      take: 20,
    });

    const matches = participants.map(p => {
      const match = p.match;
      const playerTeam = p.team;
      const opponentParticipant = match.participants.find(mp => mp.userId !== userId);
      const opponentTeam = opponentParticipant?.team;

      return {
        matchId: match.id,
        editionTitle: match.edition?.title || 'CBOT Edition',
        editionNumber: match.edition?.number || 0,
        playerName: user.name || 'Player',
        teamName: playerTeam?.name || 'Team 1',
        teamLogo: playerTeam?.logo || null,
        opponentName: opponentTeam?.name || 'Opponent',
        opponentLogo: opponentTeam?.logo || null,
        scheduledTime: match.scheduledAt?.toISOString() || null,
        tableNumber: match.tableNumber || 1,
        status: match.status || 'SCHEDULED',
      };
    });

    return NextResponse.json({ success: true, matches });
  } catch (error: any) {
    console.error('Mobile matches error:', error);
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 });
  }
}
