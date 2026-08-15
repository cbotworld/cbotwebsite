import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * Mobile App Authentication Endpoint
 * POST /api/mobile/auth
 * Body: { username, pin } or { email, pin }
 * Returns: { success, user, token }
 * 
 * Note: CBOT uses username + PIN for auth, not email + password.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, email, pin, password } = body;

    // Accept either username or email, and either pin or password
    const loginId = username || email;
    const loginPin = pin || password;

    if (!loginId || !loginPin) {
      return NextResponse.json({ success: false, error: 'Username/email and PIN are required.' }, { status: 400 });
    }

    // Find user by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: loginId.toLowerCase().trim() },
          { email: loginId.toLowerCase().trim() },
        ],
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid username or PIN.' }, { status: 401 });
    }

    // Compare the PIN (stored as hashed)
    const isValid = await bcrypt.compare(loginPin.toString(), user.pin);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Invalid username or PIN.' }, { status: 401 });
    }

    if (!user.isActivated) {
      return NextResponse.json({ success: false, error: 'Your account is deactivated. Contact admin.' }, { status: 403 });
    }

    // Simple token: base64 of id:timestamp (in production, use JWT)
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error: any) {
    console.error('Mobile auth error:', error);
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 });
  }
}
