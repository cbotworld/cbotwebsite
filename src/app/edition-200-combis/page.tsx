import { prisma } from '@/lib/prisma';
import DailyCombisClient from '../editions/200th-combis/DailyCombisClient';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';

export const revalidate = 300;

export default async function Edition200CombisPage() {
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
    console.error('[Edition200CombisPage] Error querying teams directly from Prisma:', error);
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
