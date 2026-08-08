import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SUPABASE_STORAGE_BASE = 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/';

const TEAMS_DATA = [
  { name: 'Vintage Strikers', tag: 'VS', poster: `${SUPABASE_STORAGE_BASE}vintage-strikers.jpeg` },
  { name: 'Boric Speedsters', tag: 'BS', poster: `${SUPABASE_STORAGE_BASE}boric-speedsters.jpeg` },
  { name: 'Plywood Pioneers', tag: 'PP', poster: `${SUPABASE_STORAGE_BASE}plywood-pioneers.jpeg` },
  { name: 'Pocket Dynamos', tag: 'PD', poster: `${SUPABASE_STORAGE_BASE}pocket-dynamos.jpeg` },
  { name: 'Vanilla Falcons', tag: 'VF', poster: `${SUPABASE_STORAGE_BASE}vanilla-falcons.jpeg` },
  { name: 'Ebony Overlords', tag: 'EO', poster: `${SUPABASE_STORAGE_BASE}ebony-overlords.jpeg` },
  { name: 'Supernova Queen', tag: 'SQ', poster: `${SUPABASE_STORAGE_BASE}supernova-queen.jpeg` },
  { name: 'Lumen Pillar', tag: 'LP', poster: `${SUPABASE_STORAGE_BASE}lumen-pillar.jpeg` },
];

async function main() {
  console.log('Cleaning up existing matches, reports, teams, and editions...');

  // Delete matches, score reports, standings, participants, teams, editions
  await prisma.scoreReport.deleteMany({});
  await prisma.matchLineupSlotPlayer.deleteMany({});
  await prisma.matchLineupSlot.deleteMany({});
  await prisma.matchLineup.deleteMany({});
  await prisma.match.deleteMany({});
  await prisma.leagueStanding.deleteMany({});
  await prisma.editionParticipant.deleteMany({});
  await prisma.editionBoardPattern.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.edition.deleteMany({});

  console.log('✅ Cleaned up old data.');

  // Find organizer user
  const organizer = await prisma.user.findFirst({
    where: { role: 'ORGANIZER' }
  }) || await prisma.user.findFirst();

  if (!organizer) {
    console.error('No organizer user found!');
    return;
  }

  // Get list of users to assign as captains and members
  const users = await prisma.user.findMany({});

  // Create Edition #200: "Cornerstones of Carrom"
  const edition200 = await prisma.edition.create({
    data: {
      id: 'ed_200',
      number: 200,
      title: 'Cornerstones of Carrom',
      slug: 'cornerstones-of-carrom',
      theme: 'Cornerstones of Carrom',
      themeDescription: 'The 200th Milestone Edition showcasing the legendary teams and ultimate precision of Carrom.',
      format: 'MULTI_FORMAT_ROUND',
      status: 'IN_PROGRESS',
      prizePool: '₹2,00,000 INR',
      maxTeams: 8,
      organizerId: organizer.id,
      tournamentStartDate: new Date(),
      bannerImage: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=1200',
    }
  });

  console.log(`✅ Created active Edition #200: "${edition200.title}"`);

  // Create the 8 theme teams under Edition #200
  for (let i = 0; i < TEAMS_DATA.length; i++) {
    const t = TEAMS_DATA[i];
    const captainUser = users[i] || users[0];

    const team = await prisma.team.create({
      data: {
        id: `team_200_${i + 1}`,
        editionId: edition200.id,
        name: t.name,
        tag: t.tag,
        logo: t.poster,
        description: `${t.name} roster competing in Edition #200`,
        captainId: captainUser?.id || null,
      }
    });

    if (captainUser) {
      await prisma.editionParticipant.upsert({
        where: { editionId_userId: { editionId: edition200.id, userId: captainUser.id } },
        update: { teamId: team.id },
        create: {
          editionId: edition200.id,
          userId: captainUser.id,
          teamId: team.id,
          category: 'A',
          status: 'REGISTERED',
        }
      });
    }

    console.log(`  - Team created: ${team.name} (${team.tag}) with poster ${team.logo}`);
  }

  console.log('🎉 Setup finished successfully!');
}

main().finally(() => prisma.$disconnect());
