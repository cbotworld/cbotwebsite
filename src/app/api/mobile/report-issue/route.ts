import { NextRequest, NextResponse } from 'next/server';
import { mobileCorsHeaders } from '@/lib/mobile-cors';
import { userFromBearer } from '@/lib/mobile-session';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function getNextTicketNumber(): Promise<string> {
  const KEY = 'cbot_ticket_counter';
  let counter = 1;
  try {
    const existing = await prisma.systemSetting.findUnique({ where: { key: KEY } });
    if (existing?.value) {
      const val = parseInt(existing.value, 10);
      if (!isNaN(val) && val > 0) {
        counter = val + 1;
      }
    }
    await prisma.systemSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: String(counter) },
      update: { value: String(counter) },
    });
  } catch (err) {
    console.warn('[ReportIssue] Error updating ticket counter in db:', err);
  }
  const padded = String(counter).padStart(4, '0');
  return `CBOT-${padded}`;
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: mobileCorsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    // Try to get the logged-in user (optional — guest users are also allowed)
    const user = await userFromBearer(request).catch(() => null);

    let name: string;
    let email: string;
    let comment: string;
    let imageBase64: string | null = null;
    let imageMime: string = 'image/jpeg';
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

    const reqContentType = request.headers.get('content-type') || '';

    if (reqContentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      name = String(formData.get('name') || user?.name || '').trim();
      email = String(formData.get('email') || user?.email || '').trim();
      comment = String(formData.get('comment') || '').trim().slice(0, 3000);

      const files = [...formData.getAll('image'), ...formData.getAll('images')];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file && file instanceof Blob && file.size > 0) {
          const mime = file.type || 'image/jpeg';
          const ext = mime.includes('png') ? 'png' : 'jpg';
          const buf = Buffer.from(await file.arrayBuffer());
          attachments.push({
            filename: `screenshot_${i + 1}.${ext}`,
            content: buf,
            contentType: mime,
          });
        }
      }
    } else {
      // JSON fallback (no image)
      const body = await request.json().catch(() => ({}));
      name = String(body.name || user?.name || '').trim();
      email = String(body.email || user?.email || '').trim();
      comment = String(body.comment || body.message || '').trim().slice(0, 3000);
    }

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }
    if (!comment) {
      return NextResponse.json(
        { success: false, error: 'Please describe the issue.' },
        { status: 400, headers: mobileCorsHeaders },
      );
    }

    const ticketNumber = await getNextTicketNumber();
    const submittedAt = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || 'cbotworld@gmail.com';
    const supportEmail = 'cbotworld@gmail.com';

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error('[ReportIssue] SMTP env vars not set');
      return NextResponse.json(
        { success: false, error: 'Email service not configured.' },
        { status: 500, headers: mobileCorsHeaders },
      );
    }

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const isLoggedIn = Boolean(user);
    const userBadge = isLoggedIn
      ? `<span style="background:#f59e0b;color:#000;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">LOGGED IN</span>`
      : `<span style="background:#64748b;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">GUEST</span>`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#020617;padding:24px 28px;">
      <h1 style="color:#f59e0b;margin:0;font-size:22px;letter-spacing:1px;">🎯 CBOT Issue Report</h1>
      <p style="color:#94a3b8;margin:6px 0 0;font-size:13px;">Ticket: <strong style="color:#fff;">${ticketNumber}</strong></p>
    </div>
    <div style="padding:28px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px;width:120px;">Reporter</td>
          <td style="padding:8px 0;font-weight:700;font-size:14px;">${name} ${userBadge}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px;">Email</td>
          <td style="padding:8px 0;font-size:14px;"><a href="mailto:${email}" style="color:#f59e0b;">${email}</a></td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px;">Submitted</td>
          <td style="padding:8px 0;font-size:14px;">${submittedAt} IST</td>
        </tr>
      </table>
      <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="color:#475569;font-size:12px;font-weight:700;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Issue Description</p>
        <p style="margin:0;font-size:14px;color:#1e293b;white-space:pre-wrap;">${comment.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
      </div>
      ${attachments.length > 0 ? `<p style="color:#475569;font-size:13px;font-weight:700;">${attachments.length} image(s) attached below ↓</p>` : ''}
    </div>
    <div style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">This report was submitted from the CBOT mobile app. Ticket: <strong>${ticketNumber}</strong></p>
    </div>
  </div>
</body>
</html>`;

    const playerConfirmHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#020617;padding:24px 28px;">
      <h1 style="color:#f59e0b;margin:0;font-size:22px;letter-spacing:1px;">✅ Issue Received — CBOT</h1>
    </div>
    <div style="padding:28px;">
      <p style="font-size:15px;color:#1e293b;">Hi <strong>${name}</strong>,</p>
      <p style="font-size:14px;color:#475569;">Thank you for reporting an issue. We have received your report and will look into it shortly.</p>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:14px 16px;border-radius:0 8px 8px 0;margin:20px 0;">
        <p style="margin:0;font-size:13px;color:#92400e;font-weight:700;">Your Ticket Number</p>
        <p style="margin:4px 0 0;font-size:22px;font-weight:900;color:#d97706;letter-spacing:2px;">${ticketNumber}</p>
      </div>
      <p style="font-size:13px;color:#64748b;">Please keep this ticket number for reference. We typically respond within 24–48 hours.</p>
      <div style="background:#f1f5f9;border-radius:8px;padding:14px 16px;margin-top:16px;">
        <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;font-weight:700;text-transform:uppercase;">Your reported issue</p>
        <p style="margin:0;font-size:13px;color:#334155;white-space:pre-wrap;">${comment.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
      </div>
    </div>
    <div style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">CBOT World · cbotworld@gmail.com · This is an automated confirmation email.</p>
    </div>
  </div>
</body>
</html>`;

    // Send to support
    await transporter.sendMail({
      from: `"CBOT Issue Report" <${smtpFrom}>`,
      to: supportEmail,
      replyTo: email,
      subject: `[${ticketNumber}] Issue Report from ${name}`,
      html: htmlBody,
      attachments,
    });

    // Send confirmation CC to user (don't fail if this bounces)
    try {
      await transporter.sendMail({
        from: `"CBOT World" <${smtpFrom}>`,
        to: email,
        subject: `[${ticketNumber}] We received your issue report — CBOT`,
        html: playerConfirmHtml,
      });
    } catch (ccErr) {
      console.warn('[ReportIssue] CC to player failed:', ccErr);
    }

    return NextResponse.json(
      { success: true, ticketNumber },
      { headers: mobileCorsHeaders },
    );
  } catch (error: any) {
    console.error('[ReportIssue] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to submit report.' },
      { status: 500, headers: mobileCorsHeaders },
    );
  }
}
