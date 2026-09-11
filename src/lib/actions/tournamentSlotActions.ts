'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import nodemailer from 'nodemailer';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canPublishDraft, isOrganizerLiveStatus } from '@/lib/tournament-slots';
import { resolveCurrentEdition, resolveRegistrationEdition, archiveEditionsBefore, getNextEditionNumber } from '@/lib/current-edition';
import { toCalendarDate } from '@/lib/combi-cutoff';
import { stageConfigKey } from '@/lib/tournament-stages';
import { snapshotEditionStandings } from '@/lib/actions/playerScoreActions';

async function requireOrganizer() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== 'ORGANIZER' && role !== 'SUPER_ADMIN')) {
    return { ok: false as const, error: 'Unauthorized' };
  }
  return { ok: true as const, session };
}

const editionInclude = {
  participants: {
    orderBy: [{ gradeAverage: 'asc' as const }, { user: { name: 'asc' as const } }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          average: true,
          target: true,
          role: true,
          isActivated: true,
        },
      },
    },
  },
  patterns: {
    orderBy: { sequence: 'asc' as const },
    include: { pattern: true },
  },
};

const participantUserSelect = {
  user: {
    select: {
      id: true,
      name: true,
      username: true,
      average: true,
      target: true,
      role: true,
      isActivated: true,
    },
  },
} as const;

async function findOrganizerLiveEdition() {
  const ref = await resolveCurrentEdition();
  if (!ref) return null;
  return prisma.edition.findUnique({
    where: { id: ref.id },
    include: editionInclude,
  });
}

async function findOrganizerDraftEdition(liveNumber: number, liveId: string) {
  const slotB = await prisma.edition.findFirst({
    where: { slot: 'B', NOT: { id: liveId } },
    include: editionInclude,
  });
  if (slotB) return slotB;

  const byNumber = await prisma.edition.findFirst({
    where: { number: liveNumber + 1, NOT: { id: liveId } },
    include: editionInclude,
  });
  return byNumber;
}

/** Copy stage path + board patterns from live cup into the draft twin (no teams/scores). */
async function cloneEditionBlueprint(sourceId: string, targetId: string) {
  const sourcePatterns = await prisma.editionBoardPattern.findMany({
    where: { editionId: sourceId },
    orderBy: { sequence: 'asc' },
  });

  if (sourcePatterns.length) {
    await prisma.editionBoardPattern.deleteMany({ where: { editionId: targetId } });
    for (const row of sourcePatterns) {
      await prisma.editionBoardPattern.create({
        data: {
          editionId: targetId,
          patternId: row.patternId,
          sequence: row.sequence,
          matchFormat: row.matchFormat,
        },
      });
    }
  }

  const sourceStage = await prisma.systemSetting.findUnique({
    where: { key: stageConfigKey(sourceId) },
  });
  if (sourceStage?.value) {
    let cleanConfig = sourceStage.value;
    try {
      const parsed = JSON.parse(sourceStage.value);
      if (parsed?.stages && Array.isArray(parsed.stages)) {
        parsed.stages = parsed.stages.map((st: any) => ({
          ...st,
          matchPairings: [],
          groups: (st.groups || []).map((g: any) => ({ ...g, teamIds: [] })),
        }));
        cleanConfig = JSON.stringify(parsed);
      }
    } catch {
      // Keep fallback
    }
    await prisma.systemSetting.upsert({
      where: { key: stageConfigKey(targetId) },
      update: { value: cleanConfig },
      create: { key: stageConfigKey(targetId), value: cleanConfig },
    });
  }
}

export async function ensureTournamentSlots() {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  try {
    const liveRef = await findOrganizerLiveEdition();
    if (!liveRef) {
      return { success: false as const, error: 'No live tournament found to anchor slots.' };
    }

    // Older completed cups are archived — only the highest live edition remains active.
    await archiveEditionsBefore(liveRef.id, liveRef.number);

    // Clear stale slot tags so the live cup is always Tournament A.
    await prisma.edition.updateMany({
      where: { slot: 'A', NOT: { id: liveRef.id } },
      data: { slot: null },
    });
    if (liveRef.slot === 'B') {
      await prisma.edition.update({
        where: { id: liveRef.id },
        data: { slot: null },
      });
    }

    // Tag live cup as slot A (metadata only).
    const slotA = await prisma.edition.update({
      where: { id: liveRef.id },
      data: { slot: 'A' },
      include: editionInclude,
    });

    let slotB = await findOrganizerDraftEdition(slotA.number, slotA.id);

    if (slotB) {
      if (slotB.slot !== 'B') {
        slotB = await prisma.edition.update({
          where: { id: slotB.id },
          data: { slot: 'B' },
          include: editionInclude,
        });
      }
    } else {
      const nextNumber = await getNextEditionNumber();
      slotB = await prisma.edition.create({
        data: {
          number: nextNumber,
          title: `Edition ${nextNumber}`,
          slug: `edition-${nextNumber}-slot-b`,
          status: 'DRAFT',
          slot: 'B',
          organizerId: slotA.organizerId,
          totalDays: slotA.totalDays,
          maxTeams: slotA.maxTeams,
          prizePool: slotA.prizePool,
          theme: slotA.theme,
          themeDescription: slotA.themeDescription,
          format: slotA.format,
          enrollmentFee: 0,
        },
        include: editionInclude,
      });
      await cloneEditionBlueprint(slotA.id, slotB.id);
    }

    revalidatePath('/dashboard/organizer');
    return { success: true as const, slotA, slotB };
  } catch (error) {
    console.error('[ensureTournamentSlots]', error);
    return { success: false as const, error: 'Failed to prepare tournament slots.' };
  }
}

export async function openRegistration(editionId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  try {
    const existing = await prisma.edition.findUnique({ where: { id: editionId }, select: { id: true, status: true } });
    if (!existing) return { success: false as const, error: 'Edition not found.' };
    const live = await findOrganizerLiveEdition();
    if (live?.id === editionId) {
      return {
        success: false as const,
        error: 'Cannot change registration on the live tournament. Use Tournament B (draft) instead.',
      };
    }

    const status = String(existing.status || '').toUpperCase();
    if (!['DRAFT', 'REGISTRATION_CLOSED', 'REGISTRATION_OPEN', 'UPCOMING'].includes(status)) {
      return {
        success: false as const,
        error: 'Registration can only be opened on the draft tournament (Tournament B).',
      };
    }

    // Organizer control is the source of truth — clear any auto-cutoff so reopen works anytime.
    const edition = await prisma.edition.update({
      where: { id: editionId },
      data: { status: 'REGISTRATION_OPEN', registrationEndDate: null },
      include: editionInclude,
    });
    revalidatePath('/dashboard/organizer');
    revalidatePath('/', 'layout');
    return { success: true as const, edition };
  } catch (error) {
    console.error('[openRegistration]', error);
    return { success: false as const, error: 'Failed to open registration.' };
  }
}

export async function closeRegistration(editionId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  try {
    const existing = await prisma.edition.findUnique({ where: { id: editionId }, select: { id: true, status: true } });
    if (!existing) return { success: false as const, error: 'Edition not found.' };
    const live = await findOrganizerLiveEdition();
    if (live?.id === editionId) {
      return {
        success: false as const,
        error: 'Cannot change registration on the live tournament. Use Tournament B (draft) instead.',
      };
    }

    const edition = await prisma.edition.update({
      where: { id: editionId },
      data: { status: 'REGISTRATION_CLOSED' },
      include: editionInclude,
    });
    revalidatePath('/dashboard/organizer');
    revalidatePath('/', 'layout');
    return { success: true as const, edition };
  } catch (error) {
    console.error('[closeRegistration]', error);
    return { success: false as const, error: 'Failed to close registration.' };
  }
}

export async function publishTournament(draftEditionId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  try {
    const draft = await prisma.edition.findUnique({ where: { id: draftEditionId } });
    if (!draft) return { success: false as const, error: 'Draft tournament not found.' };

    const live = await findOrganizerLiveEdition();
    if (!live) return { success: false as const, error: 'No live tournament found.' };
    if (live.id === draft.id) return { success: false as const, error: 'Cannot publish the live tournament.' };

    const guard = canPublishDraft(live, draft);
    if (!guard.ok) return { success: false as const, error: guard.reason };

    const nextDraftNumber = draft.number;
    const nextDraftTitle = `Edition ${nextDraftNumber + 1}`;

    // Permanently snapshot the final standings of the completed live cup before swapping slots
    await snapshotEditionStandings(live.id);

    // Swap twin slots: draft → live (A), former live → draft (B) for the next cycle.
    await prisma.edition.update({ where: { id: live.id }, data: { slot: null } });
    await prisma.edition.update({ where: { id: draft.id }, data: { slot: null } });

    const [published, resetLive] = await prisma.$transaction([
      prisma.edition.update({
        where: { id: draft.id },
        data: {
          status: 'IN_PROGRESS',
          slot: 'A',
          publishedAt: new Date(),
        },
        include: editionInclude,
      }),
      prisma.edition.update({
        where: { id: live.id },
        data: {
          status: 'DRAFT',
          slot: 'B',
          publishedAt: null,
          number: nextDraftNumber + 1,
          title: nextDraftTitle,
          slug: `edition-${nextDraftNumber + 1}-slot-b`,
          registrationStartDate: null,
          registrationEndDate: null,
          tournamentStartDate: null,
          tournamentEndDate: null,
          dayDates: null,
        },
        include: editionInclude,
      }),
    ]);

    await archiveEditionsBefore(published.id, published.number);
    await cloneEditionBlueprint(published.id, resetLive.id);

    revalidatePath('/', 'layout');
    revalidatePath('/dashboard/organizer');
    revalidatePath('/dashboard/player');
    revalidatePath('/fixtures');
    revalidatePath('/schedule');
    revalidatePath('/combis');
    revalidatePath('/teams');

    return { success: true as const, published, resetLive };
  } catch (error: any) {
    console.error('[publishTournament]', error);
    return { success: false as const, error: error?.message || 'Failed to publish tournament.' };
  }
}

export async function syncUnlockedGradeAverages(editionId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  try {
    const rows = await prisma.editionParticipant.findMany({
      where: { editionId, gradeAverageLocked: false },
      include: { user: { select: { average: true } } },
    });
    await Promise.all(
      rows.map((row) => {
        const nextAvg = Number(row.user?.average) > 0 ? Number(row.user.average) : null;
        if (row.gradeAverage === nextAvg) return Promise.resolve();
        return prisma.editionParticipant.update({
          where: { id: row.id },
          data: { gradeAverage: nextAvg },
        });
      })
    );
    return { success: true as const };
  } catch (error) {
    console.error('[syncUnlockedGradeAverages]', error);
    return { success: false as const, error: 'Failed to sync grade averages.' };
  }
}

export async function addEnrolledPlayer(editionId: string, userId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  try {
    const [user, edition] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.edition.findUnique({ where: { id: editionId }, select: { enrollmentFee: true } }),
    ]);
    if (!user) return { success: false as const, error: 'Player not found.' };

    const fee = Number(edition?.enrollmentFee) || 0;
    const gradeAverage = Number(user.average) > 0 ? Number(user.average) : null;
    const participant = await prisma.editionParticipant.upsert({
      where: { editionId_userId: { editionId, userId } },
      update: {
        status: 'ENROLLED',
        enrolledAt: new Date(),
        ...(fee <= 0
          ? { paymentStatus: 'FREE', paymentAmount: 0, paymentTransactionId: null }
          : { paymentStatus: 'WAIVED', paymentAmount: 0 }),
      },
      create: {
        editionId,
        userId,
        status: 'ENROLLED',
        gradeAverage,
        gradeAverageLocked: false,
        enrolledAt: new Date(),
        paymentStatus: fee > 0 ? 'WAIVED' : 'FREE',
        paymentAmount: 0,
      },
      include: participantUserSelect,
    });

    revalidatePath('/dashboard/organizer');
    return { success: true as const, participant };
  } catch (error) {
    console.error('[addEnrolledPlayer]', error);
    return { success: false as const, error: 'Failed to enroll player.' };
  }
}

export async function removeEnrolledPlayer(editionId: string, userId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  try {
    await prisma.editionParticipant.delete({ where: { editionId_userId: { editionId, userId } } });
    revalidatePath('/dashboard/organizer');
    return { success: true as const, removedUserId: userId };
  } catch (error) {
    console.error('[removeEnrolledPlayer]', error);
    return { success: false as const, error: 'Failed to remove enrolled player.' };
  }
}

export async function updateGradeAverage(editionId: string, userId: string, gradeAverage: number, lock = true) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  try {
    const participant = await prisma.editionParticipant.update({
      where: { editionId_userId: { editionId, userId } },
      data: {
        gradeAverage: gradeAverage > 0 ? gradeAverage : null,
        gradeAverageLocked: lock,
      },
      include: participantUserSelect,
    });
    revalidatePath('/dashboard/organizer');
    return { success: true as const, participant };
  } catch (error) {
    console.error('[updateGradeAverage]', error);
    return { success: false as const, error: 'Failed to update grade average.' };
  }
}

export async function updateEnrolledPlayerSpoc(editionId: string, userId: string, isSpoc: boolean) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  try {
    const participant = await prisma.editionParticipant.update({
      where: { editionId_userId: { editionId, userId } },
      data: { isSpoc: Boolean(isSpoc) },
      include: participantUserSelect,
    });
    revalidatePath('/dashboard/organizer');
    return { success: true as const, participant };
  } catch (error) {
    console.error('[updateEnrolledPlayerSpoc]', error);
    return { success: false as const, error: 'Failed to update SPoC selection.' };
  }
}

export async function pullCurrentAverageAsGrade(editionId: string, userId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { average: true } });
    if (!user) return { success: false as const, error: 'Player not found.' };

    const gradeAverage = Number(user.average) > 0 ? Number(user.average) : null;
    const participant = await prisma.editionParticipant.update({
      where: { editionId_userId: { editionId, userId } },
      data: { gradeAverage, gradeAverageLocked: false },
      include: participantUserSelect,
    });
    revalidatePath('/dashboard/organizer');
    return { success: true as const, participant };
  } catch (error) {
    console.error('[pullCurrentAverageAsGrade]', error);
    return { success: false as const, error: 'Failed to pull current average.' };
  }
}

export async function getOpenRegistrationEdition() {
  try {
    const edition = await prisma.edition.findFirst({
      where: { status: 'REGISTRATION_OPEN' },
      select: {
        id: true,
        title: true,
        number: true,
        theme: true,
        enrollmentFee: true,
        registrationEndDate: true,
        paymentQrUrl: true,
        paymentUpiLink: true,
        intlPaymentQrUrl: true,
        intlPaymentUpiLink: true,
        slot: true,
        organizer: {
          select: { name: true, username: true },
        },
      },
    });
    return edition;
  } catch {
    return null;
  }
}

export async function enrollCurrentUser(
  editionId: string,
  paymentTransactionId?: string,
  paymentMethod?: string
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as { id?: string }).id) {
    return { success: false as const, error: 'Please log in to enroll.' };
  }
  const userId = (session.user as { id: string }).id;

  try {
    const edition = await prisma.edition.findUnique({ where: { id: editionId } });
    if (!edition || edition.status !== 'REGISTRATION_OPEN') {
      return { success: false as const, error: 'Registration is not open for this tournament.' };
    }
    // Status is controlled by the organizer; optional registrationEndDate is display-only.

    const existing = await prisma.editionParticipant.findUnique({
      where: { editionId_userId: { editionId, userId } },
    });
    if (existing) return { success: false as const, error: 'You are already enrolled.' };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false as const, error: 'Account not found.' };

    const fee = Number(edition.enrollmentFee) || 0;
    const txnId = String(paymentTransactionId || '').trim();
    if (fee > 0 && !txnId) {
      return { success: false as const, error: 'Payment phone number / comments are required to enroll.' };
    }

    const gradeAverage = Number(user.average) > 0 ? Number(user.average) : null;
    const method =
      paymentMethod === 'INTL' || paymentMethod === 'ALTERNATE' || paymentMethod === 'ALTERNATE_UPI'
        ? 'ALTERNATE_UPI'
        : fee > 0
          ? 'PRIMARY_UPI'
          : null;

    const participant = await prisma.editionParticipant.create({
      data: {
        editionId,
        userId,
        status: 'ENROLLED',
        gradeAverage,
        gradeAverageLocked: false,
        enrolledAt: new Date(),
        paymentStatus: fee > 0 ? 'PAID' : 'FREE',
        paymentAmount: fee > 0 ? fee : 0,
        paymentTransactionId: fee > 0 ? txnId : null,
        paymentMethod: method,
      },
    });

    revalidatePath('/');
    revalidatePath('/dashboard/organizer');
    revalidatePath('/dashboard/player');
    return {
      success: true as const,
      participant,
      message:
        fee > 0
          ? `Your payment reference has been submitted. The organizer will crosscheck and verify the payment. If there are any issues, the organizer will contact you. Thank you so much!`
          : 'Enrollment successful! Thank you so much!',
    };
  } catch (error) {
    console.error('[enrollCurrentUser]', error);
    return { success: false as const, error: 'Enrollment failed. Please try again.' };
  }
}

export async function getMyEnrollmentForEdition(editionId: string, overrideUserId?: string) {
  let userId = overrideUserId;
  let username: string | undefined;

  if (!userId) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(session.user as { id?: string }).id) {
      return { success: false as const, enrolled: false as const };
    }
    userId = (session.user as { id: string }).id;
    username = (session.user as any)?.username;
  }

  try {
    const participant = await prisma.editionParticipant.findFirst({
      where: {
        editionId,
        OR: [
          { userId },
          ...(username ? [{ user: { username: { equals: username, mode: 'insensitive' as const } } }] : []),
        ],
      },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paymentAmount: true,
        paymentTransactionId: true,
        paymentMethod: true,
        enrolledAt: true,
      },
    });

    let enrollmentNumber: number | null = null;
    if (participant) {
      const allForEdition = await prisma.editionParticipant.findMany({
        where: { editionId },
        orderBy: [{ enrolledAt: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
      const idx = allForEdition.findIndex((p) => p.id === participant.id);
      enrollmentNumber = idx >= 0 ? idx + 1 : 1;
    }

    return {
      success: true as const,
      enrolled: Boolean(participant),
      participant: participant ? { ...participant, enrollmentNumber } : null,
    };
  } catch (error) {
    console.error('[getMyEnrollmentForEdition]', error);
    return { success: false as const, enrolled: false as const };
  }
}

/** Latest enrollment on registration cup / active cup for the logged-in player. */
export async function getMyRegistrationEnrollment(overrideUserId?: string) {
  let userId = overrideUserId;
  let username: string | undefined;

  if (!userId) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(session.user as { id?: string }).id) {
      return { success: false as const, enrollment: null };
    }
    userId = (session.user as { id: string }).id;
    username = (session.user as any)?.username;
  }

  try {
    const regEdition = await resolveRegistrationEdition();
    let participant: any = null;

    const userWhere = [
      { userId },
      ...(username ? [{ user: { username: { equals: username, mode: 'insensitive' as const } } }] : []),
    ];

    if (regEdition) {
      participant = await prisma.editionParticipant.findFirst({
        where: {
          editionId: regEdition.id,
          OR: userWhere,
        },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          paymentAmount: true,
          paymentTransactionId: true,
          paymentMethod: true,
          enrolledAt: true,
          edition: {
            select: {
              id: true,
              title: true,
              number: true,
              theme: true,
              enrollmentFee: true,
              status: true,
              slot: true,
              organizer: { select: { name: true, username: true } },
            },
          },
        },
      });
    }

    if (!participant?.edition) return { success: true as const, enrollment: null };

    let enrollmentNumber: number | null = null;
    if (participant?.edition?.id) {
      const allForEdition = await prisma.editionParticipant.findMany({
        where: { editionId: participant.edition.id },
        orderBy: [{ enrolledAt: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
      const idx = allForEdition.findIndex((p) => p.id === participant.id);
      enrollmentNumber = idx >= 0 ? idx + 1 : 1;
    }

    return {
      success: true as const,
      enrollment: {
        participantId: participant.id,
        enrollmentNumber,
        status: participant.status,
        paymentStatus: participant.paymentStatus,
        paymentAmount: participant.paymentAmount,
        paymentTransactionId: participant.paymentTransactionId,
        paymentMethod: participant.paymentMethod,
        enrolledAt: participant.enrolledAt,
        edition: {
          id: participant.edition.id,
          title: participant.edition.title,
          number: participant.edition.number,
          theme: participant.edition.theme,
          enrollmentFee: participant.edition.enrollmentFee,
          status: participant.edition.status,
          organizerName:
            participant.edition.organizer?.name?.trim() ||
            participant.edition.organizer?.username?.trim() ||
            'Organizer',
        },
      },
    };
  } catch (error) {
    console.error('[getMyRegistrationEnrollment]', error);
    return { success: false as const, enrollment: null };
  }
}

export async function verifyParticipantPayment(editionId: string, userId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  try {
    const [edition, user, participant] = await Promise.all([
      prisma.edition.findUnique({
        where: { id: editionId },
        select: {
          id: true,
          number: true,
          title: true,
          theme: true,
          enrollmentFee: true,
          organizer: { select: { name: true, username: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, username: true, email: true },
      }),
      prisma.editionParticipant.findUnique({
        where: { editionId_userId: { editionId, userId } },
      }),
    ]);

    if (!edition) return { success: false as const, error: 'Edition not found.' };
    if (!user) return { success: false as const, error: 'Player not found.' };
    if (!participant) return { success: false as const, error: 'Player is not enrolled in this edition.' };

    const updated = await prisma.editionParticipant.update({
      where: { editionId_userId: { editionId, userId } },
      data: {
        paymentStatus: 'VERIFIED',
      },
      include: participantUserSelect,
    });

    let emailSent = false;
    let emailRecipient = user.email?.trim() || '';

    // Send confirmation email if player has a valid email address
    if (emailRecipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRecipient)) {
      try {
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

        const feeAmount = Number(edition.enrollmentFee) || Number(participant.paymentAmount) || 200;
        const txnId = participant.paymentTransactionId || '—';
        const methodLabel =
          participant.paymentMethod === 'ALTERNATE_UPI'
            ? 'Alternate Payment UPI'
            : 'Primary Payment UPI';
        const organizerName =
          edition.organizer?.name?.trim() || edition.organizer?.username?.trim() || 'Organizer';

        const allForEdition = await prisma.editionParticipant.findMany({
          where: { editionId },
          orderBy: [{ enrolledAt: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, userId: true },
        });
        const enrollIndex = allForEdition.findIndex((p) => p.userId === userId);
        const enrollmentNumber = enrollIndex >= 0 ? enrollIndex + 1 : 1;

        await transporter.sendMail({
          from: `"CBOT Tournament Director" <${smtpFrom}>`,
          to: emailRecipient,
          subject: `✅ Payment Verified — Enrollment Confirmed (#${enrollmentNumber}) for ${edition.title} (Edition #${edition.number})`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; border: 1px solid #334155; border-radius: 16px; overflow: hidden; background: #0f172a; color: #f8fafc;">
              <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px 20px; text-align: center; border-bottom: 1px solid #334155;">
                <div style="display: inline-block; padding: 6px 14px; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 9999px; margin-bottom: 12px;">
                  <span style="color: #34d399; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">🎯 Payment Verified & Confirmed</span>
                </div>
                <h1 style="margin: 0; color: #f59e0b; font-size: 22px; font-weight: 900; letter-spacing: -0.02em;">CBOT Tournament Arena</h1>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">${edition.title} · Edition #${edition.number}</p>
              </div>

              <div style="padding: 24px 20px;">
                <p style="font-size: 15px; color: #e2e8f0; margin-top: 0;">Hello <strong style="color: #fbbf24;">${user.name || user.username}</strong>,</p>
                <p style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
                  Great news! Tournament organizer <strong>${organizerName}</strong> has verified your payment reference for the upcoming edition. Your slot and enrollment are officially confirmed!
                </p>

                <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px 18px; margin: 20px 0;">
                  <h3 style="margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #38bdf8;">Enrollment Receipt</h3>
                  <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <tr>
                      <td style="padding: 5px 0; color: #94a3b8;">Enrollment #:</td>
                      <td style="padding: 5px 0; color: #fbbf24; font-weight: 900; font-size: 14px; text-align: right;">#${enrollmentNumber}</td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; color: #94a3b8;">Tournament:</td>
                      <td style="padding: 5px 0; color: #f8fafc; font-weight: 700; text-align: right;">${edition.title} (#${edition.number})</td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; color: #94a3b8;">Player:</td>
                      <td style="padding: 5px 0; color: #f8fafc; font-weight: 700; text-align: right;">${user.name} (@${user.username})</td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; color: #94a3b8;">Fee Paid:</td>
                      <td style="padding: 5px 0; color: #34d399; font-weight: 800; text-align: right;">₹${feeAmount}</td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; color: #94a3b8;">Payment Method:</td>
                      <td style="padding: 5px 0; color: #f8fafc; font-weight: 600; text-align: right;">${methodLabel}</td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; color: #94a3b8;">Payment Comments / Ref:</td>
                      <td style="padding: 5px 0; font-family: monospace; color: #38bdf8; font-weight: 700; text-align: right;">${txnId}</td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; color: #94a3b8;">Status:</td>
                      <td style="padding: 5px 0; color: #34d399; font-weight: 800; text-align: right;">✅ VERIFIED</td>
                    </tr>
                  </table>
                </div>

                <!-- First-Come First-Served & Multiple of 8 Policy Box -->
                <div style="background-color: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.35); border-radius: 10px; padding: 14px 16px; margin: 18px 0; font-size: 12px; color: #c7d2fe; line-height: 1.55;">
                  <strong style="color: #a5b4fc; display: block; font-size: 12.5px; margin-bottom: 5px;">ℹ️ First-Come First-Served & Multiples of 8 Policy:</strong>
                  Players are admitted strictly on a first-come, first-served basis in <strong>multiples of 8</strong> (e.g. 8, 16, 24, 32 players) based on enrollment time. If final registrations exceed a confirmed multiple of 8, players beyond the cutoff can be cancelled by the organizer and the entry fee collected will be <strong>100% refunded</strong>.
                </div>

                <div style="text-align: center; margin: 24px 0 16px 0;">
                  <a href="https://www.cbotworld.com/dashboard/player" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); color: #0f172a; font-weight: 900; font-size: 13px; padding: 11px 26px; border-radius: 8px; text-decoration: none;">
                    Go to Player Dashboard →
                  </a>
                </div>

                <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 20px; line-height: 1.5;">
                  Keep your striker chalked! We look forward to seeing you at the tables.
                </p>
              </div>
            </div>
          `,
        });
        emailSent = true;
      } catch (mailErr) {
        console.error('[verifyParticipantPayment] Email send error:', mailErr);
      }
    }

    revalidatePath('/dashboard/organizer');
    revalidatePath('/dashboard/player');
    return {
      success: true as const,
      participant: updated,
      emailSent,
      playerEmail: emailRecipient,
    };
  } catch (error) {
    console.error('[verifyParticipantPayment]', error);
    return { success: false as const, error: 'Failed to verify payment.' };
  }
}

export async function updateMyPaymentTransactionId(editionId: string, paymentTransactionId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as { id?: string }).id) {
    return { success: false as const, error: 'Please log in.' };
  }
  const userId = (session.user as { id: string }).id;
  const txnId = String(paymentTransactionId || '').trim();
  if (!txnId) {
    return { success: false as const, error: 'UPI transaction ID is required.' };
  }

  try {
    const participant = await prisma.editionParticipant.findUnique({
      where: { editionId_userId: { editionId, userId } },
      include: { edition: { select: { enrollmentFee: true } } },
    });
    if (!participant) {
      return { success: false as const, error: 'You are not enrolled in this edition.' };
    }

    const fee = Number(participant.edition?.enrollmentFee) || Number(participant.paymentAmount) || 0;
    if (fee <= 0) {
      return { success: false as const, error: 'This enrollment is free — no transaction ID needed.' };
    }

    const updated = await prisma.editionParticipant.update({
      where: { id: participant.id },
      data: { paymentTransactionId: txnId },
      select: {
        id: true,
        paymentTransactionId: true,
        paymentStatus: true,
        paymentAmount: true,
      },
    });

    revalidatePath('/dashboard/player');
    revalidatePath('/dashboard/organizer');
    return { success: true as const, participant: updated };
  } catch (error) {
    console.error('[updateMyPaymentTransactionId]', error);
    return { success: false as const, error: 'Could not update transaction ID.' };
  }
}

export async function getPublishStatus(draftEditionId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  const draft = await prisma.edition.findUnique({ where: { id: draftEditionId } });
  const live = await findOrganizerLiveEdition();
  const guard = canPublishDraft(live, draft);
  return {
    success: true as const,
    canPublish: guard.ok,
    reason: guard.ok ? null : guard.reason,
    liveEndDate: live?.tournamentEndDate ? toCalendarDate(live.tournamentEndDate) : null,
  };
}

export type PublicEnrolledPlayer = {
  id: string;
  category?: string | null;
  enrolledAt: string | null;
  enrollmentNumber: number;
  user: {
    id: string;
    name: string;
    username: string;
    rating: number;
    image?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
  };
};

export async function getPublicEditionEnrolledPlayers(editionId: string): Promise<{
  success: boolean;
  totalCount?: number;
  players?: PublicEnrolledPlayer[];
  error?: string;
}> {
  if (!editionId) return { success: false, error: 'Edition ID is required.' };
  try {
    const participants = await prisma.editionParticipant.findMany({
      where: { editionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            rating: true,
            image: true,
            city: true,
            state: true,
            country: true,
          },
        },
      },
      orderBy: [
        { enrolledAt: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const players: PublicEnrolledPlayer[] = participants.map((p, idx) => ({
      id: p.id,
      category: p.category,
      enrolledAt: (p.enrolledAt || p.createdAt)?.toISOString?.() || null,
      enrollmentNumber: idx + 1,
      user: {
        id: p.user.id,
        name: p.user.name || p.user.username,
        username: p.user.username,
        rating: p.user.rating || 1200,
        image: p.user.image,
        city: p.user.city,
        state: p.user.state,
        country: p.user.country,
      },
    }));

    return {
      success: true,
      totalCount: participants.length,
      players,
    };
  } catch (error) {
    console.error('[getPublicEditionEnrolledPlayers]', error);
    return { success: false, error: 'Failed to load enrolled players list.' };
  }
}

