'use server';

import { prisma } from '@/lib/prisma';

// Historical baseline visitor count for CBOT website
const INITIAL_BASELINE = 12450;
let inMemoryFallback = INITIAL_BASELINE;

export async function getVisitorCount(): Promise<number> {
  try {
    const result = await prisma.visitorCount.findUnique({
      where: { id: 'global' }
    });
    if (result) {
      return result.count;
    }
    // Seed baseline if not exists
    const newRecord = await prisma.visitorCount.create({
      data: { id: 'global', count: INITIAL_BASELINE }
    });
    return newRecord.count;
  } catch (error) {
    console.error('Error in getVisitorCount:', error);
    return inMemoryFallback;
  }
}

export async function incrementVisitorCount(): Promise<number> {
  try {
    const result = await prisma.visitorCount.upsert({
      where: { id: 'global' },
      update: { count: { increment: 1 } },
      create: { id: 'global', count: INITIAL_BASELINE + 1 }
    });
    inMemoryFallback = result.count;
    return result.count;
  } catch (error) {
    console.error('Error in incrementVisitorCount:', error);
    return ++inMemoryFallback;
  }
}
