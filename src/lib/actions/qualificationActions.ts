'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveCurrentEdition } from '@/lib/current-edition';

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

const qualifierInclude = {
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

export async function ensureNextEdition() {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  try {
    const current = await resolveCurrentEdition();
    if (!current) return { success: false as const, error: 'No current edition found.' };

    const existingUpcoming = await prisma.edition.findFirst({
      where: { status: 'UPCOMING' },
      orderBy: { number: 'desc' },
      include: editionInclude,
    });
    if (existingUpcoming) {
      return { success: true as const, edition: existingUpcoming };
    }

    const suggestedNumber = current.number + 1;
    const byNumber = await prisma.edition.findUnique({
      where: { number: suggestedNumber },
      include: editionInclude,
    });

    if (byNumber) {
      if (byNumber.status !== 'UPCOMING') {
        const updated = await prisma.edition.update({
          where: { id: byNumber.id },
          data: { status: 'UPCOMING' },
          include: editionInclude,
        });
        revalidatePath('/dashboard/organizer');
        return { success: true as const, edition: updated };
      }
      return { success: true as const, edition: byNumber };
    }

    const currentFull = await prisma.edition.findUnique({
      where: { id: current.id },
      select: { organizerId: true, totalDays: true, maxTeams: true, prizePool: true, theme: true },
    });
    if (!currentFull) return { success: false as const, error: 'Current edition not found.' };

    const created = await prisma.edition.create({
      data: {
        number: suggestedNumber,
        title: `Edition ${suggestedNumber}`,
        slug: `edition-${suggestedNumber}`,
        status: 'UPCOMING',
        organizerId: currentFull.organizerId,
        totalDays: currentFull.totalDays,
        maxTeams: currentFull.maxTeams,
        prizePool: currentFull.prizePool,
        theme: currentFull.theme,
      },
      include: editionInclude,
    });

    revalidatePath('/dashboard/organizer');
    return { success: true as const, edition: created };
  } catch (error) {
    console.error('[ensureNextEdition]', error);
    return { success: false as const, error: 'Failed to prepare next edition.' };
  }
}

export async function syncUnlockedGradeAverages(editionId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };
  if (!editionId) return { success: false as const, error: 'Edition is required.' };

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

export async function addQualifiedPlayer(editionId: string, userId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };
  if (!editionId || !userId) {
    return { success: false as const, error: 'Edition and player are required.' };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false as const, error: 'Player not found.' };

    const gradeAverage = Number(user.average) > 0 ? Number(user.average) : null;
    const participant = await prisma.editionParticipant.upsert({
      where: { editionId_userId: { editionId, userId } },
      update: {
        status: 'QUALIFIED',
        ...(gradeAverage !== null ? { gradeAverage } : {}),
      },
      create: {
        editionId,
        userId,
        status: 'QUALIFIED',
        gradeAverage,
        gradeAverageLocked: false,
      },
      include: qualifierInclude,
    });

    revalidatePath('/dashboard/organizer');
    return { success: true as const, participant };
  } catch (error) {
    console.error('[addQualifiedPlayer]', error);
    return { success: false as const, error: 'Failed to qualify player.' };
  }
}

export async function removeQualifiedPlayer(editionId: string, userId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };
  if (!editionId || !userId) {
    return { success: false as const, error: 'Edition and player are required.' };
  }

  try {
    await prisma.editionParticipant.delete({
      where: { editionId_userId: { editionId, userId } },
    });
    revalidatePath('/dashboard/organizer');
    return { success: true as const, removedUserId: userId };
  } catch (error) {
    console.error('[removeQualifiedPlayer]', error);
    return { success: false as const, error: 'Failed to remove qualified player.' };
  }
}

export async function updateGradeAverage(
  editionId: string,
  userId: string,
  gradeAverage: number,
  lock = true
) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  try {
    const participant = await prisma.editionParticipant.update({
      where: { editionId_userId: { editionId, userId } },
      data: {
        gradeAverage: gradeAverage > 0 ? gradeAverage : null,
        gradeAverageLocked: lock,
      },
      include: qualifierInclude,
    });
    revalidatePath('/dashboard/organizer');
    return { success: true as const, participant };
  } catch (error) {
    console.error('[updateGradeAverage]', error);
    return { success: false as const, error: 'Failed to update grade average.' };
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
      data: {
        gradeAverage,
        gradeAverageLocked: false,
      },
      include: qualifierInclude,
    });
    revalidatePath('/dashboard/organizer');
    return { success: true as const, participant };
  } catch (error) {
    console.error('[pullCurrentAverageAsGrade]', error);
    return { success: false as const, error: 'Failed to pull current average.' };
  }
}
