import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        startsWith: 'youtube'
      }
    }
  });
  console.log('Found', settings.length, 'youtube settings:');
  for (const s of settings) {
    if (s.key.includes('token') || s.key.includes('secret')) {
      console.log(`${s.key}: [SET - length ${s.value?.length || 0}]`);
    } else {
      console.log(`${s.key}: ${s.value}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
