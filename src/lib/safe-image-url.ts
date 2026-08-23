/** Keep page props / ISR payloads small — reject inline base64 and oversized strings. */
const MAX_PUBLIC_IMAGE_CHARS = 2048;

export function safePublicImageUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return null;
  if (trimmed.length > MAX_PUBLIC_IMAGE_CHARS) return null;
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/')) return null;
  return trimmed;
}

/** Stable cache-buster so a new poster URL is not stuck behind a CDN/browser cache. */
export function withImageCacheBust(url: string): string {
  if (!url || url.startsWith('data:') || url.startsWith('/')) return url;
  if (/[?&]v=/.test(url)) return url;
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) hash = (hash * 31 + url.charCodeAt(i)) | 0;
  return `${url}${url.includes('?') ? '&' : '?'}v=${Math.abs(hash)}`;
}

export function withSafeTeamLogo<T extends { logo?: string | null }>(team: T): T {
  return { ...team, logo: safePublicImageUrl(team.logo) };
}

export function sanitizeCmsImages<T>(value: T): T {
  if (typeof value === 'string') {
    if (value.startsWith('data:') || value.length > MAX_PUBLIC_IMAGE_CHARS) {
      // Keep short non-image strings; blank oversized/data URLs used as images.
      if (value.startsWith('data:') || /^https?:\/\//i.test(value) || value.startsWith('/')) {
        return '' as T;
      }
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeCmsImages(item)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const looksLikeImage =
        /url|logo|image|poster|banner|avatar|photo/i.test(key) ||
        (typeof child === 'string' && (child.startsWith('data:') || /^https?:\/\//i.test(child)));
      if (looksLikeImage && typeof child === 'string') {
        out[key] = safePublicImageUrl(child) || '';
      } else {
        out[key] = sanitizeCmsImages(child);
      }
    }
    return out as T;
  }
  return value;
}
