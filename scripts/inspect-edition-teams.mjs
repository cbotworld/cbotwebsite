import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const editions = await prisma.edition.findMany({
  orderBy: { number: 'desc' },
  select: { id: true, number: true, title: true, status: true, slot: true },
});

console.log('EDITIONS:', JSON.stringify(editions, null, 2));

for (const e of editions) {
  const teams = await prisma.team.findMany({
    where: { editionId: e.id },
    select: { id: true, name: true, tag: true },
    orderBy: { name: 'asc' },
  });
  const parts = await prisma.editionParticipant.count({ where: { editionId: e.id } });
  const matches = await prisma.match.count({ where: { editionId: e.id } });
  const scores = await prisma.playerDayScore.count({ where: { editionId: e.id } });
  console.log(
    `\nEdition #${e.number} (${e.id}) status=${e.status} slot=${e.slot}`,
    `\n  teams (${teams.length}):`, teams.map((t) => t.name).join(', ') || '(none)',
    `\n  participants: ${parts}, matches: ${matches}, day scores: ${scores}`,
  );
}

// Teams with no edition or wrong edition
const orphanTeams = await prisma.team.findMany({
  where: { editionId: { notIn: editions.map((e) => e.id) } },
  select: { id: true, name: true, editionId: true },
});
if (orphanTeams.length) {
  console.log('\nORPHAN TEAMS:', orphanTeams);
}

await prisma.$disconnect();
