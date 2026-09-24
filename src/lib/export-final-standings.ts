import * as XLSX from 'xlsx';
import type { StageStandingBlock, StageStandingRow } from '@/types';
import { resolveTop4Podium } from '@/lib/tournament-podium';

export type ExportFinalStandingsOptions = {
  edition: {
    id: string;
    number?: number | string;
    title?: string;
    status?: string;
  } | null;
  blocks: StageStandingBlock[];
  players: any[];
  standingTeamsMap?: Map<string, { id: string; name: string; logo?: string | null; tag?: string | null }>;
};

function formatPlayerList(list: any[] = []): string {
  if (!list || list.length === 0) return '';
  return list
    .map((p) => {
      const name = p.name || p.username || 'Player';
      const score = p.score != null ? ` (${p.score})` : '';
      const wo = p.isWalkover ? ' [WO]' : '';
      return `${name}${score}${wo}`;
    })
    .join(', ');
}

function resolvePlayerNames(playerList?: any[], rawNames?: string): string {
  if (Array.isArray(playerList) && playerList.length > 0) {
    const formatted = formatPlayerList(playerList);
    if (formatted) return formatted;
  }
  if (rawNames && typeof rawNames === 'string' && rawNames.trim()) {
    return rawNames.trim();
  }
  return '—';
}

export function buildFinalStandingsWorkbook({
  edition,
  blocks,
  players,
  standingTeamsMap = new Map(),
}: ExportFinalStandingsOptions): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const editionTitle = edition?.title || (edition?.number ? `Edition ${edition.number}` : 'Tournament');
  const safeEditionNum = edition?.number || 'Final';

  // ==========================================
  // SHEET 1: ROUND ROBIN (Standings & Combis)
  // ==========================================
  const rrBlock = blocks.find((b) => b.kind === 'LEAGUE' || b.kind === 'ROUND_ROBIN') || blocks[0];
  const rrSheetData: any[] = [];

  // Sheet Title
  rrSheetData.push({ 'CBOT TOURNAMENT REPORT': `${editionTitle} — ROUND ROBIN STAGE` });
  rrSheetData.push({}); // Empty separator row

  // Section 1: Standings Table Header
  rrSheetData.push({
    'Rank (#)': 'Rank (#)',
    'Team Name': 'Team Name',
    'Total Points': 'Total Points',
    'Matches Played': 'Matches Played',
    'Won': 'Won',
    'Lost': 'Lost',
    'Tied': 'Tied',
    'Team Total Score': 'Team Total Score',
    'Event Points': 'Event Points',
    'Slam Bonus': 'Slam Bonus',
    'Target Bonus': 'Target Bonus',
  });

  const rrRows: StageStandingRow[] = [];
  if (rrBlock?.groups) {
    rrBlock.groups.forEach((g) => {
      if (g.rows && Array.isArray(g.rows)) {
        rrRows.push(...g.rows);
      }
    });
  }
  const sortedRR = [...rrRows].sort((a, b) => (a.rank || 0) - (b.rank || 0));

  sortedRR.forEach((r) => {
    rrSheetData.push({
      'Rank (#)': r.rank,
      'Team Name': r.teamName,
      'Total Points': r.total,
      'Matches Played': r.matchesPlayed ?? 0,
      'Won': r.matchesWon ?? 0,
      'Lost': r.matchesLost ?? 0,
      'Tied': r.matchesTied ?? 0,
      'Team Total Score': r.teamScore ?? 0,
      'Event Points': r.eventPts ?? 0,
      'Slam Bonus': r.slamBonus ?? 0,
      'Target Bonus': r.avgBonus ?? 0,
    });
  });

  rrSheetData.push({}); // Empty separator row
  rrSheetData.push({ 'Rank (#)': 'ROUND ROBIN DAY-BY-DAY MATCH COMBIS & PLAYER SCORES' });
  rrSheetData.push({
    'Rank (#)': 'Day #',
    'Team Name': 'Match Pairing',
    'Total Points': 'Event Name',
    'Matches Played': 'Format',
    'Won': 'Team 1 Players & Scores',
    'Lost': 'T1 Pts',
    'Tied': 'T2 Pts',
    'Team Total Score': 'Team 2 Players & Scores',
    'Event Points': 'Result / Winner',
    'Slam Bonus': 'Walkover Notes',
  });

  // Extract all combi events from Round Robin days
  const seenRoundRobinEvents = new Set<string>();
  sortedRR.forEach((r) => {
    const days = r.days || [];
    days.forEach((d) => {
      const events = d.events || [];
      events.forEach((ev: any) => {
        // Create canonical match-event pairing key to avoid duplicate inverted rows
        const teamsSorted = [r.teamName, d.opponentName || 'Opponent'].sort().join(' vs ');
        const eventKey = `Day-${d.dayNumber}-${teamsSorted}-${ev.name || ''}`;
        if (seenRoundRobinEvents.has(eventKey)) return;
        seenRoundRobinEvents.add(eventKey);

        const t1Players = resolvePlayerNames(ev.myPlayerList || ev.team1PlayerList, ev.myPlayers || ev.team1Players);
        const t2Players = resolvePlayerNames(ev.oppPlayerList || ev.team2PlayerList, ev.oppPlayers || ev.team2Players);
        const t1Pts = ev.myPts ?? ev.team1Pts ?? 0;
        const t2Pts = ev.oppPts ?? ev.team2Pts ?? 0;

        rrSheetData.push({
          'Rank (#)': `Day ${d.dayNumber}`,
          'Team Name': `${r.teamName} vs ${d.opponentName || 'Opponent'}`,
          'Total Points': ev.name || 'Combi Event',
          'Matches Played': ev.format || 'Standard',
          'Won': t1Players,
          'Lost': t1Pts,
          'Tied': t2Pts,
          'Team Total Score': t2Players,
          'Event Points': ev.result || 'Completed',
          'Slam Bonus': ev.reason || '',
        });
      });
    });
  });

  const wsRoundRobin = XLSX.utils.json_to_sheet(rrSheetData, { skipHeader: true });
  wsRoundRobin['!cols'] = [
    { wch: 10 }, // Day / Rank
    { wch: 32 }, // Team / Match
    { wch: 20 }, // Total Pts / Event
    { wch: 14 }, // Played / Format
    { wch: 36 }, // Won / Team 1 Players
    { wch: 10 }, // Lost / T1 Pts
    { wch: 10 }, // Tied / T2 Pts
    { wch: 36 }, // Score / Team 2 Players
    { wch: 20 }, // Event Pts / Result
    { wch: 16 }, // Slam / Notes
    { wch: 14 }, // Target+
  ];
  XLSX.utils.book_append_sheet(wb, wsRoundRobin, 'Round Robin');

  // ==========================================
  // SHEET 2: QUALIFIER MATCHES (Playoffs & Combis)
  // ==========================================
  const qualifierBlock = blocks.find(
    (b) => (b.name || '').toUpperCase().includes('QUALIFIER') || (b.name || '').toUpperCase().includes('PLAYOFF') || (b.kind || '').toUpperCase().includes('QUALIFIER'),
  );

  const qualifierMatches = (qualifierBlock?.knockout || []).concat(
    blocks.flatMap((b) => (b.knockout || []).filter((m) => {
      const l = (m.label || '').toUpperCase();
      return l.includes('QUALIFIER') || l.includes('ELIMINATOR') || l.includes('SEMI');
    }))
  );

  // Remove duplicate matches by label and dayNumber
  const seenQual = new Set<string>();
  const uniqueQualMatches = qualifierMatches.filter((m) => {
    const key = `${m.label}-${m.dayNumber}-${m.team1Name}-${m.team2Name}`;
    if (seenQual.has(key)) return false;
    seenQual.add(key);
    return true;
  });

  const qualSheetData: any[] = [];
  qualSheetData.push({ 'QUALIFIERS': `${editionTitle} — QUALIFIERS & PLAYOFF MATCHES` });
  qualSheetData.push({});

  // Summary Table of Qualifier Matches
  qualSheetData.push({
    'Match': 'Match Title',
    'Day': 'Day #',
    'Team 1': 'Team 1',
    'T1 Score': 'Team 1 Event Pts',
    'T2 Score': 'Team 2 Event Pts',
    'Team 2': 'Team 2',
    'Winner': 'Match Winner',
    'Status': 'Playoff Impact',
  });

  uniqueQualMatches.forEach((m) => {
    const winnerName = m.winnerTeamId === m.team1Id ? m.team1Name : m.winnerTeamId === m.team2Id ? m.team2Name : m.winnerTeamId ? 'Concluded' : 'TBD';
    const labelUpper = (m.label || '').toUpperCase();
    let impact = '';
    if (labelUpper.includes('QUALIFIER 1') || labelUpper.includes('Q1')) {
      impact = 'Winner -> Grand Final | Loser -> Qualifier 2';
    } else if (labelUpper.includes('ELIMINATOR')) {
      impact = 'Winner -> Qualifier 2 | Loser -> 4th Place';
    } else if (labelUpper.includes('QUALIFIER 2') || labelUpper.includes('Q2')) {
      impact = 'Winner -> Grand Final | Loser -> 3rd Place';
    } else if (labelUpper.includes('SEMI')) {
      impact = 'Winner -> Grand Final | Loser -> 3rd/4th Playoff';
    }

    qualSheetData.push({
      'Match': m.label || 'Qualifier Match',
      'Day': m.dayNumber ? `Day ${m.dayNumber}` : '—',
      'Team 1': m.team1Name || 'TBD',
      'T1 Score': m.team1EventPts ?? '—',
      'T2 Score': m.team2EventPts ?? '—',
      'Team 2': m.team2Name || 'TBD',
      'Winner': winnerName,
      'Status': impact,
    });
  });

  qualSheetData.push({});
  qualSheetData.push({ 'Match': 'DETAILED QUALIFIER COMBI EVENTS & PLAYER SCORES' });
  qualSheetData.push({
    'Match': 'Match Label',
    'Day': 'Event Name',
    'Team 1': 'Format',
    'T1 Score': 'Team 1 Lineup & Scores',
    'T2 Score': 'T1 Pts',
    'Team 2': 'T2 Pts',
    'Winner': 'Team 2 Lineup & Scores',
    'Status': 'Event Result / Status',
  });

  uniqueQualMatches.forEach((m) => {
    const events = m.events || [];
    events.forEach((ev: any) => {
      const t1Players = resolvePlayerNames(ev.team1PlayerList || ev.myPlayerList, ev.team1Players || ev.myPlayers);
      const t2Players = resolvePlayerNames(ev.team2PlayerList || ev.oppPlayerList, ev.team2Players || ev.oppPlayers);
      const t1Pts = ev.team1Pts ?? ev.myPts ?? 0;
      const t2Pts = ev.team2Pts ?? ev.oppPts ?? 0;

      qualSheetData.push({
        'Match': m.label,
        'Day': ev.name || 'Combi Event',
        'Team 1': ev.format || 'Standard',
        'T1 Score': t1Players,
        'T2 Score': t1Pts,
        'Team 2': t2Pts,
        'Winner': t2Players,
        'Status': ev.result || 'Completed',
      });
    });
  });

  const wsQualifiers = XLSX.utils.json_to_sheet(qualSheetData, { skipHeader: true });
  wsQualifiers['!cols'] = [
    { wch: 22 }, // Match
    { wch: 18 }, // Day / Event
    { wch: 18 }, // Team 1 / Format
    { wch: 34 }, // T1 Score / Team 1 Lineup
    { wch: 12 }, // T2 Score / T1 Pts
    { wch: 12 }, // Team 2 / T2 Pts
    { wch: 34 }, // Winner / Team 2 Lineup
    { wch: 38 }, // Status / Impact
  ];
  XLSX.utils.book_append_sheet(wb, wsQualifiers, 'Qualifier Matches');

  // ==========================================
  // SHEET 3: FINALS & PLACEMENTS (Top 4 + Grand Final Combis)
  // ==========================================
  const podium = resolveTop4Podium(blocks, standingTeamsMap);
  const finalsSheetData: any[] = [];

  finalsSheetData.push({ 'FINALS': `${editionTitle} — TOP 4 PLACEMENTS & GRAND FINALS` });
  finalsSheetData.push({});

  // Section 1: Official Top 4 Placements Table
  finalsSheetData.push({ 'FINALS': 'OFFICIAL TOP 4 TOURNAMENT STANDINGS & PODIUM' });
  finalsSheetData.push({
    'Position': 'Position',
    'Placement': 'Official Title',
    'Team Name': 'Team Name',
    'Details': 'Match Path / Resolution',
  });

  finalsSheetData.push({
    'Position': '1st Place 🥇',
    'Placement': 'CHAMPION',
    'Team Name': podium.champion?.teamName || 'TBD',
    'Details': podium.champion?.matchDetail || 'Grand Final Winner',
  });

  finalsSheetData.push({
    'Position': '2nd Place 🥈',
    'Placement': 'RUNNER-UP',
    'Team Name': podium.runnerUp?.teamName || 'TBD',
    'Details': podium.runnerUp?.matchDetail || 'Grand Final Finalist',
  });

  finalsSheetData.push({
    'Position': '3rd Place 🥉',
    'Placement': '3rd PLACE',
    'Team Name': podium.thirdPlace?.teamName || 'TBD',
    'Details': podium.thirdPlace?.matchDetail || 'Qualifier 2 Loser',
  });

  finalsSheetData.push({
    'Position': '4th Place 4️⃣',
    'Placement': '4th PLACE',
    'Team Name': podium.fourthPlace?.teamName || 'TBD',
    'Details': podium.fourthPlace?.matchDetail || 'Eliminator Loser',
  });

  finalsSheetData.push({});

  // Section 2: Final Matches (Grand Final & 3rd Place Playoff)
  const finalMatches = blocks.flatMap((b) => (b.knockout || []).filter((m) => {
    const l = (m.label || '').toUpperCase();
    return (l.includes('FINAL') || l.includes('3RD') || l.includes('THIRD')) && !l.includes('QUALIFIER') && !l.includes('SEMI');
  }));

  const seenFinal = new Set<string>();
  const uniqueFinalMatches = finalMatches.filter((m) => {
    const key = `${m.label}-${m.dayNumber}-${m.team1Name}-${m.team2Name}`;
    if (seenFinal.has(key)) return false;
    seenFinal.add(key);
    return true;
  });

  finalsSheetData.push({ 'FINALS': 'GRAND FINAL & PLAYOFF MATCH COMBI DETAILS' });
  finalsSheetData.push({
    'Position': 'Match Title',
    'Placement': 'Event Name',
    'Team Name': 'Format',
    'Details': 'Team 1 Players & Scores',
    'T1 Pts': 'T1 Pts',
    'T2 Pts': 'T2 Pts',
    'Team 2 Players': 'Team 2 Players & Scores',
    'Result': 'Event Result / Status',
  });

  uniqueFinalMatches.forEach((m) => {
    const events = m.events || [];
    if (events.length === 0) {
      const winnerName = m.winnerTeamId === m.team1Id ? m.team1Name : m.winnerTeamId === m.team2Id ? m.team2Name : m.winnerTeamId ? 'Concluded' : 'TBD';
      finalsSheetData.push({
        'Position': m.label,
        'Placement': `Day ${m.dayNumber || 'Final'}`,
        'Team Name': `${m.team1Name} vs ${m.team2Name}`,
        'Details': `Score: ${m.team1EventPts ?? 0} – ${m.team2EventPts ?? 0} | Winner: ${winnerName}`,
        'T1 Pts': m.team1EventPts ?? 0,
        'T2 Pts': m.team2EventPts ?? 0,
        'Team 2 Players': '',
        'Result': winnerName,
      });
    } else {
      events.forEach((ev: any) => {
        const t1Players = resolvePlayerNames(ev.team1PlayerList || ev.myPlayerList, ev.team1Players || ev.myPlayers);
        const t2Players = resolvePlayerNames(ev.team2PlayerList || ev.oppPlayerList, ev.team2Players || ev.oppPlayers);
        const t1Pts = ev.team1Pts ?? ev.myPts ?? 0;
        const t2Pts = ev.team2Pts ?? ev.oppPts ?? 0;

        finalsSheetData.push({
          'Position': m.label,
          'Placement': ev.name || 'Combi Event',
          'Team Name': ev.format || 'Standard',
          'Details': t1Players,
          'T1 Pts': t1Pts,
          'T2 Pts': t2Pts,
          'Team 2 Players': t2Players,
          'Result': ev.result || 'Completed',
        });
      });
    }
  });

  const wsFinals = XLSX.utils.json_to_sheet(finalsSheetData, { skipHeader: true });
  wsFinals['!cols'] = [
    { wch: 18 }, // Position / Match Title
    { wch: 20 }, // Placement / Event Name
    { wch: 24 }, // Team Name / Format
    { wch: 36 }, // Details / Team 1 Players
    { wch: 10 }, // T1 Pts
    { wch: 10 }, // T2 Pts
    { wch: 36 }, // Team 2 Players
    { wch: 24 }, // Result
  ];
  XLSX.utils.book_append_sheet(wb, wsFinals, 'Finals & Placements');

  // ==========================================
  // SHEET 4: PLAYER RANKINGS (Standings Table)
  // ==========================================
  const playerSheetData: any[] = [];
  playerSheetData.push({ 'PLAYER RANKINGS': `${editionTitle} — OFFICIAL PLAYER STANDINGS` });
  playerSheetData.push({});

  playerSheetData.push({
    'Rank (#)': 'Rank (#)',
    'Player Name': 'Player Name',
    'Team Name': 'Team Name',
    'Grade': 'Grade',
    'Target': 'Edition Target',
    'Matches Played': 'Matches / Days Counted',
    'Slams': 'Total Slams',
    'Walkovers': 'Walkovers (WO)',
    'Board Average': 'Board Average (G.Avg)',
    'Matches Won': 'Matches Won',
  });

  players.forEach((p) => {
    playerSheetData.push({
      'Rank (#)': p.rank,
      'Player Name': p.name,
      'Team Name': p.teamName || '—',
      'Grade': p.grade || '—',
      'Target': p.target ?? '—',
      'Matches Played': p.matches ?? p.daysCounted ?? 0,
      'Slams': p.slams ?? 0,
      'Walkovers': p.walkovers ?? 0,
      'Board Average': p.boardAverage != null ? Number(p.boardAverage).toFixed(2) : '—',
      'Matches Won': p.matchesWon ?? 0,
    });
  });

  const wsPlayers = XLSX.utils.json_to_sheet(playerSheetData, { skipHeader: true });
  wsPlayers['!cols'] = [
    { wch: 10 }, // Rank
    { wch: 28 }, // Player Name
    { wch: 24 }, // Team Name
    { wch: 10 }, // Grade
    { wch: 14 }, // Target
    { wch: 22 }, // Matches Played
    { wch: 14 }, // Slams
    { wch: 16 }, // Walkovers
    { wch: 22 }, // Board Average
    { wch: 14 }, // Matches Won
  ];
  XLSX.utils.book_append_sheet(wb, wsPlayers, 'Player Rankings');

  // ==========================================
  // SHEET 5: DAILY SCORES (Player Daily Matrix)
  // ==========================================
  const dailyScoresSheetData: any[] = [];

  // Determine total days in edition / player scores
  let maxTournamentDay = 10;
  players.forEach((p) => {
    (p.dayScores || []).forEach((ds: any) => {
      if (typeof ds.dayNumber === 'number' && ds.dayNumber > maxTournamentDay) {
        maxTournamentDay = ds.dayNumber;
      }
    });
  });

  const dayCols: number[] = [];
  for (let d = 1; d <= maxTournamentDay; d++) {
    dayCols.push(d);
  }

  // Header row matching screenshot: Sl.No | TEAMS | Player | Group | Day1 | Day2 | ... | DayN
  const dailyHeader: Record<string, string> = {
    'Sl.No': 'Sl.No',
    'TEAMS': 'TEAMS',
    'Player': 'Player',
    'Group': 'Group',
  };
  dayCols.forEach((d) => {
    dailyHeader[`Day${d}`] = `Day${d}`;
  });
  dailyScoresSheetData.push(dailyHeader);

  // Group and sort players by Team name, then Grade (G1..G8), then Player name
  const sortedPlayersForDaily = [...players].sort((a, b) => {
    const teamA = (a.teamName || '').toLowerCase();
    const teamB = (b.teamName || '').toLowerCase();
    if (teamA !== teamB) return teamA.localeCompare(teamB);

    const gradeA = String(a.grade || '').toUpperCase();
    const gradeB = String(b.grade || '').toUpperCase();
    if (gradeA !== gradeB) {
      return gradeA.localeCompare(gradeB, undefined, { numeric: true });
    }

    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  sortedPlayersForDaily.forEach((p, idx) => {
    const dayMap = new Map<number, number | string>();
    (p.dayScores || []).forEach((ds: any) => {
      if (ds.dayNumber) {
        dayMap.set(ds.dayNumber, ds.score != null ? ds.score : '');
      }
    });

    const row: Record<string, any> = {
      'Sl.No': idx + 1,
      'TEAMS': p.teamName || '—',
      'Player': p.name || 'Player',
      'Group': p.grade || '—',
    };

    dayCols.forEach((d) => {
      row[`Day${d}`] = dayMap.has(d) ? dayMap.get(d) : '';
    });

    dailyScoresSheetData.push(row);
  });

  const wsDailyScores = XLSX.utils.json_to_sheet(dailyScoresSheetData, { skipHeader: true });
  wsDailyScores['!cols'] = [
    { wch: 8 },  // Sl.No
    { wch: 26 }, // TEAMS
    { wch: 26 }, // Player
    { wch: 10 }, // Group
    ...dayCols.map(() => ({ wch: 9 })), // Day1..DayN
  ];
  XLSX.utils.book_append_sheet(wb, wsDailyScores, 'Daily Scores');

  return wb;
}

export function exportFinalStandingsWorkbook(options: ExportFinalStandingsOptions) {
  const wb = buildFinalStandingsWorkbook(options);
  const safeEditionNum = options.edition?.number || 'Final';
  const today = new Date().toISOString().split('T')[0];
  const filename = `CBOT-Edition-${safeEditionNum}-Final-Standings-${today}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function buildFinalStandingsBuffer(options: ExportFinalStandingsOptions): Buffer {
  const wb = buildFinalStandingsWorkbook(options);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

