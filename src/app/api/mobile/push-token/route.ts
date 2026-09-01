import { NextRequest, NextResponse } from 'next/server';
import { mobileCorsHeaders } from '@/lib/mobile-cors';
import { userFromBearer } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: mobileCorsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: mobileCorsHeaders },
      );
    }

    const body = await request.json().catch(() => ({}));
    const token = String(body.token || '').trim();
    const platform = String(body.platform || 'android').toLowerCase().trim();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Push token is required' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }

    await prisma.userPushToken.upsert({
      where: { token },
      update: {
        userId: user.id,
        platform,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        token,
        platform,
      },
    });

    return NextResponse.json(
      { success: true, message: 'Push token registered successfully.' },
      { headers: mobileCorsHeaders },
    );
  } catch (error: any) {
    console.error('[PushToken] POST error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to save push token.' },
      { status: 500, headers: mobileCorsHeaders },
    );
  }
}
