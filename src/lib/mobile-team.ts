import { prisma } from '@/lib/prisma';
import { TEAM_TYPE_SPOC } from '@/lib/spoc-teams';

export type CaptainDeskKind = 'MAIN' | 'SPOC';

export type CaptainDesk = {
  id: string;
  name: string;
  tag: string;
  logo?: string | null;
  kind: CaptainDeskKind;
};

export async function listCaptainDesks(userId: string, editionId?: string): Promise<CaptainDesk[]> {
  const teams = await prisma.team.findMany({
    where: {
      captainId: userId,
      ...(editionId ? { editionId } : {}),
    },
    select: { id: true, name: true, tag: true, logo: true, teamType: true },
    orderBy: { createdAt: 'asc' },
  });

  const desks: CaptainDesk[] = [];
  const main = teams.find((t) => t.teamType !== TEAM_TYPE_SPOC);
  const spoc = teams.find((t) => t.teamType === TEAM_TYPE_SPOC);
  if (main) {
    desks.push({ id: main.id, name: main.name, tag: main.tag, logo: main.logo, kind: 'MAIN' });
  }
  if (spoc) {
    desks.push({ id: spoc.id, name: spoc.name, tag: spoc.tag, logo: spoc.logo, kind: 'SPOC' });
  }
  return desks;
}

export async function resolveEditionAndTeam(
  userId: string,
  opts?: { preferSpoc?: boolean; teamId?: string },
) {
  const edition = await prisma.edition.findFirst({
    where: { OR: [{ number: 200 }, { status: 'IN_PROGRESS' }] },
    orderBy: { number: 'desc' },
    include: {
      patterns: { orderBy: { sequence: 'asc' } },
    },
  });

  const participation = await prisma.editionParticipant.findFirst({
    where: edition?.id ? { userId, editionId: edition.id } : { userId },
    include: { team: true },
    orderBy: { createdAt: 'desc' },
  });

  if (opts?.teamId && edition?.id) {
    const requested = await prisma.team.findFirst({
      where: { id: opts.teamId, editionId: edition.id },
    });
    if (requested) {
      const isCaptain = requested.captainId === userId;
      const isMainMember = requested.teamType !== TEAM_TYPE_SPOC && participation?.teamId === requested.id;
      const isSpocMember =
        requested.teamType === TEAM_TYPE_SPOC
          ? Boolean(
              await prisma.spocTeamMember.findFirst({
                where: { teamId: requested.id, userId, editionId: edition.id },
                select: { id: true },
              }),
            )
          : false;
      if (isCaptain || isMainMember || isSpocMember) {
        return { edition, team: requested, participation };
      }
    }
  }

  if (opts?.preferSpoc && edition?.id) {
    const spocCaptainTeam = await prisma.team.findFirst({
      where: { captainId: userId, editionId: edition.id, teamType: TEAM_TYPE_SPOC },
    });
    if (spocCaptainTeam) {
      return { edition, team: spocCaptainTeam, participation };
    }

    const spocMembership = await prisma.spocTeamMember.findFirst({
      where: { userId, editionId: edition.id },
      include: { team: true },
    });
    if (spocMembership?.team) {
      return { edition, team: spocMembership.team, participation };
    }
  }

  if (edition?.id) {
    const mainCaptainTeam = await prisma.team.findFirst({
      where: { captainId: userId, editionId: edition.id, NOT: { teamType: TEAM_TYPE_SPOC } },
    });
    if (mainCaptainTeam) {
      return { edition, team: mainCaptainTeam, participation };
    }
  }

  let team = participation?.team || null;
  if (!team) {
    team = await prisma.team.findFirst({
      where: {
        captainId: userId,
        ...(edition?.id ? { editionId: edition.id } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  return { edition, team, participation };
}
