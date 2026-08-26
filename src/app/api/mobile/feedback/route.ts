import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { userFromBearer } from '@/lib/mobile-session';
import { mobileCorsHeaders } from '@/lib/mobile-cors';

export const dynamic = 'force-dynamic';

const KEY = 'mobile_app_feedback';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: mobileCorsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: mobileCorsHeaders });
    }
    const body = await request.json().catch(() => ({}));
    const message = String(body.message || '').trim().slice(0, 2000);
    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Please enter feedback.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }

    const existing = await prisma.systemSetting.findUnique({ where: { key: KEY } });
    let list: unknown[] = [];
    try {
      const parsed = existing?.value ? JSON.parse(existing.value) : [];
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = [];
    }
    list.unshift({
      at: new Date().toISOString(),
      userId: user.id,
      name: user.name || user.username || 'Player',
      message,
    });
    const value = JSON.stringify(list.slice(0, 400));
    await prisma.systemSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value },
      update: { value },
    });
    return NextResponse.json({ success: true }, { headers: mobileCorsHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Could not save feedback.' },
      { status: 500, headers: mobileCorsHeaders },
    );
  }
}
