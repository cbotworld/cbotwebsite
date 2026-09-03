import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sourceId = 'ed_200';
const targetId = 'cmtl3lv9s0001uv4knf2v62gt';

async function count(label, editionId) {
  const teams = await prisma.team.count({ where: { editionId } });
  const parts = await prisma.editionParticipant.count({ where: { editionId } });
  const matches = await prisma.match.count({ where: { editionId } });
  const scores = await prisma.playerDayScore.count({ where: { editionId } });
  const standings = await prisma.leagueStanding.count({ where: { editionId } });
  const patterns = await prisma.editionBoardPattern.count({ where: { editionId } });
  console.log(`${label}: teams=${teams} participants=${parts} matches=${matches} scores=${scores} standings=${standings} patterns=${patterns}`);
}

console.log('BEFORE');
await count('  source 200', sourceId);
await count('  target 201', targetId);

const targetMatch = await prisma.match.findFirst({ where: { editionId: targetId } });
if (targetMatch) {
  console.log('Removing stray target match:', targetMatch.id);
  await prisma.scoreReport.deleteMany({ where: { matchId: targetMatch.id } });
  await prisma.matchLineup.deleteMany({ where: { matchId: targetMatch.id } });
  await prisma.match.delete({ where: { id: targetMatch.id } });
}

const source = await prisma.edition.findUnique({ where: { id: sourceId } });
const target = await prisma.edition.findUnique({ where: { id: targetId } });
if (!source || !target) throw new Error('Source or target edition missing');

// Copy edition calendar / config onto live 201 row
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

const tables = [
  ['team', prisma.team],
  ['editionParticipant', prisma.editionParticipant],
  ['spocTeamMember', prisma.spocTeamMember],
  ['editionBoardPattern', prisma.editionBoardPattern],
  ['match', prisma.match],
  ['leagueStanding', prisma.leagueStanding],
  ['playerDayScore', prisma.playerDayScore],
  ['playerAverageLog', prisma.playerAverageLog],
  ['playerTargetLog', prisma.playerTargetLog],
  ['playerRankingSnapshot', prisma.playerRankingSnapshot],
  ['playerCategoryHistory', prisma.playerCategoryHistory],
  ['liveStream', prisma.liveStream],
];

for (const [name, model] of tables) {
  const res = await model.updateMany({ where: { editionId: sourceId }, data: { editionId: targetId } });
  console.log(`Moved ${name}: ${res.count}`);
}

// Stage config in system settings
const STAGE_SETTING_PREFIX = 'edition-stages:';
const stageKey = `${STAGE_SETTING_PREFIX}${sourceId}`;
const targetStageKey = `${STAGE_SETTING_PREFIX}${targetId}`;
const stageSetting = await prisma.systemSetting.findUnique({ where: { key: stageKey } });
if (stageSetting) {
  await prisma.systemSetting.upsert({
    where: { key: targetStageKey },
    update: { value: stageSetting.value },
    create: { key: targetStageKey, value: stageSetting.value },
  });
  console.log('Copied stage config');
}

await prisma.edition.update({
  where: { id: sourceId },
  data: { status: 'COMPLETED', slot: null },
});

console.log('\nAFTER');
await count('  source 200', sourceId);
await count('  target 201', targetId);

const teams = await prisma.team.findMany({
  where: { editionId: targetId },
  select: { name: true, tag: true },
  orderBy: { name: 'asc' },
});
console.log('\nLive teams on 201:', teams.map((t) => t.name).join(', '));

await prisma.$disconnect();
