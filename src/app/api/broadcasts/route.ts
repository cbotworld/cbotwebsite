import { NextRequest, NextResponse } from 'next/server';
import { authorizeBroadcastRequest, broadcastCorsHeaders, broadcastOptions } from '@/lib/mobile-broadcast-auth';
import { createLiveSession } from '@/lib/youtube-live';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function OPTIONS() {
  return broadcastOptions();
}

/** Create a YouTube live broadcast + RTMP key for the Cbot app. Does not store live-video rows. */
export async function POST(request: NextRequest) {
  const auth = await authorizeBroadcastRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const day = typeof body.day === 'string' ? body.day.trim() : '';
    if (!name || !day) {
      return NextResponse.json(
        { error: 'Both name and day are required.' },
        { status: 400, headers: broadcastCorsHeaders },
      );
    }

    const session = await createLiveSession(name, day);
    return NextResponse.json(
      {
        ...session,
        rtmpUrl: `${session.ingestionAddress}/${session.streamName}`,
      },
      { headers: broadcastCorsHeaders },
    );
  } catch (error: any) {
    console.error('Create broadcast error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create broadcast' },
      { status: 502, headers: broadcastCorsHeaders },
    );
  }
}
