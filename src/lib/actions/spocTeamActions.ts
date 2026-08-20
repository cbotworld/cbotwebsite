'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TEAM_TYPE_SPOC } from '@/lib/spoc-teams';

async function requireOrganizer() {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any)?.role !== 'ORGANIZER' && (session.user as any)?.role !== 'SUPER_ADMIN')) {
    return { ok: false as const, error: 'Unauthorized: Organizer access required.' };
  }
  return { ok: true as const };
}

async function validateSpocRoster(editionId: string, teamId: string | null, playerUserIds: string[]) {
  const uniqueIds = [...new Set(playerUserIds.filter(Boolean))];
  if (!uniqueIds.length) return { ok: true as const, playerUserIds: uniqueIds };

  const conflicts = await prisma.spocTeamMember.findMany({
    where: {
      editionId,
      userId: { in: uniqueIds },
      ...(teamId ? { teamId: { not: teamId } } : {}),
    },
    include: { team: { select: { name: true } }, user: { select: { name: true, username: true } } },
  });

  if (conflicts.length) {
    const first = conflicts[0];
    const playerName = first.user.name || first.user.username || 'Player';
    return {
      ok: false as const,
      error: `${playerName} is already on Spoc team "${first.team.name}". A player can only be on one Spoc exhibition team at a time.`,
    };
  }

  return { ok: true as const, playerUserIds: uniqueIds };
}

export async function addOrUpdateSpocTeam(data: {
  editionId: string;
  name: string;
  tag: string;
  captainId?: string;
  playerUserIds?: string[];
  logo?: string;
}) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };

  try {
    const rosterCheck = await validateSpocRoster(data.editionId, null, data.playerUserIds || []);
    if (!rosterCheck.ok) return { success: false, error: rosterCheck.error };

    const existing = await prisma.team.findFirst({
      where: { editionId: data.editionId, name: data.name, teamType: TEAM_TYPE_SPOC },
    });

    const defaultLogo = `https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/${data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpeg`;

    let teamRecord;
    if (existing) {
      teamRecord = await prisma.team.update({
        where: { id: existing.id },
        data: {
          tag: data.tag,
          captainId: data.captainId || existing.captainId,
          logo: data.logo || existing.logo || defaultLogo,
        },
      });
    } else {
      teamRecord = await prisma.team.create({
        data: {
          editionId: data.editionId,
          name: data.name,
          tag: data.tag || data.name.substring(0, 3).toUpperCase(),
          captainId: data.captainId || undefined,
          logo: data.logo || defaultLogo,
          teamType: TEAM_TYPE_SPOC,
        },
      });
    }

    await prisma.spocTeamMember.deleteMany({ where: { teamId: teamRecord.id } });

    if (rosterCheck.playerUserIds.length) {
      await prisma.spocTeamMember.createMany({
        data: rosterCheck.playerUserIds.map((userId) => ({
          editionId: data.editionId,
          teamId: teamRecord.id,
          userId,
        })),
      });
    }

    const fullTeam = await prisma.team.findUnique({
      where: { id: teamRecord.id },
      include: {
        captain: true,
        spocMembers: { include: { user: true } },
      },
    });

    revalidatePath('/dashboard/organizer');
    revalidatePath('/teams');
    return { success: true, team: fullTeam };
  } catch (error: any) {
    console.error('[addOrUpdateSpocTeam]', error);
    return { success: false, error: error?.message || 'Failed to save Spoc exhibition team.' };
  }
}

export async function updateSpocTeamRoster(data: {
  teamId: string;
  name: string;
  tag: string;
  captainId: string;
  playerUserIds: string[];
  logo?: string;
}) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };

  try {
    const team = await prisma.team.findUnique({ where: { id: data.teamId } });
    if (!team || team.teamType !== TEAM_TYPE_SPOC) {
      return { success: false, error: 'Spoc exhibition team not found.' };
    }

    const rosterCheck = await validateSpocRoster(team.editionId, team.id, data.playerUserIds);
    if (!rosterCheck.ok) return { success: false, error: rosterCheck.error };

    await prisma.team.update({
      where: { id: team.id },
      data: {
        name: data.name,
        tag: data.tag,
        captainId: data.captainId || null,
        ...(data.logo !== undefined && { logo: data.logo }),
      },
    });

    await prisma.spocTeamMember.deleteMany({ where: { teamId: team.id } });

    if (rosterCheck.playerUserIds.length) {
      await prisma.spocTeamMember.createMany({
        data: rosterCheck.playerUserIds.map((userId) => ({
          editionId: team.editionId,
          teamId: team.id,
          userId,
        })),
      });
    }

    const fullTeam = await prisma.team.findUnique({
      where: { id: team.id },
      include: {
        captain: true,
        spocMembers: { include: { user: true } },
      },
    });

    revalidatePath('/dashboard/organizer');
    revalidatePath('/teams');
    return { success: true, team: fullTeam };
  } catch (error: any) {
    console.error('[updateSpocTeamRoster]', error);
    return { success: false, error: error?.message || 'Failed to update Spoc team roster.' };
  }
}

export async function deleteSpocTeam(teamId: string) {
  const auth = await requireOrganizer();
  if (!auth.ok) return { success: false, error: auth.error };

  try {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team || team.teamType !== TEAM_TYPE_SPOC) {
      return { success: false, error: 'Spoc exhibition team not found.' };
    }

    await prisma.team.delete({ where: { id: teamId } });
    revalidatePath('/dashboard/organizer');
    revalidatePath('/teams');
    return { success: true };
  } catch (error: any) {
    console.error('[deleteSpocTeam]', error);
    return { success: false, error: error?.message || 'Failed to delete Spoc team.' };
  }
}
