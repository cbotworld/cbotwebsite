import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import PlayerMatchLiveClient from './LiveClient';

export const revalidate = 0;

export default async function PlayerMatchLivePage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login?callbackUrl=/dashboard/player');
  }

  const sessionUser = session.user as any;
  const userId = sessionUser.id;
  const userName = sessionUser.name || sessionUser.username || 'Player';

  // Fetch the match with both teams fully populated
  const match = await prisma.match.findUnique({
    where: { id: matchId },

    include: {
      edition: true,
      team1: {
        include: {
          captain: true,
          members: { include: { user: true } },
        },
      },
      team2: {
        include: {
          captain: true,
          members: { include: { user: true } },
        },
      },
    },
  });

  // If no match found, try to find today's match for this player's team
  let resolvedMatch = match;
  if (!resolvedMatch) {
    // Find the active edition
    const activeEdition = await prisma.edition.findFirst({ orderBy: { number: 'desc' } });

    // Find which team this player is on
    const editionParticipant = activeEdition ? await prisma.editionParticipant.findFirst({
      where: { userId, editionId: activeEdition.id },
    }) : null;

    if (editionParticipant?.teamId) {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart.getTime() + 86400000);

      // Try today's match first, then next scheduled
      resolvedMatch = await prisma.match.findFirst({
        where: {
          OR: [
            { team1Id: editionParticipant.teamId },
            { team2Id: editionParticipant.teamId },
          ],
          status: { in: ['SCHEDULED', 'LIVE'] },
          scheduledTime: { gte: todayStart, lt: todayEnd },
        },
        include: {
          edition: true,
          team1: { include: { captain: true, members: { include: { user: true } } } },
          team2: { include: { captain: true, members: { include: { user: true } } } },
        },
        orderBy: { scheduledTime: 'asc' },
      }) as any;

      // Fallback: next upcoming match
      if (!resolvedMatch) {
        resolvedMatch = await prisma.match.findFirst({
          where: {
            OR: [
              { team1Id: editionParticipant.teamId },
              { team2Id: editionParticipant.teamId },
            ],
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
          include: {
            edition: true,
            team1: { include: { captain: true, members: { include: { user: true } } } },
            team2: { include: { captain: true, members: { include: { user: true } } } },
          },
          orderBy: { scheduledTime: 'asc' },
        }) as any;
      }
    }
  }

  // Fallback to official Edition #200 Monument Schedule if DB match is not created yet
  if (!resolvedMatch) {
    const activeEdition = await prisma.edition.findFirst({ orderBy: { number: 'desc' } });
    const participant = await prisma.editionParticipant.findFirst({
      where: { userId, editionId: activeEdition?.id },
      include: { team: true }
    });

    const playerTeamName = participant?.team?.name || 'Ebony Overlords';
    const playerTeamLogo = participant?.team?.logo || 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/ebony-overlords.jpeg';
    const teamUpper = playerTeamName.toUpperCase().trim();

    const teamLogos: Record<string, string> = {
      'PLYWOOD PIONEERS': 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/plywood-pioneers.jpeg',
      'SUPERNOVA QUEEN': 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/supernova-queen.jpeg',
      'POCKET DYNAMOS': 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/pocket-dynamos.jpeg',
      'LUMEN PILLAR': 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/lumen-pillar.jpeg',
      'VANILLA FALCONS': 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/vanilla-falcons.jpeg',
      'VINTAGE STRIKERS': 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/vintage-strikers.jpeg',
      'EBONY OVERLORDS': 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/ebony-overlords.jpeg',
      'BORIC SPEEDSTERS': 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/boric-speedsters.jpeg',
    };

    // Monument 4 (today's active day) fixtures
    const monument4Fixtures = [
      { t1: 'PLYWOOD PIONEERS', t2: 'VANILLA FALCONS' },
      { t1: 'EBONY OVERLORDS', t2: 'POCKET DYNAMOS' },
      { t1: 'BORIC SPEEDSTERS', t2: 'SUPERNOVA QUEEN' },
      { t1: 'VINTAGE STRIKERS', t2: 'LUMEN PILLAR' },
    ];

    const fix = monument4Fixtures.find(
      (f) => f.t1.toUpperCase() === teamUpper || f.t2.toUpperCase() === teamUpper
    ) || { t1: playerTeamName, t2: 'POCKET DYNAMOS' };

    const isT1 = fix.t1.toUpperCase() === teamUpper;
    const oppName = isT1 ? fix.t2 : fix.t1;
    const oppLogo = teamLogos[oppName.toUpperCase()] || null;

    const matchDetails = {
      matchId: matchId || `monument_4_${teamUpper.replace(/\s+/g, '_')}`,
      editionTitle: 'Edition #200',
      editionNumber: 200,
      playerName: userName,
      teamName: playerTeamName,
      teamLogo: playerTeamLogo,
      opponentName: oppName,
      opponentLogo: oppLogo,
      scheduledTime: '2026-08-12T20:00:00+05:30',
      tableNumber: 1,
      status: 'LIVE',
    };

    return <PlayerMatchLiveClient matchDetails={matchDetails} />;
  }

  // Determine which team the logged-in player belongs to
  const isTeam1Member =
    resolvedMatch.team1?.members?.some((m: any) => m.userId === userId) ||
    resolvedMatch.team1?.captainId === userId;

  const myTeam = isTeam1Member ? resolvedMatch.team1 : resolvedMatch.team2;
  const oppTeam = isTeam1Member ? resolvedMatch.team2 : resolvedMatch.team1;

  const matchDetails = {
    matchId: resolvedMatch.id,
    editionTitle: resolvedMatch.edition?.title || `Edition #${resolvedMatch.edition?.number || 200}`,
    editionNumber: resolvedMatch.edition?.number || 200,
    playerName: userName,
    teamName: myTeam?.name || 'My Team',
    teamLogo: myTeam?.logo || null,
    opponentName: oppTeam?.name || 'Opponent',
    opponentLogo: oppTeam?.logo || null,
    scheduledTime: resolvedMatch.scheduledTime?.toISOString() || null,
    tableNumber: (resolvedMatch as any).tableNumber || 1,
    status: resolvedMatch.status,
  };

  return <PlayerMatchLiveClient matchDetails={matchDetails} />;
}
