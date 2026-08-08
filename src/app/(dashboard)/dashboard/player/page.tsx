import { prisma } from '@/lib/prisma';
import PlayerClient from './PlayerClient';

export const revalidate = 0;

export default async function PlayerPage() {
  // Fetch mock data or fallback to DB for now
  const team = await prisma.team.findFirst({
    include: {
      captain: true,
      members: {
        include: {
          user: {
            include: {
              rankingSnapshots: {
                orderBy: { createdAt: 'desc' }
              }
            }
          }
        }
      }
    }
  });

  const members = team?.members.map(m => m.user) || [];
  const player = members[0];
  
  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { team1Id: team?.id },
        { team2Id: team?.id }
      ]
    },
    include: {
      team1: true,
      team2: true
    }
  });

  const patterns = await prisma.boardPattern.findMany({
    take: 5
  });

  return (
    <PlayerClient 
      initialPlayer={player} 
      initialTeam={team} 
      initialTeammates={members} 
      initialMatches={matches as any} 
      initialPatterns={patterns as any} 
    />
  );
}
