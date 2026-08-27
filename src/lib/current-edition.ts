import { prisma } from '@/lib/prisma';

export type CurrentEditionRef = {
  id: string;
  title: string;
  number: number;
  slug: string;
  status: string;
};

/** Active cup from the database — no hardcoded edition numbers. */
export async function resolveCurrentEdition(): Promise<CurrentEditionRef | null> {
  const select = { id: true, title: true, number: true, slug: true, status: true };
  const live = await prisma.edition.findFirst({
    where: { status: 'IN_PROGRESS' },
    orderBy: { number: 'desc' },
    select,
  });
  if (live) return live;
  const open = await prisma.edition.findFirst({
    where: { status: 'REGISTRATION_OPEN' },
    orderBy: { number: 'desc' },
    select,
  });
  if (open) return open;
  return prisma.edition.findFirst({
    orderBy: { number: 'desc' },
    select,
  });
}

export function editionTitleNeedles(edition: { title: string; number: number; slug?: string | null }) {
  const needles = [edition.title.trim().toLowerCase()];
  if (edition.number) {
    needles.push(`edition ${edition.number}`, `#${edition.number}`);
  }
  const slug = String(edition.slug || '')
    .replace(/-/g, ' ')
    .trim()
    .toLowerCase();
  if (slug) needles.push(slug);
  return [...new Set(needles.filter((n) => n.length >= 3))];
}

export function youtubeTitleMatchesEdition(videoTitle: string, needles: string[]) {
  const t = String(videoTitle || '').toLowerCase();
  if (!t) return false;
  return needles.some((n) => t.includes(n));
}

export function dayNumberFromVideoTitle(title: string) {
  const m = String(title || '').match(/\bday\s*(\d{1,2})\b/i);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : 0;
}
