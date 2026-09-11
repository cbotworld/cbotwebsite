'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveCurrentEdition } from '@/lib/current-edition';
import { buildEditionArchiveWorkbook } from '@/lib/edition-archive';
import { gradingSettingKey } from '@/lib/grading';
import { stageConfigKey, defaultTournamentStages } from '@/lib/tournament-stages';

async function requireOrganizer() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== 'ORGANIZER' && role !== 'SUPER_ADMIN')) {
    return { ok: false as const, error: 'Unauthorized' };
  }
  return { ok: true as const, session };
}

export async function exportEditionArchive(editionId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  if (!editionId) return { success: false as const, error: 'Edition is required.' };

  try {
    const { buffer, fileName } = await buildEditionArchiveWorkbook(editionId);
    return {
      success: true as const,
      fileName,
      fileBase64: buffer.toString('base64'),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  } catch (error) {
    console.error('[exportEditionArchive]', error);
    return { success: false as const, error: 'Failed to build edition archive.' };
  }
}

export async function emptyEditionTournamentData(editionId: string, confirmationNumber: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false as const, error: auth.error };

  if (!editionId) return { success: false as const, error: 'Edition is required.' };

  try {
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, number: true, status: true, slot: true, title: true },
    });
    if (!edition) return { success: false as const, error: 'Edition not found.' };

    if (String(confirmationNumber).trim() !== String(edition.number)) {
      return {
        success: false as const,
        error: `Type the edition number ${edition.number} to confirm.`,
      };
    }

    const live = await resolveCurrentEdition();
    if (
      live?.id === edition.id &&
      edition.slot === 'A' &&
      String(edition.status).toUpperCase() === 'IN_PROGRESS'
    ) {
      return {
        success: false as const,
        error: 'Cannot clear the live tournament. Publish the draft cup first, then clear the finished edition on Tournament B.',
      };
    }

    const captainRows = await prisma.team.findMany({
      where: { editionId },
      select: { captainId: true },
    });
    const captainIds = captainRows.map((t) => t.captainId).filter((id): id is string => Boolean(id));

    await prisma.$transaction(async (tx) => {
      await tx.liveStream.deleteMany({ where: { editionId } });
      await tx.match.deleteMany({ where: { editionId } });

      await tx.leagueStanding.deleteMany({ where: { editionId } });
      await tx.playerDayScore.deleteMany({ where: { editionId } });
      await tx.playerRankingSnapshot.deleteMany({ where: { editionId } });
      await tx.playerCategoryHistory.deleteMany({ where: { editionId } });
      await tx.playerAverageLog.deleteMany({ where: { editionId } });
      await tx.playerTargetLog.deleteMany({ where: { editionId } });
      await tx.spocTeamMember.deleteMany({ where: { editionId } });
      await tx.editionParticipant.deleteMany({ where: { editionId } });
      await tx.team.deleteMany({ where: { editionId } });
      await tx.editionBoardPattern.deleteMany({ where: { editionId } });

      await tx.systemSetting.deleteMany({
        where: {
          key: { in: [stageConfigKey(editionId), gradingSettingKey(editionId)] },
        },
      });

      if (captainIds.length) {
        await tx.user.updateMany({
          where: { id: { in: captainIds }, role: 'CAPTAIN' },
          data: { role: 'PLAYER' },
        });
      }

      await tx.edition.update({
        where: { id: editionId },
        data: {
          status: 'DRAFT',
          dayDates: null,
          tournamentStartDate: null,
          tournamentEndDate: null,
          registrationStartDate: null,
          registrationEndDate: null,
          publishedAt: null,
        },
      });

      await tx.systemSetting.upsert({
        where: { key: stageConfigKey(editionId) },
        create: {
          key: stageConfigKey(editionId),
          value: JSON.stringify({ scheduleMode: 'DIVIDED', stages: [] }),
        },
        update: {
          value: JSON.stringify({ scheduleMode: 'DIVIDED', stages: [] }),
        },
      });
    });

    revalidatePath('/', 'layout');
    revalidatePath('/dashboard/organizer');
    revalidatePath('/dashboard/player');
    revalidatePath('/dashboard/captain');
    revalidatePath('/fixtures');
    revalidatePath('/schedule');
    revalidatePath('/combis');
    revalidatePath('/teams');

    return {
      success: true as const,
      message: `Edition ${edition.number} tournament data cleared. Player profiles and website CMS were kept.`,
    };
  } catch (error) {
    console.error('[emptyEditionTournamentData]', error);
    return { success: false as const, error: 'Failed to clear tournament data.' };
  }
}
