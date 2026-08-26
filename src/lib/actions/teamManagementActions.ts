'use server';

import { prisma } from '@/lib/prisma';
import { syncCaptainRole } from '@/lib/captain-role';

// Calculate player category based on past performance for auto-balancing
export async function calculatePlayerCategoriesForDraft(playerIds: string[]) {
  const players = await prisma.user.findMany({
    where: { id: { in: playerIds } },
  });

  const categorizedPlayers = players.map((p) => {
    // Skill score calculation combining ELO, past win rate, and queen strikes
    const pastWinRate = p.wins + p.losses > 0 ? (p.wins / (p.wins + p.losses)) * 100 : 50;
    const skillScore = Math.round(p.rating * 0.5 + pastWinRate * 3.5 + p.queenStrikes * 2.0);

    let category = 'D';
    if (skillScore >= 1800) category = 'A';
    else if (skillScore >= 1500) category = 'B';
    else if (skillScore >= 1200) category = 'C';

    return {
      ...p,
      category,
      skillScore,
      past3EditionsStats: {
        editionsPlayed: 3,
        avgWinRate: Math.round(pastWinRate),
        queensCount: p.queenStrikes,
      }
    };
  });

  return { success: true, players: categorizedPlayers };
}

// Generate balanced teams with fair distribution of skill categories
export async function autoGenerateBalancedTeams(playerIds: string[], numTeams: number = 4) {
  // First calculate categories
  const { players } = await calculatePlayerCategoriesForDraft(playerIds);
  if (!players) return { success: false, error: 'No players found' };

  // Group by categories
  const catA = players.filter((p) => p.category === 'A').sort((a, b) => (b.skillScore || 0) - (a.skillScore || 0));
  const catB = players.filter((p) => p.category === 'B').sort((a, b) => (b.skillScore || 0) - (a.skillScore || 0));
  const catC = players.filter((p) => p.category === 'C').sort((a, b) => (b.skillScore || 0) - (a.skillScore || 0));
  const catD = players.filter((p) => p.category === 'D').sort((a, b) => (b.skillScore || 0) - (a.skillScore || 0));

  const allOrdered = [...catA, ...catB, ...catC, ...catD];

  const generatedTeams: any[] = [];

  const teamNames = [
    { name: 'Striker Kings', tag: 'SK' },
    { name: 'Queen Chargers', tag: 'QC' },
    { name: 'Board Titans', tag: 'BT' },
    { name: 'Rebound Squad', tag: 'RS' },
    { name: 'Falcon Strikers', tag: 'FS' },
    { name: 'Apex Carrom Club', tag: 'ACC' },
  ];

  for (let i = 0; i < numTeams; i++) {
    const tName = teamNames[i % teamNames.length];
    generatedTeams.push({
      id: `gen_team_${i + 1}`,
      name: tName.name,
      tag: tName.tag,
      captainId: '',
      members: [],
      avgSkillScore: 0,
    });
  }

  // Snake draft distribution for skill balance
  allOrdered.forEach((player, idx) => {
    const teamIndex = idx % numTeams;
    const actualTeamIdx = Math.floor(idx / numTeams) % 2 === 1 ? numTeams - 1 - teamIndex : teamIndex;
    generatedTeams[actualTeamIdx].members.push(player);
  });

  // Assign captain (highest ELO player per team) and calculate team skill average
  generatedTeams.forEach((team) => {
    team.members.sort((a: any, b: any) => b.rating - a.rating);
    const topPlayer = team.members[0];
    if (topPlayer) {
      team.captainId = topPlayer.id;
      team.captain = topPlayer;
      topPlayer.role = 'CAPTAIN';
    }

    const totalSkill = team.members.reduce((acc: number, m: any) => acc + (m.skillScore || 0), 0);
    team.avgSkillScore = Math.round(totalSkill / (team.members.length || 1));
  });

  return { success: true, teams: generatedTeams };
}

// Publish finalized teams for an edition
export async function publishFinalizedTeams(editionId: string, finalizedTeams: any[]) {
  try {
    for (const ft of finalizedTeams) {
      // Create team
      const team = await prisma.team.create({
        data: {
          name: ft.name,
          tag: ft.tag,
          description: `Finalized roster for Edition #${editionId}`,
          editionId: editionId,
          captainId: ft.captainId,
        }
      });

      await syncCaptainRole({ newCaptainId: ft.captainId });

      // Create EditionParticipants for each member
      const participantPromises = ft.members.map((m: any) => 
        prisma.editionParticipant.create({
          data: {
            editionId: editionId,
            userId: m.id,
            teamId: team.id,
            category: m.category || 'C',
          }
        })
      );

      await Promise.all(participantPromises);
    }

    return { success: true, message: `Finalized rosters published for Edition #${editionId}` };
  } catch (error) {
    console.error('Failed to publish teams:', error);
    return { success: false, error: 'Failed to publish teams to database' };
  }
}

export async function getTeamsByEdition(editionId: string) {
  try {
    const teams = await prisma.team.findMany({
      where: { editionId },
      include: {
        captain: true,
        members: {
          include: {
            user: true
          }
        }
      }
    });
    return { success: true, teams };
  } catch (error) {
    return { success: false, error: 'Failed to fetch teams' };
  }
}

// Update team captain — demotes old captain to PLAYER, promotes new one to CAPTAIN
export async function updateTeamCaptain(teamId: string, newCaptainId: string) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) return { success: false, error: 'Team not found' };

    const previousCaptainId = team.captainId;

    await prisma.team.update({
      where: { id: teamId },
      data: { captainId: newCaptainId },
    });

    await syncCaptainRole({ newCaptainId, previousCaptainId });

    return { success: true, message: 'Captain updated successfully' };
  } catch (error) {
    console.error('updateTeamCaptain error:', error);
    return { success: false, error: 'Failed to update captain' };
  }
}

