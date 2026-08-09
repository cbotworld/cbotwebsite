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
    />
  );
}
