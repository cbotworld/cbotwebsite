import { prisma } from '../src/lib/prisma';
import { formatToIst } from '../src/lib/ist-time';

async function fixSavedLineupTimestamps() {
  console.log('🔄 Checking and standardizing team savedLineups timestamps...');

  const edition = await prisma.edition.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, tournamentStartDate: true, dayDates: true }
  });
  console.log('Edition dayDates:', JSON.stringify(edition?.dayDates, null, 2));

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

    const isSingaporeCapt = team.name.toLowerCase().includes('elephant') || team.captain?.name?.toLowerCase().includes('balu');

    for (const [dayKey, dayData] of Object.entries(parsed)) {
      if (!dayData || typeof dayData !== 'object') continue;

      const raw = String(dayData.submittedAt || '').trim();
      if (!raw) continue;

      if (isSingaporeCapt) {
        // If it's a 10:xx PM or 11:xx PM Singapore timestamp, convert by -2h30m
        const match = raw.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
        if (match) {
          let hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const isPm = match[3].toLowerCase() === 'pm';

          if (isPm && hours < 12) hours += 12;
          if (!isPm && hours === 12) hours = 0;

          // If Singapore night time (between 22:00 and 23:59), convert to IST (-150 minutes)
          if (hours >= 22) {
            let totalMin = hours * 60 + minutes - 150;
            if (totalMin < 0) totalMin += 24 * 60;
            const istHours24 = Math.floor(totalMin / 60);
            const istMinutes = totalMin % 60;
            const istPeriod = istHours24 >= 12 ? 'PM' : 'AM';
            const istHours12 = istHours24 % 12 === 0 ? 12 : istHours24 % 12;

            const formattedTime = `${String(istHours12).padStart(2, '0')}:${String(istMinutes).padStart(2, '0')} ${istPeriod} IST`;
            console.log(`Converting Elephant Day ${dayKey}: "${raw}" -> "${formattedTime}"`);
            dayData.submittedAt = formattedTime;
            dayData.clientTimeZone = 'Asia/Singapore';
            modified = true;
          }
        }
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
