import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { 
  MOCK_USERS, 
  MOCK_TEAMS, 
  MOCK_EDITIONS, 
  MOCK_PATTERN_LIBRARY, 
  MOCK_MATCHES, 
  MOCK_SCORE_REPORTS,
  MOCK_HALL_OF_FAME
} from '../src/lib/mock-data';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CBOT Carrom Balu Online Tournament database...');

  // 1. Seed Users (Hashing PINs)
  for (const mockUser of MOCK_USERS) {
    const hashedPin = await bcrypt.hash(mockUser.pin || '1234', 10);
    const cleanUsername = mockUser.username.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanId = mockUser.id.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const userEmail = (mockUser.email && mockUser.email.trim() && !mockUser.email.endsWith('@cbot.gg'))
      ? mockUser.email.trim().toLowerCase()
      : `${cleanId}_${cleanUsername}@cbot.gg`;

    await prisma.user.upsert({
      where: { username: mockUser.username },
      update: {
        pin: hashedPin,
        name: mockUser.name,
        email: userEmail,
        role: mockUser.role,
        image: mockUser.image,
        bio: mockUser.bio,
        rating: mockUser.rating,
        average: mockUser.average || 0,
        target: mockUser.target || 0,
        age: mockUser.age || undefined,
        gender: mockUser.gender || undefined,
        wins: mockUser.wins,
        losses: mockUser.losses,
        queenStrikes: mockUser.queenStrikes,
        boardsWon: mockUser.boardsWon || 0,
      },
      create: {
        id: mockUser.id,
        username: mockUser.username,
        pin: hashedPin,
        isActivated: mockUser.isActivated !== undefined ? mockUser.isActivated : true,
        name: mockUser.name,
        email: userEmail,
        role: mockUser.role,
        image: mockUser.image,
        bio: mockUser.bio,
        rating: mockUser.rating,
        average: mockUser.average || 0,
        target: mockUser.target || 0,
        age: mockUser.age || undefined,
        gender: mockUser.gender || undefined,
        wins: mockUser.wins,
        losses: mockUser.losses,
        queenStrikes: mockUser.queenStrikes,
        boardsWon: mockUser.boardsWon || 0,
      },
    });
  }
  console.log('✅ Users seeded');

  // 2. Seed Patterns
  for (const pattern of MOCK_PATTERN_LIBRARY) {
    await prisma.boardPattern.upsert({
      where: { name: pattern.name },
      update: {},
      create: {
        id: pattern.id,
        name: pattern.name,
        difficulty: pattern.difficulty,
        objective: pattern.objective,
        validCoins: JSON.stringify(pattern.validCoins),
        invalidCoins: JSON.stringify(pattern.invalidCoins),
        basePoints: pattern.scoringRules.basePoints,
        queenBonus: pattern.scoringRules.queenBonus,
        penaltyPoints: pattern.scoringRules.penaltyPoints,
        instructionalMedia: pattern.instructionalMedia,
        diagramUrl: pattern.diagramUrl,
      },
    });
  }
  console.log('✅ Board Patterns seeded');

  // 3. Seed Editions
  for (const mockEdition of MOCK_EDITIONS) {
    const edition = await prisma.edition.upsert({
      where: { number: mockEdition.number },
      update: {},
      create: {
        id: mockEdition.id,
        number: mockEdition.number,
        title: mockEdition.title,
        slug: `cbot-edition-${mockEdition.number}`,
        theme: mockEdition.theme,
        themeHint: mockEdition.hints,
        posterUrl: mockEdition.posterUrl,
        bannerImage: mockEdition.bannerImage || '',
        format: mockEdition.format,
        status: mockEdition.number === 200 ? 'IN_PROGRESS' : 'COMPLETED',
        prizePool: mockEdition.prizePool,
        maxTeams: mockEdition.totalTeams,
        organizerId: 'usr_organizer_1', // Using balumaster
        registrationStartDate: mockEdition.registrationStartDate ? new Date(mockEdition.registrationStartDate) : null,
        registrationEndDate: mockEdition.registrationEndDate ? new Date(mockEdition.registrationEndDate) : null,
        tournamentStartDate: mockEdition.tournamentStartDate ? new Date(mockEdition.tournamentStartDate) : null,
      },
    });

    // Link Patterns to Edition
    if (mockEdition.assignedPatterns) {
      for (let i = 0; i < mockEdition.assignedPatterns.length; i++) {
        const pattern = mockEdition.assignedPatterns[i];
        await prisma.editionBoardPattern.upsert({
          where: { editionId_sequence: { editionId: edition.id, sequence: i + 1 } },
          update: {},
          create: {
            editionId: edition.id,
            patternId: pattern.id,
            sequence: i + 1,
            matchFormat: i < 2 ? 'SINGLES' : (i < 4 ? 'DOUBLES' : 'TRIPLES'),
          },
        });
      }
    }
  }
  console.log('✅ Editions seeded');

  // 4. Seed Teams (Edition #200)
  for (const mockTeam of MOCK_TEAMS) {
    const team = await prisma.team.upsert({
      where: { editionId_tag: { editionId: 'ed_200', tag: mockTeam.tag } },
      update: {},
      create: {
        id: mockTeam.id,
        editionId: 'ed_200',
        name: mockTeam.name,
        tag: mockTeam.tag,
        logo: mockTeam.logo,
        description: mockTeam.description,
        captainId: mockTeam.captainId,
      },
    });

    // Add members as participants
    if (mockTeam.members) {
      for (const member of mockTeam.members) {
        await prisma.editionParticipant.upsert({
          where: { editionId_userId: { editionId: 'ed_200', userId: member.userId } },
          update: { teamId: team.id },
          create: {
            editionId: 'ed_200',
            userId: member.userId,
            teamId: team.id,
            category: 'A1', // Defaulting to A1 for mock
            status: 'REGISTERED'
          }
        });
      }
    }
  }
  console.log('✅ Teams and Participants seeded');

  // 5. Seed Matches & Score Reports
  for (const mockMatch of MOCK_MATCHES) {
    try {
      await prisma.match.upsert({
        where: { id: mockMatch.id },
        update: {},
        create: {
          id: mockMatch.id,
          editionId: 'ed_200',
          round: mockMatch.round,
          matchNumber: mockMatch.matchNumber,
          team1Id: mockMatch.team1Id,
          team2Id: mockMatch.team2Id,
          score1: mockMatch.score1,
          score2: mockMatch.score2,
          queenStrikes1: mockMatch.queenStrikes1,
          queenStrikes2: mockMatch.queenStrikes2,
          status: mockMatch.status,
          winnerId: mockMatch.winnerId,
          scheduledTime: mockMatch.scheduledTime ? new Date(mockMatch.scheduledTime) : null,
          tableNumber: mockMatch.tableNumber,
        }
      });
    } catch (e) {}
  }
  
  for (const mockReport of MOCK_SCORE_REPORTS) {
    try {
      await prisma.scoreReport.upsert({
        where: { id: mockReport.id },
        update: {},
        create: {
          id: mockReport.id,
          matchId: mockReport.matchId,
          submittedByUserId: mockReport.submittedByUserId,
          team1Score: mockReport.team1Score,
          team2Score: mockReport.team2Score,
          queenStrikes1: mockReport.queenStrikes1,
          queenStrikes2: mockReport.queenStrikes2,
          proofNotes: mockReport.proofNotes,
          proofUrl: mockReport.proofUrl,
          status: mockReport.status,
          createdAt: mockReport.createdAt ? new Date(mockReport.createdAt) : new Date(),
        }
      });
    } catch (e) {}
  }
  console.log('✅ Matches and Reports seeded');

  // 6. Seed Hall of Fame
  for (const hof of MOCK_HALL_OF_FAME) {
    await prisma.hallOfFame.upsert({
      where: { id: hof.id },
      update: {},
      create: {
        id: hof.id,
        userId: 'usr_organizer_1', // Balu Master
        title: hof.title,
        achievement: hof.achievement,
        inductionYear: hof.inductionYear,
      }
    });
  }
  console.log('✅ Hall of Fame seeded');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
