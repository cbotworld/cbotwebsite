import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

export async function GET(request: Request) {
  // 1. Strict Server Session & Admin Authorization Check
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <body style="font-family: system-ui, sans-serif; background: #020617; color: #f87171; padding: 40px; text-align: center;">
          <div style="max-width: 500px; margin: 0 auto; background: #0f172a; border: 1px solid #ef4444; border-radius: 20px; padding: 30px;">
            <h2>⛔ 401 Unauthorized</h2>
            <p style="color: #cbd5e1; font-size: 14px;">Unauthenticated access attempt to OAuth callback.</p>
          </div>
        </body>
      </html>
    `, { status: 401, headers: { 'Content-Type': 'text/html' } });
  }

  const userRole = (session.user as any).role;
  if (userRole !== 'ORGANIZER' && userRole !== 'SUPER_ADMIN') {
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <body style="font-family: system-ui, sans-serif; background: #020617; color: #f87171; padding: 40px; text-align: center;">
          <div style="max-width: 500px; margin: 0 auto; background: #0f172a; border: 1px solid #ef4444; border-radius: 20px; padding: 30px;">
            <h2>⛔ 403 Forbidden</h2>
            <p style="color: #cbd5e1; font-size: 14px;">Access Denied: Only CBOT Organizers can complete YouTube Channel authorization.</p>
          </div>
        </body>
      </html>
    `, { status: 403, headers: { 'Content-Type': 'text/html' } });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <body style="font-family: system-ui, sans-serif; background: #020617; color: #f87171; padding: 40px; text-align: center;">
          <div style="max-width: 500px; margin: 0 auto; background: #0f172a; border: 1px solid #ef4444; border-radius: 20px; padding: 30px;">
            <h2>OAuth Authorization Error</h2>
            <p style="color: #cbd5e1; font-size: 14px;">${error}</p>
          </div>
        </body>
      </html>
    `, { status: 400, headers: { 'Content-Type': 'text/html' } });
  }

  if (!code) {
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <body style="font-family: system-ui, sans-serif; background: #020617; color: #f87171; padding: 40px; text-align: center;">
          <div style="max-width: 500px; margin: 0 auto; background: #0f172a; border: 1px solid #ef4444; border-radius: 20px; padding: 30px;">
            <h2>Missing OAuth Code</h2>
            <p style="color: #cbd5e1; font-size: 14px;">No authorization code received from Google.</p>
          </div>
        </body>
      </html>
    `, { status: 400, headers: { 'Content-Type': 'text/html' } });
  }

  const state = searchParams.get('state') || '';
  const channelNum = state.includes(':') ? (state.split(':')[1] === '2' ? 2 : 1) : 1;
  const channelLabel = channelNum === 2 ? 'Channel 2 (Backup/Failover)' : 'Channel 1 (Primary)';

  const defaultClientId = '857312173626-97fujm4mo4srp18mlvasmbfvfrfma2ap.apps.googleusercontent.com';
  const defaultClientSecret = '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';

  const clientId =
    channelNum === 2
      ? process.env.GOOGLE_CLIENT_ID_2 || process.env.GOOGLE_CLIENT_ID || defaultClientId
      : process.env.GOOGLE_CLIENT_ID || defaultClientId;

  const clientSecret =
    channelNum === 2
      ? process.env.GOOGLE_CLIENT_SECRET_2 || process.env.GOOGLE_CLIENT_SECRET || defaultClientSecret
      : process.env.GOOGLE_CLIENT_SECRET || defaultClientSecret;

  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://www.cbotworld.com/api/auth/youtube/callback';

  try {
    // Exchange authorization code for tokens server-side
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
          <body style="font-family: system-ui, sans-serif; background: #020617; color: #f87171; padding: 40px; text-align: center;">
            <div style="max-width: 500px; margin: 0 auto; background: #0f172a; border: 1px solid #ef4444; border-radius: 20px; padding: 30px;">
              <h2>Token Exchange Error</h2>
              <p style="color: #cbd5e1; font-size: 14px;">${tokenData.error_description || tokenData.error}</p>
            </div>
          </body>
        </html>
      `, { status: 400, headers: { 'Content-Type': 'text/html' } });
    }

    const refreshToken = tokenData.refresh_token;
    const accessToken = tokenData.access_token;

    // Fetch Channel Metadata from YouTube API
    let channelTitle = `YouTube Channel ${channelNum}`;
    let channelId = '';

    if (accessToken) {
      try {
        const profileRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const profileData = await profileRes.json();
        const firstItem = profileData.items?.[0];
        if (firstItem) {
          channelTitle = firstItem.snippet?.title || channelTitle;
          channelId = firstItem.id || '';
        }
      } catch (profileErr) {
        console.warn('Failed to fetch channel profile metadata:', profileErr);
      }
    }

    // 2. STORE REFRESH TOKEN DIRECTLY IN DATABASE SERVER-SIDE
    const tokenKey = channelNum === 2 ? 'youtube_refresh_token_2' : 'youtube_refresh_token';
    const titleKey = channelNum === 2 ? 'youtube_channel_2_title' : 'youtube_channel_1_title';
    const idKey = channelNum === 2 ? 'youtube_channel_2_id' : 'youtube_channel_1_id';

    if (refreshToken) {
      await prisma.systemSetting.upsert({
        where: { key: tokenKey },
        update: { value: refreshToken },
        create: { key: tokenKey, value: refreshToken },
      });
    }

    if (channelTitle) {
      await prisma.systemSetting.upsert({
        where: { key: titleKey },
        update: { value: channelTitle },
        create: { key: titleKey, value: channelTitle },
      });
    }

    if (channelId) {
      await prisma.systemSetting.upsert({
        where: { key: idKey },
        update: { value: channelId },
        create: { key: idKey, value: channelId },
      });
    }

    // 3. Return Clean Success Response to Admin (No secret tokens in HTML output)
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>CBOT YouTube ${channelLabel} Authorized</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; background: #020617; color: #f8fafc; padding: 40px; text-align: center; }
            .card { max-width: 550px; margin: 0 auto; background: #0f172a; border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 24px; padding: 36px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
            h1 { color: #f59e0b; margin-bottom: 8px; font-size: 24px; }
            p { color: #cbd5e1; font-size: 14px; line-height: 1.6; }
            .badge { display: inline-block; background: rgba(52, 211, 153, 0.15); border: 1px solid #34d399; color: #34d399; font-weight: bold; padding: 6px 16px; border-radius: 12px; font-size: 13px; margin: 16px 0; }
            .channel-info { background: #1e293b; border-radius: 12px; padding: 14px; margin: 16px 0; text-align: left; }
            .channel-info div { margin-bottom: 6px; font-size: 13px; }
            .btn { display: inline-block; background: #f59e0b; color: #020617; font-weight: 900; text-decoration: none; padding: 12px 24px; border-radius: 12px; margin-top: 20px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🎉 CBOT YouTube ${channelLabel} Authorized</h1>
            <div class="badge">SECURE SERVER-SIDE TOKEN STORAGE</div>
            <div class="channel-info">
              <div><strong>Channel Name:</strong> ${channelTitle}</div>
              ${channelId ? `<div><strong>Channel ID:</strong> ${channelId}</div>` : ''}
              <div><strong>Slot:</strong> ${channelLabel}</div>
              <div><strong>Status:</strong> Connected & Active</div>
            </div>
            <p>Your YouTube channel has been linked to CBOT World. Streams will now utilize this channel with automatic quota management.</p>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 10px;">🔒 Security Guarantee: No tokens or secrets were exposed to the browser.</p>
            <a href="/admin" class="btn">Return to Admin Portal</a>
          </div>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });

  } catch (err: any) {
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <body style="font-family: system-ui, sans-serif; background: #020617; color: #f87171; padding: 40px; text-align: center;">
          <div style="max-width: 500px; margin: 0 auto; background: #0f172a; border: 1px solid #ef4444; border-radius: 20px; padding: 30px;">
            <h2>Server Exception</h2>
            <p style="color: #cbd5e1; font-size: 14px;">${err.message}</p>
          </div>
        </body>
      </html>
    `, { status: 500, headers: { 'Content-Type': 'text/html' } });
  }
}
