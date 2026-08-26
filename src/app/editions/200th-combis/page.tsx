import { prisma } from '@/lib/prisma';
import DailyCombisClient from './DailyCombisClient';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';

export const revalidate = 300;

export default async function DailyCombisPage() {
  const cms = await getWebsiteCmsContent();
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

  return (
    <DailyCombisClient
      initialTeams={teams}
      pageCms={cms.pages.combis}
      shortName={cms.site.shortName}
      editionLabel={cms.site.editionLabel}
    />
  );
}
