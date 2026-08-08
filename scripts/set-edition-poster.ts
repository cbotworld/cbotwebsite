import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find the current IN_PROGRESS edition
  const edition = await prisma.edition.findFirst({
    where: { status: 'IN_PROGRESS' },
    orderBy: { number: 'desc' },
  });

  if (!edition) {
    // Fall back to most recent edition
    const latest = await prisma.edition.findFirst({ orderBy: { number: 'desc' } });
    if (!latest) { console.log('No editions found'); return; }
    const updated = await prisma.edition.update({
      where: { id: latest.id },
      data: { posterUrl: '/edition-poster.jpg' },
    });
    console.log(`Updated edition #${updated.number} "${updated.title}" posterUrl → ${updated.posterUrl}`);
    return;
  }

  const updated = await prisma.edition.update({
    where: { id: edition.id },
    data: { posterUrl: '/edition-poster.jpg' },
  });
  console.log(`Updated edition #${updated.number} "${updated.title}" posterUrl → ${updated.posterUrl}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
