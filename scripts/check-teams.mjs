import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany({
    include: { members: { include: { user: true } }, edition: true }
  });
  console.log('Teams in DB:');
  teams.forEach(t => {
    console.log(`- Team ID: ${t.id} | Name: "${t.name}" | Tag: ${t.tag} | Edition: #${t.edition?.number} (${t.editionId}) | Logo: ${t.logo}`);
  });
}

main().finally(() => prisma.$disconnect());
