import { prisma } from '@/lib/prisma';
import DailyCombisClient from './DailyCombisClient';

export const revalidate = 300;

export default async function DailyCombisPage() {
  let teams: any[] = [];
  try {
    teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        tag: true,
        savedLineups: true,
        captain: {
          select: { id: true, name: true, username: true }
        }
      }
    });
  } catch (error) {
    console.error('[DailyCombisPage] Error querying teams directly from Prisma:', error);
  }

  return <DailyCombisClient initialTeams={teams} />;
}
