import { prisma } from '@/lib/prisma';
import LeaderboardClient from './LeaderboardClient';

export const revalidate = 0; // Disable caching to always show live rankings

export default async function LeaderboardPage() {
  let users: any[] = [];
  let sortedTeams: any[] = [];

  try {
    users = await prisma.user.findMany({
      orderBy: { rating: 'desc' },
    });

    const teams = await prisma.team.findMany({
      include: {
        captain: true,
      }
    });
    sortedTeams = teams;
  } catch (err) {
    console.error('Database connection error in LeaderboardPage', err);
  }

  return <LeaderboardClient players={users} teams={sortedTeams} />;
}
