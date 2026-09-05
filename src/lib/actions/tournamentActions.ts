'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  addDaysIsoDate,
  buildDayDatesMap,
  calendarDateToUtcDate,
  istCalendarDateFromMs,
  normalizeDayDates,
  toCalendarDate,
} from '@/lib/combi-cutoff';
import { isCalendarDayCompleted } from '@/lib/tournament-stages';
import { syncCaptainRole } from '@/lib/captain-role';
import { filterMainTeams } from '@/lib/spoc-teams';
import { getWebsiteCmsSite } from '@/lib/website-cms-site';
import { getNextEditionNumber } from '@/lib/current-edition';

export async function createEdition(formData: FormData, organizerId: string) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }
  try {
    const title = formData.get('title') as string;
    const theme = (formData.get('theme') as string) || 'Standard CBOT Theme';
    const description = formData.get('description') as string;
    const format = 'MULTI_FORMAT_ROUND';
    const prizePool = (formData.get('prizePool') as string) || '₹50,000 INR';
    const maxTeams = parseInt((formData.get('maxTeams') as string) || '16', 10);
    const rules = formData.get('rules') as string;

    const roundFormatsRaw = formData.get('roundFormats') as string;
    let roundFormats: string[] = ['SINGLES', 'DOUBLES', 'TRIPLES', 'SINGLES'];
    if (roundFormatsRaw) {
      try {
        roundFormats = JSON.parse(roundFormatsRaw);
      } catch (e) {}
    }

    const roundRulesRaw = formData.get('roundRules') as string;
    let roundRules: string[] = [];
    if (roundRulesRaw) {
      try {
        roundRules = JSON.parse(roundRulesRaw);
      } catch (e) {}
    }

    const perRoundBreakdown = roundFormats
      .map((fmt, idx) => `• Round ${idx + 1} (${fmt}): ${roundRules[idx] || 'Standard rules apply'}`)
      .join('\n');

    const rulesVal = rules
      ? `${rules}\n\nPer-Round Match Directives & Rules:\n${perRoundBreakdown}`
      : `Multi-Format Round Schedule & Rules:\n${perRoundBreakdown}`;

    const currentCount = await prisma.edition.count();
    const number = currentCount + 1; 
    const titleVal = title || `CBOT Edition #${number}`;

    // Placeholder calendar starting a week out, in IST calendar days rather than a raw
    // instant, so the seeded start date and Day 1 always name the same day.
    const seedTotalDays = 15;
    const seedDayDates = buildDayDatesMap(seedTotalDays, addDaysIsoDate(istCalendarDateFromMs(Date.now()), 7));

    const newEdition = await prisma.edition.create({
      data: {
        number,
        title: titleVal,
        slug: titleVal.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
        theme,
        themeDescription: description,
        format,
        status: 'REGISTRATION_OPEN',
        totalDays: seedTotalDays,
        dayDates: JSON.stringify(seedDayDates),
        tournamentStartDate: calendarDateToUtcDate(seedDayDates[1]),
        tournamentEndDate: calendarDateToUtcDate(seedDayDates[seedTotalDays]),
        prizePool,
        maxTeams,
        rules: rulesVal,
        bannerImage: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=1200',
        organizerId,
      }
    });

    const defaultPatterns = await prisma.boardPattern.findMany({ take: roundFormats.length });
    if (defaultPatterns.length > 0) {
      for (let i = 0; i < roundFormats.length; i++) {
        const pattern = defaultPatterns[i % defaultPatterns.length];
        await prisma.editionBoardPattern.create({
          data: {
            editionId: newEdition.id,
            patternId: pattern.id,
            sequence: i + 1,
            matchFormat: roundFormats[i],
          }
        });
      }
    }

    const fullNewEdition = await prisma.edition.findUnique({
      where: { id: newEdition.id },
      include: {
        patterns: {
          orderBy: { sequence: 'asc' },
          include: { pattern: true },
        },
      },
    });

    return { success: true, edition: fullNewEdition };
  } catch (error) {
    console.error('Failed to create edition:', error);
    return { success: false, error: 'Failed to create edition' };
  }
}

export async function updateEdition(editionId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }
  try {
    const title = (formData.get('title') as string)?.trim() || '';
    const theme = (formData.get('theme') as string) || 'Standard CBOT Theme';
    const description = (formData.get('description') as string) || '';
    const prizePool = (formData.get('prizePool') as string) || '₹1,00,000 INR';
    const maxTeams = parseInt((formData.get('maxTeams') as string) || '16', 10);
    const rules = formData.get('rules') as string;
    const editionNumberRaw = formData.get('editionNumber') as string | null;
    const expectedStartDateRaw = formData.get('expectedStartDate') as string | null;
    const enrollmentFeeRaw = formData.get('enrollmentFee') as string | null;
    const registrationEndDateRaw = formData.get('registrationEndDate') as string | null;
    const paymentQrUrlRaw = formData.get('paymentQrUrl') as string | null;
    const paymentUpiLinkRaw = formData.get('paymentUpiLink') as string | null;
    const intlPaymentQrUrlRaw = formData.get('intlPaymentQrUrl') as string | null;
    const intlPaymentUpiLinkRaw = formData.get('intlPaymentUpiLink') as string | null;

    const roundFormatsRaw = formData.get('roundFormats') as string;
    let roundFormats: string[] = ['SINGLES', 'DOUBLES', 'TRIPLES', 'SINGLES'];
    if (roundFormatsRaw) {
      try { roundFormats = JSON.parse(roundFormatsRaw); } catch (e) {}
    }

    const roundRulesRaw = formData.get('roundRules') as string;
    let roundRules: string[] = [];
    if (roundRulesRaw) {
      try { roundRules = JSON.parse(roundRulesRaw); } catch (e) {}
    }

    const perRoundBreakdown = roundFormats
      .map((fmt, idx) => `• Round ${idx + 1} (${fmt})`)
      .join('\n');
    const rulesVal = `Multi-Format Round Schedule:\n${perRoundBreakdown}`;

    // Build slug — but only update if it won't conflict with another edition
    let slugData: { slug?: string } = {};
    if (title) {
      const candidateSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const conflict = await prisma.edition.findFirst({
        where: { slug: candidateSlug, NOT: { id: editionId } },
        select: { id: true },
      });
      if (!conflict) {
        slugData = { slug: candidateSlug };
      }
    }

    const totalDaysRaw = formData.get('totalDays') as string;
    const totalDays = totalDaysRaw ? parseInt(totalDaysRaw, 10) : undefined;
    const existing = await prisma.edition.findUnique({ where: { id: editionId } });
    const scheduleDays = totalDays ?? existing?.totalDays ?? 15;
    const submittedDates = formData.get('dayDates') as string | null;

    let editionNumberUpdate: { number?: number } = {};
    if (editionNumberRaw && editionNumberRaw.trim()) {
      const editionNumber = parseInt(editionNumberRaw, 10);
      if (Number.isFinite(editionNumber) && editionNumber > 0) {
        const conflict = await prisma.edition.findFirst({
          where: { number: editionNumber, NOT: { id: editionId } },
          select: { id: true },
        });
        if (conflict) {
          return { success: false, error: `Edition number ${editionNumber} is already in use.` };
        }
        editionNumberUpdate = { number: editionNumber };
      }
    }

    let expectedStartUpdate: { tournamentStartDate?: Date } = {};
    if (expectedStartDateRaw && toCalendarDate(expectedStartDateRaw)) {
      const parsed = calendarDateToUtcDate(expectedStartDateRaw);
      if (parsed) expectedStartUpdate = { tournamentStartDate: parsed };
    }

    let enrollmentFeeUpdate: { enrollmentFee?: number } = {};
    if (enrollmentFeeRaw !== null && enrollmentFeeRaw !== undefined && enrollmentFeeRaw.trim() !== '') {
      const fee = parseFloat(enrollmentFeeRaw);
      if (Number.isFinite(fee) && fee >= 0) enrollmentFeeUpdate = { enrollmentFee: fee };
    }

    let registrationEndUpdate: { registrationEndDate?: Date | null } = {};
    if (registrationEndDateRaw !== null && registrationEndDateRaw !== undefined) {
      if (registrationEndDateRaw.trim() === '') {
        registrationEndUpdate = { registrationEndDate: null };
      } else if (toCalendarDate(registrationEndDateRaw)) {
        const parsed = calendarDateToUtcDate(registrationEndDateRaw);
        if (parsed) registrationEndUpdate = { registrationEndDate: parsed };
      }
    }

    const resolvedFee =
      enrollmentFeeUpdate.enrollmentFee !== undefined
        ? enrollmentFeeUpdate.enrollmentFee
        : Number(existing?.enrollmentFee) || 0;

    let paymentUpdate: {
      paymentQrUrl?: string | null;
      paymentUpiLink?: string | null;
      intlPaymentQrUrl?: string | null;
      intlPaymentUpiLink?: string | null;
    } = {};
    if (resolvedFee <= 0) {
      paymentUpdate = {
        paymentQrUrl: null,
        paymentUpiLink: null,
        intlPaymentQrUrl: null,
        intlPaymentUpiLink: null,
      };
    } else {
      if (paymentQrUrlRaw !== null && paymentQrUrlRaw !== undefined) {
        paymentUpdate.paymentQrUrl = paymentQrUrlRaw.trim() || null;
      }
      if (paymentUpiLinkRaw !== null && paymentUpiLinkRaw !== undefined) {
        paymentUpdate.paymentUpiLink = paymentUpiLinkRaw.trim() || null;
      }
      if (intlPaymentQrUrlRaw !== null && intlPaymentQrUrlRaw !== undefined) {
        paymentUpdate.intlPaymentQrUrl = intlPaymentQrUrlRaw.trim() || null;
      }
      if (intlPaymentUpiLinkRaw !== null && intlPaymentUpiLinkRaw !== undefined) {
        paymentUpdate.intlPaymentUpiLink = intlPaymentUpiLinkRaw.trim() || null;
      }
    }

    // The organizer's calendar is the source of truth. Stored edition dates win;
    // only a fallback for an edition that has never had any dates set.
    const chosen = normalizeDayDates(submittedDates) ?? normalizeDayDates(existing?.dayDates);
    const dayDatesMap = buildDayDatesMap(scheduleDays, chosen?.[1]);
    for (const [day, date] of Object.entries(chosen ?? {})) {
      const num = Number(day);
      if (num >= 1 && num <= scheduleDays) dayDatesMap[num] = date;
    }
    const dayDates = JSON.stringify(dayDatesMap);
    // Stored at UTC midnight so a later date-only read can never slide back a day.
    const startDate = calendarDateToUtcDate(dayDatesMap[1]);
    const endDate = calendarDateToUtcDate(dayDatesMap[scheduleDays] || dayDatesMap[1]);
    const resolvedStartDate = expectedStartUpdate.tournamentStartDate || startDate || undefined;

    let updatedEdition;
    if (existing) {
      updatedEdition = await prisma.edition.update({
        where: { id: editionId },
        data: {
          ...(title ? { title } : {}),
          ...slugData,
          ...editionNumberUpdate,
          theme,
          themeDescription: description,
          prizePool,
          maxTeams,
          rules: rulesVal,
          ...(totalDays !== undefined ? { totalDays } : {}),
          dayDates,
          ...(resolvedStartDate ? { tournamentStartDate: resolvedStartDate } : {}),
          ...(endDate ? { tournamentEndDate: endDate } : {}),
          ...enrollmentFeeUpdate,
          ...registrationEndUpdate,
          ...paymentUpdate,
        }
      });
    } else {
      let organizerId = (session.user as any)?.id || 'usr_organizer_1';
      const organizerUser = await prisma.user.findFirst({ where: { role: 'ORGANIZER' } });
      if (organizerUser) organizerId = organizerUser.id;

      const nextNumber = await getNextEditionNumber();

      updatedEdition = await prisma.edition.create({
        data: {
          id: editionId,
          number: nextNumber,
          title: title || (await getWebsiteCmsSite()).editionSeriesName,
          slug: slugData.slug || `edition-${Date.now()}`,
          theme,
          themeDescription: description,
          prizePool,
          maxTeams,
          rules: rulesVal,
          totalDays: totalDays ?? 15,
          dayDates,
          ...(startDate ? { tournamentStartDate: startDate } : {}),
          ...(endDate ? { tournamentEndDate: endDate } : {}),
          organizerId,
        }
      });
    }

    // Save per-round formats — wrapped separately so it doesn't block the main save
    try {
      const defaultPatterns = await prisma.boardPattern.findMany({ take: roundFormats.length });
      if (defaultPatterns.length > 0) {
        await prisma.editionBoardPattern.deleteMany({ where: { editionId } });
        for (let i = 0; i < roundFormats.length; i++) {
          const pattern = defaultPatterns[i % defaultPatterns.length];
          await prisma.editionBoardPattern.create({
            data: {
              editionId: updatedEdition.id,
              patternId: pattern.id,
              sequence: i + 1,
              matchFormat: roundFormats[i],
            }
          });
        }
      }
    } catch (patternErr) {
      console.warn('[updateEdition] Board pattern update skipped:', patternErr);
    }

    const fullUpdatedEdition = await prisma.edition.findUnique({
      where: { id: updatedEdition.id },
      include: {
        patterns: {
          orderBy: { sequence: 'asc' },
          include: { pattern: true },
        },
      },
    });

    return { success: true, edition: fullUpdatedEdition };
  } catch (error: any) {
    console.error('[updateEdition] Failed:', error?.message || error);
    return { success: false, error: 'Failed to update edition: ' + (error?.message || 'DB error') };
  }
}

export async function saveEditionCalendar(editionId: string, day1: string, totalDays?: number) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }

  const start = toCalendarDate(day1);
  if (!start) return { success: false, error: 'Pick a valid start date first.' };

  try {
    const existing = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, status: true, totalDays: true, dayDates: true },
    });
    if (!existing) return { success: false, error: 'Edition not found.' };

    const scheduleDays = Math.max(1, totalDays || existing.totalDays || 15);
    const previous = normalizeDayDates(existing.dayDates) ?? {};
    const filled = buildDayDatesMap(scheduleDays, start);

    if (String(existing.status || '').toUpperCase() === 'IN_PROGRESS') {
      for (const [key, date] of Object.entries(previous)) {
        const day = Number(key);
        if (day >= 1 && day <= scheduleDays && isCalendarDayCompleted(day, previous)) {
          filled[day] = date;
        }
      }
    }

    const updated = await prisma.edition.update({
      where: { id: editionId },
      data: {
        totalDays: scheduleDays,
        dayDates: JSON.stringify(filled),
        tournamentStartDate: calendarDateToUtcDate(filled[1]),
        tournamentEndDate: calendarDateToUtcDate(filled[scheduleDays] || filled[1]),
      },
    });

    revalidatePath('/dashboard/organizer');
    revalidatePath('/dashboard/player');
    revalidatePath('/dashboard/captain');
    revalidatePath('/fixtures');
    revalidatePath('/schedule');
    revalidatePath('/combis');
    revalidatePath('/', 'layout');

    return { success: true, dayDates: filled, edition: updated };
  } catch (error: any) {
    console.error('[saveEditionCalendar]', error);
    return { success: false, error: 'Failed to save the start date.' };
  }
}

// ── Branding-only update for the hero section ──────────────────────────────

export async function updateEditionBranding(
  editionId: string,
  data: { title?: string; theme?: string; bannerImage?: string; posterUrl?: string }
) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized' };
  }
  try {
    const updated = await prisma.edition.update({
      where: { id: editionId },
      data: {
        ...(data.title && { title: data.title, slug: data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') }),
        ...(data.theme !== undefined && { theme: data.theme }),
        ...(data.bannerImage !== undefined && { bannerImage: data.bannerImage }),
        ...(data.posterUrl !== undefined && { posterUrl: data.posterUrl }),
      },
    });
    revalidatePath('/');
    revalidatePath('/dashboard/organizer');
    return { success: true, edition: updated };
  } catch (error) {
    console.error('updateEditionBranding error:', error);
    return { success: false, error: 'Failed to update branding' };
  }
}

// ── Update individual team name, tag, and poster logo ────────────────────────
export async function updateTeamBranding(
  teamId: string,
  data: { name?: string; tag?: string; logo?: string }
) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized' };
  }
  try {
    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.tag && { tag: data.tag }),
        ...(data.logo !== undefined && { logo: data.logo }),
      },
    });
    revalidatePath('/');
    revalidatePath('/dashboard/organizer');
    return { success: true, team: updated };
  } catch (error) {
    console.error('updateTeamBranding error:', error);
    return { success: false, error: 'Failed to update team branding' };
  }
}



export async function updateEditionStatus(editionId: string, status: string) {
  try {
    const updated = await prisma.edition.update({
      where: { id: editionId },
      data: { status }
    });
    
    revalidatePath('/dashboard/organizer');
    revalidatePath(`/editions/${updated.slug}`);
    
    return { success: true, status: updated.status };
  } catch (error) {
    console.error('Failed to update edition status:', error);
    return { success: false, error: 'Edition not found or update failed' };
  }
}

export async function getEditions() {
  try {
    const editions = await prisma.edition.findMany({
      orderBy: { number: 'desc' },
      include: {
        teams: true,
        participants: true,
        matches: true
      }
    });
    return { success: true, editions };
  } catch (error) {
    console.error('Failed to fetch editions:', error);
    return { success: false, error: 'Failed to fetch editions' };
  }
}

export async function addOrUpdateEditionTeam(data: {
  editionId: string;
  name: string;
  tag: string;
  captainId?: string;
  description?: string;
  playerUserIds?: string[];
  logo?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }
  try {
    const existing = await prisma.team.findFirst({
      where: { editionId: data.editionId, name: data.name }
    });

    let teamRecord;
    const defaultLogo = `https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/${data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpeg`;
    if (existing) {
      teamRecord = await prisma.team.update({
        where: { id: existing.id },
        data: {
          tag: data.tag,
          captainId: data.captainId || existing.captainId,
          description: data.description || existing.description,
          logo: data.logo || existing.logo || defaultLogo,
        },
        include: {
          captain: true,
          members: { include: { user: true } },
        }
      });
    } else {
      teamRecord = await prisma.team.create({
        data: {
          editionId: data.editionId,
          name: data.name,
          tag: data.tag || data.name.substring(0, 3).toUpperCase(),
          captainId: data.captainId || undefined,
          description: data.description || 'Theme-assigned CBOT Team',
          logo: data.logo || defaultLogo,
        },
        include: {
          captain: true,
          members: { include: { user: true } },
        }
      });
    }

    await syncCaptainRole({
      newCaptainId: data.captainId || existing?.captainId || null,
      previousCaptainId: existing?.captainId || null,
    });

    if (data.playerUserIds && data.playerUserIds.length > 0) {
      await prisma.editionParticipant.updateMany({
        where: { teamId: teamRecord.id },
        data: { teamId: null }
      });

      for (const uId of data.playerUserIds) {
        const existingParticipant = await prisma.editionParticipant.findFirst({
          where: { editionId: data.editionId, userId: uId }
        });

        if (existingParticipant) {
          await prisma.editionParticipant.update({
            where: { id: existingParticipant.id },
            data: { teamId: teamRecord.id }
          });
        } else {
          await prisma.editionParticipant.create({
            data: {
              editionId: data.editionId,
              userId: uId,
              teamId: teamRecord.id,
              status: 'REGISTERED'
            }
          });
        }
      }
    }

    revalidatePath('/dashboard/organizer');
    revalidatePath('/teams');
    revalidatePath('/teams-and-players');
    // The homepage marquee and fixtures render team posters and are ISR-cached,
    // so they have to be invalidated too or a new logo stays hidden for an hour.
    revalidatePath('/', 'layout');

    return { success: true, team: teamRecord, isNew: !existing };
  } catch (error) {
    console.error('Failed to add/update team:', error);
    return { success: false, error: 'Failed to add/update team' };
  }
}

export async function updateTeamRosterAndCaptain(data: {
  teamId: string;
  name: string;
  tag: string;
  captainId: string;
  playerUserIds: string[];
  logo?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }
  try {
    let team = await prisma.team.findFirst({
      where: {
        OR: [
          { id: data.teamId },
          { name: data.name }
        ]
      }
    });

    const defaultLogo = `https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/${data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpeg`;

    let targetTeamId = team ? team.id : data.teamId;

    if (team) {
      await prisma.team.update({
        where: { id: team.id },
        data: {
          name: data.name,
          tag: data.tag,
          captainId: data.captainId || null,
          ...(data.logo !== undefined && { logo: data.logo }),
        }
      });
    } else {
      const defaultEdition = await prisma.edition.findFirst({ orderBy: { number: 'desc' } });
      const editionId = defaultEdition?.id || 'edition_205';

      const newTeam = await prisma.team.create({
        data: {
          id: data.teamId.startsWith('team_') ? data.teamId : undefined,
          editionId,
          name: data.name,
          tag: data.tag || data.name.substring(0, 3).toUpperCase(),
          captainId: data.captainId || null,
          logo: data.logo || defaultLogo,
        }
      });
      targetTeamId = newTeam.id;
    }

    // Persist team roster members to EditionParticipant table
    if (data.playerUserIds) {
      const targetTeam = await prisma.team.findUnique({
        where: { id: targetTeamId },
        select: { editionId: true },
      });
      const fallbackEdition = targetTeam?.editionId
        ? null
        : await prisma.edition.findFirst({ orderBy: { number: 'desc' }, select: { id: true } });
      const editionId = targetTeam?.editionId || fallbackEdition?.id;
      if (!editionId) {
        return { success: false, error: 'No edition found to attach this roster to.' };
      }

      // Drop the old roster by unlinking it, never by deleting the rows: an
      // EditionParticipant is the player's registration for the edition, and
      // deleting it removes them from the tournament entirely.
      await prisma.editionParticipant.updateMany({
        where: { teamId: targetTeamId },
        data: { teamId: null }
      });

      for (const uId of data.playerUserIds) {
        let user = await prisma.user.findFirst({
          where: {
            OR: [{ id: uId }, { username: uId.toLowerCase() }]
          }
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              id: uId.startsWith('usr_') ? uId : undefined,
              name: uId,
              username: uId.toLowerCase(),
              pin: '$2a$10$abcdefghijklmnopqrstuu', // Default hashed pin placeholder
              role: 'PLAYER',
              isActivated: true
            }
          });
        }

        // A player holds one registration per edition, so re-point the existing
        // row instead of inserting a second one.
        await prisma.editionParticipant.upsert({
          where: { editionId_userId: { editionId, userId: user.id } },
          update: { teamId: targetTeamId },
          create: {
            editionId,
            userId: user.id,
            teamId: targetTeamId,
            status: 'REGISTERED'
          }
        });
      }
    }

    try {
      await syncCaptainRole({
        newCaptainId: data.captainId || null,
        previousCaptainId: team?.captainId || null,
      });
    } catch (e) {}

    const finalTeam = await prisma.team.findUnique({
      where: { id: targetTeamId },
      include: {
        captain: true,
        members: { include: { user: true } },
      }
    });

    revalidatePath('/dashboard/organizer');
    revalidatePath('/teams');
    revalidatePath('/teams-and-players');
    // The homepage marquee and fixtures render team posters and are ISR-cached,
    // so they have to be invalidated too or a new logo stays hidden for an hour.
    revalidatePath('/', 'layout');

    return { success: true, team: finalTeam };
  } catch (error) {
    console.error('Failed to update team roster:', error);
    return { success: false, error: 'Failed to update team roster' };
  }
}

/** Accounts that never join a team, whatever role they happen to hold. */
const AUTO_ASSIGN_EXCLUDED_USERNAMES = ['carrombalu'];

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Spreads every eligible player across the edition's main teams as evenly as
 * possible, replacing whatever rosters exist. Each team keeps the captain it
 * was given, and an uneven total puts the spare players on the first teams —
 * 129 players over 8 teams gives one team 17 and the rest 16.
 */
export async function autoAssignPlayersToTeams(editionId: string) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }

  try {
    const allTeams = await prisma.team.findMany({
      where: { editionId },
      select: { id: true, name: true, captainId: true, teamType: true },
      orderBy: { createdAt: 'asc' },
    });
    const teams = filterMainTeams(allTeams);
    if (!teams.length) {
      return { success: false, error: 'Add the teams first, then auto-assign players.' };
    }

    const players = await prisma.user.findMany({
      where: {
        role: 'PLAYER',
        NOT: { username: { in: AUTO_ASSIGN_EXCLUDED_USERNAMES } },
      },
      select: { id: true },
      orderBy: { name: 'asc' },
    });
    if (!players.length) {
      return { success: false, error: 'There are no eligible players to assign.' };
    }

    const playerIds = new Set(players.map((p) => p.id));

    // Even split, with the remainder landing one-per-team on the first teams.
    const base = Math.floor(players.length / teams.length);
    const remainder = players.length % teams.length;
    const capacity = new Map<string, number>(
      teams.map((team, index) => [team.id, base + (index < remainder ? 1 : 0)]),
    );

    // A captain belongs on the team they captain, so seat them before the rest.
    const rosters = new Map<string, string[]>(teams.map((team) => [team.id, []]));
    const seated = new Set<string>();
    for (const team of teams) {
      const captainId = team.captainId;
      if (captainId && playerIds.has(captainId) && !seated.has(captainId)) {
        rosters.get(team.id)!.push(captainId);
        seated.add(captainId);
      }
    }

    const queue = shuffled(players.map((p) => p.id).filter((id) => !seated.has(id)));
    for (const team of teams) {
      const roster = rosters.get(team.id)!;
      while (roster.length < (capacity.get(team.id) || 0) && queue.length) {
        roster.push(queue.pop()!);
      }
    }
    // Anything left over (teams already full of captains) tops up the smallest team.
    while (queue.length) {
      const smallest = teams.reduce((a, b) =>
        rosters.get(a.id)!.length <= rosters.get(b.id)!.length ? a : b,
      );
      rosters.get(smallest.id)!.push(queue.pop()!);
    }

    const existing = await prisma.editionParticipant.findMany({
      where: { editionId },
      select: { id: true, userId: true },
    });
    const participantIdByUser = new Map(existing.map((p) => [p.userId, p.id]));

    await prisma.$transaction(async (tx) => {
      // Clear every existing link first so nobody keeps a stale team.
      await tx.editionParticipant.updateMany({
        where: { editionId },
        data: { teamId: null },
      });

      const missing: Array<{ editionId: string; userId: string; teamId: string; status: string }> = [];
      for (const team of teams) {
        const roster = rosters.get(team.id)!;
        const known = roster
          .map((userId) => participantIdByUser.get(userId))
          .filter((id): id is string => Boolean(id));
        if (known.length) {
          await tx.editionParticipant.updateMany({
            where: { id: { in: known } },
            data: { teamId: team.id },
          });
        }
        for (const userId of roster) {
          if (!participantIdByUser.has(userId)) {
            missing.push({ editionId, userId, teamId: team.id, status: 'REGISTERED' });
          }
        }
      }
      if (missing.length) {
        await tx.editionParticipant.createMany({ data: missing });
      }
    });

    revalidatePath('/dashboard/organizer');
    revalidatePath('/teams');
    revalidatePath('/teams-and-players');
    // The homepage marquee and fixtures render team posters and are ISR-cached,
    // so they have to be invalidated too or a new logo stays hidden for an hour.
    revalidatePath('/', 'layout');

    return {
      success: true,
      assigned: players.length,
      teamCount: teams.length,
      breakdown: teams.map((team) => ({
        name: team.name,
        count: rosters.get(team.id)!.length,
      })),
    };
  } catch (error: any) {
    console.error('[autoAssignPlayersToTeams]', error);
    return { success: false, error: error?.message || 'Failed to auto-assign players.' };
  }
}

export async function deleteTeam(teamId: string) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }
  try {
    const doomed = await prisma.team.findUnique({
      where: { id: teamId },
      select: { captainId: true },
    });
    await prisma.team.deleteMany({
      where: { id: teamId }
    });
    await syncCaptainRole({ previousCaptainId: doomed?.captainId || null });
    revalidatePath('/dashboard/organizer');
    revalidatePath('/teams');
    revalidatePath('/teams-and-players');
    // The homepage marquee and fixtures render team posters and are ISR-cached,
    // so they have to be invalidated too or a new logo stays hidden for an hour.
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error) {
    console.error('Error deleting team:', error);
    return { success: true };
  }
}

export async function getEditionBySlug(slug: string) {
  try {
    const edition = await prisma.edition.findUnique({
      where: { slug },
      include: {
        teams: {
          include: {
            members: { include: { user: true } },
            captain: true
          }
        },
        participants: { include: { user: true } },
        matches: {
          include: {
            team1: true,
            team2: true,
            winner: true
          }
        },
        leagueStandings: true
      }
    });
    if (!edition) return { success: false, error: 'Edition not found' };
    return { success: true, edition };
  } catch (error) {
    console.error('Failed to fetch edition:', error);
    return { success: false, error: 'Failed to fetch edition' };
  }
}

export async function sendPlayerCredentialsEmailAction(data: {
  name: string;
  username: string;
  pin: string;
  email: string;
}) {
  try {
    if (!data.email || !data.email.trim()) {
      return { success: false, error: 'Email address is required.' };
    }

    const nodemailer = require('nodemailer');
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || 'noreply@cbotworld.com';

    let transporter;
    if (smtpHost && smtpUser && smtpPass) {
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
    }

    const mailOptions = {
      from: `"CBOT Tournament Director" <${smtpFrom}>`,
      to: data.email.trim(),
      subject: `🏆 Your CBOT Tournament Login Credentials — ${data.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
          <div style="background: #0f172a; color: #ffffff; padding: 20px; text-align: center;">
            <h2 style="margin: 0; color: #f59e0b; font-size: 20px;">🏆 CBOT Online Tournaments</h2>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #94a3b8;">Official Player Login Credentials</p>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 14px; color: #334155;">Hello <strong>${data.name}</strong>,</p>
            <p style="font-size: 13px; color: #475569;">Here are your official login credentials for CBOT online tournaments:</p>
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0; font-family: monospace;">
              <p style="margin: 4px 0; font-size: 13px;"><strong>Unique Username:</strong> <span style="color: #d97706;">${data.username}</span></p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>4-Digit Security PIN:</strong> <span style="color: #059669; font-size: 16px; font-weight: bold;">${data.pin}</span></p>
            </div>
            <p style="font-size: 12px; color: #64748b;">You can use these credentials to log in at <a href="https://www.cbotworld.com/login" style="color: #f59e0b; font-weight: bold;">www.cbotworld.com/login</a>.</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    if (!smtpHost) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      return { success: true, previewUrl };
    }
    return { success: true };
  } catch (error: any) {
    console.error('[sendPlayerCredentialsEmailAction] Error:', error);
    return { success: false, error: error?.message || 'Failed to send credentials email' };
  }
}

const START_NEW_TOURNAMENT_PHRASE = 'start new tournament';

/**
 * Reset stage design, days, matches, and teams. Player accounts stay, but
 * everyone drops back to player: the new tournament's captains are whoever the
 * organizer assigns once its teams exist.
 */
export async function startNewTournament(opts: {
  editionId: string;
  tournamentName: string;
  confirmation: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized: Organizer access required.' };
  }

  const title = (opts.tournamentName || '').trim();
  const confirmation = (opts.confirmation || '').trim().toLowerCase();
  if (!title) {
    return { success: false, error: 'Enter the new tournament name.' };
  }
  if (confirmation !== START_NEW_TOURNAMENT_PHRASE) {
    return { success: false, error: 'Type “start new tournament” exactly to confirm.' };
  }

  try {
    const edition = await prisma.edition.findUnique({ where: { id: opts.editionId }, select: { id: true } });
    if (!edition) return { success: false, error: 'Edition not found.' };

    const { defaultTournamentStages, stageConfigKey } = await import('@/lib/tournament-stages');

    await prisma.$transaction(async (tx) => {
      await tx.editionParticipant.updateMany({
        where: { editionId: edition.id },
        data: { teamId: null },
      });
      await tx.spocTeamMember.deleteMany({ where: { editionId: edition.id } });
      await tx.leagueStanding.deleteMany({ where: { editionId: edition.id } });
      await tx.liveStream.deleteMany({ where: { editionId: edition.id } });
      await tx.match.deleteMany({ where: { editionId: edition.id } });
      await tx.team.deleteMany({ where: { editionId: edition.id } });
      await tx.user.updateMany({
        where: { role: 'CAPTAIN' },
        data: { role: 'PLAYER' },
      });
      await tx.edition.update({
        where: { id: edition.id },
        data: {
          title,
          dayDates: null,
          tournamentStartDate: null,
          tournamentEndDate: null,
          totalDays: 15,
          status: 'REGISTRATION_OPEN',
        },
      });
      await tx.systemSetting.upsert({
        where: { key: stageConfigKey(edition.id) },
        create: { key: stageConfigKey(edition.id), value: JSON.stringify(defaultTournamentStages(8)) },
        update: { value: JSON.stringify(defaultTournamentStages(8)) },
      });
    });

    revalidatePath('/', 'layout');
    revalidatePath('/dashboard/organizer');
    revalidatePath('/dashboard/player');
    revalidatePath('/dashboard/captain');
    revalidatePath('/fixtures');
    revalidatePath('/schedule');
    revalidatePath('/combis');
    revalidatePath('/teams');
    revalidatePath('/teams-and-players');

    return { success: true, title };
  } catch (error: any) {
    console.error('[startNewTournament]', error);
    return { success: false, error: error?.message || 'Failed to start a new tournament.' };
  }
}
