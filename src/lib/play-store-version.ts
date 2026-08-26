const ANDROID_PACKAGE = 'com.cbotworld';
const PLAY_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&hl=en&gl=US`;
const CACHE_MS = 15 * 60 * 1000;

type Cache = { at: number; latestVersion: string | null };
let cache: Cache | null = null;

export function compareAppVersions(a: string, b: string) {
  const pa = String(a || '')
    .split(/[^\d]+/)
    .filter(Boolean)
    .map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '')
    .split(/[^\d]+/)
    .filter(Boolean)
    .map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

function looksLikeVersion(value: string) {
  return /^\d+(\.\d+){1,3}$/.test(value);
}

export function extractPlayStoreVersion(html: string): string | null {
  const patterns = [
    /\[\[\["(\d+\.\d+(?:\.\d+){0,2})"\]\]/,
    /"softwareVersion"\s*,\s*"(\d+\.\d+(?:\.\d+){0,2})"/,
    /"softwareVersion"\s*:\s*"(\d+\.\d+(?:\.\d+){0,2})"/,
    /Current Version<\/div><span[^>]*>\s*(\d+\.\d+(?:\.\d+){0,2})/i,
    /itemprop="softwareVersion"\s+content="(\d+\.\d+(?:\.\d+){0,2})"/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1] && looksLikeVersion(m[1])) return m[1];
  }
  return null;
}

export async function getPlayStoreAndroidVersion(): Promise<{
  packageName: string;
  storeUrl: string;
  latestVersion: string | null;
}> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return { packageName: ANDROID_PACKAGE, storeUrl: PLAY_URL, latestVersion: cache.latestVersion };
  }

  try {
    const res = await fetch(PLAY_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const html = await res.text();
    const latestVersion = extractPlayStoreVersion(html);
    cache = { at: Date.now(), latestVersion };
    return { packageName: ANDROID_PACKAGE, storeUrl: PLAY_URL, latestVersion };
  } catch {
    cache = { at: Date.now(), latestVersion: null };
    return { packageName: ANDROID_PACKAGE, storeUrl: PLAY_URL, latestVersion: null };
  }
}
