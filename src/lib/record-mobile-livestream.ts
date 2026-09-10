import { prisma } from '@/lib/prisma';
import { resolveCurrentEditionRecord } from '@/lib/current-edition';

type RecordArgs = {
  userId: string;
  dayNumber: number;
  editionId?: string | null;
  teamId?: string | null;
  opponentName?: string | null;
  youtubeBroadcastId: string;
  youtubeStreamId?: string | null;
  youtubeVideoId?: string | null;
  youtubeUrl: string;
  rtmpIngestionUrl?: string | null;
  streamKey?: string | null;
  status?: string;
  playMode?: string;
};

async function ensureDayMatch(opts: {
  editionId: string;
  dayNumber: number;
  teamId?: string | null;
  opponentTeamId?: string | null;
}) {
  const existing = await prisma.match.findFirst({
    where: {
      editionId: opts.editionId,
      round: opts.dayNumber,
      ...(opts.teamId
        ? { OR: [{ team1Id: opts.teamId }, { team2Id: opts.teamId }] }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing;

  return prisma.match.create({
    data: {
      editionId: opts.editionId,
      round: opts.dayNumber,
      matchNumber: opts.dayNumber,
      stage: 'LEAGUE',
      team1Id: opts.teamId || undefined,
      team2Id: opts.opponentTeamId || undefined,
      status: 'LIVE',
      scheduledTime: new Date(),
      tableNumber: 1,
    },
  });
}

/** Persist a Cbot-app YouTube broadcast so sequential day unlock and Videos can see it. */
export async function recordMobileLiveStream(args: RecordArgs) {
  if (!args.userId || !args.youtubeBroadcastId || args.dayNumber < 1) return null;

  const edition = args.editionId
    ? await prisma.edition.findUnique({ where: { id: args.editionId } })
    : await resolveCurrentEditionRecord();
  if (!edition) return null;

  let teamId = args.teamId || null;
  if (!teamId) {
    const participation = await prisma.editionParticipant.findFirst({
      where: { userId: args.userId, editionId: edition.id },
      orderBy: { createdAt: 'desc' },
    });
    teamId = participation?.teamId || null;
  }

  let opponentTeamId: string | null = null;
  if (args.opponentName) {
    const opp = await prisma.team.findFirst({
      where: {
        editionId: edition.id,
        name: { equals: args.opponentName.trim(), mode: 'insensitive' },
      },
    });
    opponentTeamId = opp?.id || null;
  }

  const bonus =
    args.playMode === 'tiebreak' || args.playMode === 'practice' ? args.playMode : null;
  const match = await ensureDayMatch({
    editionId: edition.id,
    dayNumber: args.dayNumber,
    teamId,
    opponentTeamId,
  });

  const youtubeUrl = args.youtubeUrl;
  const youtubeVideoId = args.youtubeVideoId || args.youtubeBroadcastId;
  // Tag bonus streams in the embed URL so they do not unlock the next official day.
  const embed = bonus
    ? `https://www.youtube.com/embed/${youtubeVideoId}?cbot=${bonus}`
    : `https://www.youtube.com/embed/${youtubeVideoId}`;

  const existing = await prisma.liveStream.findFirst({
    where: { youtubeBroadcastId: args.youtubeBroadcastId },
  });

  const data = {
    editionId: edition.id,
    matchId: match.id,
    dayNumber: args.dayNumber,
    playerId: args.userId,
    teamId,
    youtubeBroadcastId: args.youtubeBroadcastId,
    youtubeStreamId: args.youtubeStreamId || null,
    youtubeVideoId,
    youtubeUrl,
    youtubeEmbedUrl: embed,
    rtmpIngestionUrl: args.rtmpIngestionUrl || null,
    streamKey: args.streamKey || null,
    status: args.status || 'READY',
    scheduledAt: new Date(),
  };

  if (existing) {
    return prisma.liveStream.update({ where: { id: existing.id }, data });
  }
  return prisma.liveStream.create({ data });
}

export async function updateMobileLiveStreamStatus(
  youtubeBroadcastId: string,
  status: 'LIVE' | 'ARCHIVED' | 'ENDED',
) {
  if (!youtubeBroadcastId) return null;
  const stream = await prisma.liveStream.findFirst({
    where: { youtubeBroadcastId },
  });
  if (!stream) return null;

  const now = new Date();
  return prisma.liveStream.update({
    where: { id: stream.id },
    data: {
      status,
      ...(status === 'LIVE' ? { streamStartedAt: stream.streamStartedAt || now } : {}),
      ...(status === 'ARCHIVED' || status === 'ENDED'
        ? { streamEndedAt: now, recordedAt: stream.recordedAt || now, status: 'ARCHIVED' }
        : {}),
    },
  });
}
