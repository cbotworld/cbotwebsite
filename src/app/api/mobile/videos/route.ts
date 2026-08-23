import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mobileCorsHeaders } from '@/lib/mobile-cors';
import { listOfficialChannelVideos } from '@/lib/youtube-live';
import { dayNumberFromMatchRef } from '@/lib/match-play-window';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: mobileCorsHeaders });
}

function dayFromStream(s: {
  matchId?: string | null;
  match?: { round?: number | null; matchNumber?: number | null } | null;
}): number {
  return dayNumberFromMatchRef({
    matchId: s.matchId,
    round: s.match?.round,
    matchNumber: s.match?.matchNumber,
  });
}

function dayFromTitle(title: string): number {
  const m = String(title || '').match(/\bday\s*(\d{1,2})\b/i);
  return m ? parseInt(m[1], 10) : 0;
}

function parseChannelTitle(title: string): { playerName: string; dayNumber: number } {
  const dayNumber = dayFromTitle(title);
  const parts = String(title || '')
    .split(/[•·|,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const skip = (p: string) =>
    /^(cbot|official|live|200th|bicentennial|match|recorded)/i.test(p) ||
    /^day\s*\d/i.test(p) ||
    /ist$/i.test(p) ||
    /\bvs\b/i.test(p) ||
    /^\d/.test(p);
  const namePart = parts.find((p) => !skip(p) && p.length >= 2 && p.length <= 48);
  return { playerName: namePart || 'CBOT WORLD', dayNumber };
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

/** Public catalog: all CBOT World YouTube videos for every player and day. No auth. */
export async function GET(request: NextRequest) {
  try {
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

    const streamByVideoId = new Map<string, (typeof streams)[number]>();
    for (const s of streams) {
      const url = watchUrl(s);
      const videoId =
        s.youtubeVideoId && !s.youtubeVideoId.startsWith('cbot_yt_')
          ? s.youtubeVideoId
          : url?.match(/[?&]v=([^&]+)/)?.[1] || url?.match(/youtu\.be\/([^?&/]+)/)?.[1] || null;
      if (videoId && !streamByVideoId.has(videoId)) streamByVideoId.set(videoId, s);
    }

    const mapped: Array<Record<string, any>> = [];
    const seen = new Set<string>();

    const channelVideos = await listOfficialChannelVideos(300);
    for (const cv of channelVideos) {
      if (!cv.youtubeVideoId || seen.has(cv.youtubeVideoId)) continue;
      seen.add(cv.youtubeVideoId);
      const stream = streamByVideoId.get(cv.youtubeVideoId);
      const parsed = parseChannelTitle(cv.title);
      const playerName = stream?.player?.name || stream?.player?.username || parsed.playerName;
      const dayNumber = stream ? dayFromStream(stream) || parsed.dayNumber : parsed.dayNumber;
      const teamName = stream?.team?.name || stream?.match?.team1?.name || 'CBOT WORLD';
      mapped.push({
        id: stream?.id || `yt-${cv.youtubeVideoId}`,
        source: stream ? 'match' : 'channel',
        dayNumber,
        playerName,
        playerUsername: stream?.player?.username || null,
        teamName,
        teamTag: stream?.team?.tag || null,
        teamLogo: stream?.team?.logo || null,
        status: stream?.status === 'LIVE' ? 'LIVE' : 'ARCHIVED',
        isLive: stream?.status === 'LIVE',
        youtubeUrl: cv.youtubeUrl,
        youtubeVideoId: cv.youtubeVideoId,
        thumbnailUrl: cv.thumbnailUrl || thumbUrl(cv.youtubeVideoId),
        recordedAt: stream?.recordedAt || stream?.createdAt || cv.publishedAt || null,
        title: cv.title || `${playerName} · Day ${dayNumber || '?'} · ${teamName}`,
      });
    }

    for (const s of streams) {
      const isLive = s.status === 'LIVE';
      const url = watchUrl(s);
      const videoId =
        s.youtubeVideoId && !s.youtubeVideoId.startsWith('cbot_yt_')
          ? s.youtubeVideoId
          : url?.match(/[?&]v=([^&]+)/)?.[1] || url?.match(/youtu\.be\/([^?&/]+)/)?.[1] || null;
      if (videoId && seen.has(videoId)) continue;
      if (!isLive && !url && !videoId) continue;
      if (videoId) seen.add(videoId);

      const playerName = s.player?.name || s.player?.username || 'Player';
      const dayNumber = dayFromStream(s);
      mapped.push({
        id: s.id,
        source: 'match' as const,
        dayNumber,
        playerName,
        playerUsername: s.player?.username || null,
        teamName: s.team?.name || s.match?.team1?.name || 'CBOT WORLD',
        teamTag: s.team?.tag || null,
        teamLogo: s.team?.logo || null,
        status: s.status,
        isLive,
        youtubeUrl: url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null),
        youtubeVideoId: videoId,
        thumbnailUrl: thumbUrl(videoId),
        recordedAt: s.recordedAt || s.createdAt,
        title: `${playerName} · Day ${dayNumber || '?'} · ${s.team?.name || 'Match'}`,
      });
    }

    const allDays = [...new Set(mapped.map((v) => v.dayNumber).filter((n) => n > 0))].sort((a, b) => a - b);

    const videos = mapped
      .filter((v) => {
        if (dayFilter && v.dayNumber !== dayFilter) return false;
        if (playerQ) {
          const hay = `${v.playerName} ${v.playerUsername || ''} ${v.teamName} ${v.title}`.toLowerCase();
          if (!hay.includes(playerQ)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        const ta = a.recordedAt ? new Date(a.recordedAt).getTime() : 0;
        const tb = b.recordedAt ? new Date(b.recordedAt).getTime() : 0;
        return tb - ta;
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
