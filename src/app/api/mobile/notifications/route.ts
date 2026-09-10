import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCurrentEdition } from '@/lib/current-edition';
import { currentCombiDayNumber } from '@/lib/combi-cutoff';
import { userFromBearer } from '@/lib/mobile-session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    const notifications: Array<{
      id: string;
      title: string;
      body: string;
      type: string;
      createdAt: string;
    }> = [];

    // 1. Current Edition Info & Match Alerts
    const editionRef = await resolveCurrentEdition();
    if (editionRef) {
      const edition = await prisma.edition.findUnique({
        where: { id: editionRef.id },
        include: {
          teams: {
            include: {
              members: { include: { user: true } },
            },
          },
        },
      });

      if (edition) {
        const now = new Date();
        const dayNumber = currentCombiDayNumber(
          edition.totalDays || 15,
          now,
          edition.dayDates,
        );

        // Welcome / Active Edition Announcement
        notifications.push({
          id: `edition-${edition.id}-welcome`,
          title: `🏆 ${edition.title || 'CBOT Edition'} is Active`,
          body: `Welcome to ${edition.title || 'CBOT World'}. Follow daily matches, submit scores by 9:00 PM IST, and track live standings.`,
          type: 'ANNOUNCEMENT',
          createdAt: edition.createdAt.toISOString(),
        });

        // Day Status Alert
        if (dayNumber > 0 && dayNumber <= (edition.totalDays || 15)) {
          notifications.push({
            id: `edition-${edition.id}-day-${dayNumber}`,
            title: `⚔️ Tournament Day ${dayNumber} is In Progress`,
            body: `Day ${dayNumber} matches are open. Broadcast your match live on YouTube or submit your match scores before the 9:00 PM IST cutoff.`,
            type: 'MATCH',
            createdAt: now.toISOString(),
          });

          // Combi Lineup Alert
          notifications.push({
            id: `edition-${edition.id}-combi-${dayNumber}`,
            title: `📋 Day ${dayNumber} Combi Lineups Released`,
            body: `Daily combi lineups for Day ${dayNumber} are now available. Check the Combis tab to view your assigned event and opponents.`,
            type: 'COMBI',
            createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
          });
        }
      }
    }

    // 2. Practice Live Announcement
    notifications.push({
      id: 'practice-live-feature',
      title: '🔴 Free Practice Live Streaming Available',
      body: 'You can now go live anytime directly from your Profile page to practice shots and test your camera setup, even without a tournament team assignment!',
      type: 'BROADCAST',
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        ok: true,
        notifications,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Key',
        },
      },
    );
  } catch (error: any) {
    console.error('Error fetching mobile notifications:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to load notifications' },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Key',
    },
  });
}
