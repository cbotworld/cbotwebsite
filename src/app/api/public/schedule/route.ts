import { NextResponse } from 'next/server';
import { monumentStatus } from '@/lib/bicentennial-monuments';
import { prisma } from '@/lib/prisma';
import { buildOrganizerScheduleDays, resolveOrganizerPairings } from '@/lib/organizer-schedule';
import { stageConfigKey } from '@/lib/tournament-stages';
import { resolveCurrentEdition } from '@/lib/current-edition';
import { memoryCache } from '@/lib/memory-cache';

export const revalidate = 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

async function activeEditionSchedule() {
  return await memoryCache.getOrSet('public_active_edition_schedule', 15, async () => {
    const editionRef = await resolveCurrentEdition();
    const edition = editionRef
      ? await prisma.edition.findUnique({ where: { id: editionRef.id } })
      : null;

  let stageConfig: { stages?: any[] } | null = null;
  if (edition?.id) {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: stageConfigKey(edition.id) },
    });
    if (setting?.value) {
      try {
        stageConfig = JSON.parse(setting.value);
      } catch {}
    }
  }

  const teams = edition?.id
    ? await prisma.team.findMany({
        where: { editionId: edition.id },
        select: { id: true, name: true, tag: true, logo: true },
      })
    : [];

  let dayDates: Record<number, string> = {};
  if (edition?.dayDates) {
    try {
      dayDates = JSON.parse(edition.dayDates);
    } catch {}
  }

  return buildOrganizerScheduleDays({
    totalDays: edition?.totalDays,
    dayDates,
    pairings: resolveOrganizerPairings(stageConfig?.stages || [], teams),
    stages: stageConfig?.stages || [],
    teams,
  });
  });
}

/** Public fixture clock for the Cbot YouTube live app. No live-video database. */
export async function GET() {
  const now = Date.now();

  // Fall back to the seeded fixture calendar if the database is unreachable, so
  // the live app keeps a clock rather than breaking.
  let scheduleDays;
  try {
    scheduleDays = await activeEditionSchedule();
  } catch (error) {
    console.error('[api/public/schedule]', error);
    scheduleDays = buildOrganizerScheduleDays();
  }

  const days = scheduleDays.map((d) => ({
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
