import { NextRequest, NextResponse } from 'next/server';
import { userFromBearer } from '@/lib/mobile-session';
import { mobileCorsHeaders } from '@/lib/mobile-cors';
import { resolveEditionAndTeam } from '@/lib/mobile-team';
import { resolvePlayerTournamentOptions } from '@/lib/current-edition';
import { memoryCache } from '@/lib/memory-cache';
import {
  getEditionProfileStatsForUser,
  getMyDayScoresForUser,
  getTeamDayScoresForActor,
  submitPlayerDayScoreForUser,
  submitTeamDayScoresForActor,
} from '@/lib/actions/playerScoreActions';
import { triggerPassiveNotificationHeartbeat } from '@/lib/notification-scheduler';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: mobileCorsHeaders });
}

export async function GET(request: NextRequest) {
  void triggerPassiveNotificationHeartbeat();
  try {
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: mobileCorsHeaders });
    }
    const requestedDay = Number(request.nextUrl.searchParams.get('dayNumber') || '');
    const requestedTeamId = (request.nextUrl.searchParams.get('teamId') || '').trim() || undefined;
    const requestedSlot = (request.nextUrl.searchParams.get('slot') || '').trim().toUpperCase() as 'A' | 'B' | '';
    const requestedEditionId = (request.nextUrl.searchParams.get('editionId') || '').trim() || undefined;
    const slot = requestedSlot === 'B' ? 'B' : requestedSlot === 'A' ? 'A' : undefined;

    const cacheKey = `mobile_scores_${user.id}_${slot || 'A'}_${requestedEditionId || 'cur'}_day${requestedDay || 0}`;
    const payload = await memoryCache.getOrSet(cacheKey, 60, async () => {
      const [mine, tournamentOptions] = await Promise.all([
        getMyDayScoresForUser(user.id, requestedEditionId, slot),
        resolvePlayerTournamentOptions(user.id),
      ]);

      const { team } = await resolveEditionAndTeam(user.id, {
        teamId: requestedTeamId,
        editionId: requestedEditionId || (slot === 'B' ? tournamentOptions.nextTournament?.id : tournamentOptions.currentTournament?.id),
      });

      let teammates: any[] = [];
      let teamScoreWindowOpen = false;
      const teamDay =
        Number.isInteger(requestedDay) && requestedDay > 0 ? requestedDay : mine.eligibleDay;
      if (team && team.captainId === user.id) {
        const teamScores = await getTeamDayScoresForActor(team.id, teamDay, user.id, false);
        teammates = teamScores.players || [];
        teamScoreWindowOpen = Boolean(teamScores.windowOpen);
      }
      const editionStats = await getEditionProfileStatsForUser(
        user.id,
        requestedEditionId || (slot === 'B' ? tournamentOptions.nextTournament?.id : tournamentOptions.currentTournament?.id),
      );
      return {
        ...mine,
        success: true,
        teammates,
        teamId: mine.teamId || team?.id || null,
        teamName: mine.teamName || team?.name || null,
        teamTag: mine.teamTag || team?.tag || null,
        teamDayNumber: teamDay,
        teamScoreWindowOpen,
        editionStats,
        tournaments: tournamentOptions,
        activeSlot: slot || (mine.isAdvancePlay ? 'B' : 'A'),
      };
    });

    return NextResponse.json(payload, { headers: mobileCorsHeaders });
  } catch (error: any) {
    console.error('Mobile scores GET', error);
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500, headers: mobileCorsHeaders });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: mobileCorsHeaders });
    }
    const body = await request.json().catch(() => ({}));
    const requestedTeamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';
    const requestedSlot = typeof body.slot === 'string' ? (body.slot.trim().toUpperCase() as 'A' | 'B') : undefined;
    const requestedEditionId = typeof body.editionId === 'string' ? body.editionId.trim() : undefined;

    const { team } = await resolveEditionAndTeam(user.id, {
      teamId: requestedTeamId || undefined,
      editionId: requestedEditionId,
    });

    if (Array.isArray(body.rows) && team && team.captainId === user.id) {
      const result = await submitTeamDayScoresForActor({
        actorId: user.id,
        isOrganiser: false,
        teamId: team.id,
        dayNumber: Number(body.dayNumber),
        rows: body.rows,
      });
      // Invalidate cached scores for this user so next GET is fresh
      memoryCache.invalidate(`mobile_scores_${user.id}`);
      return NextResponse.json(result, { headers: mobileCorsHeaders });
    }

    const result = await submitPlayerDayScoreForUser(
      user.id,
      Number(body.dayNumber),
      body.score,
      body.slams,
      body.boards,
      requestedEditionId,
      requestedSlot,
    );
    // Invalidate cached scores for this user so next GET is fresh
    memoryCache.invalidate(`mobile_scores_${user.id}`);
    return NextResponse.json(result, { headers: mobileCorsHeaders });
  } catch (error: any) {
    console.error('Mobile scores POST', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed' }, { status: 500, headers: mobileCorsHeaders });
  }
}
