import { prisma } from '@/lib/prisma';
import { sendPushNotifications, PushNotificationPayload } from '@/lib/push-notifications';
import { currentCombiDayNumber } from '@/lib/combi-cutoff';
import { resolveCurrentEdition } from '@/lib/current-edition';
import { stageConfigKey } from '@/lib/tournament-stages';
import { resolveOrganizerPairings } from '@/lib/organizer-schedule';

function ordinalRank(rank: number): string {
  if (rank <= 0) return `${rank}`;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = rank % 100;
  return rank + (s[(v - 20) % 10] || s[v] || s[0]);
}

export interface NotificationDispatchResult {
  success: boolean;
  typeSent: string;
  dayNumber: number;
  editionTitle: string;
  notificationsCount: number;
  message?: string;
  results: { sent: number; failed: number; invalidTokensRemoved: number };
  samplePayloads?: Array<{
    toUserId: string;
    userName: string;
    teamName: string;
    title: string;
    body: string;
    type: string;
  }>;
}

/**
 * Dispatch Push Notifications based on notification type and active tournament day schedule.
 */
export async function dispatchNotifications(
  notificationType: 'golive' | 'score' | 'combi' | 'results' | 'auto',
  overrideDay?: number,
  dryRun: boolean = false,
): Promise<NotificationDispatchResult> {
  // 1. Get live Tournament A edition
  const editionRef = await resolveCurrentEdition();
  const activeEdition = editionRef
    ? await prisma.edition.findUnique({
        where: { id: editionRef.id },
        include: {
          teams: {
            include: {
              members: {
                include: {
                  user: true,
                },
              },
              captain: true,
            },
          },
          matches: {
            include: {
              team1: true,
              team2: true,
              winner: true,
            },
          },
        },
      })
    : null;

  if (!activeEdition) {
    return {
      success: false,
      typeSent: 'none',
      dayNumber: 0,
      editionTitle: 'None',
      notificationsCount: 0,
      message: 'No active live edition found.',
      results: { sent: 0, failed: 0, invalidTokensRemoved: 0 },
    };
  }

  const now = new Date();
  const totalDays = activeEdition.totalDays || 15;
  const dayNumber =
    overrideDay !== undefined && overrideDay > 0
      ? overrideDay
      : currentCombiDayNumber(totalDays, now, activeEdition.dayDates);

  // If not an override and dayNumber is out of tournament bounds, skip
  if (!overrideDay && (dayNumber < 1 || dayNumber > totalDays)) {
    return {
      success: true,
      typeSent: 'none',
      dayNumber,
      editionTitle: activeEdition.title,
      notificationsCount: 0,
      message: `Tournament is outside active match days (Day ${dayNumber} of ${totalDays}).`,
      results: { sent: 0, failed: 0, invalidTokensRemoved: 0 },
    };
  }

  // Auto-detect type if 'auto' is passed based on IST hour/minute
  let activeType = notificationType;
  if (activeType === 'auto') {
    const istTimeStr = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    const [hStr, mStr] = istTimeStr.split(':');
    const hours = parseInt(hStr, 10);
    const minutes = parseInt(mStr, 10);
    const totalMinutes = hours * 60 + minutes;

    if (totalMinutes >= 21 * 60 + 35) {
      activeType = 'results'; // 9:35 PM IST
    } else if (totalMinutes >= 21 * 60) {
      activeType = 'combi'; // 9:00 - 9:25 PM IST
    } else if (totalMinutes >= 20 * 60) {
      activeType = 'score'; // 8:00 - 8:30 PM IST
    } else {
      activeType = 'golive'; // 4:00 - 7:00 PM IST
    }
  }

  // 2. Fetch push tokens mapped by userId
  const pushTokens = await prisma.userPushToken.findMany({
    select: { userId: true, token: true },
  });

  const tokensByUserId = new Map<string, string[]>();
  for (const pt of pushTokens) {
    const list = tokensByUserId.get(pt.userId) || [];
    list.push(pt.token);
    tokensByUserId.set(pt.userId, list);
  }

  // 3. Resolve today's official pairings from saved Stage Designer Configuration
  const stageSetting = await prisma.systemSetting.findUnique({
    where: { key: stageConfigKey(activeEdition.id) },
  });

  let stages: any[] = [];
  if (stageSetting?.value) {
    try {
      const parsed = JSON.parse(stageSetting.value);
      stages = parsed.stages || [];
    } catch {}
  }

  const allResolvedPairings = resolveOrganizerPairings(stages, activeEdition.teams);
  let todayPairings = allResolvedPairings.filter((p) => Number(p.dayNumber) === Number(dayNumber));

  // Fallback: If no stage designer pairings exist for this day, check prisma.match
  if (!todayPairings.length && activeEdition.matches.length) {
    const directMatches = activeEdition.matches.filter(
      (m) => m.team1Id && m.team2Id && (m.round === dayNumber || m.matchNumber === dayNumber),
    );
    todayPairings = directMatches.map((m) => {
      const t1 = activeEdition.teams.find((t) => t.id === m.team1Id);
      const t2 = activeEdition.teams.find((t) => t.id === m.team2Id);
      return {
        dayNumber,
        team1Id: m.team1Id!,
        team2Id: m.team2Id!,
        team1Name: t1?.name || m.team1?.name || 'Team 1',
        team2Name: t2?.name || m.team2?.name || 'Team 2',
        team1Tag: t1?.tag || undefined,
        team2Tag: t2?.tag || undefined,
        isSpocExhibition: false,
        stageName: m.stage || undefined,
      };
    });
  }

  if (!todayPairings.length) {
    return {
      success: true,
      typeSent: activeType,
      dayNumber,
      editionTitle: activeEdition.title,
      notificationsCount: 0,
      message: `No matches scheduled on Day ${dayNumber} for ${activeEdition.title}.`,
      results: { sent: 0, failed: 0, invalidTokensRemoved: 0 },
    };
  }

  const payloads: PushNotificationPayload[] = [];
  const samplePayloads: Array<{
    toUserId: string;
    userName: string;
    teamName: string;
    title: string;
    body: string;
    type: string;
  }> = [];

  // Helper to add payload for all tokens of a user
  const pushToUser = (
    userId: string,
    userName: string,
    teamName: string,
    title: string,
    body: string,
    data: Record<string, any>,
  ) => {
    const tokens = tokensByUserId.get(userId) || [];
    if (!tokens.length) return;

    if (samplePayloads.length < 15) {
      samplePayloads.push({
        toUserId: userId,
        userName,
        teamName,
        title,
        body,
        type: data.type || activeType,
      });
    }

    for (const token of tokens) {
      payloads.push({
        toToken: token,
        title,
        body,
        data,
      });
    }
  };

  // ----------------------------------------------------
  // TYPE 1: Go Live & Match Reminders (4pm - 7pm IST)
  // ----------------------------------------------------
  if (activeType === 'golive') {
    const playerScores = await prisma.playerDayScore.findMany({
      where: { editionId: activeEdition.id, dayNumber },
      select: { userId: true, score: true },
    });
    const scoredUserIds = new Set(playerScores.map((s) => s.userId));

    for (const pair of todayPairings) {
      const team1 = activeEdition.teams.find((t) => t.id === pair.team1Id);
      const team2 = activeEdition.teams.find((t) => t.id === pair.team2Id);
      if (!team1 || !team2) continue;

      const t1Name = pair.team1Name || team1.name;
      const t2Name = pair.team2Name || team2.name;

      // Team 1 players
      for (const m of team1.members) {
        const alreadyRecorded = scoredUserIds.has(m.userId);
        const name = m.user.name || m.user.username || 'Player';
        const title = alreadyRecorded ? '📹 CBOT Live — Improve Score' : '⚠️ Go Live Required — CBOT';
        const body = alreadyRecorded
          ? `Hi ${name}! Day ${dayNumber} score recorded (${t1Name} vs ${t2Name}). You can optionally go live again to improve your score!`
          : `Hi ${name}! Your Day ${dayNumber} match (${t1Name} vs ${t2Name}) is active. Broadcast your match live or submit score to avoid Walkover!`;

        pushToUser(m.userId, name, t1Name, title, body, {
          type: 'golive',
          dayNumber,
          screen: 'Live',
        });
      }

      // Team 2 players
      for (const m of team2.members) {
        const alreadyRecorded = scoredUserIds.has(m.userId);
        const name = m.user.name || m.user.username || 'Player';
        const title = alreadyRecorded ? '📹 CBOT Live — Improve Score' : '⚠️ Go Live Required — CBOT';
        const body = alreadyRecorded
          ? `Hi ${name}! Day ${dayNumber} score recorded (${t2Name} vs ${t1Name}). You can optionally go live again to improve your score!`
          : `Hi ${name}! Your Day ${dayNumber} match (${t2Name} vs ${t1Name}) is active. Broadcast your match live or submit score to avoid Walkover!`;

        pushToUser(m.userId, name, t2Name, title, body, {
          type: 'golive',
          dayNumber,
          screen: 'Live',
        });
      }
    }
  }

  // ----------------------------------------------------
  // TYPE 2: Score Update Reminders (8pm, 8:30pm IST)
  // ----------------------------------------------------
  else if (activeType === 'score') {
    const playerScores = await prisma.playerDayScore.findMany({
      where: { editionId: activeEdition.id, dayNumber },
      select: { userId: true },
    });
    const scoredUserIds = new Set(playerScores.map((s) => s.userId));

    for (const pair of todayPairings) {
      const team1 = activeEdition.teams.find((t) => t.id === pair.team1Id);
      const team2 = activeEdition.teams.find((t) => t.id === pair.team2Id);
      if (!team1 || !team2) continue;

      const t1Name = pair.team1Name || team1.name;
      const t2Name = pair.team2Name || team2.name;

      const processUnscored = (team: typeof team1, myName: string, oppName: string) => {
        for (const m of team.members) {
          if (scoredUserIds.has(m.userId)) continue;
          const name = m.user.name || m.user.username || 'Player';
          pushToUser(
            m.userId,
            name,
            myName,
            '📝 Score Update Reminder — CBOT',
            `Hi ${name}! Don't forget to submit your Day ${dayNumber} match score (${myName} vs ${oppName}) before the 9:00 PM cutoff!`,
            { type: 'score', dayNumber, screen: 'Main' },
          );
        }
      };

      processUnscored(team1, t1Name, t2Name);
      processUnscored(team2, t2Name, t1Name);
    }
  }

  // ----------------------------------------------------
  // TYPE 3: Captain Combi Submission Reminders (9:00pm - 9:25pm IST)
  // ----------------------------------------------------
  else if (activeType === 'combi') {
    for (const pair of todayPairings) {
      const team1 = activeEdition.teams.find((t) => t.id === pair.team1Id);
      const team2 = activeEdition.teams.find((t) => t.id === pair.team2Id);
      if (!team1 || !team2) continue;

      const t1Name = pair.team1Name || team1.name;
      const t2Name = pair.team2Name || team2.name;

      // Find the match for this pairing
      const match = activeEdition.matches.find(
        (m) =>
          (m.team1Id === team1.id && m.team2Id === team2.id) ||
          (m.team1Id === team2.id && m.team2Id === team1.id),
      );

      const notifyCaptainIfMissing = async (team: typeof team1, myName: string, oppName: string) => {
        if (!team.captainId) return;

        let submitted = false;
        if (match) {
          const lineup = await prisma.matchLineup.findUnique({
            where: { matchId_teamId: { matchId: match.id, teamId: team.id } },
          });
          submitted = lineup?.status === 'SUBMITTED';
        }

        if (!submitted) {
          const captainName = team.captain?.name || team.captain?.username || 'Captain';
          pushToUser(
            team.captainId,
            captainName,
            myName,
            '⚡ Combi Submission Warning — CBOT',
            `Captain ${captainName}! Submit ${myName}'s Day ${dayNumber} combi vs ${oppName} before the 9:30 PM lock cutoff!`,
            { type: 'combi', dayNumber, screen: 'Main' },
          );
        }
      };

      await notifyCaptainIfMissing(team1, t1Name, t2Name);
      await notifyCaptainIfMissing(team2, t2Name, t1Name);
    }
  }

  // ----------------------------------------------------
  // TYPE 4: Match Results & Standings (9:35pm IST)
  // ----------------------------------------------------
  else if (activeType === 'results') {
    const teamRanks = new Map<string, number>();
    try {
      const standings = await prisma.leagueStanding.findMany({
        where: { editionId: activeEdition.id },
        orderBy: { rank: 'asc' },
      });
      for (const s of standings) {
        teamRanks.set(s.teamId, s.rank);
      }
    } catch {}

    const playerScores = await prisma.playerDayScore.findMany({
      where: { editionId: activeEdition.id, dayNumber },
    });
    const scoreMap = new Map(playerScores.map((s) => [s.userId, s.score]));

    for (const pair of todayPairings) {
      const team1 = activeEdition.teams.find((t) => t.id === pair.team1Id);
      const team2 = activeEdition.teams.find((t) => t.id === pair.team2Id);
      if (!team1 || !team2) continue;

      const t1Name = pair.team1Name || team1.name;
      const t2Name = pair.team2Name || team2.name;

      const team1RankStr = ordinalRank(teamRanks.get(team1.id) || 1);
      const team2RankStr = ordinalRank(teamRanks.get(team2.id) || 2);

      // Check official match winner if completed
      const match = activeEdition.matches.find(
        (m) =>
          (m.team1Id === team1.id && m.team2Id === team2.id) ||
          (m.team1Id === team2.id && m.team2Id === team1.id),
      );

      let team1Won = false;
      let team2Won = false;

      if (match?.winnerId) {
        team1Won = match.winnerId === team1.id;
        team2Won = match.winnerId === team2.id;
      } else {
        const team1ScoreSum = team1.members.reduce((acc, m) => acc + (scoreMap.get(m.userId) || 0), 0);
        const team2ScoreSum = team2.members.reduce((acc, m) => acc + (scoreMap.get(m.userId) || 0), 0);
        team1Won = team1ScoreSum >= team2ScoreSum;
        team2Won = team2ScoreSum > team1ScoreSum;
      }

      const processPlayerResult = (
        team: typeof team1,
        myName: string,
        oppName: string,
        opp: typeof team2,
        wonMatch: boolean,
        rankStr: string,
      ) => {
        for (const m of team.members) {
          const pScore = scoreMap.get(m.userId) || 0;
          const oppScores = opp.members.map((om) => scoreMap.get(om.userId) || 0);
          const avgOppScore = oppScores.length
            ? oppScores.reduce((a, b) => a + b, 0) / oppScores.length
            : 0;
          const playerWon = pScore >= avgOppScore && pScore > 0;
          const name = m.user.name || m.user.username || 'Player';

          let title = '🎯 Match Results — CBOT';
          let body = '';

          if (playerWon && wonMatch) {
            title = '🎉 Double Victory! — CBOT';
            body = `Double Victory ${name}! You won your match (${pScore}) and ${myName} defeated ${oppName}! ${myName} is now ${rankStr} on the Leaderboard! 🏆`;
          } else if (playerWon && !wonMatch) {
            title = '🌟 Great Performance! — CBOT';
            body = `Great effort ${name}! 🌟 You won your match (${pScore}), but ${myName} fell to ${oppName}. ${myName} is currently ${rankStr} on the Leaderboard!`;
          } else if (!playerWon && wonMatch) {
            title = '🏆 Team Victory! — CBOT';
            body = `Team Victory ${name}! 🏆 ${myName} defeated ${oppName}! ${myName} is in ${rankStr} place on the Leaderboard!`;
          } else {
            title = '💪 Keep Pushing! — CBOT';
            body = `Tough match today ${name}. ${myName} fell to ${oppName}. ${myName} is currently in ${rankStr} place. Bounce back stronger tomorrow!`;
          }

          pushToUser(m.userId, name, myName, title, body, {
            type: 'results',
            dayNumber,
            screen: 'Main',
          });
        }
      };

      processPlayerResult(team1, t1Name, t2Name, team2, team1Won, team1RankStr);
      processPlayerResult(team2, t2Name, t1Name, team1, team2Won, team2RankStr);
    }
  }

  if (dryRun) {
    return {
      success: true,
      typeSent: activeType,
      dayNumber,
      editionTitle: activeEdition.title,
      notificationsCount: payloads.length,
      message: `[Preview] Generated ${payloads.length} notification(s) for Day ${dayNumber} (${activeType}).`,
      results: { sent: 0, failed: 0, invalidTokensRemoved: 0 },
      samplePayloads,
    };
  }

  // 4. Send all constructed push notifications via Expo
  const sendResults = await sendPushNotifications(payloads);

  return {
    success: true,
    typeSent: activeType,
    dayNumber,
    editionTitle: activeEdition.title,
    notificationsCount: payloads.length,
    message: `Dispatched ${payloads.length} notification(s) for Day ${dayNumber} (${activeType}).`,
    results: sendResults,
    samplePayloads,
  };
}
