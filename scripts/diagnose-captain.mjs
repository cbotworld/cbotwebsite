import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const live = await prisma.edition.findFirst({
  where: { slot: 'A', status: 'IN_PROGRESS' },
  select: { id: true, number: true, title: true },
});
console.log('Live edition:', live);

const captains = await prisma.user.findMany({
  where: { role: 'CAPTAIN' },
  select: { id: true, username: true, name: true },
  take: 5,
});
console.log('Captains:', captains);

for (const c of captains) {
  const team = live
    ? await prisma.team.findFirst({
        where: { captainId: c.id, editionId: live.id },
        select: { id: true, name: true, tag: true },
      })
    : null;
  const part = live
    ? await prisma.editionParticipant.findFirst({
        where: { userId: c.id, editionId: live.id },
        select: { teamId: true, category: true },
      })
    : null;
  console.log(`  ${c.username}: team=${team?.name || 'none'} participant=${part?.teamId || 'none'}`);
}

await prisma.$disconnect();
