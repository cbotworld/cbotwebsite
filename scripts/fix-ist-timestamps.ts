import { prisma } from '../src/lib/prisma';
import { formatToIst } from '../src/lib/ist-time';

async function fixSavedLineupTimestamps() {
  console.log('🔄 Checking and standardizing team savedLineups timestamps...');

  const teams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      tag: true,
      savedLineups: true,
      captain: { select: { id: true, name: true, username: true } },
    },
  });

  for (const team of teams) {
    if (!team.savedLineups) continue;

    let parsed: Record<string, any> = {};
    try {
      parsed = JSON.parse(team.savedLineups);
    } catch {
      continue;
    }

    let modified = false;

    for (const [dayKey, dayData] of Object.entries(parsed)) {
      if (!dayData || typeof dayData !== 'object') continue;

      const rawSubmittedAt = String(dayData.submittedAt || '').trim();

      // Specifically detect Balu's Singapore submission on Day 1 (11:03 pm SGT = 08:33 PM IST)
      if (rawSubmittedAt.includes('11:03') && !rawSubmittedAt.includes('08:33')) {
        console.log(`Fixing Singapore timezone for Team "${team.name}" (Capt: ${team.captain?.name}) Day ${dayKey}...`);
        dayData.submittedAt = '06 Sep, 08:33 PM IST';
        dayData.submittedAtIso = '2026-09-06T15:03:00.000Z';
        dayData.clientTimeZone = 'Asia/Singapore';
        modified = true;
      } else if (rawSubmittedAt && !rawSubmittedAt.includes('IST')) {
        dayData.submittedAt = formatToIst(rawSubmittedAt);
        modified = true;
      }
    }

    if (modified) {
      await prisma.team.update({
        where: { id: team.id },
        data: {
          savedLineups: JSON.stringify(parsed),
        },
      });
      console.log(`✅ Updated team "${team.name}" savedLineups in DB.`);
    }
  }

  console.log('🎉 Timestamp standardization complete.');
}

fixSavedLineupTimestamps()
  .catch((e) => {
    console.error('Error fixing timestamps:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
