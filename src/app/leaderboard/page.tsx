import { prisma } from '@/lib/prisma';
import { MOCK_USERS, MOCK_TEAMS } from '@/lib/mock-data';
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
    users = MOCK_USERS;
    sortedTeams = MOCK_TEAMS;
  }

  if (!users || users.length === 0) {
    users = MOCK_USERS;
  }
  if (!sortedTeams || sortedTeams.length === 0) {
    sortedTeams = MOCK_TEAMS;
  }

  return <LeaderboardClient players={users} teams={sortedTeams} />;
}
