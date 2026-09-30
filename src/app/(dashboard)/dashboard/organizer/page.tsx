import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import OrganizerClient from './OrganizerClient';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import { MOCK_SCORE_REPORTS, MOCK_TEAMS, MOCK_USERS, DELETED_USERNAMES } from '@/lib/mock-data';
import { ensureOfficialDayDates } from '@/lib/edition-day-dates';
import { resolveCurrentEdition } from '@/lib/current-edition';
import { parseGradingGrid, computePlayerTargetUpdates, computePlayerGradeUpdates } from '@/lib/grading';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
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
  let gradingSettings: any[] = [];

  let websiteCms = await getWebsiteCmsContent();

  try {
    editions = await prisma.edition.findMany({
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
    });

    users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    dbTeams = await prisma.team.findMany({
      include: {
        captain: true,
        members: {
          include: { user: true },
        },
        spocMembers: {
          include: { user: true },
        },
        leagueStandings: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    gradingSettings = await prisma.systemSetting.findMany({
      where: {
        key: { startsWith: 'edition_grading_' },
      },
    });

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

  const initialEditionTargetMaps: Record<string, Record<string, number>> = {};
  const initialEditionGradeMaps: Record<string, Record<string, string>> = {};

  gradingSettings.forEach((setting) => {
    const editionId = setting.key.replace('edition_grading_', '');
    const grid = parseGradingGrid(setting.value);
    if (!grid) return;

    const targetUpdates = computePlayerTargetUpdates(grid);
    const targetMap: Record<string, number> = {};
    targetUpdates.forEach((t) => {
      targetMap[t.userId] = t.target;
    });
    initialEditionTargetMaps[editionId] = targetMap;

    const gradeUpdates = computePlayerGradeUpdates(grid);
    const gradeMap: Record<string, string> = {};
    gradeUpdates.forEach((g) => {
      gradeMap[g.userId] = g.grade;
    });
    initialEditionGradeMaps[editionId] = gradeMap;
  });

  return (
    <OrganizerClient 
      initialEditions={editions}
      initialUsersList={usersList}
      initialScoreReports={MOCK_SCORE_REPORTS}
      initialTeams={teams}
      initialWebsiteCms={websiteCms}
      initialEditionTargetMaps={initialEditionTargetMaps}
      initialEditionGradeMaps={initialEditionGradeMaps}
    />
  );
}

