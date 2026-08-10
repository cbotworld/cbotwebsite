import { NextResponse } from 'next/server';
import { sendFinalDailyLineupSummaryAction } from '@/lib/actions/lineupActions';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    // Default to Day 1, or parse from searchParams ?day=1
    const { searchParams } = new URL(request.url);
    const dayParam = searchParams.get('day');
    const dayNumber = dayParam ? parseInt(dayParam, 10) : 1;

    console.log(`[Cron] Executing daily locked combi summary email for Day ${dayNumber}...`);
    const result = await sendFinalDailyLineupSummaryAction(dayNumber);

    if (!result.success) {
      console.error('[Cron] Summary email failed:', result.error);
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Day ${dayNumber} summary email successfully dispatched to all captains and cbotworld@gmail.com.`,
      previewUrl: result.previewUrl || null,
    });
  } catch (error: any) {
    console.error('[Cron] Unhandled error in daily summary cron:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
