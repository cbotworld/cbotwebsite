import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import OrganizerClient from './OrganizerClient';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import { MOCK_SCORE_REPORTS, MOCK_TEAMS, MOCK_USERS, DELETED_USERNAMES } from '@/lib/mock-data';
import { ensureOfficialDayDates } from '@/lib/edition-day-dates';
import { resolveCurrentEdition } from '@/lib/current-edition';

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

  let websiteCms = await getWebsiteCmsContent();

  try {
    [editions, users, dbTeams, websiteCms] = await Promise.all([
      prisma.edition.findMany({
        orderBy: { number: 'desc' },
        include: {
          participants: {
            orderBy: [{ gradeAverage: 'asc' }, { user: { name: 'asc' } }],
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  average: true,
                  target: true,
                  role: true,
                  isActivated: true,
                },
              },
              team: {
                select: {
                  id: true,
                  name: true,
                  tag: true,
                },
              },
            },
          },
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
          spocMembers: {
            include: { user: true }
          },
          leagueStandings: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      getWebsiteCmsContent(),
    ]);

    // Only the edition the dashboard opens on; archived ones keep their own dates.
    const liveEditionRef = await resolveCurrentEdition();
    await ensureOfficialDayDates(
      (liveEditionRef && editions.find((e) => e.id === liveEditionRef.id)) || editions[0],
    );
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

  const usersList = filteredDbUsers;

  return (
    <OrganizerClient 
      initialEditions={editions}
      initialUsersList={usersList}
      initialScoreReports={MOCK_SCORE_REPORTS}
      initialTeams={teams}
      initialWebsiteCms={websiteCms}
    />
  );
}

