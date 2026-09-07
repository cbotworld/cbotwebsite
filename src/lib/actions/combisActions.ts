'use server';

import { prisma } from '@/lib/prisma';
import { unstable_cache } from 'next/cache';
import { stageConfigKey } from '@/lib/tournament-stages';
import { resolveCurrentEditionRecord } from '@/lib/current-edition';
import { gradingSettingKey, parseGradingGrid, computePlayerGradeUpdates } from '@/lib/grading';

async function fetchCurrentEditionCombisData() {
  try {
    const edition = await resolveCurrentEditionRecord({
      patterns: {
        orderBy: { sequence: 'asc' },
        include: { pattern: true },
      },
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

    const teams = await prisma.team.findMany({
      where: editionId ? { editionId } : {},
      include: {
        captain: {
          select: { id: true, name: true, username: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, username: true, rating: true, average: true, target: true },
            },
          },
        },
        spocMembers: {
          include: {
            user: {
              select: { id: true, name: true, username: true },
            },
          },
        },
      },
    });

    const scores = editionId
      ? await prisma.playerDayScore.findMany({
          where: { editionId },
          select: { userId: true, dayNumber: true, score: true, slams: true },
        })
      : [];

    const matches = await prisma.match.findMany({
      where: editionId ? { editionId } : {},
      orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
      include: {
        team1: {
          include: {
            captain: { select: { id: true, name: true, username: true } },
          },
        },
        team2: {
          include: {
            captain: { select: { id: true, name: true, username: true } },
          },
        },
        lineups: {
          include: {
            slots: {
              include: {
                players: {
                  include: {
                    user: { select: { id: true, name: true, username: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    let userGradeMap: Record<string, string> = {};
    if (editionId) {
      const gradingSetting = await prisma.systemSetting.findUnique({
        where: { key: gradingSettingKey(editionId) },
      });
      if (gradingSetting?.value) {
        const grid = parseGradingGrid(gradingSetting.value);
        const updates = computePlayerGradeUpdates(grid);
        updates.forEach((u) => {
          userGradeMap[u.userId] = u.grade;
        });
      }
    }

    return {
      success: true,
      edition,
      stageConfig,
      teams,
      matches,
      scores,
      userGradeMap,
    };
  } catch (error) {
    console.error('Failed to fetch live edition combis data:', error);
    return {
      success: false,
      error: 'Failed to fetch tournament data',
      teams: [],
      matches: [],
      scores: [],
      userGradeMap: {},
    };
  }
}

export async function getCurrentEditionCombisData() {
  return unstable_cache(fetchCurrentEditionCombisData, ['edition-combis-data'], {
    revalidate: 15,
    tags: ['edition-combis-data', 'organizer-schedule'],
  })();
}