import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  console.log(`Total users in DB: ${count}`);
  
  const users = await prisma.user.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
  console.log('Recent users:', users.map(u => u.username));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
