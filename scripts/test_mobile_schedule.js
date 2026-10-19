const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: 'Balu', mode: 'insensitive' } },
        { username: { contains: 'Balu', mode: 'insensitive' } },
      ]
    }
  });
  console.log('Balu user:', users[0]);
  if (!users[0]) return;

  const { getPlayerMatchSchedule } = require('./src/lib/player-match-schedule');
  const result = await getPlayerMatchSchedule(users[0].id);
  console.log('Total days returned:', result?.days?.length);
  if (result?.days && result.days.length > 0) {
    const day1 = result.days[0];
    console.log('=== DAY 1 MATCH CARD DATA ===');
    console.log('dayNumber:', day1.dayNumber);
    console.log('teamName:', day1.teamName);
    console.log('teamTag:', day1.teamTag);
    console.log('teamLogo:', day1.teamLogo);
    console.log('team1Logo:', day1.team1Logo);
    console.log('opponentName:', day1.opponentName);
    console.log('opponentTag:', day1.opponentTag);
    console.log('opponentLogo:', day1.opponentLogo);
    console.log('team2Logo:', day1.team2Logo);
  }
}

main().finally(() => prisma.$disconnect());
