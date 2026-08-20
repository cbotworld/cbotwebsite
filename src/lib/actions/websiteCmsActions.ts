'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  DEFAULT_WEBSITE_CMS,
  parseWebsiteCms,
  WEBSITE_CMS_KEY,
  type WebsiteCmsContent,
  type WebsiteHeroCms,
  type WebsiteSponsorsCms,
  type WebsiteSpecialSponsorsCms,
  type WebsiteGoldSponsorsCms,
  type WebsiteLegacyCms,
  type WebsiteFooterCms,
} from '@/lib/website-cms';
import { updateEditionBranding } from '@/lib/actions/tournamentActions';

async function requireOrganizer() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== 'ORGANIZER' && role !== 'SUPER_ADMIN')) {
    return { ok: false as const, error: 'Unauthorized' };
  }
  return { ok: true as const };
}

export async function getWebsiteCmsContent(): Promise<WebsiteCmsContent> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: WEBSITE_CMS_KEY } });
    return parseWebsiteCms(row?.value);
  } catch (error) {
    console.error('[getWebsiteCmsContent]', error);
    return DEFAULT_WEBSITE_CMS;
  }
}

async function saveWebsiteCms(content: WebsiteCmsContent) {
  await prisma.systemSetting.upsert({
    where: { key: WEBSITE_CMS_KEY },
    create: { key: WEBSITE_CMS_KEY, value: JSON.stringify(content) },
    update: { value: JSON.stringify(content) },
  });
  revalidatePath('/');
  revalidatePath('/dashboard/organizer');
}

export async function updateWebsiteHeroCms(data: WebsiteHeroCms, editionId?: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };

  try {
    const current = await getWebsiteCmsContent();
    const hero = { ...current.hero, ...data };
    await saveWebsiteCms({ ...current, hero });

    if (editionId) {
      await updateEditionBranding(editionId, {
        bannerImage: hero.bannerImage || undefined,
        posterUrl: hero.posterUrl || undefined,
      });
    }

    return { success: true, hero };
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
