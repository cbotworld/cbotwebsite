import { prisma } from '@/lib/prisma';

export async function resolveEditionAndTeam(userId: string) {
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
