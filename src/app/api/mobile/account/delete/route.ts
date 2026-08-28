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
    const username = String(body.username || '').trim().toLowerCase();
    const pin = String(body.pin || '').trim();

    // Verify username matches
    if (!username || username !== (user.username || '').toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Username does not match your account.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }

    // Verify PIN
    if (!pin) {
      return NextResponse.json(
        { success: false, error: 'Enter your 4-digit PIN to confirm.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }
    const stored = (user.pin || '').trim();
    let pinValid = false;
    if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
      pinValid = await bcrypt.compare(pin, stored);
    } else {
      pinValid = pin === stored;
    }
    if (!pinValid) {
      return NextResponse.json(
        { success: false, error: 'Incorrect PIN. Account not deleted.' },
        { status: 401, headers: mobileCorsHeaders },
      );
    }

    // Guard: Organizers and super admins cannot self-delete
    if (user.role === 'SUPER_ADMIN' || user.role === 'ORGANIZER') {
      return NextResponse.json(
        { success: false, error: 'Organizer accounts cannot be self-deleted. Contact support.' },
        { status: 403, headers: mobileCorsHeaders },
      );
    }

    // Permanently delete user and all cascading data
    await prisma.$transaction(async (tx) => {
      const uid = user.id;
      // Remove from team captaincy (set captain to null)
      await tx.team.updateMany({ where: { captainId: uid }, data: { captainId: null } });
      // Delete all user-owned data
      await tx.playerDayScore.deleteMany({ where: { userId: uid } });
      await tx.playerAverageLog.deleteMany({ where: { userId: uid } });
      await tx.playerRankingSnapshot.deleteMany({ where: { userId: uid } });
      await tx.hallOfFame.deleteMany({ where: { userId: uid } });
      await tx.playerCategoryHistory.deleteMany({ where: { userId: uid } });
      await tx.liveStream.deleteMany({ where: { playerId: uid } });
      await tx.scoreReport.deleteMany({ where: { userId: uid } });
      await tx.matchLineupSlotPlayer.deleteMany({ where: { userId: uid } });
      await tx.spocTeamMember.deleteMany({ where: { userId: uid } });
      await tx.editionParticipant.deleteMany({ where: { userId: uid } });
      await tx.account.deleteMany({ where: { userId: uid } });
      await tx.session.deleteMany({ where: { userId: uid } });
      // Finally delete the user record
      await tx.user.delete({ where: { id: uid } });
    });

    return NextResponse.json(
      { success: true, message: 'Account permanently deleted.' },
      { headers: mobileCorsHeaders },
    );
  } catch (error: any) {
    console.error('Mobile account delete:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete account. Please try again.' },
      { status: 500, headers: mobileCorsHeaders },
    );
  }
}
