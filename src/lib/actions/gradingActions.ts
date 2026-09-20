'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveCurrentEdition } from '@/lib/current-edition';
import { recordPlayerTargetChange } from '@/lib/actions/playerScoreActions';
import { memoryCache } from '@/lib/memory-cache';
import {
  assignedUserIdsFromGrid,
  gradingSettingKey,
  parseGradingGrid,
  sanitizeGradingGrid,
  computePlayerTargetUpdates,
  computePlayerGradeUpdates,
  type GradingGrid,
} from '@/lib/grading';

async function requireOrganizer() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== 'ORGANIZER' && role !== 'SUPER_ADMIN')) {
    return { ok: false as const, error: 'Unauthorized' };
  }
  return { ok: true as const, session };
}

export async function getEditionGrading(editionId: string): Promise<{
  success: boolean;
  grid?: GradingGrid;
  error?: string;
}> {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };

  if (!editionId) return { success: false, error: 'Edition is required.' };

  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: gradingSettingKey(editionId) },
    });
    return { success: true, grid: parseGradingGrid(row?.value) };
  } catch (error) {
    console.error('[getEditionGrading]', error);
    return { success: false, error: 'Failed to load grading.' };
  }
}

export async function saveEditionGrading(
  editionId: string,
  grid: GradingGrid,
): Promise<{
  success: boolean;
  grid?: GradingGrid;
  targetsUpdated?: number;
  gradesUpdated?: number;
  error?: string;
}> {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };

  if (!editionId) return { success: false, error: 'Edition is required.' };

  const cleaned = sanitizeGradingGrid(grid);
  const assigned = Object.keys(cleaned.cells).length;
  const capacity = cleaned.columns.length * cleaned.rowCount;
  if (assigned > capacity) {
    return { success: false, error: 'Too many player assignments for this grid size.' };
  }

  try {
    const edition = await prisma.edition.findUnique({ where: { id: editionId }, select: { id: true } });
    if (!edition) return { success: false, error: 'Edition not found.' };

    const existingRow = await prisma.systemSetting.findUnique({
      where: { key: gradingSettingKey(editionId) },
    });
    const previousGrid = parseGradingGrid(existingRow?.value);
    const previousAssigned = assignedUserIdsFromGrid(previousGrid);
    const nextAssigned = assignedUserIdsFromGrid(cleaned);
    const removedFromGrid = [...previousAssigned].filter((userId) => !nextAssigned.has(userId));

    await prisma.systemSetting.upsert({
      where: { key: gradingSettingKey(editionId) },
      create: { key: gradingSettingKey(editionId), value: JSON.stringify(cleaned) },
      update: { value: JSON.stringify(cleaned) },
    });

    const changedById = (auth.session.user as { id?: string }).id || '';
    const liveEdition = await resolveCurrentEdition();
    const isLiveEdition = liveEdition?.id === editionId;
    const targetUpdates = computePlayerTargetUpdates(cleaned);
    let targetsUpdated = 0;

    for (const { userId, target } of targetUpdates) {
      if (changedById) {
        await recordPlayerTargetChange(userId, target, changedById, false, editionId);
      }
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { target },
        });
      } catch {}
      targetsUpdated += 1;
    }

    const gradeUpdates = computePlayerGradeUpdates(cleaned);
    let gradesUpdated = 0;

    for (const { userId, grade } of gradeUpdates) {
      const participant = await prisma.editionParticipant.findUnique({
        where: { editionId_userId: { editionId, userId } },
        select: { id: true, category: true },
      });
      if (participant) {
        if (participant.category === grade) continue;
        await prisma.editionParticipant.update({
          where: { id: participant.id },
          data: { category: grade },
        });
      } else {
        await prisma.editionParticipant.create({
          data: { editionId, userId, category: grade },
        });
      }
      gradesUpdated += 1;
    }

    for (const userId of removedFromGrid) {
      const participant = await prisma.editionParticipant.findUnique({
        where: { editionId_userId: { editionId, userId } },
        select: { id: true, category: true },
      });
      if (!participant?.category) continue;
      await prisma.editionParticipant.update({
        where: { id: participant.id },
        data: { category: null },
      });
      gradesUpdated += 1;
    }

    memoryCache.invalidate(`stage_config_${editionId}`);
    memoryCache.invalidate(`edition_schedule_shared_${editionId}`);
    memoryCache.invalidate('public_standings_');
    memoryCache.invalidate('current_edition_combis');
    memoryCache.invalidate('mobile_public_combis');

    revalidatePath('/dashboard/organizer');
    revalidatePath('/dashboard/player');
    revalidatePath('/teams-and-players');
    return { success: true, grid: cleaned, targetsUpdated, gradesUpdated };
  } catch (error) {
    console.error('[saveEditionGrading]', error);
    return { success: false, error: 'Failed to save grading.' };
  }
}
