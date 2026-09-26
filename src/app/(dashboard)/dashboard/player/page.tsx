export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import PlayerClient from './PlayerClient';
import { TEAM_TYPE_SPOC, spocTeamMembersFromTeam } from '@/lib/spoc-teams';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import { resolveCurrentEditionRecord } from '@/lib/current-edition';
import { getMyRegistrationEnrollment } from '@/lib/actions/tournamentSlotActions';
import { gradingSettingKey } from '@/lib/grading';
import { extractGradeAndTargetMaps } from '@/lib/actions/playerScoreActions';


export default async function PlayerPage() {
  const session = await getServerSession(authOptions);

  // If not logged in, redirect to login
  if (!session?.user) {
    redirect('/login?callbackUrl=/dashboard/player');
  }

  const sessionUser = session.user as any;
  const userId = sessionUser.id;
  const username = sessionUser.username;

  // Fetch the LOGGED-IN player's full profile from DB
  const player = await prisma.user.findFirst({
    where: {
      OR: [
        { id: userId },
        { username: username?.toLowerCase() },
      ]
    },
    include: {
      rankingSnapshots: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  });

  // Live Tournament A — same edition used for scores, standings, and mobile.
  let activeEdition = await resolveCurrentEditionRecord();

  const participantInclude = {
    team: {
      include: {
        captain: true,
        members: {
          include: {
            user: true,
          },
        },
      },
    },
  } as const;

  let editionParticipant = player
    ? await prisma.editionParticipant.findFirst({
        where: {
          userId: player.id,
          editionId: activeEdition?.id,
        },
        include: participantInclude,
      })
    : null;

  // Fallback: player team may be on the live cup even when slot tags are stale in DB.
  if (player && !editionParticipant?.team) {
    editionParticipant = await prisma.editionParticipant.findFirst({
      where: { userId: player.id, teamId: { not: null } },
      include: participantInclude,
      orderBy: { edition: { number: 'desc' } },
    });
    if (editionParticipant?.editionId && editionParticipant.editionId !== activeEdition?.id) {
      activeEdition = await prisma.edition.findUnique({ where: { id: editionParticipant.editionId } });
    }
  }

  const team = editionParticipant?.team || null;
  const teammates = team?.members?.map((m: any) => m.user) || [];

  const [spocMembership, spocCaptainTeam] = player
    ? await Promise.all([
        prisma.spocTeamMember.findFirst({
          where: { userId: player.id, editionId: activeEdition?.id },
          include: {
            team: {
              include: {
                captain: true,
                members: { include: { user: true } },
                spocMembers: { include: { user: true } },
              },
            },
          },
        }),
        prisma.team.findFirst({
          where: {
            captainId: player.id,
            teamType: TEAM_TYPE_SPOC,
            ...(activeEdition?.id ? { editionId: activeEdition.id } : {}),
          },
          include: {
            captain: true,
            members: { include: { user: true } },
            spocMembers: { include: { user: true } },
          },
        }),
      ])
    : [null, null];

  const spocTeam = spocCaptainTeam || spocMembership?.team || null;
  const spocMembers = spocTeam ? spocTeamMembersFromTeam(spocTeam) : [];
  const hasSpocCaptainDesk = Boolean(spocCaptainTeam);

  const matches = team ? await prisma.match.findMany({
    where: {
      OR: [
        { team1Id: team.id },
        { team2Id: team.id }
      ]
    },
    include: {
      team1: true,
      team2: true
    },
    orderBy: { scheduledTime: 'asc' }
  }) : [];

  const patterns = await prisma.boardPattern.findMany({ take: 5 });

  const websiteCms = await getWebsiteCmsContent();
  let registrationEnrollment: any = null;
  try {
    const enrollmentRes = await getMyRegistrationEnrollment(player?.id || userId);
    if (enrollmentRes?.success && enrollmentRes?.enrollment?.edition) {
      registrationEnrollment = {
        ...enrollmentRes.enrollment,
        enrolledAt: enrollmentRes.enrollment.enrolledAt
          ? (typeof enrollmentRes.enrollment.enrolledAt === 'string'
              ? enrollmentRes.enrollment.enrolledAt
              : enrollmentRes.enrollment.enrolledAt instanceof Date && !isNaN(enrollmentRes.enrollment.enrolledAt.getTime())
                ? enrollmentRes.enrollment.enrolledAt.toISOString()
                : String(enrollmentRes.enrollment.enrolledAt))
          : null,
      };
    }
  } catch (err) {
    console.error('[PlayerPage] enrollment fetch error:', err);
    registrationEnrollment = null;
  }

  // All of this player's streams for the edition (includes day-N / schedule_* match ids)
  const liveStreams = player
    ? await prisma.liveStream.findMany({
        where: {
          playerId: player.id,
          ...(activeEdition?.id ? { editionId: activeEdition.id } : {}),
        },
        select: {
          id: true,
          matchId: true,
          status: true,
          createdAt: true,
          recordedAt: true,
          youtubeUrl: true,
          youtubeVideoId: true,
          youtubeEmbedUrl: true,
          match: { select: { round: true, matchNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  let activeTarget = 0;
  let activeGrade = editionParticipant?.category || null;

  if (activeEdition?.id && player?.id) {
    const [gradingSetting, targetLog] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: gradingSettingKey(activeEdition.id) } }),
      prisma.playerTargetLog.findFirst({
        where: { editionId: activeEdition.id, userId: player.id },
        orderBy: { effectiveFrom: 'desc' },
        select: { target: true },
      }),
    ]);
    const { userGradeMap, userTargetMap } = await extractGradeAndTargetMaps(
      gradingSetting,
      editionParticipant ? [editionParticipant] : [],
      targetLog ? [targetLog] : [],
      [],
    );
    activeTarget = userTargetMap.get(player.id) ?? 0;
    if (userGradeMap.has(player.id)) {
      activeGrade = userGradeMap.get(player.id)!;
    }
  }

  return (
    <PlayerClient
      initialPlayer={player ? { ...player, target: activeTarget } : { ...sessionUser, wins: 0, losses: 0, rating: 1200, queenStrikes: 0, boardsWon: 0, target: activeTarget }}
      initialTeam={team}
      initialTeammates={teammates}
      initialMatches={matches as any}
      initialPatterns={patterns as any}
      initialStreams={liveStreams as any}
      initialSpocTeam={spocTeam}
      initialSpocMembers={spocMembers}
      hasSpocCaptainDesk={hasSpocCaptainDesk}
      initialEditionGrade={activeGrade}
      registrationEnrollment={registrationEnrollment}
      currentEditionInfo={activeEdition ? {
        id: activeEdition.id,
        title: activeEdition.title,
        number: activeEdition.number,
        status: activeEdition.status,
      } : null}
      shortName={websiteCms.site.shortName}
      editionLabel={websiteCms.site.editionLabel}
    />
  );
}
