import { NextRequest, NextResponse } from 'next/server';
import { dispatchNotifications } from '@/lib/notification-scheduler';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Security check via CRON_SECRET or query secret parameter
    const expectedSecret = process.env.CRON_SECRET || 'cbot_cron_secret_2026';
    const secret =
      searchParams.get('secret') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (secret !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized cron request.' },
        { status: 401 },
      );
    }

    const typeParam = (searchParams.get('type') || 'auto').toLowerCase();
    const dayParam = searchParams.get('day');
    const dayOverride = dayParam ? parseInt(dayParam, 10) : undefined;

    const validTypes = ['golive', 'score', 'combi', 'results', 'auto'];
    const type = validTypes.includes(typeParam) ? (typeParam as any) : 'auto';

    console.log(`[CronNotifications] Dispatching push notifications (type: ${type}, dayOverride: ${dayOverride || 'none'})...`);

    const result = await dispatchNotifications(type, dayOverride);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
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
