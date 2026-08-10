import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendFinalDailyLineupSummaryAction } from '@/lib/actions/lineupActions';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dayParam = searchParams.get('day');
    
    let dayNumber = 1;
    if (dayParam) {
      dayNumber = parseInt(dayParam, 10);
    } else {
      // Calculate active day dynamically based on edition dates or current date
      const activeEdition = await prisma.edition.findFirst({
        orderBy: { number: 'desc' },
        select: { tournamentStartDate: true, dayDates: true }
      });
      if (activeEdition?.tournamentStartDate) {
        const start = new Date(activeEdition.tournamentStartDate);
        const today = new Date();
        const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (diffDays >= 1) dayNumber = diffDays;
      }
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
