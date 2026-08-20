import { prisma } from '@/lib/prisma';
import { TEAM_TYPE_SPOC } from '@/lib/spoc-teams';

export async function resolveEditionAndTeam(userId: string, opts?: { preferSpoc?: boolean }) {
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
