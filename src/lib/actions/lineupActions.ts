'use server';

import { prisma } from '@/lib/prisma';
import { MatchLineupSlot } from '@/types';
import { revalidatePath } from 'next/cache';

export async function submitMatchLineup(data: {
  matchId: string;
  teamId: string;
  teamName: string;
  captainId: string;
  slots: MatchLineupSlot[];
}) {
  try {
    const existingLineup = await prisma.matchLineup.findUnique({
      where: { matchId_teamId: { matchId: data.matchId, teamId: data.teamId } }
    });

    let lineupId = '';

    if (existingLineup) {
      // Delete existing slots to fully replace them
      await prisma.matchLineupSlot.deleteMany({
        where: { lineupId: existingLineup.id }
      });
      await prisma.matchLineup.update({
        where: { id: existingLineup.id },
        data: { status: 'SUBMITTED', submittedAt: new Date() }
      });
      lineupId = existingLineup.id;
    } else {
      const newLineup = await prisma.matchLineup.create({
        data: {
          matchId: data.matchId,
          teamId: data.teamId,
          status: 'SUBMITTED',
          submittedAt: new Date(),
        }
      });
      lineupId = newLineup.id;
    }

    // Create slots and their players
    for (const slot of data.slots) {
      const createdSlot = await prisma.matchLineupSlot.create({
        data: {
          lineupId,
          formatType: slot.formatType,
          patternId: slot.patternId,
          patternName: slot.patternName,
        }
      });

      const playerPromises = slot.playerIds.map((pid: string) => 
        prisma.matchLineupSlotPlayer.create({
          data: {
            slotId: createdSlot.id,
            userId: pid,
          }
        })
      );

      await Promise.all(playerPromises);
    }

    revalidatePath('/dashboard/captain');
    revalidatePath('/fixtures');

    return { success: true, message: 'Lineup submitted successfully' };
  } catch (error) {
    console.error('Failed to submit lineup:', error);
    return { success: false, error: 'Failed to submit lineup' };
  }
}

export async function lockMatchLineup(lineupId: string) {
  try {
    const lineup = await prisma.matchLineup.update({
      where: { id: lineupId },
      data: { status: 'LOCKED', lockedAt: new Date() }
    });
    return { success: true, lineup };
  } catch (error) {
    return { success: false, error: 'Lineup not found or could not be locked' };
  }
}

export async function overrideMatchLineup(lineupId: string, updatedSlots: MatchLineupSlot[], notes: string) {
  try {
    // Delete existing slots
    await prisma.matchLineupSlot.deleteMany({
      where: { lineupId }
    });

    // Recreate slots
    for (const slot of updatedSlots) {
      const createdSlot = await prisma.matchLineupSlot.create({
        data: {
          lineupId,
          formatType: slot.formatType,
          patternId: slot.patternId,
          patternName: slot.patternName,
        }
      });

      const playerPromises = slot.playerIds.map((pid: string) => 
        prisma.matchLineupSlotPlayer.create({
          data: {
            slotId: createdSlot.id,
            userId: pid,
          }
        })
      );

      await Promise.all(playerPromises);
    }

    const lineup = await prisma.matchLineup.update({
      where: { id: lineupId },
      data: { status: 'OVERRIDDEN', overrideNotes: notes }
    });

    return { success: true, lineup };
  } catch (error) {
    return { success: false, error: 'Failed to override lineup' };
  }
}
