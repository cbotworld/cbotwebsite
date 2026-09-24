'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { sendFinalStandingsEmail } from '@/lib/tournament-report-email';

export async function submitScoreReport(data: {
  matchId: string;
  captainUserId: string;
  team1Score: number;
  team2Score: number;
  queenStrikes1: number;
  queenStrikes2: number;
  proofNotes?: string;
  proofUrl?: string;
}) {
  try {
    const newReport = await prisma.scoreReport.create({
      data: {
        matchId: data.matchId,
        submittedByUserId: data.captainUserId,
        team1Score: data.team1Score,
        team2Score: data.team2Score,
        queenStrikes1: data.queenStrikes1,
        queenStrikes2: data.queenStrikes2,
        proofNotes: data.proofNotes || 'Match score report submitted by team captain.',
        proofUrl: data.proofUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=400',
        status: 'PENDING',
      }
    });

    revalidatePath('/dashboard/captain');
    revalidatePath('/dashboard/organizer');

    return { success: true, report: newReport };
  } catch (error) {
    console.error('Failed to submit score report:', error);
    return { success: false, error: 'Failed to submit score report' };
  }
}

export async function verifyScoreReport(reportId: string, action: 'APPROVE' | 'REJECT') {
  try {
    const report = await prisma.scoreReport.findUnique({
      where: { id: reportId },
      include: { match: true }
    });

    if (!report) return { success: false, error: 'Report not found' };

    const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    
    await prisma.scoreReport.update({
      where: { id: reportId },
      data: { status }
    });

    if (action === 'APPROVE' && report.match) {
      const match = report.match;
      const winnerId = report.team1Score > report.team2Score ? match.team1Id : match.team2Id;

      await prisma.match.update({
        where: { id: match.id },
        data: {
          score1: report.team1Score,
          score2: report.team2Score,
          queenStrikes1: report.queenStrikes1,
          queenStrikes2: report.queenStrikes2,
          status: 'COMPLETED',
          winnerId: winnerId,
        }
      });

      // If this was a playoff / qualifier / finals match, check if all matches for the stage are complete
      if (['QUALIFIER_1', 'QUALIFIER_2', 'QUALIFIER_3', 'QUALIFIER_4', 'SEMI_FINAL', 'GRAND_FINAL', 'THIRD_PLACE'].includes(match.stage || '')) {
        try {
          const pendingMatchesOnStage = await prisma.match.count({
            where: {
              editionId: match.editionId,
              stage: match.stage,
              id: { not: match.id },
              status: { not: 'COMPLETED' },
            },
          });
          if (pendingMatchesOnStage === 0) {
            console.log(`[verifyScoreReport] All matches for stage ${match.stage} are completed. Dispatching automated report email...`);
            await sendFinalStandingsEmail({
              editionId: match.editionId,
              triggerReason: match.stage === 'GRAND_FINAL' ? 'FINALS_END' : 'QUALIFIER_END',
              dayNumber: match.round,
            });
          }
        } catch (mailErr) {
          console.error('[verifyScoreReport] Error sending automated report email:', mailErr);
        }
      }
    }

    revalidatePath('/dashboard/organizer');
    revalidatePath('/fixtures');
    
    return { success: true, report: { ...report, status } };
  } catch (error) {
    console.error('Failed to verify score report:', error);
    return { success: false, error: 'Failed to verify score report' };
  }
}
