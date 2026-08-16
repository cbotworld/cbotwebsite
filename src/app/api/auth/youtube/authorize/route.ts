import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const revalidate = 0;

export async function GET(request: Request) {
  // 1. Strict Server Authentication & Role Authorization Check
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <body style="font-family: system-ui, sans-serif; background: #020617; color: #f87171; padding: 40px; text-align: center;">
          <div style="max-width: 500px; margin: 0 auto; background: #0f172a; border: 1px solid #ef4444; border-radius: 20px; p-8; padding: 30px;">
            <h2>⛔ 401 Unauthorized</h2>
            <p style="color: #cbd5e1; font-size: 14px;">You must be logged into CBOT World to access YouTube Channel Authorization.</p>
            <a href="/login" style="display: inline-block; margin-top: 15px; background: #f59e0b; color: #020617; padding: 10px 20px; font-weight: bold; text-decoration: none; border-radius: 10px;">Log In to CBOT</a>
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
            <p style="color: #cbd5e1; font-size: 14px;">Access Denied: Only CBOT Organizers & Administrators can authorize the official YouTube channel.</p>
          </div>
        </body>
      </html>
    `, { status: 403, headers: { 'Content-Type': 'text/html' } });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || '857312173626-97fujm4mo4srp18mlvasmbfvfrfma2ap.apps.googleusercontent.com';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://www.cbotworld.com/api/auth/youtube/callback';

  const scopes = [
    'https://www.googleapis.com/auth/youtube.force-ssl',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.upload'
  ].join(' ');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  // State parameter to bind session user ID
  authUrl.searchParams.set('state', (session.user as any).id || 'organizer');

  return NextResponse.redirect(authUrl.toString());
}
