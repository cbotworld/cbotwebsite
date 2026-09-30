'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { memoryCache } from '@/lib/memory-cache';
import {
  DEFAULT_WEBSITE_CMS,
  parseWebsiteCms,
  pinPublicNavHrefs,
  PUBLIC_COMBIS_PATH,
  PUBLIC_SCHEDULE_PATH,
  PUBLIC_TEAMS_PLAYERS_PATH,
  WEBSITE_CMS_KEY,
  type WebsiteCmsContent,
  type WebsiteHeroCms,
  type WebsiteSponsorsCms,
  type WebsiteSpecialSponsorsCms,
  type WebsiteGoldSponsorsCms,
  type WebsiteLegacyCms,
  type WebsiteFooterCms,
  type WebsiteNavCms,
  type WebsiteSiteCms,
  type WebsitePagesCms,
} from '@/lib/website-cms';
import { updateEditionBranding } from '@/lib/actions/tournamentActions';
import { safePublicImageUrl } from '@/lib/safe-image-url';

async function requireOrganizer() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== 'ORGANIZER' && role !== 'SUPER_ADMIN')) {
    return { ok: false as const, error: 'Unauthorized' };
  }
  return { ok: true as const };
}

import { cache } from 'react';

export const getWebsiteCmsContent = cache(async function getWebsiteCmsContent(): Promise<WebsiteCmsContent> {
  try {
    return await memoryCache.getOrSet('website_cms_content', 5, async () => {
      try {
        const row = await prisma.systemSetting.findUnique({ where: { key: WEBSITE_CMS_KEY } });
        return parseWebsiteCms(row?.value);
      } catch (dbErr) {
        console.warn('[getWebsiteCmsContent] DB query warning, falling back to default:', dbErr);
        return DEFAULT_WEBSITE_CMS;
      }
    });
  } catch (error) {
    console.warn('[getWebsiteCmsContent] Memory cache error:', error);
    return DEFAULT_WEBSITE_CMS;
  }
});

async function saveWebsiteCms(content: WebsiteCmsContent) {
  memoryCache.invalidate('website_cms_content');
  await prisma.systemSetting.upsert({
    where: { key: WEBSITE_CMS_KEY },
    create: { key: WEBSITE_CMS_KEY, value: JSON.stringify(content) },
    update: { value: JSON.stringify(content) },
  });
  revalidatePath('/', 'layout');
  revalidatePath('/editions');
  revalidatePath('/dashboard/organizer');
  revalidatePath(PUBLIC_COMBIS_PATH);
  revalidatePath(PUBLIC_SCHEDULE_PATH);
  revalidatePath(PUBLIC_TEAMS_PLAYERS_PATH);
}

export async function updateWebsiteHeroCms(data: WebsiteHeroCms, editionId?: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };

  try {
    const current = await getWebsiteCmsContent();

    // An inline (data:) image can't be stored, but it must not block the text
    // edits in the same form - keep the previous image and warn instead.
    const posterIsInline = (data.posterUrl || '').startsWith('data:');
    const bannerIsInline = (data.bannerImage || '').startsWith('data:');
    const posterUrl = posterIsInline
      ? current.hero.posterUrl || ''
      : safePublicImageUrl(data.posterUrl) || '';
    const bannerImage = bannerIsInline ? current.hero.bannerImage : data.bannerImage || '';

    const stillInline = [posterIsInline && 'poster', bannerIsInline && 'banner'].filter(
      Boolean,
    ) as string[];

    const hero = { ...current.hero, ...data, posterUrl, bannerImage };
    await saveWebsiteCms({ ...current, hero });

    if (editionId) {
      await updateEditionBranding(editionId, {
        bannerImage: safePublicImageUrl(bannerImage) || undefined,
        posterUrl: posterUrl || undefined,
      });
    }

    return {
      success: true,
      hero,
      warning: stillInline.length
        ? `Text saved, but the ${stillInline.join(' and ')} image is still an inline preview and was left unchanged. Click Replace Image, wait for a public URL, then save again.`
        : undefined,
    };
  } catch (error) {
    console.error('[updateWebsiteHeroCms]', error);
    return { success: false, error: 'Failed to save hero content' };
  }
}

export async function updateWebsiteSponsorsCms(data: WebsiteSponsorsCms) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };

  try {
    const current = await getWebsiteCmsContent();
    const sponsors = { ...current.sponsors, ...data };
    await saveWebsiteCms({ ...current, sponsors });
    return { success: true, sponsors };
  } catch (error) {
    console.error('[updateWebsiteSponsorsCms]', error);
    return { success: false, error: 'Failed to save sponsors content' };
  }
}

async function saveCmsPatch(patch: Partial<WebsiteCmsContent>) {
  const current = await getWebsiteCmsContent();
  await saveWebsiteCms({ ...current, ...patch });
}

export async function updateWebsiteSpecialSponsorsCms(data: WebsiteSpecialSponsorsCms) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    await saveCmsPatch({ specialSponsors: { ...(await getWebsiteCmsContent()).specialSponsors, ...data } });
    return { success: true };
  } catch (error) {
    console.error('[updateWebsiteSpecialSponsorsCms]', error);
    return { success: false, error: 'Failed to save special sponsors' };
  }
}

export async function updateWebsiteGoldSponsorsCms(data: WebsiteGoldSponsorsCms) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    await saveCmsPatch({ goldSponsors: { ...(await getWebsiteCmsContent()).goldSponsors, ...data } });
    return { success: true };
  } catch (error) {
    console.error('[updateWebsiteGoldSponsorsCms]', error);
    return { success: false, error: 'Failed to save gold sponsors' };
  }
}

export async function updateWebsiteLegacyCms(data: WebsiteLegacyCms) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    await saveCmsPatch({ legacy: { ...(await getWebsiteCmsContent()).legacy, ...data } });
    return { success: true };
  } catch (error) {
    console.error('[updateWebsiteLegacyCms]', error);
    return { success: false, error: 'Failed to save legacy videos' };
  }
}

export async function updateWebsiteNavCms(data: WebsiteNavCms) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    // Fall back to what is already stored rather than the 200th-edition
    // default, so clearing a field cannot silently drag the site back to it.
    const current = (await getWebsiteCmsContent()).nav;
    const keep = (key: keyof WebsiteNavCms) =>
      (data[key] || '').trim() || current[key] || DEFAULT_WEBSITE_CMS.nav[key];

    await saveCmsPatch({
      nav: pinPublicNavHrefs({
        editionButtonLabel: keep('editionButtonLabel'),
        editionButtonHref: keep('editionButtonHref'),
        combisLabel: keep('combisLabel'),
        combisHref: PUBLIC_COMBIS_PATH,
        scheduleLabel: keep('scheduleLabel'),
        scheduleHref: PUBLIC_SCHEDULE_PATH,
      }),
    });
    return { success: true };
  } catch (error) {
    console.error('[updateWebsiteNavCms]', error);
    return { success: false, error: 'Failed to save navigation button' };
  }
}

export async function updateWebsiteSiteCms(data: WebsiteSiteCms) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    // Brand tokens feed page titles and metadata everywhere, so a blank field
    // keeps the stored value instead of rendering an empty site name.
    const current = (await getWebsiteCmsContent()).site;
    const keep = (key: keyof WebsiteSiteCms) =>
      (data[key] || '').trim() || current[key] || DEFAULT_WEBSITE_CMS.site[key];

    await saveCmsPatch({
      site: {
        brandName: keep('brandName'),
        shortName: keep('shortName'),
        brandTagline: keep('brandTagline'),
        organizationName: keep('organizationName'),
        founderName: keep('founderName'),
        editionLabel: keep('editionLabel'),
        editionSeriesName: keep('editionSeriesName'),
        metaTitle: keep('metaTitle'),
        metaDescription: keep('metaDescription'),
        metaKeywords: keep('metaKeywords'),
        ogUrl: keep('ogUrl'),
        whatsappNumber: keep('whatsappNumber'),
        whatsappMessage: keep('whatsappMessage'),
      },
    });
    return { success: true };
  } catch (error) {
    console.error('[updateWebsiteSiteCms]', error);
    return { success: false, error: 'Failed to save site branding' };
  }
}

export async function updateWebsitePagesCms(data: WebsitePagesCms) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    await saveCmsPatch({ pages: { ...(await getWebsiteCmsContent()).pages, ...data } });
    return { success: true };
  } catch (error) {
    console.error('[updateWebsitePagesCms]', error);
    return { success: false, error: 'Failed to save page headings' };
  }
}

export async function updateWebsiteFooterCms(data: WebsiteFooterCms) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };
  try {
    await saveCmsPatch({ footer: { ...(await getWebsiteCmsContent()).footer, ...data } });
    return { success: true };
  } catch (error) {
    console.error('[updateWebsiteFooterCms]', error);
    return { success: false, error: 'Failed to save footer content' };
  }
}
