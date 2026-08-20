import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

try {
  const teams = await p.team.findMany({
    select: { id: true, name: true, tag: true, logo: true, teamType: true },
    orderBy: { name: 'asc' },
  });

  for (const t of teams) {
    const logo = t.logo || '';
    const kind = logo.startsWith('data:')
      ? 'data-uri'
      : logo.startsWith('http')
        ? 'url'
        : logo
          ? 'other'
          : 'empty';
    console.log(
      [
        t.teamType.padEnd(16),
        t.name.padEnd(22),
        kind.padEnd(10),
        `${Math.round(logo.length / 1024)}KB`.padStart(8),
        logo.slice(0, 60),
      ].join(' | '),
    );
  }

  const cms = await p.systemSetting.findUnique({ where: { key: 'website_cms' } });
  if (cms?.value) {
    const walk = (o, path = '') => {
      if (!o || typeof o !== 'object') return;
      for (const [k, val] of Object.entries(o)) {
        if (typeof val === 'string' && (val.startsWith('data:') || val.length > 5000)) {
          console.log('CMS', `${path}${k}`, `${Math.round(val.length / 1024)}KB`, val.slice(0, 50));
        } else if (Array.isArray(val)) {
          val.forEach((item, i) => walk(item, `${path}${k}[${i}].`));
        } else if (val && typeof val === 'object') {
          walk(val, `${path}${k}.`);
        }
      }
    };
    walk(JSON.parse(cms.value));
  }
} finally {
  await p.$disconnect();
}
