import { prisma } from '@/lib/prisma';
import { sendPushNotifications, PushNotificationPayload } from '@/lib/push-notifications';
import { currentCombiDayNumber } from '@/lib/combi-cutoff';
import { resolveCurrentEdition } from '@/lib/current-edition';
import { stageConfigKey } from '@/lib/tournament-stages';
import { resolveOrganizerPairings } from '@/lib/organizer-schedule';
import { getPublicStandings } from '@/lib/actions/playerScoreActions';
import { scoreMatchDay } from '@/lib/combi-results';
import { resolveEffectiveTeamCombi } from '@/lib/combi-fallback';
import { sendFinalStandingsEmail } from '@/lib/tournament-report-email';

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

export interface NotificationSlotDefinition {
  key: string;
  type: 'golive' | 'score' | 'combi' | 'results';
  name: string;
  timeWindowIst: string;
  startMinutes: number;
  endMinutes: number;
  description: string;
}

export const DAILY_NOTIFICATION_SLOTS: NotificationSlotDefinition[] = [
  {
    key: 'golive_4pm',
    type: 'golive',
    name: 'Match Start & Go Live Alert',
    timeWindowIst: '4:00 PM – 6:59 PM',
    startMinutes: 15 * 60, // 3:00 PM / 4:00 PM
    endMinutes: 19 * 60 - 1, // 6:59 PM
    description: 'Alerts players with their opponent for today to broadcast live or record score before 8:00 PM.',
  },
  {
    key: 'golive_7pm',
    type: 'golive',
    name: 'Evening Match & Go Live Reminder',
    timeWindowIst: '7:00 PM – 7:49 PM',
    startMinutes: 19 * 60, // 7:00 PM
    endMinutes: 19 * 60 + 49, // 7:49 PM
    description: 'Final match broadcast reminder for unscored players before cutoff.',
  },
  {
    key: 'score_8pm',
    type: 'score',
    name: 'Score Cutoff Warning (1h)',
    timeWindowIst: '7:50 PM – 8:39 PM',
    startMinutes: 19 * 60 + 50, // 7:50 PM
    endMinutes: 20 * 60 + 39, // 8:39 PM
    description: 'Warns unscored players to record scores before 9:00 PM to avoid walkover.',
  },
  {
    key: 'score_840pm',
    type: 'score',
    name: 'Score Cutoff Final Warning (20m)',
    timeWindowIst: '8:40 PM – 8:54 PM',
    startMinutes: 20 * 60 + 40, // 8:40 PM
    endMinutes: 20 * 60 + 54, // 8:54 PM
    description: 'Urgent 20-minute score warning before the 9:00 PM lock.',
  },
  {
    key: 'combi_9pm',
    type: 'combi',
    name: 'Captain Combi Warning (30m)',
    timeWindowIst: '8:55 PM – 9:19 PM',
    startMinutes: 20 * 60 + 55, // 8:55 PM
    endMinutes: 21 * 60 + 19, // 9:19 PM
    description: 'Alerts team captains to submit today\'s combi lineup before the 9:30 PM lock.',
  },
  {
    key: 'combi_920pm',
    type: 'combi',
    name: 'Captain Combi Final Warning (10m)',
    timeWindowIst: '9:20 PM – 9:30 PM',
    startMinutes: 21 * 60 + 20, // 9:20 PM
    endMinutes: 21 * 60 + 30, // 9:30 PM
    description: 'Final 10-minute emergency warning for captains with missing combis.',
  },
  {
    key: 'results_935pm',
    type: 'results',
    name: 'Day Results & Standings Reveal',
    timeWindowIst: '9:31 PM – 11:59 PM',
    startMinutes: 21 * 60 + 31, // 9:31 PM
    endMinutes: 23 * 60 + 59, // 11:59 PM
    description: 'Dispatches personalized match results, victory celebrations, and live rank updates.',
  },
];

export function resolveCurrentNotificationSlot(istMinutes: number): {
  slot?: NotificationSlotDefinition;
  type: 'golive' | 'score' | 'combi' | 'results' | 'idle';
} {
  const slot = DAILY_NOTIFICATION_SLOTS.find(
    (s) => istMinutes >= s.startMinutes && istMinutes <= s.endMinutes,
  );
  if (slot) {
    return { slot, type: slot.type };
  }
  return { type: 'idle' };
}

export async function getTodayNotificationSlotsStatus(overrideDay?: number) {
  const editionRef = await resolveCurrentEdition();
  if (!editionRef) return { dayNumber: 0, slots: [] };

  const edition = await prisma.edition.findUnique({
    where: { id: editionRef.id },
    select: { id: true, title: true, totalDays: true, dayDates: true },
  });
  if (!edition) return { dayNumber: 0, slots: [] };

  const now = new Date();
  const dayNumber =
    overrideDay !== undefined && overrideDay > 0
      ? overrideDay
      : currentCombiDayNumber(edition.totalDays || 15, now, edition.dayDates);

  const istTimeStr = now.toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const [hStr, mStr] = istTimeStr.split(':');
  const currentMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);

  // Fetch all slot settings for today
  const slotKeys = DAILY_NOTIFICATION_SLOTS.map(
    (s) => `notif_slot_${edition.id}_d${dayNumber}_${s.key}`,
  );
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: slotKeys } },
  });
  const settingMap = new Map(settings.map((st) => [st.key, st]));

  const slots = DAILY_NOTIFICATION_SLOTS.map((s) => {
    const key = `notif_slot_${edition.id}_d${dayNumber}_${s.key}`;
    const setting = settingMap.get(key);
    let dispatchedAt: string | null = null;
    let sentCount = 0;
    if (setting) {
      try {
        const parsed = JSON.parse(setting.value);
        dispatchedAt = parsed.dispatchedAt || setting.updatedAt.toISOString();
        sentCount = parsed.sent || 0;
      } catch {
        dispatchedAt = setting.updatedAt.toISOString();
      }
    }

    let status: 'SENT' | 'DUE' | 'UPCOMING' | 'PASSED' = 'UPCOMING';
    if (dispatchedAt) {
      status = 'SENT';
    } else if (currentMinutes >= s.startMinutes && currentMinutes <= s.endMinutes) {
      status = 'DUE';
    } else if (currentMinutes > s.endMinutes) {
      status = 'PASSED';
    } else {
      status = 'UPCOMING';
    }

    return {
      key: s.key,
      type: s.type,
      name: s.name,
      timeWindowIst: s.timeWindowIst,
      description: s.description,
      status,
      dispatchedAt,
      sentCount,
    };
  });

  return {
    editionTitle: edition.title,
    dayNumber,
    currentTimeIst: istTimeStr,
    slots,
  };
}

/**
 * Dispatch Push Notifications based on notification type and active tournament day schedule.
 */
export async function dispatchNotifications(
  notificationType: 'golive' | 'score' | 'combi' | 'results' | 'auto',
  overrideDay?: number,
  dryRun: boolean = false,
  force: boolean = false,
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
  let activeType: 'golive' | 'score' | 'combi' | 'results' | 'auto' | 'idle' = notificationType;
  let currentSlotKey = '';
  let slotLabel = '';
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

    const slotInfo = resolveCurrentNotificationSlot(totalMinutes);
    activeType = slotInfo.type as any;
    if (slotInfo.slot) {
      currentSlotKey = slotInfo.slot.key;
      slotLabel = slotInfo.slot.name;
    }

    if (activeType === 'idle') {
      // Outside active broadcast hours (00:00 - 14:59 IST)
      return {
        success: true,
        typeSent: 'idle',
        dayNumber,
        editionTitle: activeEdition.title,
        notificationsCount: 0,
        message: `Currently outside active tournament broadcast hours (${istTimeStr} IST). Push notifications trigger between 3:00 PM and 10:00 PM IST.`,
        results: { sent: 0, failed: 0, invalidTokensRemoved: 0 },
      };
    }
  }

  // Slot Deduplication check: If this slot was already dispatched for today, skip unless forced
  const slotSettingKey = currentSlotKey
    ? `notif_slot_${activeEdition.id}_d${dayNumber}_${currentSlotKey}`
    : undefined;

  if (slotSettingKey && !force && !dryRun) {
    const existing = await prisma.systemSetting.findUnique({
      where: { key: slotSettingKey },
    });
    if (existing) {
      let sentTimestamp = existing.updatedAt.toISOString();
      try {
        const parsed = JSON.parse(existing.value);
        if (parsed.dispatchedAt) sentTimestamp = parsed.dispatchedAt;
      } catch {}
      const istSent = new Date(sentTimestamp).toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
      });
      return {
        success: true,
        typeSent: activeType,
        dayNumber,
        editionTitle: activeEdition.title,
        notificationsCount: 0,
        message: `[AutoSkip] Slot "${slotLabel || currentSlotKey}" already dispatched for Day ${dayNumber} at ${istSent} IST.`,
        results: { sent: 0, failed: 0, invalidTokensRemoved: 0 },
      };
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

    if (samplePayloads.length < 20) {
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
  // TYPE 1: Go Live & Match Reminders (3:00pm - 7:45pm IST)
  // ----------------------------------------------------
  if (activeType === 'golive') {
    const playerScores = await prisma.playerDayScore.findMany({
      where: { editionId: activeEdition.id, dayNumber },
      select: { userId: true, score: true },
    });
    const scoreMap = new Map(playerScores.map((s) => [s.userId, s.score]));

    for (const pair of todayPairings) {
      const team1 = activeEdition.teams.find((t) => t.id === pair.team1Id);
      const team2 = activeEdition.teams.find((t) => t.id === pair.team2Id);
      if (!team1 || !team2) continue;

      const t1Name = pair.team1Name || team1.name;
      const t2Name = pair.team2Name || team2.name;

      const processTeamGoLive = (team: typeof team1, myName: string, oppName: string) => {
        for (const m of team.members) {
          const hasScore = scoreMap.has(m.userId);
          // If score is already updated, do NOT send any notification
          if (hasScore) continue;

          const name = m.user.name || m.user.username || 'Player';
          const title = '⚠️ Go Live Required — CBOT';
          const body = `Hi ${name}! Your Day ${dayNumber} match (${myName} vs ${oppName}) is active. Broadcast your match live or submit score before 8:00 PM to avoid Walkover!`;

          pushToUser(m.userId, name, myName, title, body, {
            type: 'golive',
            dayNumber,
            screen: 'Live',
          });
        }
      };

      processTeamGoLive(team1, t1Name, t2Name);
      processTeamGoLive(team2, t2Name, t1Name);
    }
  }

  // ----------------------------------------------------
  // TYPE 2: Score Update Reminders (7:50pm - 8:54pm IST)
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
            '📝 Score Update Warning — CBOT',
            `Hi ${name}! You haven't submitted your Day ${dayNumber} score for ${myName} vs ${oppName}. Submit now before the 9:00 PM lock cutoff to avoid a Walkover!`,
            { type: 'score', dayNumber, screen: 'Main' },
          );
        }
      };

      processUnscored(team1, t1Name, t2Name);
      processUnscored(team2, t2Name, t1Name);
    }
  }

  // ----------------------------------------------------
  // TYPE 3: Captain Combi Submission Reminders (8:55pm - 9:30pm IST)
  // ----------------------------------------------------
  else if (activeType === 'combi') {
    for (const pair of todayPairings) {
      const team1 = activeEdition.teams.find((t) => t.id === pair.team1Id);
      const team2 = activeEdition.teams.find((t) => t.id === pair.team2Id);
      if (!team1 || !team2) continue;

      const t1Name = pair.team1Name || team1.name;
      const t2Name = pair.team2Name || team2.name;

      const match = activeEdition.matches.find(
        (m) =>
          (m.team1Id === team1.id && m.team2Id === team2.id) ||
          (m.team1Id === team2.id && m.team2Id === team1.id),
      );

      const notifyCaptainIfMissing = async (team: typeof team1, myName: string, oppName: string) => {
        let submitted = false;
        if (match) {
          const lineup = await prisma.matchLineup.findUnique({
            where: { matchId_teamId: { matchId: match.id, teamId: team.id } },
          });
          submitted = lineup?.status === 'SUBMITTED' || lineup?.status === 'LOCKED';
        }

        // Check if team has submitted lineups in savedLineups JSON for today
        if (!submitted && team.savedLineups) {
          try {
            const parsed = JSON.parse(team.savedLineups);
            if (parsed[`day_${dayNumber}`]?.rounds?.length || parsed[String(dayNumber)]?.rounds?.length) {
              submitted = true;
            }
          } catch {}
        }

        if (!submitted) {
          const captainUserIds = new Set<string>();
          if (team.captainId) captainUserIds.add(team.captainId);
          for (const m of team.members) {
            if ((m as any).roleInTeam === 'CAPTAIN' || (m.user as any)?.role === 'CAPTAIN') {
              captainUserIds.add(m.userId);
            }
          }
          if (!captainUserIds.size && team.members[0]) {
            captainUserIds.add(team.members[0].userId);
          }

          for (const capUserId of captainUserIds) {
            const memberObj = team.members.find((m) => m.userId === capUserId);
            const capUser = memberObj?.user || team.captain;
            const captainName = capUser?.name || capUser?.username || 'Captain';
            pushToUser(
              capUserId,
              captainName,
              myName,
              '⚡ Combi Submission Warning — CBOT',
              `Captain ${captainName}! Submit ${myName}'s Day ${dayNumber} combi vs ${oppName} before the 9:30 PM lock cutoff!`,
              { type: 'combi', dayNumber, screen: 'Main' },
            );
          }
        }
      };

      await notifyCaptainIfMissing(team1, t1Name, t2Name);
      await notifyCaptainIfMissing(team2, t2Name, t1Name);
    }
  }

  // ----------------------------------------------------
  // TYPE 4: Match Results & Real-Time Standings (9:31pm - 11:59pm IST)
  // ----------------------------------------------------
  else if (activeType === 'results') {
    // 1. Fetch Official Live Standings from Stage Designer Engine
    const teamRankMap = new Map<string, { rank: number; rankStr: string; totalPoints: number }>();
    try {
      const standingsData = await getPublicStandings(activeEdition.id);
      if (standingsData.blocks && standingsData.blocks.length > 0) {
        // Search across all stage blocks and groups
        for (const block of standingsData.blocks) {
          for (const grp of block.groups || []) {
            for (const row of grp.rows || []) {
              if (row.teamId && row.rank) {
                if (block.current || !teamRankMap.has(row.teamId)) {
                  teamRankMap.set(row.teamId, {
                    rank: row.rank,
                    rankStr: ordinalRank(row.rank),
                    totalPoints: row.total,
                  });
                }
              }
            }
          }
        }
      }
      // If knockouts placement exists
      if (standingsData.placement && standingsData.placement.length > 0) {
        for (const pl of standingsData.placement) {
          if (pl.teamId && pl.place) {
            teamRankMap.set(pl.teamId, {
              rank: pl.place,
              rankStr: ordinalRank(pl.place),
              totalPoints: 0,
            });
          }
        }
      }
    } catch (stErr) {
      console.warn('[NotificationScheduler] Could not load dynamic public standings:', stErr);
    }

    // Fallback: If any teams are unranked in teamRankMap, calculate points from all recorded scores
    const unrankedTeams = activeEdition.teams.filter((t) => !teamRankMap.has(t.id));
    if (unrankedTeams.length > 0) {
      const allScores = await prisma.playerDayScore.findMany({
        where: { editionId: activeEdition.id },
        select: { userId: true, score: true },
      });
      const userScoreMap = new Map<string, number>();
      for (const s of allScores) {
        userScoreMap.set(s.userId, (userScoreMap.get(s.userId) || 0) + s.score);
      }

      const teamTotals = activeEdition.teams.map((t) => {
        let totalScore = 0;
        for (const m of t.members) {
          totalScore += userScoreMap.get(m.userId) || 0;
        }
        return { teamId: t.id, name: t.name, totalScore };
      });

      teamTotals.sort((a, b) => b.totalScore - a.totalScore);
      teamTotals.forEach((tt, idx) => {
        if (!teamRankMap.has(tt.teamId)) {
          teamRankMap.set(tt.teamId, {
            rank: idx + 1,
            rankStr: ordinalRank(idx + 1),
            totalPoints: tt.totalScore,
          });
        }
      });
    }

    // 2. Fetch Day Scores
    const playerScores = await prisma.playerDayScore.findMany({
      where: { editionId: activeEdition.id, dayNumber },
    });
    const dayScoreMap: Record<string, { score: number; slams: number; isWalkover?: boolean }> = {};
    for (const s of playerScores) {
      dayScoreMap[s.userId] = {
        score: s.score,
        slams: s.slams,
        isWalkover: Boolean((s as any).isWalkover),
      };
    }

    // 3. Process each pairing with official Combi Match Scoring Engine
    for (const pair of todayPairings) {
      const team1 = activeEdition.teams.find((t) => t.id === pair.team1Id);
      const team2 = activeEdition.teams.find((t) => t.id === pair.team2Id);
      if (!team1 || !team2) continue;

      const t1Name = pair.team1Name || team1.name;
      const t2Name = pair.team2Name || team2.name;

      // Resolve effective combis (Singles, Doubles, Triples)
      const combi1 = resolveEffectiveTeamCombi({ team: team1 as any, dayNumber });
      const combi2 = resolveEffectiveTeamCombi({ team: team2 as any, dayNumber });

      const matchResult = scoreMatchDay(
        combi1.rounds,
        combi2.rounds,
        team1.members as any,
        team2.members as any,
        dayScoreMap,
      );

      const t1Pts = matchResult.team1EventPts;
      const t2Pts = matchResult.team2EventPts;
      const winner = matchResult.matchWinner; // 1 = Team 1, 2 = Team 2, 0 = Tie

      const t1RankInfo = teamRankMap.get(team1.id);
      const t2RankInfo = teamRankMap.get(team2.id);

      const processPlayerResult = (
        team: typeof team1,
        myName: string,
        oppName: string,
        myPts: number,
        oppPts: number,
        wonTeamMatch: boolean,
        isTieMatch: boolean,
        rankInfo: { rank: number; rankStr: string } | undefined,
        isTeam1: boolean,
      ) => {
        for (const m of team.members) {
          const name = m.user.name || m.user.username || 'Player';
          const pScoreInfo = dayScoreMap[m.userId];
          const pScore = pScoreInfo?.score ?? null;

          // Find specific event(s) played by this player in combi
          const playerEvents = matchResult.events.filter((ev) =>
            isTeam1 ? ev.team1PlayerIds.includes(m.userId) : ev.team2PlayerIds.includes(m.userId),
          );

          let playerWonEvent = false;
          let eventFormat = 'match';
          if (playerEvents.length > 0) {
            const ev = playerEvents[0];
            eventFormat = ev.format || ev.name || 'match';
            playerWonEvent = isTeam1 ? ev.winnerTeam === 1 : ev.winnerTeam === 2;
          } else if (pScore !== null) {
            playerWonEvent = wonTeamMatch;
          }

          let title = '🎯 Match Results — CBOT';
          let body = '';

          const rankPhrase = rankInfo
            ? ` ${myName} is currently ranked ${rankInfo.rankStr} on the Leaderboard!`
            : ' Check the Leaderboard for updated team standings!';
          const firstPlaceTrophy = rankInfo?.rank === 1 ? ' 🏆' : '';

          if (isTieMatch) {
            title = '🤝 Match Tied! — CBOT';
            body = `Hard-fought tie ${name}! ${myName} drew with ${oppName} (${myPts}-${oppPts}).${rankPhrase}`;
          } else if (playerWonEvent && wonTeamMatch) {
            title = '🎉 Double Victory! — CBOT';
            body = `Double Victory ${name}! You won your ${eventFormat} match and ${myName} defeated ${oppName} (${myPts}-${oppPts})!${rankPhrase}${firstPlaceTrophy}`;
          } else if (playerWonEvent && !wonTeamMatch) {
            title = '🌟 Great Effort! — CBOT';
            body = `Great performance ${name}! 🌟 You won your ${eventFormat} match, but ${myName} fell to ${oppName} (${myPts}-${oppPts}).${rankPhrase}`;
          } else if (!playerWonEvent && wonTeamMatch) {
            title = '🏆 Team Victory! — CBOT';
            body = `Team Victory ${name}! 🏆 ${myName} defeated ${oppName} (${myPts}-${oppPts})!${rankPhrase}${firstPlaceTrophy}`;
          } else {
            title = `💪 Day ${dayNumber} Complete — CBOT`;
            body = `Day ${dayNumber} complete ${name}. ${myName} fell to ${oppName} (${myPts}-${oppPts}).${rankPhrase} Bounce back stronger tomorrow!`;
          }

          pushToUser(m.userId, name, myName, title, body, {
            type: 'results',
            dayNumber,
            screen: 'Main',
          });
        }
      };

      processPlayerResult(team1, t1Name, t2Name, t1Pts, t2Pts, winner === 1, winner === 0, t1RankInfo, true);
      processPlayerResult(team2, t2Name, t1Name, t2Pts, t1Pts, winner === 2, winner === 0, t2RankInfo, false);
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

  // Record that this slot was dispatched today to prevent duplicates on repeated cron/heartbeat checks
  if (slotSettingKey && !dryRun && sendResults.sent > 0) {
    try {
      await prisma.systemSetting.upsert({
        where: { key: slotSettingKey },
        create: {
          key: slotSettingKey,
          value: JSON.stringify({
            dispatchedAt: new Date().toISOString(),
            sent: sendResults.sent,
            failed: sendResults.failed,
            type: activeType,
            dayNumber,
          }),
        },
        update: {
          value: JSON.stringify({
            dispatchedAt: new Date().toISOString(),
            sent: sendResults.sent,
            failed: sendResults.failed,
            type: activeType,
            dayNumber,
          }),
          updatedAt: new Date(),
        },
      });
    } catch (saveErr) {
      console.warn('[NotificationScheduler] Failed to save slot dispatch record:', saveErr);
    }
  }

  // 5. Automated Final Standings & Excel Email on Qualifier and Finals Match Days
  if (activeType === 'results' && !dryRun) {
    try {
      const stageSetting = await prisma.systemSetting.findUnique({
        where: { key: stageConfigKey(activeEdition.id) },
      });
      if (stageSetting?.value) {
        const config = JSON.parse(stageSetting.value);
        const stages: any[] = config.stages || [];
        const qualStage = stages.find((s) => s.kind === 'QUALIFIER');
        const finalsStage = stages.find((s) => s.kind === 'FINALS');

        let isQualDay = false;
        let isFinalsDay = false;

        if (qualStage) {
          const start = qualStage.startDay || 0;
          const end = start + (qualStage.durationDays || 1) - 1;
          if (dayNumber >= start && dayNumber <= end) isQualDay = true;
        }

        if (finalsStage) {
          const start = finalsStage.startDay || 0;
          const end = start + (finalsStage.durationDays || 1) - 1;
          if (dayNumber >= start && dayNumber <= end) isFinalsDay = true;
        }

        if (isQualDay || isFinalsDay) {
          console.log(`[NotificationScheduler] Day ${dayNumber} is a ${isFinalsDay ? 'Finals' : 'Qualifier'} match day. Dispatching automated report email to cbotworld@gmail.com...`);
          await sendFinalStandingsEmail({
            editionId: activeEdition.id,
            triggerReason: isFinalsDay ? 'FINALS_END' : 'QUALIFIER_END',
            dayNumber,
          });
        }
      }
    } catch (emailErr) {
      console.error('[NotificationScheduler] Failed to dispatch qualifier/finals report email:', emailErr);
    }
  }

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

let lastHeartbeatTimestamp = 0;

/**
 * Passive self-healing heartbeat.
 * Called opportunistically on high-traffic server API routes during match evening hours.
 * Automatically checks if any scheduled slot is due and dispatches it if not yet sent.
 */
export async function triggerPassiveNotificationHeartbeat() {
  const now = Date.now();
  // Throttle to at most once every 60 seconds per Node process
  if (now - lastHeartbeatTimestamp < 60_000) return;
  lastHeartbeatTimestamp = now;

  try {
    const istTimeStr = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    const [hStr, mStr] = istTimeStr.split(':');
    const currentMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);

    // Only run during active tournament evening broadcast hours (3:00 PM to 11:59 PM IST)
    if (currentMinutes < 15 * 60) return;

    // Run auto-dispatch without force (deduplication skips if slot was already sent)
    await dispatchNotifications('auto', undefined, false, false);
  } catch (err) {
    // Non-blocking catch
    console.warn('[NotificationHeartbeat] Passive check error:', err);
  }
}

