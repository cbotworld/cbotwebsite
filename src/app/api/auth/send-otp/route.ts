import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mobileCorsHeaders } from '@/lib/mobile-cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: mobileCorsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Valid email address is required.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'This email address is already registered. Please log in.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Delete existing token if any
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });

    // Store new token
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: otp,
        expires,
      },
    });

    // Send OTP via Nodemailer SMTP
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || 'cbotworld@gmail.com';

    if (smtpHost && smtpUser && smtpPass) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:540px;margin:0 auto;background:#0f172a;color:#f8fafc;border-radius:16px;overflow:hidden;border:1px solid #334155;box-shadow:0 10px 25px rgba(0,0,0,0.3);">
    <div style="background:#020617;padding:24px 28px;text-align:center;border-bottom:1px solid #1e293b;">
      <h1 style="color:#f59e0b;margin:0;font-size:22px;letter-spacing:1px;">🎯 CBOT Email Verification</h1>
      <p style="color:#94a3b8;margin:6px 0 0;font-size:13px;">Carrom World Official Registration</p>
    </div>
    <div style="padding:28px;text-align:center;">
      <p style="font-size:15px;color:#cbd5e1;margin-top:0;">Hi <strong>${name || 'Player'}</strong>,</p>
      <p style="font-size:14px;color:#94a3b8;line-height:22px;">Use the 6-digit OTP code below to verify your email address and complete your CBOT player account registration.</p>
      
      <div style="background:#020617;border:2px dashed #f59e0b;border-radius:12px;padding:18px 24px;display:inline-block;margin:20px 0;">
        <span style="font-family:monospace;font-size:32px;font-weight:900;color:#f59e0b;letter-spacing:8px;">${otp}</span>
      </div>

      <p style="font-size:12px;color:#64748b;margin-bottom:0;">This OTP is valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
    </div>
    <div style="background:#020617;padding:16px 28px;border-top:1px solid #1e293b;text-align:center;">
      <p style="margin:0;color:#64748b;font-size:11px;">CBOT World · Connect Carrom Enthusiasts Worldwide</p>
    </div>
  </div>
</body>
</html>`;

      await transporter.sendMail({
        from: `"CBOT Account Verification" <${smtpFrom}>`,
        to: email,
        subject: `${otp} is your CBOT Email Verification Code`,
        html: htmlBody,
      });
    } else {
      console.warn('[SendOTP] SMTP environment variables missing. OTP code is:', otp);
    }

    return NextResponse.json(
      { success: true, message: `Verification OTP sent to ${email}` },
      { headers: mobileCorsHeaders },
    );
  } catch (error: any) {
    console.error('[SendOTP] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to send OTP.' },
      { status: 500, headers: mobileCorsHeaders },
    );
  }
}
