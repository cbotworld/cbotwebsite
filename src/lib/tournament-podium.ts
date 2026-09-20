import type { KnockoutMatchRow, StageStandingBlock, StageStandingRow } from '@/types';

export type PodiumTeam = {
  place: number;
  teamId: string;
  teamName: string;
  teamLogo?: string | null;
  tag?: string | null;
  title: string;
  badgeVariant: 'gold' | 'silver' | 'bronze' | 'neutral';
  matchDetail?: string;
  points?: number;
  score?: number;
  won?: number;
  lost?: number;
};

export type Top4PodiumResult = {
  isFinalized: boolean; // True if Grand Final and Qualifiers have completed
  stageStatusDescription: string;
  champion: PodiumTeam | null;      // 1st Place (Final Winner)
  runnerUp: PodiumTeam | null;      // 2nd Place (Final Loser)
  thirdPlace: PodiumTeam | null;    // 3rd Place (Qualifier 2 Loser)
  fourthPlace: PodiumTeam | null;   // 4th Place (Eliminator Loser)
  allPlacements: PodiumTeam[];
};

/**
 * Resolves the Top 4 tournament teams according to official playoff rules:
 * 1. 🥇 1st Place (Champion)   : Winner of Grand Final match
 * 2. 🥈 2nd Place (Runner-Up)  : Loser of Grand Final match
 * 3. 🥉 3rd Place              : Loser of Qualifier 2 (match just before Grand Final)
 * 4. 4️⃣ 4th Place              : Loser of Eliminator (match played alongside Qualifier 1)
 *
 * If playoffs are still in progress or tournament is in Round Robin,
 * fallbacks gracefully to the Round Robin top 4 standings with an in-progress label.
 */
export function resolveTop4Podium(
  blocks: StageStandingBlock[] = [],
  standingTeamsMap: Map<string, { id: string; name: string; logo?: string | null; tag?: string | null }> = new Map(),
): Top4PodiumResult {
  // Collect all knockout matches from all stages (Qualifiers, Finals, etc.)
  const allKnockoutMatches: KnockoutMatchRow[] = [];
  blocks.forEach((b) => {
    if (b.knockout && Array.isArray(b.knockout)) {
      allKnockoutMatches.push(...b.knockout);
    }
  });

  // Helper to resolve loser team
  const getLoser = (m: KnockoutMatchRow): { id: string; name: string } | null => {
    if (!m.winnerTeamId) return null;
    if (m.winnerTeamId === m.team1Id) {
      return { id: m.team2Id, name: m.team2Name };
    }
    return { id: m.team1Id, name: m.team1Name };
  };

  // Helper to resolve winner team
  const getWinner = (m: KnockoutMatchRow): { id: string; name: string } | null => {
    if (!m.winnerTeamId) return null;
    if (m.winnerTeamId === m.team1Id) {
      return { id: m.team1Id, name: m.team1Name };
    }
    return { id: m.team2Id, name: m.team2Name };
  };

  // 1. Find Grand Final match
  const finalMatch = allKnockoutMatches.find((m) => {
    const label = (m.label || '').toUpperCase();
    return (label.includes('GRAND FINAL') || label.includes('FINAL') || label === 'FINAL') && !label.includes('QUALIFIER') && !label.includes('SEMI') && !label.includes('3RD') && !label.includes('THIRD');
  });

  // 2. Find Qualifier 2 match (match played just before final between Q1 loser & Eliminator winner)
  const q2Match = allKnockoutMatches.find((m) => {
    const label = (m.label || '').toUpperCase();
    return label.includes('QUALIFIER 2') || label.includes('QUALIFIER-2') || label.includes('Q2');
  });

  // 3. Find Eliminator match
  const eliminatorMatch = allKnockoutMatches.find((m) => {
    const label = (m.label || '').toUpperCase();
    return label.includes('ELIMINATOR') || label.includes('ELIM');
  });

  // 4. Find 3rd Place Playoff match (if tournament uses Semi-finals -> 3rd place match format)
  const thirdPlaceMatch = allKnockoutMatches.find((m) => {
    const label = (m.label || '').toUpperCase();
    return label.includes('3RD') || label.includes('THIRD PLACE') || label.includes('BRONZE');
  });

  // Check if we have concluded playoff results
  const finalWinner = finalMatch ? getWinner(finalMatch) : null;
  const finalLoser = finalMatch ? getLoser(finalMatch) : null;
  const q2Loser = q2Match ? getLoser(q2Match) : null;
  const elimLoser = eliminatorMatch ? getLoser(eliminatorMatch) : null;
  const thirdPlaceWinner = thirdPlaceMatch ? getWinner(thirdPlaceMatch) : null;
  const thirdPlaceLoser = thirdPlaceMatch ? getLoser(thirdPlaceMatch) : null;

  const isFinalized = Boolean(finalWinner && finalLoser);

  // Helper to build team object
  const buildTeam = (
    place: number,
    teamRef: { id: string; name: string } | null,
    title: string,
    badgeVariant: 'gold' | 'silver' | 'bronze' | 'neutral',
    matchDetail?: string,
  ): PodiumTeam | null => {
    if (!teamRef || !teamRef.id) return null;
    const info = standingTeamsMap.get(teamRef.id);
    return {
      place,
      teamId: teamRef.id,
      teamName: teamRef.name || info?.name || 'TBD',
      teamLogo: info?.logo || null,
      tag: info?.tag || null,
      title,
      badgeVariant,
      matchDetail,
    };
  };

  // If playoffs have finished, construct Top 4 from playoff results
  if (finalWinner || finalLoser || q2Loser || elimLoser || thirdPlaceWinner) {
    const champion = buildTeam(
      1,
      finalWinner,
      'Champion (1st Place)',
      'gold',
      finalMatch ? `Grand Final Winner (${finalMatch.team1EventPts ?? 0}–${finalMatch.team2EventPts ?? 0} pts)` : 'Grand Final Winner',
    );

    const runnerUp = buildTeam(
      2,
      finalLoser,
      'Runner-Up (2nd Place)',
      'silver',
      finalMatch ? `Grand Finalist (${finalMatch.team1EventPts ?? 0}–${finalMatch.team2EventPts ?? 0} pts)` : 'Grand Final Finalist',
    );

    // 3rd place: Qualifier 2 Loser OR 3rd Place Match Winner
    const thirdRef = q2Loser || thirdPlaceWinner;
    const thirdPlace = buildTeam(
      3,
      thirdRef,
      '3rd Place',
      'bronze',
      q2Match && q2Loser ? `Qualifier 2 Loser (${q2Match.team1EventPts ?? 0}–${q2Match.team2EventPts ?? 0} pts)` : thirdPlaceMatch ? '3rd Place Playoff Winner' : undefined,
    );

    // 4th place: Eliminator Loser OR 3rd Place Match Loser
    const fourthRef = elimLoser || thirdPlaceLoser;
    const fourthPlace = buildTeam(
      4,
      fourthRef,
      '4th Place',
      'neutral',
      eliminatorMatch && elimLoser ? `Eliminator Loser (${eliminatorMatch.team1EventPts ?? 0}–${eliminatorMatch.team2EventPts ?? 0} pts)` : thirdPlaceMatch ? '3rd Place Playoff Loser' : undefined,
    );

    const allPlacements = [champion, runnerUp, thirdPlace, fourthPlace].filter(Boolean) as PodiumTeam[];

    return {
      isFinalized,
      stageStatusDescription: isFinalized ? 'Official Tournament Playoff Standings' : 'Playoffs In Progress',
      champion,
      runnerUp,
      thirdPlace,
      fourthPlace,
      allPlacements,
    };
  }

  // Fallback: Use Round Robin Top 4 standings
  const rrBlock = blocks.find((b) => b.kind === 'LEAGUE' || b.kind === 'ROUND_ROBIN') || blocks[0];
  const rrRows: StageStandingRow[] = [];
  if (rrBlock?.groups) {
    rrBlock.groups.forEach((g) => {
      if (g.rows && Array.isArray(g.rows)) {
        rrRows.push(...g.rows);
      }
    });
  }

  // Sort rows by rank
  const sortedRR = [...rrRows].sort((a, b) => (a.rank || 0) - (b.rank || 0));

  const t1 = sortedRR[0] ? { id: sortedRR[0].teamId, name: sortedRR[0].teamName } : null;
  const t2 = sortedRR[1] ? { id: sortedRR[1].teamId, name: sortedRR[1].teamName } : null;
  const t3 = sortedRR[2] ? { id: sortedRR[2].teamId, name: sortedRR[2].teamName } : null;
  const t4 = sortedRR[3] ? { id: sortedRR[3].teamId, name: sortedRR[3].teamName } : null;

  const champion = buildTeam(1, t1, '1st Place (Round Robin Leader)', 'gold', sortedRR[0] ? `${sortedRR[0].total} pts · ${sortedRR[0].matchesWon}W-${sortedRR[0].matchesLost}L` : undefined);
  const runnerUp = buildTeam(2, t2, '2nd Place (Round Robin)', 'silver', sortedRR[1] ? `${sortedRR[1].total} pts · ${sortedRR[1].matchesWon}W-${sortedRR[1].matchesLost}L` : undefined);
  const thirdPlace = buildTeam(3, t3, '3rd Place (Round Robin)', 'bronze', sortedRR[2] ? `${sortedRR[2].total} pts · ${sortedRR[2].matchesWon}W-${sortedRR[2].matchesLost}L` : undefined);
  const fourthPlace = buildTeam(4, t4, '4th Place (Round Robin)', 'neutral', sortedRR[3] ? `${sortedRR[3].total} pts · ${sortedRR[3].matchesWon}W-${sortedRR[3].matchesLost}L` : undefined);

  const allPlacements = [champion, runnerUp, thirdPlace, fourthPlace].filter(Boolean) as PodiumTeam[];

  return {
    isFinalized: false,
    stageStatusDescription: 'Current Round Robin Leaders (Playoffs Pending)',
    champion,
    runnerUp,
    thirdPlace,
    fourthPlace,
    allPlacements,
  };
}
