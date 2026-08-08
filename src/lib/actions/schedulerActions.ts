'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function generateRoundRobinFixtures(editionId: string, teamsList: any[]) {
  if (teamsList.length < 2) {
    return { success: false, error: 'At least 2 teams are required to generate a Round-Robin schedule.' };
  }

  try {
    const generatedMatches = [];
    let matchCounter = 1;
    const baseDate = new Date();

    for (let i = 0; i < teamsList.length; i++) {
      for (let j = i + 1; j < teamsList.length; j++) {
        const matchDate = new Date(baseDate);
        matchDate.setHours(10 + (matchCounter % 6) * 2, 0, 0, 0);

        const newMatch = await prisma.match.create({
          data: {
            editionId,
            round: Math.floor(matchCounter / (teamsList.length / 2)) + 1,
            matchNumber: matchCounter,
            stage: 'ROUND_ROBIN',
            team1Id: teamsList[i].id,
            team2Id: teamsList[j].id,
            score1: 0,
            score2: 0,
            queenStrikes1: 0,
            queenStrikes2: 0,
            status: 'SCHEDULED',
            scheduledTime: matchDate,
            tableNumber: (matchCounter % 8) + 1,
          }
        });

        generatedMatches.push(newMatch);
        matchCounter++;
      }
    }

    revalidatePath('/dashboard/admin');
    revalidatePath('/fixtures');

    return { success: true, matches: generatedMatches };
  } catch (error) {
    console.error('Failed to generate fixtures:', error);
    return { success: false, error: 'Failed to generate fixtures' };
  }
}

export async function calculateLeagueStandings(editionId: string) {
  try {
    const teams = await prisma.team.findMany({ where: { editionId } });
    const matches = await prisma.match.findMany({ where: { editionId } });

    const standingsMap: { [teamId: string]: any } = {};

    teams.forEach((t) => {
      standingsMap[t.id] = {
        rank: 0,
        teamId: t.id,
        teamName: t.name,
        teamTag: t.tag,
        played: 0,
        wins: 0,
        losses: 0,
        points: 0,
        scoreDiff: 0,
        queenStrikes: 0,
      };
    });

    matches.forEach((m) => {
      if (m.status === 'COMPLETED' && m.team1Id && m.team2Id) {
        const s1 = standingsMap[m.team1Id];
        const s2 = standingsMap[m.team2Id];

        if (s1 && s2) {
          s1.played += 1;
          s2.played += 1;

          s1.queenStrikes += m.queenStrikes1 || 0;
          s2.queenStrikes += m.queenStrikes2 || 0;

          s1.scoreDiff += m.score1 - m.score2;
          s2.scoreDiff += m.score2 - m.score1;

          if (m.score1 > m.score2) {
            s1.wins += 1;
            s1.points += 3;
            s2.losses += 1;
          } else if (m.score2 > m.score1) {
            s2.wins += 1;
            s2.points += 3;
            s1.losses += 1;
          }
        }
      }
    });

    const sortedStandings = Object.values(standingsMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
      return b.queenStrikes - a.queenStrikes;
    });

    sortedStandings.forEach((s, idx) => {
      s.rank = idx + 1;
    });

    return { success: true, standings: sortedStandings };
  } catch (error) {
    console.error('Failed to calculate standings:', error);
    return { success: false, error: 'Failed to calculate standings' };
  }
}

export async function generatePlayoffFixtures(editionId: string, standings: any[], teams: any[]) {
  if (standings.length < 4) {
    return { success: false, error: 'At least 4 teams with calculated standings are required for playoffs.' };
  }

  try {
    const team1st = teams.find((t) => t.id === standings[0].teamId) || teams[0];
    const team2nd = teams.find((t) => t.id === standings[1].teamId) || teams[1];
    const team3rd = teams.find((t) => t.id === standings[2].teamId) || teams[2];
    const team4th = teams.find((t) => t.id === standings[3].teamId) || teams[3];

    const now = new Date();

    // Qualifier 1 (1st vs 2nd)
    const q1Date = new Date(now);
    q1Date.setHours(14, 0, 0, 0);
    const qualifier1 = await prisma.match.create({
      data: {
        editionId,
        round: 1,
        matchNumber: 101,
        stage: 'QUALIFIER_1',
        team1Id: team1st.id,
        team2Id: team2nd.id,
        score1: 0,
        score2: 0,
        status: 'SCHEDULED',
        scheduledTime: q1Date,
        tableNumber: 1,
      }
    });

    // Qualifier 2 (3rd vs 4th)
    const q2Date = new Date(now);
    q2Date.setHours(16, 0, 0, 0);
    const qualifier2 = await prisma.match.create({
      data: {
        editionId,
        round: 1,
        matchNumber: 102,
        stage: 'QUALIFIER_2',
        team1Id: team3rd.id,
        team2Id: team4th.id,
        score1: 0,
        score2: 0,
        status: 'SCHEDULED',
        scheduledTime: q2Date,
        tableNumber: 2,
      }
    });

    // Grand Final (Winner Q1 vs Winner Q2)
    const gfDate = new Date(now);
    gfDate.setDate(gfDate.getDate() + 1);
    gfDate.setHours(18, 0, 0, 0);
    const grandFinal = await prisma.match.create({
      data: {
        editionId,
        round: 2,
        matchNumber: 201,
        stage: 'GRAND_FINAL',
        team1Id: team1st.id,
        team2Id: team3rd.id,
        score1: 0,
        score2: 0,
        status: 'SCHEDULED',
        scheduledTime: gfDate,
        tableNumber: 1,
      }
    });

    revalidatePath('/dashboard/admin');
    revalidatePath('/fixtures');

    return {
      success: true,
      playoffs: {
        qualifier1,
        qualifier2,
        grandFinal,
      },
    };
  } catch (error) {
    console.error('Failed to generate playoffs:', error);
    return { success: false, error: 'Failed to generate playoffs' };
  }
}

export async function rescheduleFixture(matchId: string, newScheduledTime: string, newTableNumber: number) {
  try {
    const match = await prisma.match.update({
      where: { id: matchId },
      data: {
        scheduledTime: new Date(newScheduledTime),
        tableNumber: newTableNumber,
      }
    });
    
    revalidatePath('/dashboard/admin');
    revalidatePath('/fixtures');
    return { success: true, match };
  } catch (error) {
    return { success: false, error: 'Match fixture not found or update failed' };
  }
}
