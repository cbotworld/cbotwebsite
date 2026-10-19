import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.liveStream.count({
    where: { editionId: 'cmtl3lv9s0001uv4knf2v62gt' },
  });
  console.log('Edition 205 LiveStream count:', count);

  const streams = await prisma.liveStream.findMany({
    where: { editionId: 'cmtl3lv9s0001uv4knf2v62gt' },
    select: {
      id: true,
      dayNumber: true,
      playerId: true,
      player: { select: { id: true, name: true, username: true } },
      team: { select: { name: true, tag: true } },
      youtubeUrl: true,
      youtubeVideoId: true,
      status: true,
    },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });
  console.log('Sample streams:', JSON.stringify(streams, null, 2));
}

main().finally(() => prisma.$disconnect());
