import { prisma } from '@/lib/prisma';
import DailyCombisClient from '../editions/200th-combis/DailyCombisClient';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import { PUBLIC_COMBIS_PATH } from '@/lib/website-cms';

export const revalidate = 300;

export default async function CombisPage() {
  const cms = await getWebsiteCmsContent();
  let teams: any[] = [];
  try {
    teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        tag: true,
        logo: true,
        savedLineups: true,
        captain: {
          select: { id: true, name: true, username: true },
        },
      },
    });
  } catch (error) {
    console.error('[CombisPage] Error querying teams directly from Prisma:', error);
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

export const metadata = {
  alternates: { canonical: PUBLIC_COMBIS_PATH },
};
