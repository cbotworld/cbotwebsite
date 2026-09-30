const { PrismaClient } = require('@prisma/client');

function getUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('connection_limit', '1');
    parsed.searchParams.set('pool_timeout', '10');
    return parsed.toString();
  } catch {
    return url;
  }
}

const prisma = new PrismaClient({
  datasources: { db: { url: getUrl() } }
});

async function main() {
  console.log('--- Cleaning Teams ---');
  const teams = await prisma.team.findMany();
  for (const t of teams) {
    if (t.logo && t.logo.includes('/login/api/storage/')) {
      const fixed = t.logo.replaceAll('/login/api/storage/', '/api/storage/');
      await prisma.team.update({
        where: { id: t.id },
        data: { logo: fixed }
      });
      console.log(`Fixed team logo: ${t.name} -> ${fixed}`);
    }
  }

  console.log('--- Cleaning Editions ---');
  const editions = await prisma.edition.findMany();
  for (const ed of editions) {
    if (ed.posterUrl && ed.posterUrl.includes('/login/api/storage/')) {
      const fixed = ed.posterUrl.replaceAll('/login/api/storage/', '/api/storage/');
      await prisma.edition.update({
        where: { id: ed.id },
        data: { posterUrl: fixed }
      });
      console.log(`Fixed edition #${ed.number} posterUrl -> ${fixed}`);
    }
  }

  console.log('--- Cleaning System Settings ---');
  const settings = await prisma.systemSetting.findMany();
  for (const s of settings) {
    if (s.value && s.value.includes('/login/api/storage/')) {
      const fixed = s.value.replaceAll('/login/api/storage/', '/api/storage/');
      await prisma.systemSetting.update({
        where: { key: s.key },
        data: { value: fixed }
      });
      console.log(`Fixed system setting key: ${s.key}`);
    }
  }

  console.log('--- Done Cleaning DB URLs ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
