import { prisma } from '@/lib/prisma';
import { sendPushNotifications, PushNotificationPayload } from '@/lib/push-notifications';
import { currentCombiDayNumber } from '@/lib/combi-cutoff';
import { rankStandingRows } from '@/lib/team-standings';

function ordinalRank(rank: number): string {
  if (rank <= 0) return `${rank}`;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = rank % 100;
  return rank + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Dispatch Push Notifications based on notification type and active tournament day.
 */
export async function dispatchNotifications(
  notificationType: 'golive' | 'score' | 'combi' | 'results' | 'auto',
  overrideDay?: number,
): Promise<{
  success: boolean;
  typeSent: string;
  dayNumber: number;
  notificationsCount: number;
  results: { sent: number; failed: number; invalidTokensRemoved: number };
}> {
  // 1. Get active edition
  const activeEdition = await prisma.edition.findFirst({
    orderBy: { number: 'desc' },
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
      matches: true,
    },
  });

  if (!activeEdition) {
    return {
      success: false,
      typeSent: 'none',
      dayNumber: 0,
      notificationsCount: 0,
      results: { sent: 0, failed: 0, invalidTokensRemoved: 0 },
    };
  }

  const now = new Date();
  const dayNumber =
    overrideDay ||
    currentCombiDayNumber(activeEdition.totalDays || 15, now, activeEdition.dayDates);

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

  // 3. Resolve today's pairings/schedule from activeEdition matches
  let pairings = activeEdition.matches
    .filter((m) => m.team1Id && m.team2Id && (m.round === dayNumber || m.matchNumber === dayNumber))
    .map((m) => ({ team1Id: m.team1Id!, team2Id: m.team2Id! }));

  if (!pairings.length && activeEdition.teams.length >= 2) {
    for (let i = 0; i < activeEdition.teams.length; i += 2) {
      if (activeEdition.teams[i + 1]) {
        pairings.push({
          team1Id: activeEdition.teams[i].id,
          team2Id: activeEdition.teams[i + 1].id,
        });
      }
    }
  }

  const payloads: PushNotificationPayload[] = [];

  if (activeType === 'golive') {
    // ----------------------------------------------------
    // TYPE 1: Go Live & Play Again Reminders (4pm, 6pm, 7pm IST)
    // ----------------------------------------------------
    const playerScores = await prisma.playerDayScore.findMany({
      where: { editionId: activeEdition.id, dayNumber },
      select: { userId: true, score: true },
    });
    const scoredUserIds = new Set(playerScores.map((s) => s.userId));

    for (const pair of pairings) {
      const team1 = activeEdition.teams.find((t) => t.id === pair.team1Id);
      const team2 = activeEdition.teams.find((t) => t.id === pair.team2Id);
      if (!team1 || !team2) continue;

      // Process Team 1 players
      for (const m of team1.members) {
        const tokens = tokensByUserId.get(m.userId) || [];
        if (!tokens.length) continue;

        const alreadyRecorded = scoredUserIds.has(m.userId);
        const name = m.user.name || m.user.username || 'Player';
        const title = alreadyRecorded ? '📹 CBOT Live — Improve Score' : '⚠️ Go Live Required — CBOT';
        const body = alreadyRecorded
          ? `Hi ${name}! Day ${dayNumber} score recorded (${team1.name} vs ${team2.name}). You can optionally go live again to improve your score!`
          : `Hi ${name}! Your Day ${dayNumber} match (${team1.name} vs ${team2.name}) is active. Go live or enter score to avoid Walkover!`;

        for (const token of tokens) {
          payloads.push({
            toToken: token,
            title,
            body,
            data: { type: 'golive', dayNumber, screen: 'Live' },
          });
        }
      }

      // Process Team 2 players
      for (const m of team2.members) {
        const tokens = tokensByUserId.get(m.userId) || [];
        if (!tokens.length) continue;

        const alreadyRecorded = scoredUserIds.has(m.userId);
        const name = m.user.name || m.user.username || 'Player';
        const title = alreadyRecorded ? '📹 CBOT Live — Improve Score' : '⚠️ Go Live Required — CBOT';
        const body = alreadyRecorded
          ? `Hi ${name}! Day ${dayNumber} score recorded (${team2.name} vs ${team1.name}). You can optionally go live again to improve your score!`
          : `Hi ${name}! Your Day ${dayNumber} match (${team2.name} vs ${team1.name}) is active. Go live or enter score to avoid Walkover!`;

        for (const token of tokens) {
          payloads.push({
            toToken: token,
            title,
            body,
            data: { type: 'golive', dayNumber, screen: 'Live' },
          });
        }
      }
    }
  } else if (activeType === 'score') {
    // ----------------------------------------------------
    // TYPE 2: Score Update Reminders (8pm, 8:30pm IST)
    // ----------------------------------------------------
    const playerScores = await prisma.playerDayScore.findMany({
      where: { editionId: activeEdition.id, dayNumber },
      select: { userId: true },
    });
    const scoredUserIds = new Set(playerScores.map((s) => s.userId));

    for (const pair of pairings) {
      const team1 = activeEdition.teams.find((t) => t.id === pair.team1Id);
      const team2 = activeEdition.teams.find((t) => t.id === pair.team2Id);
      if (!team1 || !team2) continue;

      const processUnscored = (team: typeof team1, opp: typeof team2) => {
        for (const m of team.members) {
          if (scoredUserIds.has(m.userId)) continue;
          const tokens = tokensByUserId.get(m.userId) || [];
          if (!tokens.length) continue;

          const name = m.user.name || m.user.username || 'Player';
          for (const token of tokens) {
            payloads.push({
              toToken: token,
              title: '📝 Score Update Reminder — CBOT',
              body: `Hi ${name}! Don't forget to submit your Day ${dayNumber} match score (${team.name} vs ${opp.name}) before the deadline!`,
              data: { type: 'score', dayNumber, screen: 'Main' },
            });
          }
        }
      };

      processUnscored(team1, team2);
      processUnscored(team2, team1);
    }
  } else if (activeType === 'combi') {
    // ----------------------------------------------------
    // TYPE 3: Captain Combi Submission Reminders (9pm, 9:10, 9:20, 9:25pm IST)
    // ----------------------------------------------------
    // Find matches for today and check if lineup is submitted
    for (const pair of pairings) {
      const team1 = activeEdition.teams.find((t) => t.id === pair.team1Id);
      const team2 = activeEdition.teams.find((t) => t.id === pair.team2Id);
      if (!team1 || !team2) continue;

      const notifyCaptainIfMissing = async (team: typeof team1, opp: typeof team2) => {
        if (!team.captainId) return;
        const tokens = tokensByUserId.get(team.captainId) || [];
        if (!tokens.length) return;

        // Check if combi is submitted
        const match = activeEdition.matches.find(
          (m) =>
            (m.team1Id === team.id && m.team2Id === opp.id) ||
            (m.team1Id === opp.id && m.team2Id === team.id),
        );
        let submitted = false;
        if (match) {
          const lineup = await prisma.matchLineup.findUnique({
            where: { matchId_teamId: { matchId: match.id, teamId: team.id } },
          });
          submitted = lineup?.status === 'SUBMITTED';
        }

        if (!submitted) {
          const captainName = team.captain?.name || team.captain?.username || 'Captain';
          for (const token of tokens) {
            payloads.push({
              toToken: token,
              title: '⚡ Combi Submission Warning — CBOT',
              body: `Captain ${captainName}! Submit ${team.name}'s Day ${dayNumber} combi vs ${opp.name} before 9:30 PM lock cutoff!`,
              data: { type: 'combi', dayNumber, screen: 'Main' },
            });
          }
        }
      };

      await notifyCaptainIfMissing(team1, team2);
      await notifyCaptainIfMissing(team2, team1);
    }
  } else if (activeType === 'results') {
    // ----------------------------------------------------
    // TYPE 4: Match Result Celebrations & Leaderboard Standings (9:35pm IST)
    // ----------------------------------------------------
    // Build rankings/standings
    let teamRanks = new Map<string, number>();
    try {
      const standings = await prisma.leagueStanding.findMany({
        where: { editionId: activeEdition.id },
        orderBy: { rank: 'asc' },
      });
      for (const s of standings) {
        teamRanks.set(s.teamId, s.rank);
      }
    } catch {
      // Fallback
    }

    const playerScores = await prisma.playerDayScore.findMany({
      where: { editionId: activeEdition.id, dayNumber },
    });
    const scoreMap = new Map(playerScores.map((s) => [s.userId, s.score]));

    for (const pair of pairings) {
      const team1 = activeEdition.teams.find((t) => t.id === pair.team1Id);
      const team2 = activeEdition.teams.find((t) => t.id === pair.team2Id);
      if (!team1 || !team2) continue;

      const team1Rank = ordinalRank(teamRanks.get(team1.id) || 1);
      const team2Rank = ordinalRank(teamRanks.get(team2.id) || 2);

      // Compare team overall scores
      const team1ScoreSum = team1.members.reduce((acc, m) => acc + (scoreMap.get(m.userId) || 0), 0);
      const team2ScoreSum = team2.members.reduce((acc, m) => acc + (scoreMap.get(m.userId) || 0), 0);
      const team1Won = team1ScoreSum >= team2ScoreSum;
      const team2Won = team2ScoreSum >= team1ScoreSum;

      const processPlayerResult = (
        team: typeof team1,
        opp: typeof team2,
        teamWon: boolean,
        teamRankStr: string,
      ) => {
        for (const m of team.members) {
          const tokens = tokensByUserId.get(m.userId) || [];
          if (!tokens.length) continue;

          const pScore = scoreMap.get(m.userId) || 0;
          const oppScores = opp.members.map((om) => scoreMap.get(om.userId) || 0);
          const avgOppScore = oppScores.length
            ? oppScores.reduce((a, b) => a + b, 0) / oppScores.length
            : 0;
          const playerWon = pScore >= avgOppScore && pScore > 0;

          const name = m.user.name || m.user.username || 'Player';
          let title = '🎯 Match Results — CBOT';
          let body = '';

          if (playerWon && teamWon) {
            // (b) Player WON event, Team WON match
            title = '🎉 Double Victory! — CBOT';
            body = `Double Victory ${name}! You won your match (${pScore}) and ${team.name} defeated ${opp.name}! ${team.name} is now ${teamRankStr} on the Leaderboard! 🏆`;
          } else if (playerWon && !teamWon) {
            // (a) Player WON event, Team LOST match
            title = '🌟 Great Performance! — CBOT';
            body = `Great effort ${name}! 🌟 You won your match (${pScore}), but ${team.name} fell to ${opp.name}. ${team.name} is currently in ${teamRankStr} place on the Leaderboard!`;
          } else if (!playerWon && teamWon) {
            // (d) Player LOST event, Team WON match
            title = '🏆 Team Victory! — CBOT';
            body = `Team Victory ${name}! 🏆 ${team.name} defeated ${opp.name}! ${team.name} is in ${teamRankStr} place on the Leaderboard!`;
          } else {
            // (c) Player LOST event, Team LOST match
            title = '💪 Keep Pushing! — CBOT';
            body = `Tough match today ${name}. 💔 ${team.name} fell to ${opp.name}. ${team.name} is currently in ${teamRankStr} place. Bounce back stronger tomorrow!`;
          }

          for (const token of tokens) {
            payloads.push({
              toToken: token,
              title,
              body,
              data: { type: 'results', dayNumber, screen: 'Main' },
            });
          }
        }
      };

      processPlayerResult(team1, team2, team1Won, team1Rank);
      processPlayerResult(team2, team1, team2Won, team2Rank);
    }
  }

  // 4. Send all constructed push notifications
  const sendResults = await sendPushNotifications(payloads);

  return {
    success: true,
    typeSent: activeType,
    dayNumber,
    notificationsCount: payloads.length,
    results: sendResults,
  };
}
