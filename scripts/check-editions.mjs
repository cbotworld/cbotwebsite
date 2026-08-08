import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const eds = await prisma.edition.findMany({
    include: { teams: true }
  });
  console.log('Editions in DB:');
  eds.forEach(e => {
    console.log(`- #${e.number} (ID: ${e.id}): "${e.title}" | Status: ${e.status} | Teams count: ${e.teams.length}`);
  });
}

main().finally(() => prisma.$disconnect());
