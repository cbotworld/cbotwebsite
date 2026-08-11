import { prisma } from '@/lib/prisma';
import DailyCombisClient from '../editions/200th-combis/DailyCombisClient';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function Edition200CombisPage() {
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
    console.error('[Edition200CombisPage] Error querying teams directly from Prisma:', error);
  }

  return <DailyCombisClient initialTeams={teams} />;
}
