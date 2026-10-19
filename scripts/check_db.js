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
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'website_cms_content' }
  });
  if (setting) {
    const parsed = JSON.parse(setting.value);
    console.log('=== DB CMS SPECIAL SPONSORS ===');
    console.log(parsed.specialSponsors);
    console.log('\n=== DB CMS LEGACY VIDEOS ===');
    console.log(parsed.legacy?.videos);
  } else {
    console.log('No website_cms_content found in DB');
  }
}

main().finally(() => prisma.$disconnect());
