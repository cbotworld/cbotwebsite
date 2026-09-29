import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mobileCorsHeaders } from '@/lib/mobile-cors';
import { dayNumberFromMatchRef } from '@/lib/match-play-window';
import { dayNumberFromVideoTitle } from '@/lib/current-edition';
import { listOfficialChannelVideos } from '@/lib/youtube-live';
import { memoryCache } from '@/lib/memory-cache';

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

function playerFromTitle(title: string) {
  const first = String(title || '')
    .split(/[·|\-–]/)[0]
    .trim();
  return first || 'CBOT WORLD';
}

function isChannel2Reference(str?: string | null): boolean {
  if (!str) return false;
  const s = str.toLowerCase();
  return s.includes('channel 2') || s === 'ch 2' || s.includes('backup channel') || s.includes('failover');
}

/** Public catalog: strictly primary official YouTube videos. No auth. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const playerQ = (searchParams.get('player') || '').trim().toLowerCase();
    const dayQ = searchParams.get('day');
    const dayFilter = dayQ && dayQ !== 'ALL' ? Number(dayQ) : null;

    const { mapped, allDays } = await memoryCache.getOrSet('mobile_videos_catalog_v2', 15, async () => {
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
          edition: { select: { title: true, number: true } },
        },
      });

      const mappedList: Array<Record<string, any>> = [];
      const seen = new Set<string>();

      for (const s of streams) {
        // Exclude any streams flagged with Channel 2
        if (isChannel2Reference(s.team?.tag) || isChannel2Reference(s.team?.name)) {
          continue;
        }

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
        const teamName = s.team?.name || s.match?.team1?.name || s.edition?.title || 'CBOT WORLD';

        mappedList.push({
          id: s.id,
          source: 'match' as const,
          dayNumber,
          playerName,
          playerUsername: s.player?.username || null,
          teamName,
          teamTag: s.team?.tag || null,
          teamLogo: s.team?.logo || null,
          status: s.status,
          isLive,
          youtubeUrl: url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null),
          youtubeVideoId: videoId,
          thumbnailUrl: thumbUrl(videoId),
          recordedAt: s.recordedAt || s.createdAt,
          title: `${playerName} · Day ${dayNumber || '?'} · ${teamName}`,
        });
      }

      // Fetch primary official channel videos only
      const channelVideos = await listOfficialChannelVideos(300);
      for (const v of channelVideos) {
        // Strictly exclude secondary channel videos
        if (v.channelIndex === 2 || isChannel2Reference(v.channelTitle) || isChannel2Reference(v.title)) {
          continue;
        }
        if (!v.youtubeVideoId || seen.has(v.youtubeVideoId)) continue;
        seen.add(v.youtubeVideoId);
        mappedList.push({
          id: `yt-${v.youtubeVideoId}`,
          source: 'channel' as const,
          dayNumber: dayNumberFromVideoTitle(v.title),
          playerName: playerFromTitle(v.title),
          playerUsername: null,
          teamName: v.channelTitle || 'CBOT WORLD',
          teamTag: null,
          teamLogo: null,
          status: 'ENDED',
          isLive: false,
          youtubeUrl: v.youtubeUrl,
          youtubeVideoId: v.youtubeVideoId,
          thumbnailUrl: v.thumbnailUrl || thumbUrl(v.youtubeVideoId),
          recordedAt: v.publishedAt || null,
          title: v.title,
          channelIndex: 1,
          channelTitle: v.channelTitle || 'CBOT WORLD',
        });
      }

      const daysList = [...new Set(mappedList.map((v) => v.dayNumber).filter((n) => n > 0))].sort((a, b) => a - b);
      return { mapped: mappedList, allDays: daysList };
    });

    const videos = mapped
      .filter((v) => {
        // Extra safeguard: exclude Channel 2
        if (v.channelIndex === 2 || isChannel2Reference(v.teamTag) || isChannel2Reference(v.teamName) || isChannel2Reference(v.channelTitle)) {
          return false;
        }
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
        edition: null,
        filters: { player: playerQ || null, day: dayFilter },
        days: allDays,
        videos,
        count: videos.length,
      },
      { headers: { ...mobileCorsHeaders, 'Cache-Control': 'no-store, must-revalidate' } },
    );
  } catch (error: any) {
    console.error('Mobile videos GET:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error.' },
      { status: 500, headers: mobileCorsHeaders },
    );
  }
}
