/**
 * Reports users whose role is CAPTAIN but who no longer captain any team, which
 * is the state left behind by a tournament reset that predates role syncing.
 *
 *   node scripts/audit-captain-roles.mjs           # report only
 *   node scripts/audit-captain-roles.mjs --apply   # demote them to PLAYER
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const byRole = await prisma.user.groupBy({ by: ['role'], _count: { _all: true } });
console.log('Role counts:');
for (const row of byRole.sort((a, b) => b._count._all - a._count._all)) {
  console.log(`  ${String(row.role || '(null)').padEnd(12)} ${row._count._all}`);
}

const teamCount = await prisma.team.count();
const teamsWithCaptain = await prisma.team.count({ where: { captainId: { not: null } } });
console.log(`\nTeams: ${teamCount} total, ${teamsWithCaptain} with a captain assigned`);

const captains = await prisma.user.findMany({
  where: { role: 'CAPTAIN' },
  select: {
    id: true,
    name: true,
    username: true,
    captainedTeams: { select: { id: true, name: true } },
  },
  orderBy: { name: 'asc' },
});

const stale = captains.filter((u) => u.captainedTeams.length === 0);
const real = captains.filter((u) => u.captainedTeams.length > 0);

console.log(`\nCAPTAIN users: ${captains.length}`);
console.log(`  still captaining a team : ${real.length}`);
console.log(`  captaining nothing      : ${stale.length}`);

if (real.length) {
  console.log('\nKeeping CAPTAIN (they hold a team):');
  for (const u of real) {
    console.log(`  ${u.name || u.username} -> ${u.captainedTeams.map((t) => t.name).join(', ')}`);
  }
}

if (stale.length) {
  console.log(`\n${apply ? 'Demoting to PLAYER' : 'Would demote to PLAYER'}:`);
  for (const u of stale) console.log(`  ${u.name || u.username} (${u.username})`);
}

if (apply && stale.length) {
  const result = await prisma.user.updateMany({
    where: { id: { in: stale.map((u) => u.id) }, role: 'CAPTAIN' },
    data: { role: 'PLAYER' },
  });
  console.log(`\nUpdated ${result.count} user(s) to PLAYER.`);
} else if (!apply && stale.length) {
  console.log('\nRe-run with --apply to make these changes.');
}

await prisma.$disconnect();
