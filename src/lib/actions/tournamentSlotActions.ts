'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canPublishDraft, isOrganizerLiveStatus } from '@/lib/tournament-slots';
import { resolveCurrentEdition, archiveEditionsBefore, getNextEditionNumber } from '@/lib/current-edition';
import { toCalendarDate } from '@/lib/combi-cutoff';
import { stageConfigKey } from '@/lib/tournament-stages';

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
    await prisma.systemSetting.upsert({
      where: { key: stageConfigKey(targetId) },
      update: { value: sourceStage.value },
      create: { key: stageConfigKey(targetId), value: sourceStage.value },
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
      await cloneEditionBlueprint(slotA.id, slotB.id);
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

export async function enrollCurrentUser(editionId: string, paymentTransactionId?: string) {
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
      return { success: false as const, error: 'UPI transaction ID is required to enroll.' };
    }

    const gradeAverage = Number(user.average) > 0 ? Number(user.average) : null;

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
      },
    });

    revalidatePath('/');
    revalidatePath('/dashboard/organizer');
    revalidatePath('/dashboard/player');
    return {
      success: true as const,
      participant,
      message: fee > 0 ? `Payment of ₹${fee} received. You are enrolled!` : 'Enrollment successful!',
    };
  } catch (error) {
    console.error('[enrollCurrentUser]', error);
    return { success: false as const, error: 'Enrollment failed. Please try again.' };
  }
}

export async function getMyEnrollmentForEdition(editionId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as { id?: string }).id) {
    return { success: false as const, enrolled: false as const };
  }
  const userId = (session.user as { id: string }).id;

  try {
    const participant = await prisma.editionParticipant.findUnique({
      where: { editionId_userId: { editionId, userId } },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paymentAmount: true,
        paymentTransactionId: true,
        enrolledAt: true,
      },
    });
    if (!participant) return { success: true as const, enrolled: false as const };

    const status = String(participant.status || '').toUpperCase();
    const enrolled =
      status === 'ENROLLED' ||
      status === 'QUALIFIED' ||
      Boolean(participant.enrolledAt) ||
      String(participant.paymentStatus || '').toUpperCase() === 'PAID';

    return {
      success: true as const,
      enrolled,
      participant: enrolled ? participant : null,
    };
  } catch (error) {
    console.error('[getMyEnrollmentForEdition]', error);
    return { success: false as const, enrolled: false as const };
  }
}

/** Latest enrollment on Tournament B (draft / registration cup) for the logged-in player. */
export async function getMyRegistrationEnrollment() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as { id?: string }).id) {
    return { success: false as const, enrollment: null };
  }
  const userId = (session.user as { id: string }).id;

  try {
    const participant = await prisma.editionParticipant.findFirst({
      where: {
        userId,
        OR: [
          { status: { in: ['ENROLLED', 'QUALIFIED'] } },
          { enrolledAt: { not: null } },
          { paymentStatus: { in: ['PAID', 'FREE'] } },
        ],
        edition: { slot: 'B' },
      },
      orderBy: { enrolledAt: 'desc' },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paymentAmount: true,
        paymentTransactionId: true,
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

    if (!participant?.edition) return { success: true as const, enrollment: null };

    return {
      success: true as const,
      enrollment: {
        participantId: participant.id,
        status: participant.status,
        paymentStatus: participant.paymentStatus,
        paymentAmount: participant.paymentAmount,
        paymentTransactionId: participant.paymentTransactionId,
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
