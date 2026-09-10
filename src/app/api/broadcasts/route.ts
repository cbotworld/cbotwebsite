import { NextRequest, NextResponse } from 'next/server';
import { authorizeBroadcastRequest, broadcastCorsHeaders, broadcastOptions } from '@/lib/mobile-broadcast-auth';
import { createLiveSession } from '@/lib/youtube-live';
import { userFromBearer } from '@/lib/mobile-session';
import { getPlayerMatchSchedule } from '@/lib/player-match-schedule';
import { recordMobileLiveStream } from '@/lib/record-mobile-livestream';
import { getWebsiteCmsSite } from '@/lib/website-cms-site';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function OPTIONS() {
  return broadcastOptions();
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Create a YouTube live broadcast + RTMP key for the Cbot app. */
export async function POST(request: NextRequest) {
  const auth = await authorizeBroadcastRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    let name = asText(body.name);
    let day = asText(body.day);
    let teamName = asText(body.teamName);
    let opponentName = asText(body.opponentName);
    let teamTag = asText(body.teamTag);
    let opponentTag = asText(body.opponentTag);
    let stage = asText(body.stage);
    let editionTitle = asText(body.editionTitle);
    let timeRange = asText(body.timeRange);
    let endIso = asText(body.endIso);
    const playMode = asText(body.playMode).toLowerCase();
    const isBonusPlay =
      playMode === 'tiebreak' ||
      playMode === 'practice' ||
      /practice|tie[\s._-]*break/i.test(day);

    const slotRaw = asText(body.editionSlot || body.slot).toUpperCase();
    const activeSlot = slotRaw === 'B' ? ('B' as const) : slotRaw === 'A' ? ('A' as const) : undefined;
    const requestedEditionId = asText(body.editionId) || undefined;

    const user = await userFromBearer(request);
    let teamId: string | null = null;
    let editionId: string | undefined = requestedEditionId;
    if (user) {
      const schedule = await getPlayerMatchSchedule(user.id, {
        editionSlot: activeSlot,
        editionId: requestedEditionId,
      });
      teamId = schedule?.team?.id || null;
      if (!editionId && schedule?.edition?.id) {
        editionId = schedule.edition.id;
      }
      const dayNum = parseInt(day.replace(/\D/g, ''), 10);
      const days = (schedule?.days || []).filter(Boolean) as any[];
      const row =
        days.find((d) => d.dayNumber === dayNum) ||
        days.find((d) => d.status === 'live') ||
        null;

      if (Number.isFinite(dayNum) && dayNum > 0 && !isBonusPlay) {
        if (row && row.canGoLive === false) {
          return NextResponse.json(
            {
              error:
                row.lockedReason ||
                `Day ${dayNum} is locked. Save a YouTube link for the previous match day first.`,
            },
            { status: 403, headers: broadcastCorsHeaders },
          );
        }
        if (!row) {
          const scheduled = days.map((d) => d.dayNumber).filter(Boolean);
          if (scheduled.length && !scheduled.includes(dayNum)) {
            return NextResponse.json(
              { error: `Day ${dayNum} is not on your match schedule.` },
              { status: 403, headers: broadcastCorsHeaders },
            );
          }
        }
      }

      if (!name) name = schedule?.user?.name || user.name || user.username || '';
      if (row) {
        if (!day) day = row.label || `Day ${row.dayNumber}`;
        if (!teamName) teamName = row.teamName || '';
        if (!opponentName) opponentName = row.opponentName || '';
        if (!teamTag) teamTag = row.teamTag || '';
        if (!opponentTag) opponentTag = row.opponentTag || '';
        if (!stage) stage = row.stageName || row.stageLabel || row.title || '';
        if (!editionTitle) editionTitle = row.editionTitle || '';
        if (!timeRange) timeRange = row.timeRange || '';
        if (!endIso && !isBonusPlay) endIso = row.endIso || '';
      }
      if (!editionTitle) {
        const site = await getWebsiteCmsSite();
        editionTitle = `${site.shortName} ${site.editionLabel}`;
      }
    }

    if (!name || !day) {
      return NextResponse.json(
        { error: 'Both name and day are required.' },
        { status: 400, headers: broadcastCorsHeaders },
      );
    }

    const session = await createLiveSession({
      name,
      day,
      teamName,
      opponentName,
      teamTag,
      opponentTag,
      stage,
      editionTitle,
      timeRange,
      endIso,
    });

    if (user) {
      const dayNum = parseInt(day.replace(/\D/g, ''), 10);
      if (Number.isFinite(dayNum) && dayNum > 0) {
        try {
          await recordMobileLiveStream({
            userId: user.id,
            dayNumber: dayNum,
            editionId: editionId || null,
            teamId,
            opponentName,
            playMode: isBonusPlay
              ? playMode === 'practice' || /practice/i.test(day)
                ? 'practice'
                : 'tiebreak'
              : 'match',
            youtubeBroadcastId: session.broadcastId,
            youtubeStreamId: session.streamId,
            youtubeVideoId: session.broadcastId,
            youtubeUrl: session.watchUrl,
            rtmpIngestionUrl: session.ingestionAddress,
            streamKey: session.streamName,
            status: 'READY',
          });
        } catch (persistError) {
          console.error('Failed to persist mobile live stream:', persistError);
        }
      }
    }

    return NextResponse.json(
      {
        ...session,
        rtmpUrl: `${session.ingestionAddress}/${session.streamName}`,
      },
      { headers: broadcastCorsHeaders },
    );
  } catch (error: any) {
    console.error('Create broadcast error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create broadcast' },
      { status: 502, headers: broadcastCorsHeaders },
    );
  }
}
