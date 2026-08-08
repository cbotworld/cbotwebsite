'use server';

import { prisma } from '@/lib/prisma';
import { calculateLeagueStandings } from './schedulerActions';

/**
 * Calculates a player's category based on their past 3 editions performance.
 * Simple rule for MVP: if win rate > 75%, A1. > 50%, A2. > 25%, B1. Else B2.
 */
export async function calculatePlayerCategory(userId: string) {
  try {
    const pastEditions = await prisma.editionParticipant.findMany({
      where: { userId },
      orderBy: { edition: { number: 'desc' } },
      take: 3,
      include: {
        edition: {
          include: {
            matches: {
              where: {
                OR: [
                  { team1: { members: { some: { userId } } } },
                  { team2: { members: { some: { userId } } } },
                ]
              }
            }
          }
        }
      }
    });

    if (pastEditions.length === 0) return 'NEW';

    let totalWins = 0;
    let totalPlayed = 0;

    for (const participant of pastEditions) {
      for (const match of participant.edition.matches) {
        if (match.status !== 'COMPLETED') continue;
        const isTeam1 = match.team1Id === participant.teamId;
        const isTeam2 = match.team2Id === participant.teamId;
        
        if (isTeam1 || isTeam2) {
          totalPlayed++;
          if (match.winnerId === participant.teamId) {
            totalWins++;
          }
        }
      }
    }

    const winRate = totalPlayed > 0 ? (totalWins / totalPlayed) * 100 : 0;
    let newCategory = 'B2';
    if (winRate > 75) newCategory = 'A1';
    else if (winRate > 50) newCategory = 'A2';
    else if (winRate > 25) newCategory = 'B1';

    return newCategory;
  } catch (error) {
    console.error('Failed to calculate player category:', error);
    return 'B2'; // fallback
  }
}

/**
 * Triggered at the end of an edition. 
 * Finalizes standings, creates ranking snapshots, and updates user stats.
 */
export async function finalizeEditionRankings(editionId: string) {
  try {
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        matches: true,
        teams: {
          include: { members: { include: { user: true } } }
        },
        participants: {
          include: { user: true }
        }
      }
    });

    if (!edition) return { success: false, error: 'Edition not found' };

    // 1. Calculate and save League Standings
    const standingsRes = await calculateLeagueStandings(editionId);
    if (standingsRes.success && standingsRes.standings) {
      for (const standing of standingsRes.standings) {
        await prisma.leagueStanding.upsert({
          where: { editionId_teamId: { editionId, teamId: standing.teamId } },
          update: {
            rank: standing.rank,
            played: standing.played,
            wins: standing.wins,
            losses: standing.losses,
            points: standing.points,
            scoreDiff: standing.scoreDiff,
            queenStrikes: standing.queenStrikes,
          },
          create: {
            editionId,
            teamId: standing.teamId,
            rank: standing.rank,
            played: standing.played,
            wins: standing.wins,
            losses: standing.losses,
            points: standing.points,
            scoreDiff: standing.scoreDiff,
            queenStrikes: standing.queenStrikes,
          }
        });
      }
    }

    // 2. Update Global User Stats & Take Snapshots
    // Assuming for this MVP that the ELO change is just static logic (+10 per win)
    const users = await prisma.user.findMany();
    const sortedUsers = [...users].sort((a, b) => b.rating - a.rating);

    for (let i = 0; i < sortedUsers.length; i++) {
      const user = sortedUsers[i];
      const globalRank = i + 1;
      
      const newCategory = await calculatePlayerCategory(user.id);
      
      // Upsert ranking snapshot
      await prisma.playerRankingSnapshot.upsert({
        where: { userId_editionId: { userId: user.id, editionId } },
        update: {
          rating: user.rating,
          globalRank,
          category: newCategory,
        },
        create: {
          userId: user.id,
          editionId,
          rating: user.rating,
          globalRank,
          category: newCategory,
        }
      });
    }

    // 3. Mark Edition as COMPLETED
    await prisma.edition.update({
      where: { id: editionId },
      data: { status: 'COMPLETED' }
    });

    return { success: true };
  } catch (error) {
    console.error('Finalize edition error:', error);
    return { success: false, error: 'Failed to finalize edition' };
  }
}

export async function getGlobalRankings(country?: string) {
  try {
    const whereClause = country && country !== 'Global' ? { country } : {};
    
    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: { rating: 'desc' }
    });

    return { success: true, rankings: users };
  } catch (error) {
    return { success: false, error: 'Failed to fetch rankings' };
  }
}

export async function getHallOfFame() {
  try {
    const members = await prisma.hallOfFame.findMany({
      include: { user: true },
      orderBy: { inductionYear: 'desc' }
    });
    return { success: true, members };
  } catch (error) {
    return { success: false, error: 'Failed to fetch hall of fame' };
  }
}
