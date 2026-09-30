export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { prisma } from '@/lib/prisma';
import HomeClient from './HomeClient';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import { DEFAULT_WEBSITE_CMS } from '@/lib/website-cms';
import { sanitizeCmsImages, safePublicImageUrl, withSafeTeamLogo } from '@/lib/safe-image-url';
import { resolveCurrentEdition } from '@/lib/current-edition';
import { EnrollmentBarWithRegistration } from '@/components/layout/EnrollmentBarWithRegistration';

export default async function HomePage() {
  try {
    // Only query what is actually rendered on the UI to minimize data transfer size.
    // HomeClient only needs edition metadata for basic display, and teams/allTeams for the marquee image strip (using id, name, tag, logo).
    const [currentEditionRef, allTeams, websiteCms] = await Promise.all([
      resolveCurrentEdition(),
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

    const currentEdition = currentEditionRef
      ? await prisma.edition.findUnique({
          where: { id: currentEditionRef.id },
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
        })
      : null;

    // Drop base64 / oversized logos so ISR HTML stays under Vercel's ~19MB limit.
    const currentEditionTeams = (currentEdition?.teams ?? []).map(withSafeTeamLogo);
    const slimAllTeams = allTeams.map(withSafeTeamLogo);
    const currentEditionName = currentEdition
      ? `${currentEdition.title} (Edition #${currentEdition.number})`
      : null;
    const safeCms = sanitizeCmsImages(websiteCms);

    return (
      <>
        <HomeClient
          teams={currentEditionTeams}
          allTeams={slimAllTeams}
          players={[]}
          matches={[]}
          currentEditionName={currentEditionName}
          editionPosterUrl={safePublicImageUrl(currentEdition?.posterUrl) ?? null}
          currentEdition={currentEdition ? {
            id: currentEdition.id,
            title: currentEdition.title,
            theme: currentEdition.theme ?? null,
            bannerImage: safePublicImageUrl(currentEdition.bannerImage),
            posterUrl: safePublicImageUrl(currentEdition.posterUrl),
            number: currentEdition.number,
            tournamentStartDate: currentEdition.tournamentStartDate ? currentEdition.tournamentStartDate.toISOString() : null,
            dayDates: currentEdition.dayDates ?? null,
            totalDays: currentEdition.totalDays ?? 15,
          } : null}
          websiteCms={safeCms}
        />
        <EnrollmentBarWithRegistration />
      </>
    );
  } catch (error) {
    console.error('Error loading HomePage from database:', error);
    // Graceful fallback if database connection is pending or configuring
    return (
      <>
        <HomeClient
          teams={[]}
          allTeams={[]}
          players={[]}
          matches={[]}
          currentEditionName={DEFAULT_WEBSITE_CMS.site.editionLabel}
          editionPosterUrl={DEFAULT_WEBSITE_CMS.hero.posterUrl || null}
          currentEdition={null}
          websiteCms={DEFAULT_WEBSITE_CMS}
        />
        <EnrollmentBarWithRegistration />
      </>
    );
  }
}
