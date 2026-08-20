import { prisma } from '@/lib/prisma';
import HomeClient from './HomeClient';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import { DEFAULT_WEBSITE_CMS } from '@/lib/website-cms';

export const revalidate = 3600; // Cache homepage for 1 hour; revalidated on-demand via server actions

export default async function HomePage() {
  try {
    // Only query what is actually rendered on the UI to minimize data transfer size.
    // HomeClient only needs edition metadata for basic display, and teams/allTeams for the marquee image strip (using id, name, tag, logo).
    const [currentEdition, allTeams, websiteCms] = await Promise.all([
      prisma.edition.findFirst({
        orderBy: { number: 'desc' },
        select: {
          id: true,
          title: true,
          number: true,
          theme: true,
          bannerImage: true,
          posterUrl: true,
          tournamentStartDate: true,
          dayDates: true,
          totalDays: true,
          teams: {
            select: {
              id: true,
              name: true,
              tag: true,
              logo: true,
            },
          },
        },
      }),
      prisma.team.findMany({
        select: {
          id: true,
          name: true,
          tag: true,
          logo: true,
        },
      }),
      getWebsiteCmsContent(),
    ]);

    const currentEditionTeams = currentEdition?.teams ?? [];
    const currentEditionName = currentEdition
      ? `${currentEdition.title} (Edition #${currentEdition.number})`
      : null;

    // Safely serialize and pass only the necessary properties to the client component
    return (
      <HomeClient
        teams={JSON.parse(JSON.stringify(currentEditionTeams))}
        allTeams={JSON.parse(JSON.stringify(allTeams))}
        players={[]}
        matches={[]}
        currentEditionName={currentEditionName}
        editionPosterUrl={currentEdition?.posterUrl ?? null}
        currentEdition={currentEdition ? {
          id: currentEdition.id,
          title: currentEdition.title,
          theme: currentEdition.theme ?? null,
          bannerImage: currentEdition.bannerImage ?? null,
          posterUrl: currentEdition.posterUrl ?? null,
          number: currentEdition.number,
          tournamentStartDate: currentEdition.tournamentStartDate ? currentEdition.tournamentStartDate.toISOString() : null,
          dayDates: currentEdition.dayDates ?? null,
          totalDays: currentEdition.totalDays ?? 15,
        } : null}
        websiteCms={JSON.parse(JSON.stringify(websiteCms))}
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
        websiteCms={DEFAULT_WEBSITE_CMS}
      />
    );
  }
}
