import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FINISHED = ['COMPLETED', 'FINISHED', 'ARCHIVED', 'CANCELLED'];

async function countFor(editionId: string, label: string) {
  const [teams, participants, matches, scores, streams, spoc] = await Promise.all([
    prisma.team.count({ where: { editionId } }),
    prisma.editionParticipant.count({ where: { editionId } }),
    prisma.match.count({ where: { editionId } }),
    prisma.playerDayScore.count({ where: { editionId } }),
    prisma.liveStream.count({ where: { editionId } }),
    prisma.spocTeamMember.count({ where: { editionId } }),
  ]);
  console.log(label, { teams, participants, matches, scores, streams, spoc });
}

try {
  const editions = await prisma.edition.findMany({
    orderBy: { number: 'asc' },
    select: { id: true, number: true, title: true, status: true, slot: true },
  });
  console.log('Editions:', JSON.stringify(editions, null, 2));
  for (const e of editions) {
    await countFor(e.id, `Edition ${e.number} (${e.id})`);
  }
} catch (e) {
  console.error(e);
} finally {
  await prisma.$disconnect();
}
