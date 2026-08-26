import { prisma } from '@/lib/prisma';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import FixturesClient from './FixturesClient';

export const revalidate = 3600; // Cache fixtures for up to 1 hour; revalidated on-demand via actions

export default async function FixturesPage() {
  const [matches, cms] = await Promise.all([
    prisma.match.findMany({
      include: {
        team1: true,
        team2: true
      },
      orderBy: {
        scheduledTime: 'asc'
      }
    }),
    getWebsiteCmsContent(),
  ]);

  // Safe mapping of match status and time for the client component
  const safeMatches = matches.map(m => ({
    ...m,
    scheduledTime: m.scheduledTime ? m.scheduledTime.toISOString() : new Date().toISOString()
  }));

  return (
    <FixturesClient
      initialMatches={safeMatches}
      pageCms={cms.pages.fixtures}
      scheduleHref={cms.nav.scheduleHref}
      scheduleLabel={cms.nav.scheduleLabel}
    />
  );
}
