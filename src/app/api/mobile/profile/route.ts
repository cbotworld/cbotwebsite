import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { userFromBearer } from '@/lib/mobile-session';
import { mobileCorsHeaders } from '@/lib/mobile-cors';

import { resolveEditionAndTeam } from '@/lib/mobile-team';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: mobileCorsHeaders });
}

function publicProfile(user: any, team: any) {
  return {
    user: {
      id: user.id,
      name: user.name || user.username || 'Player',
      username: user.username,
      role: user.role || 'PLAYER',
      email: user.email || '',
      bio: user.bio || '',
      city: user.city || '',
      address: user.address || '',
      pincode: user.pincode || '',
      state: user.state || '',
      country: user.country || '',
      whatsApp: user.whatsApp || '',
      age: user.age ?? null,
      gender: user.gender || '',
      image: user.image || null,
      average: user.average ?? 0,
      target: user.target ?? 0,
      rating: user.rating ?? 0,
      wins: 0,
      losses: 0,
      queenStrikes: user.queenStrikes ?? 0,
      boardsWon: user.boardsWon ?? 0,
      isActivated: Boolean(user.isActivated),
    },
    team: team
      ? {
          id: team.id,
          name: team.name,
          tag: team.tag,
          logo: team.logo,
          description: team.description || '',
          isCaptain: team.captainId === user.id,
        }
      : null,
  };
}

async function teamForUser(userId: string) {
  const { team } = await resolveEditionAndTeam(userId);
  return team;
}

export async function GET(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: mobileCorsHeaders });
    }
    const team = await teamForUser(user.id);
    const { getEditionProfileStatsForUser } = await import('@/lib/actions/playerScoreActions');
    const editionStats = await getEditionProfileStatsForUser(user.id);
    return NextResponse.json(
      { success: true, ...publicProfile(user, team), editionStats, averageHistory: editionStats.history || [] },
      { headers: mobileCorsHeaders },
    );
  } catch (error: any) {
    console.error('Mobile profile GET:', error);
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500, headers: mobileCorsHeaders });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: mobileCorsHeaders });
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;

    if (email) {
      const duplicate = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, NOT: { id: user.id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'Email is already in use by another account.' },
          { status: 400, headers: mobileCorsHeaders },
        );
      }
    }

    const ageRaw = body.age;
    const age =
      ageRaw === null || ageRaw === ''
        ? null
        : typeof ageRaw === 'number'
          ? ageRaw
          : typeof ageRaw === 'string' && ageRaw.trim()
            ? parseInt(ageRaw, 10)
            : undefined;

    const pincode = typeof body.pincode === 'string' ? body.pincode.replace(/\s/g, '') : undefined;
    const address = typeof body.address === 'string' ? body.address.trim() : undefined;
    if (body.address !== undefined && !address) {
      return NextResponse.json(
        { success: false, error: 'Please enter your full address.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }
    if (body.pincode !== undefined && !pincode) {
      return NextResponse.json(
        { success: false, error: 'Please enter your 6-digit pincode.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }
    if (pincode && !/^\d{6}$/.test(pincode)) {
      return NextResponse.json(
        { success: false, error: 'Pincode must be 6 digits.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.bio !== undefined && { bio: String(body.bio || '') || null }),
        ...(body.city !== undefined && { city: String(body.city || '') || null }),
        ...(body.address !== undefined && { address: address || null }),
        ...(body.pincode !== undefined && { pincode: pincode || null }),
        ...(body.state !== undefined && { state: String(body.state || '') || null }),
        ...(body.country !== undefined && { country: String(body.country || '') || null }),
        ...(body.whatsApp !== undefined && { whatsApp: String(body.whatsApp || '') || null }),
        ...(email !== undefined && { email: email || null }),
        ...(age !== undefined && { age: Number.isFinite(age) ? age : null }),
        ...(body.gender !== undefined && { gender: String(body.gender || '') || null }),
      },
    });

    const team = await teamForUser(updated.id);
    return NextResponse.json({ success: true, ...publicProfile(updated, team) }, { headers: mobileCorsHeaders });
  } catch (error: any) {
    console.error('Mobile profile PATCH:', error);
    return NextResponse.json({ success: false, error: 'Failed to save profile.' }, { status: 500, headers: mobileCorsHeaders });
  }
}
