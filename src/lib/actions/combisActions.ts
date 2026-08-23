'use server';

import { prisma } from '@/lib/prisma';
import { unstable_cache } from 'next/cache';
import { stageConfigKey } from '@/lib/tournament-stages';

async function fetch200thEditionCombisData() {
  try {
    // 1. Fetch active Edition 200
    const edition = await prisma.edition.findFirst({
      where: { OR: [{ number: 200 }, { status: 'IN_PROGRESS' }] },
      orderBy: { number: 'desc' },
      include: {
        patterns: {
          orderBy: { sequence: 'asc' },
          include: { pattern: true }
        }
      }
    });

    const editionId = edition?.id;

    let stageConfig = null;
    if (editionId) {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: stageConfigKey(editionId) },
      });
      if (setting?.value) {
        try {
          stageConfig = JSON.parse(setting.value);
        } catch {}
      }
    }

    // 2. Fetch all Teams under Edition 200 from Supabase
    const teams = await prisma.team.findMany({
      where: editionId ? { editionId } : {},
      include: {
        captain: {
          select: { id: true, name: true, username: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, username: true, rating: true, average: true, target: true }
            }
          }
        }
      }
    });

    // 3. Fetch all Matches under Edition 200 from Supabase
    const matches = await prisma.match.findMany({
      where: editionId ? { editionId } : {},
      orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
      include: {
        team1: {
          include: {
            captain: { select: { id: true, name: true, username: true } }
          }
        },
        team2: {
          include: {
            captain: { select: { id: true, name: true, username: true } }
          }
        },
        lineups: {
          include: {
            slots: {
              include: {
                players: {
                  include: {
                    user: { select: { id: true, name: true, username: true } }
                  }
                }
              }
            }
          }
        }
      }
    });

    return {
      success: true,
      edition,
      stageConfig,
      teams,
      matches,
    };
  } catch (error) {
    console.error('Failed to fetch 200th edition data from Supabase:', error);
    return {
      success: false,
      error: 'Failed to fetch data from Supabase',
      teams: [],
      matches: [],
    };
  }
}

export async function get200thEditionCombisData() {
  return unstable_cache(fetch200thEditionCombisData, ['edition-200-combis-data'], {
    revalidate: 15,
    tags: ['edition-200-combis-data', 'organizer-schedule'],
  })();
}
