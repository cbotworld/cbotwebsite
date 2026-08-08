'use server';

import { prisma } from '@/lib/prisma';

export async function generateRankingReportCSV(country?: string) {
  try {
    const whereClause = country && country !== 'Global' ? { country } : {};
    
    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: { rating: 'desc' },
      include: {
        rankingSnapshots: {
          orderBy: { createdAt: 'desc' },
          take: 3
        }
      }
    });

    // CSV Header
    let csvStr = 'Rank,Player Name,Username,Role,Country,State,ELO Rating,Wins,Losses,Win Rate (%),Queen Strikes,Boards Won,Current Category,Trend (Last 3 Editions)\n';

    users.forEach((user: any, idx: number) => {
      const rank = idx + 1;
      const winRate = user.wins + user.losses > 0 
        ? ((user.wins / (user.wins + user.losses)) * 100).toFixed(1) 
        : '0.0';
      
      const currentCategory = user.rankingSnapshots.length > 0 
        ? user.rankingSnapshots[0].category 
        : 'NEW';

      const trend = user.rankingSnapshots.map((s: any) => s.rating).join(' <- ') || 'N/A';

      csvStr += `"${rank}","${user.name || ''}","${user.username}","${user.role}","${user.country || ''}","${user.state || ''}","${user.rating}","${user.wins}","${user.losses}","${winRate}%","${user.queenStrikes}","${user.boardsWon}","${currentCategory}","${trend}"\n`;
    });

    return { success: true, csvData: csvStr };
  } catch (error) {
    console.error('CSV Generation Error:', error);
    return { success: false, error: 'Failed to generate report' };
  }
}
