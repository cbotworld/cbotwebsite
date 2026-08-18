import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { userFromBearer } from '@/lib/mobile-session';
import { mobileCorsHeaders } from '@/lib/mobile-cors';

export const dynamic = 'force-dynamic';

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
    const currentPin = String(body.currentPin || body.oldPin || '').trim();
    const newPin = String(body.newPin || '').trim();

    if (!/^\d{4}$/.test(newPin)) {
      return NextResponse.json(
        { success: false, error: 'New PIN must be exactly 4 digits.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }
    if (!currentPin) {
      return NextResponse.json(
        { success: false, error: 'Enter your current PIN.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }
    if (currentPin === newPin) {
      return NextResponse.json(
        { success: false, error: 'New PIN must be different from your current PIN.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }

    const stored = (user.pin || '').trim();
    let valid = false;
    if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
      valid = await bcrypt.compare(currentPin, stored);
    } else {
      valid = currentPin === stored;
    }
    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'Current PIN is incorrect.' },
        { status: 401, headers: mobileCorsHeaders },
      );
    }

    const hashed = await bcrypt.hash(newPin, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { pin: hashed, isActivated: true },
    });

    return NextResponse.json(
      { success: true, message: 'PIN updated. Use the new PIN at next login.' },
      { headers: mobileCorsHeaders },
    );
  } catch (error: any) {
    console.error('Mobile PIN change:', error);
    return NextResponse.json({ success: false, error: 'Failed to update PIN.' }, { status: 500, headers: mobileCorsHeaders });
  }
}
