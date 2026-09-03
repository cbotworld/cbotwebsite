'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function requireOrganizer() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== 'ORGANIZER' && role !== 'SUPER_ADMIN')) {
    return { ok: false as const, error: 'Unauthorized' };
  }
  return { ok: true as const, session };
}

const participantInclude = {
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
  team: {
    select: {
      id: true,
      name: true,
      tag: true,
    },
  },
} as const;

export async function getEditionParticipants(editionId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  if (!editionId) return { success: false as const, error: 'Edition is required.' };

  try {
    const participants = await prisma.editionParticipant.findMany({
      where: { editionId },
      include: participantInclude,
      orderBy: { user: { name: 'asc' } },
    });
    return { success: true as const, participants };
  } catch (error) {
    console.error('[getEditionParticipants]', error);
    return { success: false as const, error: 'Failed to load selected players.' };
  }
}

export async function addEditionParticipant(editionId: string, userId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  if (!editionId || !userId) {
    return { success: false as const, error: 'Edition and player are required.' };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false as const, error: 'Player not found.' };

    const participant = await prisma.editionParticipant.upsert({
      where: { editionId_userId: { editionId, userId } },
      update: {},
      create: {
        editionId,
        userId,
        status: 'REGISTERED',
      },
      include: participantInclude,
    });

    revalidatePath('/dashboard/organizer');
    revalidatePath('/teams-and-players');
    revalidatePath('/dashboard/player');

    return { success: true as const, participant };
  } catch (error) {
    console.error('[addEditionParticipant]', error);
    return { success: false as const, error: 'Failed to add player to edition.' };
  }
}

export async function removeEditionParticipant(editionId: string, userId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  if (!editionId || !userId) {
    return { success: false as const, error: 'Edition and player are required.' };
  }

  try {
    const existing = await prisma.editionParticipant.findUnique({
      where: { editionId_userId: { editionId, userId } },
      include: { team: { select: { name: true } } },
    });
    if (!existing) return { success: false as const, error: 'Player is not in this edition.' };

    await prisma.editionParticipant.delete({
      where: { editionId_userId: { editionId, userId } },
    });

    revalidatePath('/dashboard/organizer');
    revalidatePath('/teams-and-players');
    revalidatePath('/dashboard/player');

    return {
      success: true as const,
      removedUserId: userId,
      wasOnTeam: existing.team?.name || null,
    };
  } catch (error) {
    console.error('[removeEditionParticipant]', error);
    return { success: false as const, error: 'Failed to remove player from edition.' };
  }
}
