import { NextRequest, NextResponse } from 'next/server';
import { userFromBearer } from '@/lib/mobile-session';
import { mobileCorsHeaders } from '@/lib/mobile-cors';
import { resolveEditionAndTeam } from '@/lib/mobile-team';
import {
  getEditionProfileStatsForUser,
  getMyDayScoresForUser,
  getTeamDayScoresForActor,
  submitPlayerDayScoreForUser,
  submitTeamDayScoresForActor,
} from '@/lib/actions/playerScoreActions';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: mobileCorsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: mobileCorsHeaders });
    }
    const requestedDay = Number(request.nextUrl.searchParams.get('dayNumber') || '');
    const requestedTeamId = (request.nextUrl.searchParams.get('teamId') || '').trim() || undefined;
    const mine = await getMyDayScoresForUser(user.id);
    const { team } = await resolveEditionAndTeam(user.id, { teamId: requestedTeamId });
    let teammates: any[] = [];
    let teamScoreWindowOpen = false;
    const teamDay =
      Number.isInteger(requestedDay) && requestedDay > 0 ? requestedDay : mine.eligibleDay;
    if (team && team.captainId === user.id) {
      const teamScores = await getTeamDayScoresForActor(team.id, teamDay, user.id, false);
      teammates = teamScores.players || [];
      teamScoreWindowOpen = Boolean(teamScores.windowOpen);
    }
    const editionStats = await getEditionProfileStatsForUser(user.id);
    return NextResponse.json(
      {
        ...mine,
        success: true,
        teammates,
        teamId: team?.id || null,
        teamDayNumber: teamDay,
        teamScoreWindowOpen,
        editionStats,
      },
      { headers: mobileCorsHeaders },
    );
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
    const { team } = await resolveEditionAndTeam(user.id, {
      teamId: requestedTeamId || undefined,
    });

    if (Array.isArray(body.rows) && team && team.captainId === user.id) {
      const result = await submitTeamDayScoresForActor({
        actorId: user.id,
        isOrganiser: false,
        teamId: team.id,
        dayNumber: Number(body.dayNumber),
        rows: body.rows,
      });
      return NextResponse.json(result, { headers: mobileCorsHeaders });
    }

    const result = await submitPlayerDayScoreForUser(
      user.id,
      Number(body.dayNumber),
      body.score,
      body.slams,
      body.boards,
    );
    return NextResponse.json(result, { headers: mobileCorsHeaders });
  } catch (error: any) {
    console.error('Mobile scores POST', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed' }, { status: 500, headers: mobileCorsHeaders });
  }
}
