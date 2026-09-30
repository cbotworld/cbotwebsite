export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import PlayersClient from './PlayersClient';
import { DELETED_USERNAMES } from '@/lib/mock-data';

export const revalidate = 0;

export default async function PlayersPage() {
  let users: any[] = [];
  
  try {
    users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
  } catch (e) {
    console.error('Database connection error in PlayersPage', e);
  }

  // Filter out legacy dummy usernames (e.g. rajesh_cbot, queen_ananya, striker_vikram)
  const dummyUsernames = new Set(['rajesh_cbot', 'queen_ananya', 'striker_vikram']);

  const filteredDbUsers = users.filter((u: any) => {
    const uname = u.username?.toLowerCase();
    return uname && !dummyUsernames.has(uname) && !DELETED_USERNAMES.has(uname) && !DELETED_USERNAMES.has(u.id?.toLowerCase());
  });

  return <PlayersClient initialPlayers={filteredDbUsers} />;
}
