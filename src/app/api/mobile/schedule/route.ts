import { NextRequest, NextResponse } from 'next/server';
import { userFromBearer } from '@/lib/mobile-session';
import { getPlayerMatchSchedule } from '@/lib/player-match-schedule';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/** Player match schedule for the Cbot app. Fixtures from organizer stages — not live-video DB. */
export async function GET(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const view = request.nextUrl.searchParams.get('view');
    const teamId = request.nextUrl.searchParams.get('teamId') || undefined;
    const editionSlotParam = request.nextUrl.searchParams.get('editionSlot')?.toUpperCase();
    const editionSlot = editionSlotParam === 'B' || editionSlotParam === 'A' ? (editionSlotParam as 'A' | 'B') : undefined;
    const editionId = request.nextUrl.searchParams.get('editionId') || undefined;
    const payload = await getPlayerMatchSchedule(user.id, {
      teamId,
      view: view === 'SPOC' || view === 'MAIN' ? view : undefined,
      editionSlot,
      editionId,
    });
    if (!payload) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 401, headers: corsHeaders });
    }

    return NextResponse.json({ success: true, ...payload }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Mobile schedule error:', error);
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500, headers: corsHeaders });
  }
}
