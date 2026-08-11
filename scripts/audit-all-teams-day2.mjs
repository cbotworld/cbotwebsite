import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany({
    include: { captain: true }
  });

  console.log(`Auditing ${teams.length} teams:\n`);

  teams.forEach((t) => {
    let day1Status = 'MISSING';
    let day2Status = 'MISSING';
    let day2Singles1 = 'N/A';

    if (t.savedLineups) {
      try {
        const parsed = JSON.parse(t.savedLineups);
        if (parsed[1] || parsed['1']) day1Status = 'PRESENT';
        if (parsed[2] || parsed['2']) {
          day2Status = 'PRESENT';
          const d2 = parsed[2] || parsed['2'];
          day2Singles1 = d2.rounds?.[0]?.players?.join(', ') || 'NONE';
        }
      } catch (e) {}
    }

    console.log(`Team: ${t.name.padEnd(20)} | Tag: ${t.tag.padEnd(4)} | Day 1: ${day1Status} | Day 2: ${day2Status} | Day 2 Singles 1: "${day2Singles1}"`);
  });
}

main().finally(() => prisma.$disconnect());
