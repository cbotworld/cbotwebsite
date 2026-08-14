import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import CaptainClient from './CaptainClient';

export const revalidate = 0;

export default async function CaptainPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login?callbackUrl=/dashboard/captain');
  }

  const sessionUser = session.user as any;
  const role = sessionUser.role;
  if (role !== 'CAPTAIN' && role !== 'ORGANIZER' && role !== 'SUPER_ADMIN') {
    redirect('/dashboard/player');
  }

  const userId = sessionUser.id;
  const username = sessionUser.username;

  // Parallelize independent initial queries to eliminate network waterfalls
  const [captainUser, activeEdition, allUsers] = await Promise.all([
    prisma.user.findFirst({
      where: {
        OR: [
          { id: userId },
          { username: username?.toLowerCase() }
        ]
      }
    }),
    prisma.edition.findFirst({
      orderBy: { number: 'desc' },
      include: {
        patterns: {
          orderBy: { sequence: 'asc' },
          include: { pattern: true },
        },
      },
    }),
    prisma.user.findMany({ 
      select: { id: true, name: true, username: true, role: true, rating: true, average: true, target: true },
      orderBy: { name: 'asc' } 
    }),
  ]);

  // Build ordered round format list
  const savedRoundFormats: string[] = (activeEdition as any)?.patterns?.map(
    (bp: any) => bp.matchFormat || 'SINGLES'
  ) ?? [];

  const roundsPerDay = savedRoundFormats.length > 0 ? savedRoundFormats.length : 5;

  // Execute team queries in parallel
  const [team, allTeams] = await Promise.all([
    captainUser
      ? prisma.team.findFirst({
          where: {
            OR: [
              { captainId: captainUser.id },
              {
                members: {
                  some: {
                    userId: captainUser.id,
                    editionId: activeEdition?.id ?? undefined,
                  }
                }
              }
            ],
            ...(activeEdition ? { editionId: activeEdition.id } : {})
          },
          include: {
            captain: true,
            members: { include: { user: true } }
          }
        })
      : Promise.resolve(null),
    prisma.team.findMany({
      where: activeEdition ? { editionId: activeEdition.id } : {},
      include: {
        captain: true,
        members: { include: { user: true } }
      }
    }),
  ]);
  const members = team?.members?.map((m: any) => m.user) || [];

  // ── PLAYER DATA for the embedded player dashboard panel ─────────────────
  // Captains are also players — fetch all the same data PlayerClient needs
  const captainPlayerMatches = team ? await prisma.match.findMany({
    where: {
      OR: [
        { team1Id: team.id },
        { team2Id: team.id },
      ]
    },
    include: { team1: true, team2: true },
    orderBy: { scheduledTime: 'asc' },
  }) : [];

  const captainLiveStreams = captainUser ? await prisma.liveStream.findMany({
    where: {
      playerId: captainUser.id,
      matchId: { in: captainPlayerMatches.map((m) => m.id) },
    },
    select: { id: true, matchId: true, status: true, createdAt: true, youtubeUrl: true },
    orderBy: { createdAt: 'desc' },
  }) : [];

  const boardPatterns = await prisma.boardPattern.findMany({ take: 5 });

  return (
    <CaptainClient
      initialTeam={team}
      initialMembers={members}
      initialAllTeams={allTeams}
      initialAllUsers={allUsers}
      initialActiveEdition={{
        ...activeEdition,
        roundsPerDay,
        roundFormats: savedRoundFormats,
      }}
      initialPlayer={captainUser || { ...sessionUser, wins: 0, losses: 0, rating: 1200, queenStrikes: 0, boardsWon: 0 }}
      initialPlayerMatches={captainPlayerMatches as any}
      initialPlayerStreams={captainLiveStreams as any}
      initialPatterns={boardPatterns as any}
    />
  );
}
