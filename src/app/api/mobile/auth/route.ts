import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { listCaptainDesks, listPlayerTeams } from '@/lib/mobile-team';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * Mobile App Authentication Endpoint
 * POST /api/mobile/auth
 * Body: { username, pin } or { email, pin }
 * Returns: { success, user, token }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, email, pin, password } = body;

    const rawInput = (username || email || '').trim();
    const inputPin = (pin || password || '').toString().trim();

    if (!rawInput || !inputPin) {
      return NextResponse.json(
        { success: false, error: 'Username/email and PIN are required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanInput = rawInput.toLowerCase().replace(/^@/, '').trim();
    const withAt = `@${cleanInput}`;

    // Find user by username (with or without @), email, or name
    let foundUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: cleanInput },
          { username: withAt },
          { username: rawInput },
          { email: rawInput.toLowerCase() },
          { email: cleanInput },
          { name: { equals: rawInput, mode: 'insensitive' } },
          { name: { equals: cleanInput, mode: 'insensitive' } },
        ],
      },
    });

    if (!foundUser) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or PIN.' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Check PIN matching exactly how src/lib/auth.ts does
    let isPinValid = false;
    if (!foundUser.pin) {
      // If user has no PIN assigned yet in DB, set their PIN to inputPin and log in
      try {
        const hashed = await bcrypt.hash(inputPin, 10);
        await prisma.user.update({
          where: { id: foundUser.id },
          data: { pin: hashed, isActivated: true },
        });
      } catch (e) {}
      isPinValid = true;
    } else {
      const storedPin = foundUser.pin.trim();
      if (storedPin.startsWith('$2a$') || storedPin.startsWith('$2b$')) {
        isPinValid = await bcrypt.compare(inputPin, storedPin);
      } else {
        // Direct string match for plain text 4-digit PINs
        isPinValid = inputPin === storedPin;
      }
    }

    if (!isPinValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or PIN.' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Auto-activate account on successful PIN authentication
    if (!foundUser.isActivated) {
      try {
        await prisma.user.update({
          where: { id: foundUser.id },
          data: { isActivated: true },
        });
      } catch (e) {}
    }

    // Generate token
    const token = Buffer.from(`${foundUser.id}:${Date.now()}`).toString('base64');

    const participation = await prisma.editionParticipant.findFirst({
      where: { userId: foundUser.id },
      include: { team: true },
      orderBy: { createdAt: 'desc' },
    });
    const [playerTeams, captainDesks] = await Promise.all([
      listPlayerTeams(foundUser.id),
      listCaptainDesks(foundUser.id),
    ]);
    const team = participation?.team || (playerTeams[0]
      ? { id: playerTeams[0].id, name: playerTeams[0].name, tag: playerTeams[0].tag, logo: playerTeams[0].logo }
      : null);

    return NextResponse.json(
      {
        success: true,
        user: {
          id: foundUser.id,
          name: foundUser.name || foundUser.username,
          username: foundUser.username,
          email: foundUser.email || '',
          role: foundUser.role,
          bio: foundUser.bio || '',
          city: foundUser.city || '',
          state: foundUser.state || '',
          country: foundUser.country || '',
          whatsApp: foundUser.whatsApp || '',
          age: foundUser.age ?? null,
          gender: foundUser.gender || '',
          image: foundUser.image || null,
          average: foundUser.average ?? 0,
          target: foundUser.target ?? 0,
          rating: foundUser.rating ?? 0,
          wins: 0,
          losses: 0,
          queenStrikes: foundUser.queenStrikes ?? 0,
          boardsWon: foundUser.boardsWon ?? 0,
        },
        team: team
          ? { id: team.id, name: team.name, tag: team.tag, logo: team.logo }
          : null,
        playerTeams,
        captainDesks,
        token,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Mobile auth error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error.' },
      { status: 500, headers: corsHeaders }
    );
  }
}
