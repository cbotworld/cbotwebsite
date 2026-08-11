import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany({
    include: { captain: true }
  });

  console.log(`=== ALL CAPTAINS DAY 2 COMBIS SUBMITTED IN SUPABASE ===\n`);

  teams.forEach((t, i) => {
    console.log(`--------------------------------------------------`);
    console.log(`${i + 1}. TEAM: ${t.name.toUpperCase()} (${t.tag})`);
    console.log(`   CAPTAIN: ${t.captain?.name || 'Assigned Captain'} (${t.captain?.username || ''})`);
    
    if (t.savedLineups) {
      try {
        const parsed = JSON.parse(t.savedLineups);
        const day2 = parsed[2] || parsed['2'];
        if (day2) {
          console.log(`   SUBMITTED AT: ${day2.submittedAt || 'Recorded'}`);
          console.log(`   DAY 2 LINEUP:`);
          if (day2.rounds && Array.isArray(day2.rounds)) {
            day2.rounds.forEach((r) => {
              const playersStr = Array.isArray(r.players) ? r.players.join(', ') : r.players;
              console.log(`     - ${r.name}: ${playersStr}`);
            });
          }
        } else {
          console.log(`   DAY 2 STATUS: NO DAY 2 COMBI SAVED YET`);
        }
      } catch (e) {
        console.log(`   PARSING ERROR:`, e.message);
      }
    } else {
      console.log(`   STATUS: NO COMBIS SAVED IN DB`);
    }
    console.log(`--------------------------------------------------\n`);
  });
}

main().finally(() => prisma.$disconnect());
