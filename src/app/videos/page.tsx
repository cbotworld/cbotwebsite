import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { listOfficialChannelVideos } from '@/lib/youtube-live';
import { dayNumberFromMatchRef } from '@/lib/match-play-window';
import { dayNumberFromVideoTitle, resolveCurrentEdition } from '@/lib/current-edition';
import VideosClient, { type EditionOption, type VideoItem } from './VideosClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Player Match Videos | CBOT World',
  description: 'Watch official CBOT World YouTube recordings of every player match day. Filter by tournament edition, player name, or day.',
};

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

function thumbUrl(id?: string | null) {
  if (!id || id.startsWith('cbot_yt_')) return null;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

function isChannel2(s?: string | null): boolean {
  if (!s) return false;
  const v = s.toLowerCase();
  return v.includes('channel 2') || v === 'ch 2' || v.includes('backup channel') || v.includes('failover');
}

function parseEditionFromTitle(title: string): number | null {
  const m = String(title || '').match(/\b(?:edition|ed\.?)\s*(\d{2,4})\b/i);
  if (m) {
    const num = Number(m[1]);
    if (Number.isInteger(num) && num > 0) return num;
  }
  const hash = String(title || '').match(/#(\d{2,4})\b/);
  if (hash) {
    const num = Number(hash[1]);
    if (Number.isInteger(num) && num > 0) return num;
  }
  return null;
}

async function fetchVideos() {
  const [currentEd, dbEditions, streams] = await Promise.all([
    resolveCurrentEdition(),
    prisma.edition.findMany({
      orderBy: { number: 'desc' },
      select: { id: true, number: true, title: true, status: true, slot: true },
    }),
    prisma.liveStream.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        player: { select: { id: true, name: true, username: true } },
        team: { select: { id: true, name: true, tag: true } },
        match: { select: { id: true, round: true, matchNumber: true } },
        edition: { select: { id: true, title: true, number: true } },
      },
    }),
  ]);

  const currentEditionNumber = currentEd?.number ?? 205;
  const seen = new Set<string>();
  const dbVideoEditionMap = new Map<string, { editionNumber: number; editionTitle?: string }>();
  const videos: VideoItem[] = [];

  for (const s of streams) {
    if (isChannel2(s.team?.tag) || isChannel2(s.team?.name)) continue;
    const isLive = s.status === 'LIVE';
    const url = watchUrl(s);
    const videoId =
      s.youtubeVideoId && !s.youtubeVideoId.startsWith('cbot_yt_')
        ? s.youtubeVideoId
        : url?.match(/[?&]v=([^&]+)/)?.[1] || null;

    const editionNumber =
      s.edition?.number ?? (s.editionId === currentEd?.id ? currentEditionNumber : null);
    const editionTitle = s.edition?.title ?? (editionNumber ? `Edition ${editionNumber}` : null);

    if (videoId && editionNumber) {
      dbVideoEditionMap.set(videoId, { editionNumber, editionTitle: editionTitle || undefined });
    }

    if (videoId && seen.has(videoId)) continue;
    if (!isLive && !url && !videoId) continue;
    if (videoId) seen.add(videoId);

    const playerName = s.player?.name || s.player?.username || 'Player';
    const dayNumber =
      s.dayNumber && s.dayNumber > 0
        ? s.dayNumber
        : dayNumberFromMatchRef({
            matchId: s.matchId,
            round: s.match?.round,
            matchNumber: s.match?.matchNumber,
          });

    videos.push({
      id: s.id,
      dayNumber,
      editionNumber,
      editionTitle,
      playerName,
      playerUsername: s.player?.username || null,
      teamName: s.team?.name || s.edition?.title || (editionNumber ? `Edition ${editionNumber}` : 'CBOT WORLD'),
      teamTag: s.team?.tag || null,
      status: s.status,
      isLive,
      youtubeUrl: url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null),
      youtubeVideoId: videoId,
      thumbnailUrl: thumbUrl(videoId),
      title: `${playerName} · Day ${dayNumber || '?'}`,
      recordedAt: s.recordedAt || s.createdAt ? String(s.recordedAt || s.createdAt) : null,
    });
  }

  // Channel videos
  try {
    const channelVideos = await listOfficialChannelVideos(300);
    for (const v of channelVideos) {
      if (v.channelIndex === 2 || isChannel2(v.channelTitle) || isChannel2(v.title)) continue;
      if (!v.youtubeVideoId || seen.has(v.youtubeVideoId)) continue;
      seen.add(v.youtubeVideoId);

      const dbMatch = dbVideoEditionMap.get(v.youtubeVideoId);
      const edNum = dbMatch?.editionNumber ?? parseEditionFromTitle(v.title);
      const edTitle = dbMatch?.editionTitle ?? (edNum ? `Edition ${edNum}` : null);

      videos.push({
        id: `yt-${v.youtubeVideoId}`,
        dayNumber: dayNumberFromVideoTitle(v.title),
        editionNumber: edNum,
        editionTitle: edTitle,
        playerName: String(v.title || '').split(/[·|\-–]/)[0].trim() || 'CBOT WORLD',
        playerUsername: null,
        teamName: v.channelTitle || (edNum ? `Edition ${edNum}` : 'CBOT WORLD'),
        teamTag: null,
        status: 'ENDED',
        isLive: false,
        youtubeUrl: v.youtubeUrl,
        youtubeVideoId: v.youtubeVideoId,
        thumbnailUrl: v.thumbnailUrl || thumbUrl(v.youtubeVideoId),
        title: v.title,
        channelTitle: v.channelTitle || 'CBOT WORLD',
        recordedAt: v.publishedAt ? String(v.publishedAt) : null,
      });
    }
  } catch {
    // channel fetch optional
  }

  // Sort: live first, then newest
  videos.sort((a, b) => {
    if (a.isLive && !b.isLive) return -1;
    if (!a.isLive && b.isLive) return 1;
    const ta = a.recordedAt ? new Date(a.recordedAt).getTime() : 0;
    const tb = b.recordedAt ? new Date(b.recordedAt).getTime() : 0;
    return tb - ta;
  });

  const allDays = [...new Set(videos.map((v) => v.dayNumber).filter((n) => n > 0))].sort((a, b) => a - b);

  // Compute edition counts
  const editionCounts = new Map<number, number>();
  for (const v of videos) {
    if (v.editionNumber) {
      editionCounts.set(v.editionNumber, (editionCounts.get(v.editionNumber) || 0) + 1);
    }
  }
  if (!editionCounts.has(currentEditionNumber)) {
    editionCounts.set(currentEditionNumber, 0);
  }

  const allEditions: EditionOption[] = Array.from(editionCounts.keys())
    .sort((a, b) => b - a)
    .map((num) => {
      const dbEd = dbEditions.find((e) => e.number === num);
      return {
        number: num,
        title: dbEd?.title || `Edition ${num}`,
        isCurrent: num === currentEditionNumber,
        videoCount: editionCounts.get(num) || 0,
      };
    });

  return { videos, allDays, allEditions, currentEditionNumber };
}

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = (await searchParams) || {};
  const { videos, allDays, allEditions, currentEditionNumber } = await fetchVideos();

  const playerParam =
    typeof resolvedParams.player === 'string'
      ? resolvedParams.player
      : Array.isArray(resolvedParams.player)
      ? resolvedParams.player[0]
      : '';
  const dayParam =
    typeof resolvedParams.day === 'string'
      ? resolvedParams.day
      : Array.isArray(resolvedParams.day)
      ? resolvedParams.day[0]
      : '';
  const editionParam =
    typeof resolvedParams.edition === 'string'
      ? resolvedParams.edition
      : Array.isArray(resolvedParams.edition)
      ? resolvedParams.edition[0]
      : '';

  const defaultPlayer = playerParam.trim();
  const dayRaw = dayParam ? Number(dayParam) : null;
  const defaultDay = dayRaw && Number.isFinite(dayRaw) && dayRaw > 0 ? dayRaw : null;

  let defaultEdition: number | 'ALL' = currentEditionNumber;
  if (editionParam && editionParam.toUpperCase() === 'ALL') {
    defaultEdition = 'ALL';
  } else if (editionParam && Number.isFinite(Number(editionParam)) && Number(editionParam) > 0) {
    defaultEdition = Number(editionParam);
  }

  return (
    <Suspense>
      <VideosClient
        initialVideos={videos}
        allDays={allDays}
        allEditions={allEditions}
        currentEditionNumber={currentEditionNumber}
        defaultEdition={defaultEdition}
        defaultPlayer={defaultPlayer || undefined}
        defaultDay={defaultDay}
      />
    </Suspense>
  );
}
