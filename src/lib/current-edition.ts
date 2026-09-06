import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export type CurrentEditionRef = {
  id: string;
  title: string;
  number: number;
  slug: string;
  status: string;
  slot?: string | null;
};

const editionSelect = {
  id: true,
  title: true,
  number: true,
  slug: true,
  status: true,
  slot: true,
} as const;

/** Editions that are no longer the live cup. */
export const FINISHED_EDITION_STATUSES = ['COMPLETED', 'FINISHED', 'ARCHIVED', 'CANCELLED'] as const;

/** Next edition number when creating a new cup in the database. */
export async function getNextEditionNumber(): Promise<number> {
  const max = await prisma.edition.aggregate({ _max: { number: true } });
  return (max._max.number ?? 0) + 1;
}

/**
 * Live cup for scores, standings, website, and mobile — slot A when set, else highest active edition.
 */
export async function resolveCurrentEdition(): Promise<CurrentEditionRef | null> {
  let live = await prisma.edition.findFirst({
    where: { slot: 'A', status: 'IN_PROGRESS' },
    select: editionSelect,
  });

  if (!live) {
    live = await prisma.edition.findFirst({
      where: {
        status: { notIn: [...FINISHED_EDITION_STATUSES, 'DRAFT'] },
      },
      orderBy: { number: 'desc' },
      select: editionSelect,
    });
  }

  if (live) {
    await archiveEditionsBefore(live.id, live.number);
  }

  return live;
}

/** Mark every older edition as completed so only the live cup stays active. */
export async function archiveEditionsBefore(liveEditionId: string, liveNumber: number) {
  await prisma.edition.updateMany({
    where: {
      id: { not: liveEditionId },
      number: { lt: liveNumber },
      status: { notIn: [...FINISHED_EDITION_STATUSES] },
    },
    data: { status: 'COMPLETED', slot: null },
  });
}

const liveEditionPlayerInclude = {
  patterns: { orderBy: { sequence: 'asc' as const } },
} satisfies Prisma.EditionInclude;

export type LiveEditionForPlayers = Prisma.EditionGetPayload<{
  include: typeof liveEditionPlayerInclude;
}>;

/** Tournament A with patterns — used by mobile score/combi flows. */
export async function resolveLiveEditionForPlayers(): Promise<LiveEditionForPlayers | null> {
  const ref = await resolveCurrentEdition();
  if (!ref) return null;
  return prisma.edition.findUnique({
    where: { id: ref.id },
    include: liveEditionPlayerInclude,
  });
}

/** Full edition row for player/mobile dashboards (Tournament A). */
export async function resolveCurrentEditionRecord(include?: Prisma.EditionInclude) {
  const ref = await resolveCurrentEdition();
  if (!ref) return null;
  return prisma.edition.findUnique({
    where: { id: ref.id },
    include,
  });
}

/** Public enrollment bar — Tournament B (slot B) with open registration only. */
export async function resolveRegistrationEdition() {
  const live = await resolveCurrentEdition();
  const notLive = live ? { NOT: { id: live.id } } : {};

  return prisma.edition.findFirst({
    where: {
      slot: 'B',
      status: 'REGISTRATION_OPEN',
      ...notLive,
    },
    select: {
      id: true,
      title: true,
      number: true,
      theme: true,
      enrollmentFee: true,
      registrationEndDate: true,
      paymentQrUrl: true,
      paymentUpiLink: true,
      paymentPhoneNumber: true,
      intlPaymentQrUrl: true,
      intlPaymentUpiLink: true,
      intlPaymentPhone: true,
      slot: true,
      organizer: {
        select: {
          name: true,
          username: true,
        },
      },
    },
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
