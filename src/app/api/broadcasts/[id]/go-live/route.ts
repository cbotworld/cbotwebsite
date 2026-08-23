import { NextRequest, NextResponse } from 'next/server';
import { authorizeBroadcastRequest, broadcastCorsHeaders, broadcastOptions } from '@/lib/mobile-broadcast-auth';
import { transitionBroadcast } from '@/lib/youtube-live';
import { updateMobileLiveStreamStatus } from '@/lib/record-mobile-livestream';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function OPTIONS() {
  return broadcastOptions();
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeBroadcastRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Broadcast id is required.' }, { status: 400, headers: broadcastCorsHeaders });
    }
    await transitionBroadcast(id, 'live');
    try {
      await updateMobileLiveStreamStatus(id, 'LIVE');
    } catch (persistError) {
      console.error('Failed to mark mobile live stream LIVE:', persistError);
    }
    return NextResponse.json({ ok: true, status: 'live' }, { headers: broadcastCorsHeaders });
  } catch (error: any) {
    console.error('Go live error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to go live' },
      { status: 502, headers: broadcastCorsHeaders },
    );
  }
}
