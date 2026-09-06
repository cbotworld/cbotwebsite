export type TournamentSlot = 'A' | 'B';

export const TOURNAMENT_SLOT_STATUSES = {
  DRAFT: 'DRAFT',
  REGISTRATION_OPEN: 'REGISTRATION_OPEN',
  REGISTRATION_CLOSED: 'REGISTRATION_CLOSED',
  IN_PROGRESS: 'IN_PROGRESS',
} as const;

export type EditionLike = {
  id: string;
  slot?: string | null;
  status?: string | null;
  number?: number | null;
  title?: string | null;
  tournamentEndDate?: Date | string | null;
  tournamentStartDate?: Date | string | null;
  registrationEndDate?: Date | string | null;
  enrollmentFee?: number | null;
};

export function editionBySlot(editions: EditionLike[], slot: TournamentSlot) {
  return editions.find((e) => e.slot === slot) || null;
}

export function liveEdition(editions: EditionLike[]) {
  return editions.find((e) => String(e.status).toUpperCase() === 'IN_PROGRESS') || null;
}

const ORGANIZER_LIVE_STATUSES = new Set(['IN_PROGRESS', 'REGISTRATION_OPEN']);

export function isOrganizerLiveStatus(status?: string | null) {
  return ORGANIZER_LIVE_STATUSES.has(String(status || '').toUpperCase());
}

const FINISHED_SLOT_STATUSES = new Set(['COMPLETED', 'FINISHED', 'ARCHIVED', 'CANCELLED']);

/** Live cup — Tournament A tab (slot A, or highest active edition). */
export function resolveOrganizerLiveEdition(editions: EditionLike[]) {
  if (!editions.length) return null;

  const slotA = editionBySlot(editions, 'A');
  if (slotA && !FINISHED_SLOT_STATUSES.has(String(slotA.status || '').toUpperCase())) {
    return slotA;
  }

  const finished = new Set([...FINISHED_SLOT_STATUSES, 'DRAFT']);
  const live = editions
    .filter((e) => !finished.has(String(e.status || '').toUpperCase()))
    .sort((a, b) => (b.number || 0) - (a.number || 0));

  return live[0] || null;
}

/** Draft cup — Tournament B tab (slot B, or next active non-live edition). */
export function resolveOrganizerDraftEdition(editions: EditionLike[]) {
  const live = resolveOrganizerLiveEdition(editions);
  const slotB = editionBySlot(editions, 'B');
  if (slotB && (!live || slotB.id !== live.id)) return slotB;

  if (live?.number) {
    const next = editions.find((e) => e.number === live.number! + 1 && e.id !== live.id);
    if (next) return next;
  }

  return null;
}

export function draftEdition(editions: EditionLike[]) {
  const slotA = editionBySlot(editions, 'A');
  const slotB = editionBySlot(editions, 'B');
  const live = liveEdition(editions);
  if (live?.slot === 'A') return slotB;
  if (live?.slot === 'B') return slotA;
  return slotB || slotA || editions.find((e) => String(e.status).toUpperCase() !== 'IN_PROGRESS') || null;
}

export function statusLabel(status?: string | null) {
  switch (String(status || '').toUpperCase()) {
    case 'IN_PROGRESS':
      return 'Ongoing';
    case 'REGISTRATION_OPEN':
      return 'Registration Open';
    case 'REGISTRATION_CLOSED':
      return 'Registration Closed';
    case 'DRAFT':
      return 'Draft';
    default:
      return status || 'Draft';
  }
}

export function isDraftSlot(edition: EditionLike | null | undefined) {
  if (!edition) return false;
  const s = String(edition.status || '').toUpperCase();
  return s === 'DRAFT' || s === 'REGISTRATION_OPEN' || s === 'REGISTRATION_CLOSED' || s === 'UPCOMING';
}

export function canPublishDraft(live: EditionLike | null, draft: EditionLike | null, now = new Date()) {
  if (!live || !draft) return { ok: false, reason: 'Tournament slots are not ready.' };
  const draftStatus = String(draft.status || '').toUpperCase();
  if (!['DRAFT', 'REGISTRATION_CLOSED', 'REGISTRATION_OPEN', 'UPCOMING'].includes(draftStatus)) {
    return { ok: false, reason: 'Next edition is not in a publishable state.' };
  }
  return { ok: true as const };
}

export function formatEnrollmentFee(fee?: number | null) {
  const amount = Number(fee) || 0;
  if (amount <= 0) return 'Free';
  return `₹${amount.toLocaleString('en-IN')}`;
}
