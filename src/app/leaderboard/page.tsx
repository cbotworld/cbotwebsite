import { prisma } from '@/lib/prisma';
import LeaderboardClient from './LeaderboardClient';

export const revalidate = 0; // Disable caching to always show live rankings

export default async function LeaderboardPage() {
  const users = await prisma.user.findMany({
    orderBy: { rating: 'desc' },
    include: {
      rankingSnapshots: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  const teams = await prisma.team.findMany({
    include: {
      captain: true,
      leagueStandings: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  const sortedTeams = [...teams].sort((a, b) => {
    const rankA = a.leagueStandings[0]?.rank || 999;
    const rankB = b.leagueStandings[0]?.rank || 999;
    return rankA - rankB;
  });

  return <LeaderboardClient players={users} teams={sortedTeams} />;
}
