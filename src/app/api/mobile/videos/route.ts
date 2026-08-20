import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { userFromBearer } from '@/lib/mobile-session';
import { mobileCorsHeaders } from '@/lib/mobile-cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: mobileCorsHeaders });
}

function dayFromStream(s: {
  matchId?: string | null;
  match?: { round?: number | null; matchNumber?: number | null } | null;
}): number {
  const matchId = s.matchId || '';
  const mon = matchId.match(/monument_(\d+)/i);
  if (mon) return parseInt(mon[1], 10);
  if (s.match?.round) return s.match.round;
  if (s.match?.matchNumber) return s.match.matchNumber;
  return 0;
}

function watchUrl(s: { youtubeUrl?: string | null; youtubeVideoId?: string | null; youtubeEmbedUrl?: string | null }) {
  const raw = s.youtubeUrl || s.youtubeEmbedUrl || '';
  if (raw && !raw.includes('cbot_yt_') && /^https?:\/\//i.test(raw)) {
    const embedMatch = raw.match(/youtube\.com\/embed\/([^?&/]+)/i);
    if (embedMatch) return `https://www.youtube.com/watch?v=${embedMatch[1]}`;
    return raw;
  }
  if (s.youtubeVideoId && !s.youtubeVideoId.startsWith('cbot_yt_')) {
    return `https://www.youtube.com/watch?v=${s.youtubeVideoId}`;
  }
  return null;
}

function thumbUrl(videoId: string | null | undefined) {
  if (!videoId || videoId.startsWith('cbot_yt_')) return null;
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: mobileCorsHeaders });
    }

    const { searchParams } = new URL(request.url);
    const playerQ = (searchParams.get('player') || '').trim().toLowerCase();
    const dayQ = searchParams.get('day');
    const dayFilter = dayQ && dayQ !== 'ALL' ? Number(dayQ) : null;

    const streams = await prisma.liveStream.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        player: { select: { id: true, name: true, username: true, image: true } },
        team: { select: { id: true, name: true, tag: true, logo: true } },
        match: {
          select: {
            id: true,
            round: true,
            matchNumber: true,
            team1: { select: { name: true, tag: true } },
            team2: { select: { name: true, tag: true } },
          },
        },
      },
    });

    const mapped = streams
      .map((s) => {
        const isLive = s.status === 'LIVE';
        const url = watchUrl(s);
        const hasReplay = Boolean(url) || s.status === 'ARCHIVED';
        if (!isLive && !hasReplay) return null;

        const playerName = s.player?.name || s.player?.username || 'Player';
        const dayNumber = dayFromStream(s);
        const videoId =
          s.youtubeVideoId && !s.youtubeVideoId.startsWith('cbot_yt_')
            ? s.youtubeVideoId
            : url?.match(/[?&]v=([^&]+)/)?.[1] || null;

        return {
          id: s.id,
          dayNumber,
          playerName,
          playerUsername: s.player?.username || null,
          teamName: s.team?.name || s.match?.team1?.name || 'CBOT',
          teamTag: s.team?.tag || null,
          teamLogo: s.team?.logo || null,
          status: s.status,
          isLive,
          youtubeUrl: url,
          youtubeVideoId: videoId,
          thumbnailUrl: thumbUrl(videoId),
          recordedAt: s.recordedAt || s.createdAt,
          title: `${playerName} · Day ${dayNumber || '?'} · ${s.team?.name || 'Match'}`,
        };
      })
      .filter(Boolean) as Array<Record<string, any>>;

    const allDays = [...new Set(mapped.map((v) => v.dayNumber).filter((n) => n > 0))].sort((a, b) => a - b);

    const videos = mapped
      .filter((v) => {
        if (dayFilter && v.dayNumber !== dayFilter) return false;
        if (playerQ) {
          const hay = `${v.playerName} ${v.playerUsername || ''} ${v.teamName}`.toLowerCase();
          if (!hay.includes(playerQ)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        return (b.dayNumber || 0) - (a.dayNumber || 0);
      });

    return NextResponse.json(
      {
        success: true,
        filters: { player: playerQ || null, day: dayFilter },
        days: allDays,
        videos,
        count: videos.length,
      },
      { headers: mobileCorsHeaders },
    );
  } catch (error: any) {
    console.error('Mobile videos GET:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error.' },
      { status: 500, headers: mobileCorsHeaders },
    );
  }
}
