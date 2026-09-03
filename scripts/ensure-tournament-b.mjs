import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Ensure Tournament B (draft twin) exists for Edition 201 live cup
const live = await prisma.edition.findFirst({
  where: { slot: 'A', status: 'IN_PROGRESS' },
});

if (!live) {
  console.error('No live slot-A edition found.');
  process.exit(1);
}

let slotB = await prisma.edition.findFirst({ where: { slot: 'B' } });

if (!slotB) {
  const nextNumber = (await prisma.edition.aggregate({ _max: { number: true } }))._max.number + 1;
  slotB = await prisma.edition.create({
    data: {
      number: nextNumber,
      title: `Edition ${nextNumber}`,
      slug: `edition-${nextNumber}-slot-b`,
      status: 'DRAFT',
      slot: 'B',
      organizerId: live.organizerId,
      totalDays: live.totalDays,
      maxTeams: live.maxTeams,
      prizePool: live.prizePool,
      theme: live.theme,
      themeDescription: live.themeDescription,
      format: live.format,
      enrollmentFee: 0,
    },
  });
  console.log(`Created Tournament B draft: Edition ${slotB.number} (${slotB.id})`);
} else {
  console.log(`Tournament B already exists: Edition ${slotB.number} (${slotB.id})`);
}

const patterns = await prisma.editionBoardPattern.findMany({ where: { editionId: live.id } });
if (patterns.length) {
  await prisma.editionBoardPattern.deleteMany({ where: { editionId: slotB.id } });
  for (const row of patterns) {
    await prisma.editionBoardPattern.create({
      data: {
        editionId: slotB.id,
        patternId: row.patternId,
        sequence: row.sequence,
        matchFormat: row.matchFormat,
      },
    });
  }
  console.log(`Cloned ${patterns.length} board patterns to draft twin.`);
}

const STAGE_PREFIX = 'edition-stages:';
const stage = await prisma.systemSetting.findUnique({ where: { key: `${STAGE_PREFIX}${live.id}` } });
if (stage?.value) {
  await prisma.systemSetting.upsert({
    where: { key: `${STAGE_PREFIX}${slotB.id}` },
    update: { value: stage.value },
    create: { key: `${STAGE_PREFIX}${slotB.id}`, value: stage.value },
  });
  console.log('Cloned stage designer config to draft twin.');
}

console.log('\nTwin slots ready:');
console.log(`  A (live):  Edition ${live.number} — ${live.title}`);
console.log(`  B (draft): Edition ${slotB.number} — ${slotB.title}`);

await prisma.$disconnect();
