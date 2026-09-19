import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveTeamFace } from '@/lib/team-identity';
import { stageConfigKey } from '@/lib/tournament-stages';
import { memoryCache } from '@/lib/memory-cache';

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

    const requestedSlot = (request.nextUrl.searchParams.get('slot') || '').trim().toUpperCase();
    const requestedEditionId = (request.nextUrl.searchParams.get('editionId') || '').trim() || undefined;

    const payload = await memoryCache.getOrSet(`mobile_matches_${userId}_${requestedSlot}_${requestedEditionId || 'none'}`, 15, async () => {
      let targetEdition: any = null;
      if (requestedEditionId) {
        targetEdition = await prisma.edition.findUnique({ where: { id: requestedEditionId } });
      } else if (requestedSlot === 'B') {
        targetEdition = await prisma.edition.findFirst({ where: { slot: 'B' } });
      }

    if (requestedSlot === 'B' || (targetEdition && targetEdition.slot === 'B')) {
      const edition = targetEdition || await prisma.edition.findFirst({ where: { slot: 'B' } });
      if (edition) {
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
          return {
            success: true,
            matches: [],
            isAdvancePlay: true,
            editionTitle: edition.title,
            message: 'No tournament stages scheduled yet.',
          };
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
          return {
            success: true,
            matches: [],
            isAdvancePlay: true,
            isEnrolled: false,
            editionTitle: edition.title,
            message: 'You are not enrolled in this edition yet.',
          };
        }

        const playerScores = await prisma.playerDayScore.findMany({
          where: { editionId: edition.id, userId },
          select: { dayNumber: true, score: true },
        });
        const submittedMap = new Map(playerScores.map((s) => [s.dayNumber, s.score]));

        // Generate advance day fixtures
        const totalDays = edition.totalDays || 10;
        const advanceMatches = [];
        for (let d = 1; d <= totalDays; d++) {
          const hasScore = submittedMap.has(d);
          advanceMatches.push({
            matchId: `advance-${edition.id}-day-${d}`,
            editionId: edition.id,
            editionTitle: edition.title || `Next Edition #${edition.number}`,
            editionNumber: edition.number,
            dayNumber: d,
            round: d,
            matchNumber: d,
            stage: `DAY ${d}`,
            playerName: user.name || user.username || 'Player',
            playerRole: user.role || 'PLAYER',
            teamName: participant?.team?.name || 'Your Team (TBD)',
            teamTag: participant?.team?.tag || 'TBD',
            teamLogo: participant?.team?.logo || null,
            opponentName: 'Opponent (TBD)',
            opponentTag: 'TBD',
            opponentLogo: null,
            score1: hasScore ? submittedMap.get(d) : 0,
            score2: 0,
            queenStrikes1: 0,
            queenStrikes2: 0,
            scheduledTime: null,
            tableNumber: 1,
            status: hasScore ? 'COMPLETED' : 'READY_TO_PLAY',
            isAdvancePlay: true,
          });
        }

        return {
          success: true,
          matches: advanceMatches,
          isAdvancePlay: true,
          editionTitle: edition.title,
        };
      }
    }

    // Find the player's teams via EditionParticipant
    const participations = await prisma.editionParticipant.findMany({
      where: { userId },
      select: { teamId: true, editionId: true },
    });

    const teamIds = participations.map(p => p.teamId).filter(Boolean) as string[];

    // If user is not yet assigned to a team, show recent scheduled matches so they can still test
    let matches: any[] = [];

    if (teamIds.length > 0) {
      matches = await prisma.match.findMany({
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
    }

    // Fallback: If no matches for player's specific team, fetch any active/scheduled matches
    if (matches.length === 0) {
      matches = await prisma.match.findMany({
        where: {
          status: { in: ['SCHEDULED', 'READY', 'LIVE', 'IN_PROGRESS'] },
        },
        include: {
          edition: true,
          team1: true,
          team2: true,
        },
        orderBy: { scheduledTime: 'desc' },
        take: 10,
      });
    }

    // Secondary fallback: get latest 10 matches of any status
    if (matches.length === 0) {
      matches = await prisma.match.findMany({
        include: {
          edition: true,
          team1: true,
          team2: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    }

    const formattedMatches = matches.map(match => {
      const isTeam1 = teamIds.includes(match.team1Id || '');
      const playerTeam = isTeam1 ? match.team1 : match.team2;
      const opponentTeam = isTeam1 ? match.team2 : match.team1;
      const mine = resolveTeamFace({
        id: playerTeam?.id,
        name: playerTeam?.name,
        tag: playerTeam?.tag,
        logo: playerTeam?.logo,
      });
      const opp = resolveTeamFace({
        id: opponentTeam?.id,
        name: opponentTeam?.name,
        tag: opponentTeam?.tag,
        logo: opponentTeam?.logo,
      });

      return {
        matchId: match.id,
        editionId: match.editionId,
        editionTitle: match.edition?.title || `CBOT Edition #${match.edition?.number || 1}`,
        editionNumber: match.edition?.number || 1,
        dayNumber: match.round || 1,
        round: match.round || 1,
        matchNumber: match.matchNumber || 1,
        stage: match.stage || 'LEAGUE',
        playerName: user.name || user.username || 'Player',
        playerRole: user.role || 'PLAYER',
        teamName: mine.name,
        teamTag: mine.tag,
        teamLogo: mine.logo,
        opponentName: opp.name,
        opponentTag: opp.tag,
        opponentLogo: opp.logo,
        score1: match.score1 || 0,
        score2: match.score2 || 0,
        queenStrikes1: match.queenStrikes1 || 0,
        queenStrikes2: match.queenStrikes2 || 0,
        scheduledTime: match.scheduledTime?.toISOString() || null,
        tableNumber: match.tableNumber || 1,
        status: match.status || 'SCHEDULED',
        isAdvancePlay: false,
      };
    });

    return { success: true, matches: formattedMatches };
    });

    return NextResponse.json(payload, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Mobile matches error:', error);
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500, headers: corsHeaders });
  }
}
