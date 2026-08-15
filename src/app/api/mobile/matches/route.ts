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
 * Mobile App - Get Player's Matches
 * GET /api/mobile/matches
 * Headers: Authorization: Bearer <token>
 */
export async function GET(request: NextRequest) {
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

    // Find the player's teams via EditionParticipant
    const participations = await prisma.editionParticipant.findMany({
      where: { userId },
      select: { teamId: true, editionId: true },
    });

    const teamIds = participations.map(p => p.teamId).filter(Boolean) as string[];

    if (teamIds.length === 0) {
      return NextResponse.json({ success: true, matches: [] }, { headers: corsHeaders });
    }

    // Find matches where this player's team is team1 or team2
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { team1Id: { in: teamIds } },
          { team2Id: { in: teamIds } },
        ],
      },
      include: {
        edition: true,
        team1: true,
        team2: true,
      },
      orderBy: { scheduledTime: 'desc' },
      take: 20,
    });

    const formattedMatches = matches.map(match => {
      const isTeam1 = teamIds.includes(match.team1Id || '');
      const playerTeam = isTeam1 ? match.team1 : match.team2;
      const opponentTeam = isTeam1 ? match.team2 : match.team1;

      return {
        matchId: match.id,
        editionTitle: match.edition?.title || 'CBOT Edition',
        editionNumber: match.edition?.number || 0,
        playerName: user.name || user.username || 'Player',
        teamName: playerTeam?.name || 'My Team',
        teamLogo: playerTeam?.logo || null,
        opponentName: opponentTeam?.name || 'Opponent',
        opponentLogo: opponentTeam?.logo || null,
        scheduledTime: match.scheduledTime?.toISOString() || null,
        tableNumber: match.tableNumber || 1,
        status: match.status || 'SCHEDULED',
      };
    });

    return NextResponse.json({ success: true, matches: formattedMatches }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Mobile matches error:', error);
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500, headers: corsHeaders });
  }
}
