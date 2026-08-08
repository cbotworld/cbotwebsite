'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createBoardPattern(data: {
  name: string;
  difficulty: string;
  objective: string;
  validCoins: string[];
  invalidCoins: string[];
  basePoints: number;
  queenBonus: number;
  penaltyPoints: number;
  instructionalMedia?: string;
  diagramUrl?: string;
}) {
  try {
    const newPattern = await prisma.boardPattern.create({
      data: {
        name: data.name,
        difficulty: data.difficulty,
        objective: data.objective,
        validCoins: data.validCoins.join(','),
        invalidCoins: data.invalidCoins.join(','),
        basePoints: data.basePoints,
        queenBonus: data.queenBonus,
        penaltyPoints: data.penaltyPoints,
        instructionalMedia: data.instructionalMedia || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=400',
        diagramUrl: data.diagramUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=400',
      }
    });

    revalidatePath('/dashboard/admin/patterns');
    revalidatePath('/patterns');

    return { success: true, pattern: newPattern };
  } catch (error) {
    console.error('Failed to create pattern:', error);
    return { success: false, error: 'Failed to create pattern' };
  }
}

export async function updateBoardPattern(patternId: string, data: any) {
  try {
    const updateData: any = { ...data };
    if (data.validCoins && Array.isArray(data.validCoins)) updateData.validCoins = data.validCoins.join(',');
    if (data.invalidCoins && Array.isArray(data.invalidCoins)) updateData.invalidCoins = data.invalidCoins.join(',');
    
    // Scoring rules mapping from UI if passed as nested object
    if (data.scoringRules) {
      updateData.basePoints = data.scoringRules.basePoints;
      updateData.queenBonus = data.scoringRules.queenBonus;
      updateData.penaltyPoints = data.scoringRules.penaltyPoints;
      delete updateData.scoringRules;
    }

    const updated = await prisma.boardPattern.update({
      where: { id: patternId },
      data: updateData
    });

    revalidatePath('/dashboard/admin/patterns');
    revalidatePath('/patterns');

    return { success: true, pattern: updated };
  } catch (error) {
    console.error('Failed to update pattern:', error);
    return { success: false, error: 'Failed to update pattern' };
  }
}

export async function deleteBoardPattern(patternId: string) {
  try {
    const deleted = await prisma.boardPattern.delete({
      where: { id: patternId }
    });
    
    revalidatePath('/dashboard/admin/patterns');
    revalidatePath('/patterns');

    return { success: true, deleted };
  } catch (error) {
    console.error('Failed to delete pattern:', error);
    return { success: false, error: 'Failed to delete pattern' };
  }
}

export async function getPatterns() {
  try {
    const patterns = await prisma.boardPattern.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, patterns };
  } catch (error) {
    return { success: false, error: 'Failed to fetch patterns' };
  }
}

export async function assignPatternsToEdition(editionId: string, patternAssignments: { patternId: string, matchFormat: string, sequence: number }[]) {
  try {
    // Delete existing assignments for this edition to fully replace them
    await prisma.editionBoardPattern.deleteMany({
      where: { editionId }
    });

    const creations = patternAssignments.map(pa => 
      prisma.editionBoardPattern.create({
        data: {
          editionId,
          patternId: pa.patternId,
          matchFormat: pa.matchFormat,
          sequence: pa.sequence
        }
      })
    );

    await Promise.all(creations);

    return { success: true, message: 'Patterns assigned successfully' };
  } catch (error) {
    console.error('Failed to assign patterns:', error);
    return { success: false, error: 'Failed to assign patterns' };
  }
}
