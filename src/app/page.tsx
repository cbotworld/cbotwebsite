import { prisma } from '@/lib/prisma';
import HomeClient from './HomeClient';

export const revalidate = 0;

export default async function HomePage() {
  try {
    // Fetch current active edition (IN_PROGRESS first, then most recent)
    const currentEdition = (await prisma.edition.findFirst({
      where: { status: 'IN_PROGRESS' },
      orderBy: { number: 'desc' },
      include: {
        teams: {
          include: {
            captain: true,
            members: {
              include: { user: true },
            },
            leagueStandings: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    })) ?? (await prisma.edition.findFirst({
      orderBy: { number: 'desc' },
      include: {
        teams: {
          include: {
            captain: true,
            members: {
              include: { user: true },
            },
            leagueStandings: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    }));

    const currentEditionTeams = currentEdition?.teams ?? [];
    const currentEditionName = currentEdition
      ? `${currentEdition.title} (Edition #${currentEdition.number})`
      : null;

    // Fetch players ranked by ELO
    const players = await prisma.user.findMany({
      orderBy: { rating: 'desc' },
      include: {
        rankingSnapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Fetch current edition matches only
    const rawMatches = currentEdition
      ? await prisma.match.findMany({
          where: { editionId: currentEdition.id },
          include: { team1: true, team2: true },
          orderBy: { scheduledTime: 'asc' },
        })
      : [];

    const matches = rawMatches.map(m => ({
      ...m,
      scheduledTime: m.scheduledTime ? m.scheduledTime.toISOString() : new Date().toISOString(),
    }));

    // Rankings: fetch all-time teams sorted by league standing
    const allTeams = await prisma.team.findMany({
      include: {
        captain: true,
        leagueStandings: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Safely serialize all database records before passing to client component
    return (
      <HomeClient
        teams={JSON.parse(JSON.stringify(currentEditionTeams))}
        allTeams={JSON.parse(JSON.stringify(allTeams))}
        players={JSON.parse(JSON.stringify(players))}
        matches={JSON.parse(JSON.stringify(matches))}
        currentEditionName={currentEditionName}
        editionPosterUrl={currentEdition?.posterUrl ?? null}
        currentEdition={currentEdition ? {
          id: currentEdition.id,
          title: currentEdition.title,
          theme: currentEdition.theme ?? null,
          bannerImage: currentEdition.bannerImage ?? null,
          posterUrl: currentEdition.posterUrl ?? null,
          number: currentEdition.number,
        } : null}
      />
    );
  } catch (error) {
    console.error('Error loading HomePage from database:', error);
    // Graceful fallback if database connection is pending or configuring
    return (
      <HomeClient
        teams={[]}
        allTeams={[]}
        players={[]}
        matches={[]}
        currentEditionName="Edition #200"
        editionPosterUrl={null}
        currentEdition={null}
      />
    );
  }
}
