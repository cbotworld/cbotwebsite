import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendFinalDailyLineupSummaryAction } from '@/lib/actions/lineupActions';
import { currentCombiDayNumber } from '@/lib/combi-cutoff';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dayParam = searchParams.get('day');
    
    let dayNumber = 1;
    if (dayParam) {
      dayNumber = parseInt(dayParam, 10);
    } else {
      const activeEdition = await prisma.edition.findFirst({
        orderBy: { number: 'desc' },
        select: { totalDays: true, dayDates: true },
      });
      dayNumber = currentCombiDayNumber(activeEdition?.totalDays || 15, new Date(), activeEdition?.dayDates);
    }

    console.log(`[Cron] Executing daily locked combi summary email for Day ${dayNumber}...`);
    const result = await sendFinalDailyLineupSummaryAction(dayNumber);

    if (!result.success) {
      console.error('[Cron] Summary email failed:', result.error);
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      dayNumber,
      message: `Day ${dayNumber} summary email successfully dispatched to all captains and cbotworld@gmail.com.`,
      previewUrl: result.previewUrl || null,
    });
  } catch (error: any) {
    console.error('[Cron] Unhandled error in daily summary cron:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
