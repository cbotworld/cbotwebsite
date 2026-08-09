import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import OrganizerClient from './OrganizerClient';
import { MOCK_SCORE_REPORTS, MOCK_TEAMS, MOCK_USERS, DELETED_USERNAMES } from '@/lib/mock-data';

export const revalidate = 0;

export default async function OrganizerPage() {
  const session = await getServerSession(authOptions);

  // Require logged-in session for organizer dashboard access
  if (!session?.user) {
    redirect('/login?callbackUrl=/dashboard/organizer');
  }

  const role = (session.user as any)?.role;
  if (role !== 'ORGANIZER' && role !== 'SUPER_ADMIN') {
    if (role === 'CAPTAIN') redirect('/dashboard/captain');
    redirect('/dashboard/player');
  }

  let editions: any[] = [];
  let users: any[] = [];
  let dbTeams: any[] = [];

  try {
    [editions, users, dbTeams] = await Promise.all([
      prisma.edition.findMany({
        orderBy: { number: 'desc' },
        include: {
          patterns: {
            orderBy: { sequence: 'asc' },
            include: { pattern: true },
          },
        },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
      }),
      prisma.team.findMany({
        include: {
          captain: true,
          members: {
            include: { user: true }
          },
          leagueStandings: true
        },
        orderBy: { createdAt: 'desc' }
      }),
    ]);
  } catch (e) {
    console.error('Database connection error in OrganizerPage fallback to mocks', e);
  }

  const teams = dbTeams.length > 0 ? dbTeams : MOCK_TEAMS;
  
  // Filter out legacy dummy usernames (e.g. rajesh_cbot, queen_ananya, striker_vikram)
  const dummyUsernames = new Set(['rajesh_cbot', 'queen_ananya', 'striker_vikram']);

  const filteredDbUsers = users.filter((u: any) => {
    const uname = u.username?.toLowerCase();
    return uname && !dummyUsernames.has(uname) && !DELETED_USERNAMES.has(uname) && !DELETED_USERNAMES.has(u.id?.toLowerCase());
  });

  const dbUserMap = new Map(filteredDbUsers.map((u: any) => [u.username?.toLowerCase(), u]));
  const mergedUsersMap = new Map<string, any>();

  // Always include all 112 MOCK_USERS (except deleted ones), merged with any DB overrides
  MOCK_USERS.filter((mu: any) => {
    const key = mu.username.toLowerCase();
    return !DELETED_USERNAMES.has(key) && !DELETED_USERNAMES.has(mu.id.toLowerCase());
  }).forEach((mu: any) => {
    const key = mu.username.toLowerCase();
    const dbu = dbUserMap.get(key);
    mergedUsersMap.set(key, {
      ...mu,
      ...(dbu || {}),
      average: (dbu && dbu.average !== null && dbu.average !== undefined && dbu.average !== 0) ? dbu.average : mu.average,
      target: (dbu && dbu.target !== null && dbu.target !== undefined && dbu.target !== 0) ? dbu.target : mu.target,
    });
  });

  // Also append any extra DB users not in MOCK_USERS
  filteredDbUsers.forEach((dbu: any) => {
    const key = dbu.username?.toLowerCase();
    if (key && !mergedUsersMap.has(key)) {
      mergedUsersMap.set(key, dbu);
    }
  });

  const usersList = Array.from(mergedUsersMap.values());

  return (
    <OrganizerClient 
      initialEditions={editions}
      initialUsersList={usersList}
      initialScoreReports={MOCK_SCORE_REPORTS}
      initialTeams={teams}
    />
  );
}

