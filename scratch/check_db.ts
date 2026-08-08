import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const activeEdition = await prisma.edition.findFirst({
    orderBy: { number: 'desc' },
    include: {
      patterns: {
        include: { pattern: true }
      }
    }
  });

  console.log('--- ACTIVE EDITION ---');
  console.log(JSON.stringify(activeEdition, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
