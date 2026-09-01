import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { mobileCorsHeaders } from '@/lib/mobile-cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: mobileCorsHeaders });
}

async function generateUniqueUsername(name: string): Promise<string> {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'player';
  let candidate = base;
  let attempts = 0;
  while (attempts < 20) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: candidate }, { username: `@${candidate}` }],
      },
    });
    if (!existing) return candidate;
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    candidate = `${base}${randomSuffix}`;
    attempts++;
  }
  return `${base}${Date.now().toString().slice(-4)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const otp = String(body.otp || '').trim();
    const name = String(body.name || '').trim();
    const mobile = String(body.mobile || '').trim();
    const pin = String(body.pin || '').trim();

    if (!email || !otp || !name || !pin) {
      return NextResponse.json(
        { success: false, error: 'Email, OTP, Name, and 4-digit PIN are required.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { success: false, error: 'PIN must be a 4-digit number.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }

    // Verify OTP against VerificationToken database table
    const tokenRecord = await prisma.verificationToken.findFirst({
      where: {
        identifier: email,
        token: otp,
        expires: { gt: new Date() },
      },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired OTP verification code. Please request a new code.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }

    // Delete used token
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });

    // Check if user email already exists (safety check)
    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Account already exists for this email address. Please log in.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }

    // Generate unique username & hash 4-digit PIN
    const username = await generateUniqueUsername(name);
    const hashedPin = await bcrypt.hash(pin, 10);

    // Create User record in PostgreSQL
    const createdUser = await prisma.user.create({
      data: {
        name,
        email,
        username,
        whatsApp: mobile || null,
        pin: hashedPin,
        role: 'PLAYER',
        isActivated: true,
        emailVerified: new Date(),
      },
    });

    // Send Welcome Email with Username & PIN to player's inbox
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || 'cbotworld@gmail.com';

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });

        const welcomeHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#0f172a;color:#f8fafc;border-radius:16px;overflow:hidden;border:1px solid #334155;box-shadow:0 10px 25px rgba(0,0,0,0.3);">
    <div style="background:#020617;padding:24px 28px;text-align:center;border-bottom:1px solid #1e293b;">
      <h1 style="color:#f59e0b;margin:0;font-size:24px;letter-spacing:1px;">🎉 Welcome to CBOT World!</h1>
      <p style="color:#94a3b8;margin:6px 0 0;font-size:13px;">Your Player Account Has Been Verified &amp; Created</p>
    </div>
    <div style="padding:28px;">
      <p style="font-size:15px;color:#cbd5e1;margin-top:0;">Hi <strong>${name}</strong>,</p>
      <p style="font-size:14px;color:#94a3b8;line-height:22px;">Thank you for creating your account! Below are your official login credentials. Please keep this email for your records.</p>
      
      <div style="background:#020617;border:1px solid #f59e0b;border-radius:12px;padding:20px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;color:#f8fafc;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#94a3b8;width:140px;">Unique Username:</td>
            <td style="padding:6px 0;font-family:monospace;font-weight:700;color:#f59e0b;font-size:16px;">${username}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#94a3b8;">Security PIN:</td>
            <td style="padding:6px 0;font-family:monospace;font-weight:700;color:#22c55e;font-size:16px;">${pin}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#94a3b8;">Registered Email:</td>
            <td style="padding:6px 0;color:#f8fafc;">${email}</td>
          </tr>
          ${mobile ? `
          <tr>
            <td style="padding:6px 0;color:#94a3b8;">Mobile / WhatsApp:</td>
            <td style="padding:6px 0;color:#f8fafc;">${mobile}</td>
          </tr>` : ''}
        </table>
      </div>

      <p style="font-size:13px;color:#94a3b8;line-height:20px;">You can use either your <strong>Username</strong> or <strong>Email</strong> along with your <strong>4-Digit PIN</strong> to log into the CBOT mobile app or website dashboard.</p>
    </div>
    <div style="background:#020617;padding:16px 28px;border-top:1px solid #1e293b;text-align:center;">
      <p style="margin:0;color:#64748b;font-size:11px;">CBOT World · cbotworld@gmail.com · Connect Carrom Enthusiasts Worldwide</p>
    </div>
  </div>
</body>
</html>`;

        await transporter.sendMail({
          from: `"CBOT World" <${smtpFrom}>`,
          to: email,
          subject: `🎉 Account Created — Your CBOT Login Credentials (${username})`,
          html: welcomeHtml,
        });
      } catch (emailErr) {
        console.warn('[VerifyOTP] Welcome email sending failed:', emailErr);
      }
    }

    const token = Buffer.from(`${createdUser.id}:${Date.now()}`).toString('base64');

    return NextResponse.json(
      {
        success: true,
        message: 'Account created successfully!',
        token,
        username,
        pin,
        user: {
          id: createdUser.id,
          name: createdUser.name,
          username: createdUser.username,
          email: createdUser.email,
          role: createdUser.role,
          whatsApp: createdUser.whatsApp || '',
        },
      },
      { headers: mobileCorsHeaders },
    );
  } catch (error: any) {
    console.error('[VerifyOTP] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to verify OTP and create account.' },
      { status: 500, headers: mobileCorsHeaders },
    );
  }
}
