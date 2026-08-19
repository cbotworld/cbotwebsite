import { NextResponse } from 'next/server';
import { officialMatchDays, monumentStatus } from '@/lib/bicentennial-monuments';

export const revalidate = 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/** Public fixture clock for the Cbot YouTube live app. No live-video database. */
export async function GET() {
  const now = Date.now();
  const days = officialMatchDays().map((d) => ({
    dayNumber: d.dayNumber,
    label: `Day ${d.dayNumber}`,
    title: d.title,
    timeRange: d.timeRange,
    startIso: d.startIso,
    endIso: d.endIso,
    status: monumentStatus(d, now),
  }));
  const live = days.find((d) => d.status === 'live') || null;

  return NextResponse.json(
    {
      success: true,
      now: new Date(now).toISOString(),
      liveDay: live?.dayNumber ?? null,
      liveLabel: live?.label ?? null,
      days,
    },
    { headers: { ...corsHeaders, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
  );
}
