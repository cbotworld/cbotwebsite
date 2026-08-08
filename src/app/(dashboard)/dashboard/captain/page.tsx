import { prisma } from '@/lib/prisma';
import CaptainClient from './CaptainClient';

export const revalidate = 0;

export default async function CaptainPage() {
  // Try to fetch a mock team since we don't have session auth completely wired to team lookup yet
  const team = await prisma.team.findFirst({
    include: {
      captain: true,
      members: {
        include: {
          user: true
        }
      }
    }
  });

  const members = team?.members.map(m => m.user) || [];

  return <CaptainClient initialTeam={team} initialMembers={members} />;
}
