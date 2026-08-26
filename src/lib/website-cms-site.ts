import { prisma } from '@/lib/prisma';
import {
  DEFAULT_WEBSITE_CMS,
  parseWebsiteCms,
  WEBSITE_CMS_KEY,
  type WebsiteSiteCms,
} from '@/lib/website-cms';

/**
 * Reads the site-wide brand tokens straight from the settings row so callers in
 * `src/lib` don't have to pull in the CMS server-action module. Never throws:
 * a broadcast title must still be generated if the settings read fails.
 */
export async function getWebsiteCmsSite(): Promise<WebsiteSiteCms> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: WEBSITE_CMS_KEY } });
    return parseWebsiteCms(row?.value).site;
  } catch (error) {
    console.error('[getWebsiteCmsSite]', error);
    return DEFAULT_WEBSITE_CMS.site;
  }
}
