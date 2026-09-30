export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import LeaderboardClient from './LeaderboardClient';

export const revalidate = 0;

export default async function LeaderboardPage() {
  let users: any[] = [];
  let sortedTeams: any[] = [];
  const cms = await getWebsiteCmsContent();

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

  return <LeaderboardClient players={users} teams={sortedTeams} pageCms={cms.pages.leaderboard} />;
}
