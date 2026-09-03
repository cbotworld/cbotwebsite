import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STAGE_SETTING_PREFIX = 'edition-stages:';

async function count(editionId) {
  const teams = await prisma.team.count({ where: { editionId } });
  const parts = await prisma.editionParticipant.count({ where: { editionId } });
  const matches = await prisma.match.count({ where: { editionId } });
  const scores = await prisma.playerDayScore.count({ where: { editionId } });
  return { teams, parts, matches, scores };
}

async function migrateLiveData(sourceId, targetId) {
  const source = await prisma.edition.findUnique({ where: { id: sourceId } });
  const target = await prisma.edition.findUnique({ where: { id: targetId } });
  if (!source || !target) return false;

  const targetStats = await count(targetId);
  const sourceStats = await count(sourceId);
  if (sourceStats.teams === 0) return false;

  console.log(`Migrating live data ${sourceId} -> ${targetId}`);

  const strayMatches = await prisma.match.findMany({ where: { editionId: targetId } });
  for (const match of strayMatches) {
    await prisma.scoreReport.deleteMany({ where: { matchId: match.id } });
    await prisma.matchLineup.deleteMany({ where: { matchId: match.id } });
    await prisma.match.delete({ where: { id: match.id } });
  }

  await prisma.edition.update({
    where: { id: targetId },
    data: {
      title: source.title || target.title,
      theme: source.theme || target.theme,
      themeDescription: source.themeDescription,
      themeHint: source.themeHint,
      posterUrl: source.posterUrl,
      bannerImage: source.bannerImage,
      format: source.format || target.format,
      prizePool: source.prizePool,
      maxTeams: source.maxTeams,
      totalDays: source.totalDays,
      dayDates: source.dayDates,
      tournamentStartDate: source.tournamentStartDate,
      tournamentEndDate: source.tournamentEndDate,
      registrationStartDate: source.registrationStartDate,
      registrationEndDate: source.registrationEndDate,
      status: 'IN_PROGRESS',
      slot: 'A',
    },
  });

  const movers = [
    prisma.team,
    prisma.editionParticipant,
    prisma.spocTeamMember,
    prisma.editionBoardPattern,
    prisma.match,
    prisma.leagueStanding,
    prisma.playerDayScore,
    prisma.playerAverageLog,
    prisma.playerTargetLog,
    prisma.playerRankingSnapshot,
    prisma.playerCategoryHistory,
    prisma.liveStream,
  ];

  for (const model of movers) {
    await model.updateMany({ where: { editionId: sourceId }, data: { editionId: targetId } });
  }

  const stageKey = `${STAGE_SETTING_PREFIX}${sourceId}`;
  const targetStageKey = `${STAGE_SETTING_PREFIX}${targetId}`;
  const stageSetting = await prisma.systemSetting.findUnique({ where: { key: stageKey } });
  if (stageSetting) {
    await prisma.systemSetting.upsert({
      where: { key: targetStageKey },
      update: { value: stageSetting.value },
      create: { key: targetStageKey, value: stageSetting.value },
    });
  }

  await prisma.edition.update({
    where: { id: sourceId },
    data: { status: 'COMPLETED', slot: null },
  });

  return true;
}

const edition200 = await prisma.edition.findFirst({ where: { number: 200 } });
const edition201 = await prisma.edition.findFirst({ where: { number: 201 } });

if (edition200 && edition201) {
  const migrated = await migrateLiveData(edition200.id, edition201.id);
  if (migrated) {
    console.log('Live cup data moved onto Edition 201.');
  } else if (edition201) {
    await prisma.edition.update({
      where: { id: edition201.id },
      data: { slot: 'A', status: 'IN_PROGRESS' },
    });
    console.log('Edition 201 -> slot A, IN_PROGRESS');
  }

  if (!migrated && edition200) {
    await prisma.edition.update({
      where: { id: edition200.id },
      data: { status: 'COMPLETED', slot: null },
    });
    console.log('Edition 200 -> COMPLETED');
  }
}

const after = await prisma.edition.findMany({
  select: { number: true, status: true, slot: true, title: true },
  orderBy: { number: 'asc' },
});
console.log('After repair:', JSON.stringify(after, null, 2));

if (edition201) {
  const stats = await count(edition201.id);
  const teams = await prisma.team.findMany({
    where: { editionId: edition201.id },
    select: { name: true },
    orderBy: { name: 'asc' },
  });
  console.log('Edition 201 stats:', stats);
  console.log('Teams:', teams.map((t) => t.name).join(', ') || '(none)');
}

await prisma.$disconnect();
