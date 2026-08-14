'use server';

import { prisma } from '@/lib/prisma';

// Historical baseline visitor count for CBOT website
const INITIAL_BASELINE = 12450;
let inMemoryFallback = INITIAL_BASELINE;
let tableChecked = false;

async function ensureTableExists() {
  if (tableChecked) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "VisitorCount" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
        "count" INTEGER NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    tableChecked = true;
  } catch (err) {
    // Ignore if table exists or raw query unsupported
  }
}

export async function getVisitorCount(): Promise<number> {
  try {
    await ensureTableExists();
    const result = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`
      SELECT "count" FROM "VisitorCount" WHERE "id" = 'global' LIMIT 1;
    `);
    if (result && result.length > 0) {
      return Number(result[0].count);
    }
    // If not found, seed with initial baseline
    await prisma.$executeRawUnsafe(`
      INSERT INTO "VisitorCount" ("id", "count", "updatedAt")
      VALUES ('global', ${INITIAL_BASELINE}, NOW())
      ON CONFLICT ("id") DO NOTHING;
    `);
    return INITIAL_BASELINE;
  } catch (error) {
    console.error('Error in getVisitorCount:', error);
    return inMemoryFallback;
  }
}

export async function incrementVisitorCount(): Promise<number> {
  try {
    await ensureTableExists();
    const result = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`
      INSERT INTO "VisitorCount" ("id", "count", "updatedAt")
      VALUES ('global', ${INITIAL_BASELINE + 1}, NOW())
      ON CONFLICT ("id") DO UPDATE
      SET "count" = "VisitorCount"."count" + 1, "updatedAt" = NOW()
      RETURNING "count";
    `);
    if (result && result.length > 0) {
      const count = Number(result[0].count);
      inMemoryFallback = count;
      return count;
    }
    return ++inMemoryFallback;
  } catch (error) {
    console.error('Error in incrementVisitorCount:', error);
    return ++inMemoryFallback;
  }
}
