import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import PlayerClient from './PlayerClient';

export const revalidate = 0;

export default async function PlayerPage() {
  const session = await getServerSession(authOptions);

  // If not logged in, redirect to login
  if (!session?.user) {
    redirect('/login?callbackUrl=/dashboard/player');
  }

  const sessionUser = session.user as any;
  const userId = sessionUser.id;
  const username = sessionUser.username;

  // Fetch the LOGGED-IN player's full profile from DB
  const player = await prisma.user.findFirst({
    where: {
      OR: [
        { id: userId },
        { username: username?.toLowerCase() },
      ]
    },
    include: {
      rankingSnapshots: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  });

  // Find the team this player belongs to in the current edition
  const activeEdition = await prisma.edition.findFirst({ orderBy: { number: 'desc' } });

  const editionParticipant = player ? await prisma.editionParticipant.findFirst({
    where: {
      userId: player.id,
      editionId: activeEdition?.id,
    },
    include: {
      team: {
        include: {
          captain: true,
          members: {
            include: {
              user: true
            }
          }
        }
      }
    }
  }) : null;

  const team = editionParticipant?.team || null;
  const teammates = team?.members?.map((m: any) => m.user) || [];

  const matches = team ? await prisma.match.findMany({
    where: {
      OR: [
        { team1Id: team.id },
        { team2Id: team.id }
      ]
    },
    include: {
      team1: true,
      team2: true
    },
    orderBy: { scheduledTime: 'asc' }
  }) : [];

  const patterns = await prisma.boardPattern.findMany({ take: 5 });

  // Fetch liveStreams for this player so client knows which matches already have recordings
  const liveStreams = player ? await prisma.liveStream.findMany({
    where: {
      playerId: player.id,
      matchId: { in: matches.map((m) => m.id) },
    },
    select: { id: true, matchId: true, status: true, createdAt: true, youtubeUrl: true },
    orderBy: { createdAt: 'desc' },
  }) : [];

  return (
    <PlayerClient
      initialPlayer={player || { ...sessionUser, wins: 0, losses: 0, rating: 1200, queenStrikes: 0, boardsWon: 0 }}
      initialTeam={team}
      initialTeammates={teammates}
      initialMatches={matches as any}
      initialPatterns={patterns as any}
      initialStreams={liveStreams as any}
    />
  );
}
