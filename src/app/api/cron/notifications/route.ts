import { NextRequest, NextResponse } from 'next/server';
import { dispatchNotifications } from '@/lib/notification-scheduler';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const defaultSecret = 'cbot_cron_secret_2026';
    const envSecret = process.env.CRON_SECRET;
    const querySecret = searchParams.get('secret');
    const authHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';

    const isAuthorized =
      isVercelCron ||
      (envSecret && (querySecret === envSecret || authHeader === envSecret)) ||
      querySecret === defaultSecret ||
      authHeader === defaultSecret;

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized cron request.' },
        { status: 401 },
      );
    }

    const typeParam = (searchParams.get('type') || 'auto').toLowerCase();
    const dayParam = searchParams.get('day');
    const dayOverride = dayParam ? parseInt(dayParam, 10) : undefined;
    const force = searchParams.get('force') === 'true';

    const validTypes = ['golive', 'score', 'combi', 'results', 'auto'];
    const type = validTypes.includes(typeParam) ? (typeParam as any) : 'auto';

    const istTimeStr = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: true,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    console.log(`[CronNotifications] ${istTimeStr} IST — Dispatching push notifications (type: ${type}, dayOverride: ${dayOverride || 'none'}, force: ${force})...`);

    const result = await dispatchNotifications(type, dayOverride, false, force);

    return NextResponse.json({
      timestampUtc: new Date().toISOString(),
      timestampIst: istTimeStr,
      ...result,
    });
  } catch (error: any) {
    console.error('[CronNotifications] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to dispatch notifications.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
