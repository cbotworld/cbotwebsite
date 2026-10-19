import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { listOfficialChannelVideos } from '@/lib/youtube-live';

export const dynamic = 'force-dynamic';

function cleanId(urlOrId?: string | null): string | null {
  if (!urlOrId) return null;
  const s = urlOrId.trim();
  if (!s.includes('/') && !s.includes('?') && s.length >= 8 && s.length <= 16 && !s.startsWith('cbot_yt_')) {
    return s;
  }
  const m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|(?:embed|v)\/))([a-zA-Z0-9_-]{11})/i);
  return m ? m[1] : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dayRaw = searchParams.get('day');
    const dayNumber = dayRaw ? Number(dayRaw) : null;
    const editionRaw = searchParams.get('edition');
    const editionNumber = editionRaw ? Number(editionRaw) : null;
    const teamsParam = searchParams.get('teams') || '';
    const playersParam = searchParams.get('players') || '';

    const playerNames = playersParam
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (playerNames.length === 0) {
      return NextResponse.json({ success: true, streams: {} });
    }

    const matchTeams = teamsParam
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Resolve target edition strictly (default to active tournament edition, usually 205)
    let targetEdition = await prisma.edition.findFirst({
      where: editionNumber
        ? { number: editionNumber }
        : { status: 'IN_PROGRESS' },
      select: { id: true, number: true, title: true, tournamentStartDate: true },
      orderBy: { number: 'desc' },
    });

    if (!targetEdition) {
      targetEdition = await prisma.edition.findFirst({
        where: { slot: 'A' },
        select: { id: true, number: true, title: true, tournamentStartDate: true },
        orderBy: { number: 'desc' },
      });
    }

    const targetEditionNumber = targetEdition?.number || editionNumber || 205;
    const targetEditionId = targetEdition?.id;

    // Fetch teams for target edition
    const targetEditionTeams = await prisma.team.findMany({
      where: targetEditionId ? { editionId: targetEditionId } : { edition: { number: targetEditionNumber } },
      select: { name: true, tag: true },
    });
    const validTeamNames = targetEditionTeams.map((t) => t.name.toLowerCase());
    const validMatchTeamNames = matchTeams.map((t) => t.toLowerCase());

    // Build OR clauses for each player name
    const orClauses = playerNames.map((name) => {
      const firstWord = name.split(/\s+/)[0];
      return {
        player: {
          name: {
            contains: firstWord.length >= 3 ? firstWord : name,
            mode: 'insensitive' as const,
          },
        },
      };
    });

    // Query streams STRICTLY belonging to the target edition (and dayNumber if given)
    const dbStreams = await prisma.liveStream.findMany({
      where: {
        edition: { number: targetEditionNumber },
        ...(dayNumber != null ? { dayNumber } : {}),
        OR: orClauses,
      },
      select: {
        id: true,
        dayNumber: true,
        youtubeVideoId: true,
        youtubeUrl: true,
        youtubeEmbedUrl: true,
        status: true,
        player: { select: { id: true, name: true, username: true } },
        team: { select: { name: true, tag: true } },
        edition: { select: { number: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map by normalized player name
    const streamMap: Record<
      string,
      {
        playerName: string;
        dayNumber: number;
        editionNumber?: number | null;
        youtubeVideoId: string | null;
        youtubeUrl: string | null;
        status: string;
        teamName?: string | null;
      }
    > = {};

    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const targetName of playerNames) {
      const targetNorm = norm(targetName);

      const playerStreams = dbStreams.filter((s) => {
        const pName = norm(s.player?.name || s.player?.username || '');
        return pName === targetNorm || pName.includes(targetNorm) || targetNorm.includes(pName);
      });

      // Strict edition streams only
      const editionStreams = playerStreams.filter(
        (s) => s.edition?.number === targetEditionNumber
      );

      // Prefer exact day and matching team
      let match = editionStreams.find((s) => {
        const dayMatch = dayNumber == null || s.dayNumber === dayNumber;
        const teamMatch =
          validMatchTeamNames.length === 0 ||
          (s.team?.name && validMatchTeamNames.includes(s.team.name.toLowerCase()));
        return dayMatch && teamMatch;
      });

      // If no team-specific match, match exact day in this edition
      if (!match && dayNumber != null) {
        match = editionStreams.find((s) => s.dayNumber === dayNumber);
      }

      // If day was not specified, match first in this edition
      if (!match && dayNumber == null && editionStreams.length > 0) {
        match = editionStreams[0];
      }

      if (match) {
        const vidId = cleanId(match.youtubeVideoId) || cleanId(match.youtubeUrl) || cleanId(match.youtubeEmbedUrl);
        if (vidId) {
          streamMap[targetName] = {
            playerName: match.player?.name || targetName,
            dayNumber: match.dayNumber || dayNumber || 1,
            editionNumber: targetEditionNumber,
            youtubeVideoId: vidId,
            youtubeUrl: `https://www.youtube.com/watch?v=${vidId}`,
            status: match.status,
            teamName: match.team?.name || null,
          };
        }
      }
    }

    // For any players still missing, check official YouTube channel videos
    // STRICTLY ensuring they belong to targetEditionNumber
    const missingPlayers = playerNames.filter((p) => !streamMap[p]);
    if (missingPlayers.length > 0) {
      try {
        const channelVideos = await listOfficialChannelVideos(100);
        for (const targetName of missingPlayers) {
          const targetNorm = norm(targetName);
          const channelMatch = channelVideos.find((v) => {
            const rawTitle = v.title || '';
            const t = norm(rawTitle);
            const lowerTitle = rawTitle.toLowerCase();

            // 1. Must contain player name
            if (!t.includes(targetNorm)) return false;

            // 2. Must match dayNumber if provided
            if (dayNumber != null) {
              const dayRegex = new RegExp(`day\\s*${dayNumber}\\b`, 'i');
              if (!dayRegex.test(rawTitle)) return false;
            }

            // 3. Must NOT belong to previous editions
            const edRegex = /edition\s*(\d+)/i;
            const edMatch = rawTitle.match(edRegex);
            if (edMatch && Number(edMatch[1]) !== targetEditionNumber) {
              return false;
            }

            // Check if title mentions known older edition teams that do not belong to targetEdition
            const olderTeams = ['voice victors', 'harmony heroes', 'melody mavericks', 'tune titans', 'sargam strikers', 'legend lions'];
            if (olderTeams.some((ot) => lowerTitle.includes(ot))) {
              return false;
            }

            // Check publication date: Edition 205 tournament began ~Oct 10, 2026
            if (targetEdition?.tournamentStartDate && v.publishedAt) {
              const pubTime = new Date(v.publishedAt).getTime();
              const startLimit = new Date(targetEdition.tournamentStartDate).getTime() - 2 * 86400000;
              if (pubTime < startLimit) {
                return false;
              }
            }

            // 4. Must match either edition number (205) or one of the edition's / match's teams
            const mentionsEdition = lowerTitle.includes(String(targetEditionNumber));
            const mentionsMatchTeam = validMatchTeamNames.length > 0 && validMatchTeamNames.some((tm) => lowerTitle.includes(tm));
            const mentionsValidTeam = validTeamNames.some((tm) => lowerTitle.includes(tm));

            return mentionsEdition || mentionsMatchTeam || mentionsValidTeam;
          });

          if (channelMatch && channelMatch.youtubeVideoId) {
            const detectedTeam = targetEditionTeams.find((tm) =>
              channelMatch.title.toLowerCase().includes(tm.name.toLowerCase())
            );

            streamMap[targetName] = {
              playerName: targetName,
              dayNumber: dayNumber || 1,
              editionNumber: targetEditionNumber,
              youtubeVideoId: channelMatch.youtubeVideoId,
              youtubeUrl: channelMatch.youtubeUrl || `https://www.youtube.com/watch?v=${channelMatch.youtubeVideoId}`,
              status: 'ENDED',
              teamName: detectedTeam?.name || channelMatch.channelTitle || null,
            };
          }
        }
      } catch (err) {
        console.warn('Channel video lookup warning:', err);
      }
    }

    return NextResponse.json({ success: true, streams: streamMap });
  } catch (error: any) {
    console.error('Error fetching match player videos:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

