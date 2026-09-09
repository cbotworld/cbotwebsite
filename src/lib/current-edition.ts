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
      themeDescription: true,
      themeHint: true,
      rules: true,
      enrollmentFee: true,
      registrationEndDate: true,
      paymentQrUrl: true,
      paymentUpiLink: true,
      paymentPhoneNumber: true,
      intlPaymentQrUrl: true,
      intlPaymentUpiLink: true,
      intlPaymentPhone: true,
      slot: true,
      _count: {
        select: {
          participants: true,
        },
      },
      organizer: {
        select: {
          name: true,
          username: true,
        },
      },
    },
  });
}

export async function resolveNextEdition() {
  const live = await resolveCurrentEdition();
  const notLive = live ? { NOT: { id: live.id } } : {};

  let next = await prisma.edition.findFirst({
    where: {
      slot: 'B',
      ...notLive,
    },
    orderBy: { number: 'desc' },
  });

  if (!next && live) {
    next = await prisma.edition.findFirst({
      where: {
        number: { gt: live.number },
        ...notLive,
      },
      orderBy: { number: 'asc' },
    });
  }

  return next;
}

export async function resolveEditionBySlotOrId(opts?: {
  slot?: string | null;
  editionId?: string | null;
}) {
  if (opts?.editionId) {
    const direct = await prisma.edition.findUnique({
      where: { id: opts.editionId },
    });
    if (direct) return direct;
  }

  const slotUpper = String(opts?.slot || '').trim().toUpperCase();
  if (slotUpper === 'B' || slotUpper === 'NEXT') {
    const next = await resolveNextEdition();
    if (next) return next;
  }

  return resolveCurrentEdition();
}

export async function resolvePlayerTournamentOptions(userId: string) {
  const live = await resolveCurrentEdition();
  const next = await resolveNextEdition();

  const [liveRecord, nextRecord] = await Promise.all([
    live
      ? prisma.edition.findUnique({
          where: { id: live.id },
          include: {
            participants: { where: { userId }, include: { team: { select: { id: true, name: true, tag: true } } } },
          },
        })
      : null,
    next
      ? prisma.edition.findUnique({
          where: { id: next.id },
          include: {
            participants: { where: { userId }, include: { team: { select: { id: true, name: true, tag: true } } } },
          },
        })
      : null,
  ]);

  const liveParticipant = liveRecord?.participants?.[0];
  const nextParticipant = nextRecord?.participants?.[0];

  return {
    currentTournament: liveRecord
      ? {
          id: liveRecord.id,
          number: liveRecord.number,
          title: liveRecord.title,
          slug: liveRecord.slug,
          slot: 'A' as const,
          status: liveRecord.status,
          totalDays: liveRecord.totalDays,
          isEnrolled: Boolean(liveParticipant),
          teamId: liveParticipant?.team?.id || null,
          teamName: liveParticipant?.team?.name || null,
          teamTag: liveParticipant?.team?.tag || null,
          isAdvancePlay: false as const,
        }
      : null,
    nextTournament: nextRecord
      ? {
          id: nextRecord.id,
          number: nextRecord.number,
          title: nextRecord.title,
          slug: nextRecord.slug,
          slot: 'B' as const,
          status: nextRecord.status,
          totalDays: nextRecord.totalDays,
          isEnrolled: Boolean(nextParticipant),
          teamId: nextParticipant?.team?.id || null,
          teamName: nextParticipant?.team?.name || 'TBD (Advance Play)',
          teamTag: nextParticipant?.team?.tag || 'TBD',
          isAdvancePlay: true as const,
        }
      : null,
  };
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
