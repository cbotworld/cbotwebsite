import { NextRequest, NextResponse } from 'next/server';
import { userFromBearer } from '@/lib/mobile-session';

export const broadcastCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Key',
};

export function broadcastOptions() {
  return NextResponse.json({}, { headers: broadcastCorsHeaders });
}

export async function authorizeBroadcastRequest(request: NextRequest) {
  const appKey = process.env.APP_API_KEY;
  const headerKey = request.headers.get('X-App-Key');
  if (appKey && headerKey && headerKey === appKey) {
    return { ok: true as const };
  }

  const user = await userFromBearer(request);
  if (user) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    response: NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: broadcastCorsHeaders },
    ),
  };
}
