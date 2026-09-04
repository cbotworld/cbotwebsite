import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import {
  cellKey,
  gradingSettingKey,
  parseGradingGrid,
  resolveTargetForCell,
} from '@/lib/grading';
import { stageConfigKey } from '@/lib/tournament-stages';
import { toCalendarDate } from '@/lib/combi-cutoff';

function csvSafe(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function appendSheet(wb: XLSX.WorkBook, name: string, rows: Record<string, unknown>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ note: 'No data' }]);
  XLSX.utils.book_append_sheet(wb, sheet, name.slice(0, 31));
}

export async function buildEditionArchiveWorkbook(editionId: string) {
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              whatsApp: true,
              address: true,
              city: true,
              state: true,
              country: true,
              pincode: true,
              average: true,
              target: true,
            },
          },
          team: { select: { name: true, tag: true } },
        },
      },
      teams: {
        include: {
          captain: { select: { name: true, username: true } },
          members: {
            include: { user: { select: { name: true, username: true } } },
          },
        },
      },
      patterns: {
        orderBy: { sequence: 'asc' },
        include: { pattern: { select: { name: true, objective: true } } },
      },
    },
  });

  if (!edition) throw new Error('Edition not found.');

  const [standings, dayScores, matches, gradingSetting, stageSetting] = await Promise.all([
    prisma.leagueStanding.findMany({
      where: { editionId },
      include: { team: { select: { name: true, tag: true } } },
      orderBy: { rank: 'asc' },
    }),
    prisma.playerDayScore.findMany({
      where: { editionId },
      include: { user: { select: { name: true, username: true } } },
      orderBy: [{ dayNumber: 'asc' }, { user: { name: 'asc' } }],
    }),
    prisma.match.findMany({
      where: { editionId },
      include: {
        team1: { select: { name: true, tag: true } },
        team2: { select: { name: true, tag: true } },
        winner: { select: { name: true } },
        lineups: {
          include: {
            team: { select: { name: true, tag: true } },
            slots: {
              include: {
                players: {
                  include: { user: { select: { name: true, username: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
    }),
    prisma.systemSetting.findUnique({ where: { key: gradingSettingKey(editionId) } }),
    prisma.systemSetting.findUnique({ where: { key: stageConfigKey(editionId) } }),
  ]);

  const gradingGrid = parseGradingGrid(gradingSetting?.value);
  const userById = new Map(edition.participants.map((p) => [p.userId, p.user]));

  const summaryRows = [
    { field: 'edition_number', value: edition.number },
    { field: 'title', value: edition.title },
    { field: 'theme', value: edition.theme || '' },
    { field: 'status', value: edition.status },
    { field: 'slot', value: edition.slot || '' },
    { field: 'prize_pool', value: edition.prizePool },
    { field: 'tournament_start', value: toCalendarDate(edition.tournamentStartDate) },
    { field: 'tournament_end', value: toCalendarDate(edition.tournamentEndDate) },
    { field: 'total_days', value: edition.totalDays },
    { field: 'exported_at', value: new Date().toISOString() },
    { field: 'stage_config_present', value: stageSetting?.value ? 'yes' : 'no' },
  ];

  const playerRows = edition.participants.map((p) => ({
    name: p.user?.name || '',
    username: p.user?.username || '',
    email: p.user?.email || '',
    whatsapp: p.user?.whatsApp || '',
    address: p.user?.address || '',
    city: p.user?.city || '',
    state: p.user?.state || '',
    country: p.user?.country || '',
    pincode: p.user?.pincode || '',
    team: p.team?.name || '',
    team_tag: p.team?.tag || '',
    career_average: p.user?.average ?? '',
    career_target: p.user?.target ?? '',
  }));

  const selectedRows = edition.participants.map((p) => ({
    name: p.user?.name || '',
    username: p.user?.username || '',
    team: p.team?.name || '',
    category_grade: p.category || '',
    grade_average: p.gradeAverage ?? '',
    grade_average_locked: p.gradeAverageLocked ? 'yes' : 'no',
    status: p.status,
    enrolled_at: p.enrolledAt?.toISOString() || '',
    payment_status: p.paymentStatus || '',
    payment_amount: p.paymentAmount ?? '',
    payment_transaction_id: p.paymentTransactionId || '',
    career_average: p.user?.average ?? '',
    career_target: p.user?.target ?? '',
  }));

  const gradingRows: Record<string, unknown>[] = [];
  const gridRows: Record<string, unknown>[] = [];

  gradingGrid.columns.forEach((col) => {
    for (let rowIndex = 0; rowIndex < gradingGrid.rowCount; rowIndex += 1) {
      const userId = gradingGrid.cells[cellKey(col.id, rowIndex)];
      if (!userId) continue;
      const user = userById.get(userId);
      const participant = edition.participants.find((p) => p.userId === userId);
      const target = resolveTargetForCell(col, rowIndex);
      gradingRows.push({
        player_name: user?.name || '',
        username: user?.username || '',
        grade: col.label,
        grid_column: col.label,
        grid_row: rowIndex + 1,
        target_for_edition: target ?? '',
        grade_average: participant?.gradeAverage ?? '',
        grade_average_locked: participant?.gradeAverageLocked ? 'yes' : 'no',
        category_on_roster: participant?.category || '',
        career_average: user?.average ?? '',
        career_target: user?.target ?? '',
      });
      gridRows.push({
        column_id: col.id,
        column_label: col.label,
        row: rowIndex + 1,
        user_id: userId,
        player_name: user?.name || '',
        username: user?.username || '',
        target: target ?? '',
      });
    }
  });

  edition.participants.forEach((p) => {
    if (!p.category && p.gradeAverage == null) return;
    if (gradingRows.some((r) => r.username === p.user?.username)) return;
    gradingRows.push({
      player_name: p.user?.name || '',
      username: p.user?.username || '',
      grade: p.category || '',
      grid_column: '',
      grid_row: '',
      target_for_edition: p.user?.target ?? '',
      grade_average: p.gradeAverage ?? '',
      grade_average_locked: p.gradeAverageLocked ? 'yes' : 'no',
      category_on_roster: p.category || '',
      career_average: p.user?.average ?? '',
      career_target: p.user?.target ?? '',
    });
  });

  const standingRows =
    standings.length > 0
      ? standings.map((s) => ({
          rank: s.rank,
          team: s.team.name,
          tag: s.team.tag,
          played: s.played,
          wins: s.wins,
          losses: s.losses,
          points: s.points,
          score_diff: s.scoreDiff,
          queen_strikes: s.queenStrikes,
        }))
      : edition.teams.map((t, idx) => ({
          rank: idx + 1,
          team: t.name,
          tag: t.tag,
          note: 'No league standing rows',
        }));

  const dayScoreRows = dayScores.map((s) => ({
    day: s.dayNumber,
    player_name: s.user?.name || '',
    username: s.user?.username || '',
    score: s.score,
    slams: s.slams,
    boards: csvSafe(s.boards),
    submitted_at: s.submittedAt.toISOString(),
  }));

  const matchRows = matches.map((m) => ({
    round: m.round,
    match_number: m.matchNumber,
    stage: m.stage,
    team1: m.team1?.name || '',
    team2: m.team2?.name || '',
    score1: m.score1,
    score2: m.score2,
    queen_strikes1: m.queenStrikes1,
    queen_strikes2: m.queenStrikes2,
    status: m.status,
    winner: m.winner?.name || '',
    table_number: m.tableNumber ?? '',
    scheduled_time: m.scheduledTime?.toISOString() || '',
  }));

  const combiRows: Record<string, unknown>[] = [];
  matches.forEach((m) => {
    m.lineups.forEach((lineup) => {
      lineup.slots.forEach((slot) => {
        combiRows.push({
          round: m.round,
          match_number: m.matchNumber,
          team: lineup.team.name,
          team_tag: lineup.team.tag,
          format: slot.formatType,
          pattern: slot.patternName,
          players: slot.players
            .map((pl) => pl.user?.name || pl.user?.username)
            .filter(Boolean)
            .join(', '),
          lineup_status: lineup.status,
        });
      });
    });
  });

  edition.teams.forEach((t) => {
    if (!t.savedLineups) return;
    combiRows.push({
      round: '',
      match_number: '',
      team: t.name,
      team_tag: t.tag,
      format: 'saved_lineup_snapshot',
      pattern: '',
      players: '',
      lineup_status: t.savedLineups,
    });
  });

  const teamRows = edition.teams.map((t) => ({
    name: t.name,
    tag: t.tag,
    team_type: t.teamType,
    captain: t.captain?.name || t.captain?.username || '',
    roster: t.members
      .map((m) => m.user?.name || m.user?.username)
      .filter(Boolean)
      .join(', '),
    saved_lineups: t.savedLineups || '',
  }));

  const patternRows = edition.patterns.map((p) => ({
    sequence: p.sequence,
    match_format: p.matchFormat,
    pattern_name: p.pattern.name,
    objective: p.pattern.objective,
  }));

  const wb = XLSX.utils.book_new();
  appendSheet(wb, 'Summary', summaryRows);
  appendSheet(wb, 'Players', playerRows);
  appendSheet(wb, 'Selected', selectedRows);
  appendSheet(wb, 'Grading', gradingRows);
  appendSheet(wb, 'Grading Grid', gridRows);
  appendSheet(wb, 'Standings', standingRows);
  appendSheet(wb, 'Day Scores', dayScoreRows);
  appendSheet(wb, 'Matches', matchRows);
  appendSheet(wb, 'Combis', combiRows);
  appendSheet(wb, 'Teams', teamRows);
  appendSheet(wb, 'Patterns', patternRows);

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const fileName = `CBOT-Edition-${edition.number}-${toCalendarDate(new Date()) || 'export'}.xlsx`;

  return { buffer, fileName, edition };
}
