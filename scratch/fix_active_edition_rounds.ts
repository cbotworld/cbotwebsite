import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const editionId = 'ed_200';
  
  // Clean up current patterns
  await prisma.editionBoardPattern.deleteMany({
    where: { editionId }
  });

  const roundFormats = [
    'SINGLES', // Round 1
    'SINGLES', // Round 2
    'SINGLES', // Round 3
    'SINGLES', // Round 4
    'DOUBLES', // Round 5
    'DOUBLES', // Round 6
    'DOUBLES', // Round 7
    'TRIPLES', // Round 8
    'TRIPLES'  // Round 9
  ];

  const defaultPatterns = await prisma.boardPattern.findMany({ take: 5 });
  if (defaultPatterns.length === 0) {
    throw new Error('No board patterns found to link!');
  }

  for (let i = 0; i < roundFormats.length; i++) {
    const pattern = defaultPatterns[i % defaultPatterns.length];
    await prisma.editionBoardPattern.create({
      data: {
        editionId,
        patternId: pattern.id,
        sequence: i + 1,
        matchFormat: roundFormats[i]
      }
    });
  }

  console.log('✅ Successfully linked 9 rounds to active edition ed_200!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
