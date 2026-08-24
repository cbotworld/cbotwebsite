import { NextResponse } from 'next/server';
import { mobileCorsHeaders } from '@/lib/mobile-cors';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import { safePublicImageUrl } from '@/lib/safe-image-url';

export const dynamic = 'force-dynamic';

const SITE_ORIGIN = 'https://www.cbotworld.com';

function absolutePublicUrl(value?: string | null) {
  const safe = safePublicImageUrl(value);
  if (!safe) return '';
  if (/^https?:\/\//i.test(safe)) return safe;
  return `${SITE_ORIGIN}${safe.startsWith('/') ? safe : `/${safe}`}`;
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: mobileCorsHeaders });
}

export async function GET() {
  try {
    const cms = await getWebsiteCmsContent();
    const eliteSponsors = [...cms.sponsors.eliteSponsors]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((sponsor) => ({
        id: sponsor.id,
        name: sponsor.name,
        logoUrl: absolutePublicUrl(sponsor.logoUrl),
        websiteUrl: sponsor.websiteUrl?.trim() || '',
        posterUrl: absolutePublicUrl(sponsor.posterUrl),
        layout: sponsor.layout,
        accent: sponsor.accent,
        sortOrder: sponsor.sortOrder,
      }))
      .filter((sponsor) => sponsor.name && sponsor.logoUrl);

    return NextResponse.json(
      {
        success: true,
        sectionBadge: cms.sponsors.sectionBadge,
        sectionTitle: cms.sponsors.sectionTitle,
        eliteSponsors,
      },
      { headers: mobileCorsHeaders },
    );
  } catch (error) {
    console.error('[mobile/sponsors]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load sponsors.', eliteSponsors: [] },
      { status: 500, headers: mobileCorsHeaders },
    );
  }
}
