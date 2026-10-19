import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.liveStream.count();
  console.log('Total liveStream count in DB:', count);

  const streams = await prisma.liveStream.findMany({
    select: {
      id: true,
      playerId: true,
      dayNumber: true,
      youtubeUrl: true,
      youtubeVideoId: true,
      status: true,
      createdAt: true,
      player: { select: { name: true, username: true } },
    },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });

  console.log('Recent 20 liveStreams:');
  console.log(JSON.stringify(streams, null, 2));

  // Also check distinct dayNumbers
  const withUrls = await prisma.liveStream.count({
    where: {
      OR: [
        { youtubeUrl: { not: null } },
        { youtubeVideoId: { not: null } },
      ]
    }
  });
  console.log('LiveStreams with non-null youtubeUrl or youtubeVideoId:', withUrls);
}

main().finally(() => prisma.$disconnect());
