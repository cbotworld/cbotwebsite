import { prisma } from '@/lib/prisma';
import OrganizerClient from './OrganizerClient';
import { MOCK_SCORE_REPORTS, MOCK_TEAMS } from '@/lib/mock-data';

export const revalidate = 0;

export default async function OrganizerPage() {
  const editions = await prisma.edition.findMany({
    orderBy: { number: 'desc' }
  });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' }
  });

  // Keep Mock data for teams and score reports until their sub-phases
  return (
    <OrganizerClient 
      initialEditions={editions}
      initialUsersList={users}
      initialScoreReports={MOCK_SCORE_REPORTS}
      initialTeams={MOCK_TEAMS}
    />
  );
}
