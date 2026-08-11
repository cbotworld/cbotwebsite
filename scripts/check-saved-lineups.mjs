import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const team = await prisma.team.findFirst({
    where: { name: { contains: 'Boric', mode: 'insensitive' } }
  });
  console.log('=== Boric Speedsters ===');
  console.log('ID:', team?.id);
  console.log('Name:', team?.name);
  console.log('SavedLineups:', team?.savedLineups);
}

main().finally(() => prisma.$disconnect());
