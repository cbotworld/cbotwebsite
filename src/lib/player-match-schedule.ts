import { prisma } from '@/lib/prisma';
import { monumentStatus } from '@/lib/bicentennial-monuments';
import {
  currentPlayDayNumber,
  isDayUnlockedByYoutubeSequence,
  playedDaysForUnlock,
  summarizePlayerDayStreams,
  tournamentPlayWindow,
  unlockPrerequisiteDay,
} from '@/lib/match-play-window';
import { buildOrganizerScheduleDays, calendarDateForDay, addDaysIsoDate, formatDayRange, resolveOrganizerPairings } from '@/lib/organizer-schedule';
import { listCaptainDesks, listPlayerTeams } from '@/lib/mobile-team';
import { resolveTeamFace } from '@/lib/team-identity';
import { stageConfigKey } from '@/lib/tournament-stages';
import { getWebsiteCmsSite } from '@/lib/website-cms-site';
import { isCombiSubmissionLocked } from '@/lib/combi-cutoff';
import { isDayScorePublished } from '@/lib/day-scoring';
import { isSpocExhibitionTeam } from '@/lib/spoc-teams';
import { resolveCurrentEditionRecord, resolvePlayerTournamentOptions, resolveEditionBySlotOrId } from '@/lib/current-edition';
import { resolveEffectiveTeamCombi } from '@/lib/combi-fallback';
import { gradingSettingKey, parseGradingGrid, computePlayerGradeUpdates } from '@/lib/grading';
import {
  parseSavedLineups,
  playerMatchEvent,
  type LineupRound,
  type RosterPlayer,
} from '@/lib/combi-results';
export async function getPlayerMatchSchedule(
  userId: string,
  opts?: { teamId?: string; view?: 'MAIN' | 'SPOC'; editionSlot?: 'A' | 'B'; editionId?: string },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const tournamentOptions = await resolvePlayerTournamentOptions(userId);
  const activeSlot: 'A' | 'B' =
    opts?.editionSlot === 'B' || opts?.editionSlot === 'A'
      ? opts.editionSlot
      : 'A';
  const isAdvancePlay = activeSlot === 'B';

  const edition = await resolveEditionBySlotOrId({
    slot: activeSlot,
    editionId: opts?.editionId,
  });

  const cmsSite = await getWebsiteCmsSite();
  const fallbackEditionTitle = `${cmsSite.shortName} ${cmsSite.editionLabel}`;

  const participation = await prisma.editionParticipant.findFirst({
    where: edition?.id ? { userId, editionId: edition.id } : { userId },
    include: { team: true },
    orderBy: { createdAt: 'desc' },
  });

  const isEnrolledInEdition = Boolean(
    participation &&
    (
      ['ENROLLED', 'QUALIFIED', 'REGISTERED'].includes(String(participation.status || '').toUpperCase()) ||
      ['PAID', 'VERIFIED', 'FREE', 'WAIVED'].includes(String(participation.paymentStatus || '').toUpperCase())
    )
  );

  const playerTeams = await listPlayerTeams(userId, edition?.id);
  const captainDesks = await listCaptainDesks(userId, edition?.id);
  const requested =
    (opts?.teamId && playerTeams.find((t) => t.id === opts.teamId)) ||
    (opts?.view === 'SPOC' && playerTeams.find((t) => t.kind === 'SPOC')) ||
    (opts?.view === 'MAIN' && playerTeams.find((t) => t.kind === 'MAIN')) ||
    playerTeams.find((t) => t.kind === 'MAIN') ||
    playerTeams[0] ||
    null;
  const team = requested
    ? {
        id: requested.id,
        name: requested.name,
        tag: requested.tag,
        logo: requested.logo,
      }
    : participation?.team || (isAdvancePlay ? { id: 'advance', name: user.name || user.username || 'Advance Play', tag: 'ADV', logo: null } : null);

  let stageConfig: { stages?: any[] } | null = null;
  if (edition?.id) {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: stageConfigKey(edition.id) },
    });
    if (setting?.value) {
      try {
        stageConfig = JSON.parse(setting.value);
      } catch {}
    }
  }

  const teams = edition?.id
    ? await prisma.team.findMany({
        where: { editionId: edition.id },
        select: {
          id: true,
          name: true,
          tag: true,
          logo: true,
          savedLineups: true,
          teamType: true,
          captain: { select: { id: true, name: true, username: true } },
          members: { include: { user: { select: { id: true, name: true, username: true } } } },
          spocMembers: { include: { user: { select: { id: true, name: true, username: true } } } },
        },
      })
    : [];
  const teamByName = new Map(teams.map((t) => [t.name.toUpperCase().trim(), t]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const pairings = resolveOrganizerPairings(stageConfig?.stages || [], teams);

  let dayDates: Record<number, string> = {};
  if (edition?.dayDates) {
    try {
      dayDates = JSON.parse(edition.dayDates);
    } catch {}
  }

  const scheduleDays = buildOrganizerScheduleDays({
    totalDays: edition?.totalDays,
    dayDates,
    pairings,
    stages: stageConfig?.stages || [],
    teams,
  });

  const now = Date.now();
  const isSpocView = requested?.kind === 'SPOC';
  const teamNameUpper = (team?.name || '').toUpperCase().trim();
  const teamTag = (team?.tag || '').toUpperCase().trim();
  const isSpocMatch = (day: (typeof scheduleDays)[number], m: (typeof scheduleDays)[number]['matches'][number]) =>
    Boolean(m.isSpocExhibition) || Boolean(day.isSpocDay) || day.stageKind === 'SPOC_EXHIBITION';
  const matchForTeam = (day: (typeof scheduleDays)[number]) =>
    day.matches.find((m) => {
      const nameHit =
        m.team1 === teamNameUpper ||
        m.team2 === teamNameUpper ||
        (!!teamTag && (m.team1Tag === teamTag || m.team2Tag === teamTag));
      if (!nameHit) return false;
      const spoc = isSpocMatch(day, m);
      return isSpocView ? spoc : !spoc;
    });
  const officialWindow = tournamentPlayWindow(
    now,
    Math.max(scheduleDays.length, ...scheduleDays.map((d) => d.dayNumber), 0),
  );
  const liveScheduleDay = scheduleDays.find((d) => monumentStatus(d, now) === 'live')?.dayNumber;
  const scheduleCurrentDay = currentPlayDayNumber(
    scheduleDays.map((d) => ({
      dayNumber: d.dayNumber,
      status: monumentStatus(d, now),
    })),
  );
  const hasStages = (stageConfig?.stages || []).some((s: any) => s?.kind && s.kind !== 'SPOC_EXHIBITION');
  const scheduleMax = Math.max(1, ...scheduleDays.map((d) => d.dayNumber), scheduleDays.length);
  const currentDay = Math.min(
    liveScheduleDay || scheduleCurrentDay || (hasStages ? 0 : officialWindow.currentDay) || 1,
    scheduleMax,
  );
  const totalDays = hasStages
    ? scheduleMax
    : Math.max(officialWindow.totalDays, edition?.totalDays || 0, scheduleMax, currentDay, 1);

  const playerStreams = await prisma.liveStream.findMany({
    where: {
      playerId: userId,
      ...(edition?.id ? { editionId: edition.id } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      matchId: true,
      youtubeUrl: true,
      youtubeVideoId: true,
      youtubeEmbedUrl: true,
      status: true,
      createdAt: true,
      recordedAt: true,
      match: { select: { round: true, matchNumber: true } },
    },
  });
  const streamSummary = summarizePlayerDayStreams(playerStreams);
  const dayScores = edition?.id
    ? await prisma.playerDayScore.findMany({
        where: { editionId: edition.id },
        select: { userId: true, dayNumber: true, score: true, slams: true },
      })
    : [];
  const daysPlayed = playedDaysForUnlock(
    streamSummary,
    dayScores.filter((s) => s.userId === userId).map((s) => s.dayNumber),
  );

  const rosterOf = (full: (typeof teams)[number] | undefined): RosterPlayer[] => {
    if (!full) return [];
    const byId = new Map<string, RosterPlayer>();
    if (full.captain) {
      byId.set(full.captain.id, { id: full.captain.id, name: full.captain.name || full.captain.username });
    }
    const list = isSpocExhibitionTeam(full) ? full.spocMembers : full.members;
    for (const m of list) {
      if (!m.user) continue;
      byId.set(m.user.id, { id: m.user.id, name: m.user.name || m.user.username });
    }
    return Array.from(byId.values());
  };

  const daysByNumber = new Map(scheduleDays.map((d) => [d.dayNumber, d]));
  const fixtureDays = isSpocView
    ? scheduleDays
        .filter((d) => Boolean(matchForTeam(d)))
        .map((d) => d.dayNumber)
        .filter((n, i, arr) => n > 0 && arr.indexOf(n) === i)
        .sort((a, b) => a - b)
    : scheduleDays
        .filter((d) => {
          const spocOnly =
            (Boolean(d.isSpocDay) || d.stageKind === 'SPOC_EXHIBITION') &&
            !d.matches.some((m) => !m.isSpocExhibition);
          if (spocOnly) return false;
          return true;
        })
        .map((d) => d.dayNumber)
        .filter((n, i, arr) => n > 0 && arr.indexOf(n) === i)
        .sort((a, b) => a - b);
  const currentDayForView = isSpocView
    ? fixtureDays.find((d) => d === currentDay) ||
      fixtureDays.find((d) => {
        const scheduled = daysByNumber.get(d);
        return scheduled ? monumentStatus(scheduled, now) === 'live' : d === currentDay;
      }) ||
      fixtureDays.find((d) => d >= currentDay) ||
      (fixtureDays.length ? fixtureDays[fixtureDays.length - 1] : currentDay)
    : currentDay;

  const userGradeMap = new Map<string, string>();
  if (edition?.id) {
    const gradingSetting = await prisma.systemSetting.findUnique({
      where: { key: gradingSettingKey(edition.id) },
    });
    if (gradingSetting?.value) {
      const grid = parseGradingGrid(gradingSetting.value);
      const updates = computePlayerGradeUpdates(grid);
      updates.forEach((u) => userGradeMap.set(u.userId, u.grade));
    }
  }

  const roundFormats = (edition as any)?.patterns?.map((bp: any) => bp.matchFormat || 'SINGLES').filter(Boolean) || [
    'SINGLES',
    'SINGLES',
    'SINGLES',
    'SINGLES',
    'DOUBLES',
    'TRIPLES',
    'TRIPLES',
  ];

  const days = !team || (isAdvancePlay && (!hasStages || !isEnrolledInEdition))
    ? []
    : fixtureDays.map((dayNumber) => {
      const scheduled = daysByNumber.get(dayNumber);
      const calendarDate = scheduled?.calendarDate || calendarDateForDay(dayNumber, dayDates);
      const startIso = scheduled?.startIso || `${addDaysIsoDate(calendarDate, -1)}T20:00:00+05:30`;
      const endIso = scheduled?.endIso || `${calendarDate}T20:00:00+05:30`;
      const timeRange = scheduled?.timeRange || formatDayRange(startIso, endIso);
      const title = scheduled?.title || `DAY ${dayNumber}`;
      const fix = teamNameUpper && scheduled ? matchForTeam(scheduled) : null;
      const myTeamRow = (team?.id && teamById.get(team.id)) || teamByName.get(teamNameUpper);
      const isT1 = !fix
        ? true
        : myTeamRow?.id && fix.team1Id
          ? fix.team1Id === myTeamRow.id
          : fix.team1 === teamNameUpper || (!!teamTag && fix.team1Tag === teamTag);
      const oppNameRaw = fix ? (isT1 ? fix.team2 : fix.team1) : '';
      const oppMissing = !oppNameRaw || /^tbd$/i.test(oppNameRaw);
      const oppRow =
        (isT1 ? (fix?.team2Id && teamById.get(fix.team2Id)) : (fix?.team1Id && teamById.get(fix.team1Id))) ||
        teamByName.get(String(oppNameRaw).toUpperCase().trim());
      const myFace = resolveTeamFace({
        name: team?.name || 'Your team',
        tag: team?.tag,
        logo: team?.logo,
        id: team?.id,
        teams,
      });
      const oppFace = oppMissing
        ? { name: 'TBD', tag: 'TBD', logo: null as string | null }
        : resolveTeamFace({
            name: oppNameRaw,
            tag: teamByName.get(oppNameRaw)?.tag,
            logo: teamByName.get(oppNameRaw)?.logo,
            id: teamByName.get(oppNameRaw)?.id,
            teams,
          });
      const status = scheduled
        ? monumentStatus(scheduled, now)
        : dayNumber < currentDay
          ? 'completed'
          : dayNumber === currentDay
            ? 'live'
            : 'upcoming';
      const isLiveDay = status === 'live';
      const isCurrent = isLiveDay || dayNumber === currentDayForView;
      const isPast = !isCurrent && dayNumber < currentDayForView;
      const isFuture = dayNumber > currentDayForView && !isLiveDay;
      const canGoLive = isPast
        ? false
        : isCurrent
          ? true
          : isDayUnlockedByYoutubeSequence(dayNumber, fixtureDays, daysPlayed, currentDayForView);
      const latest = streamSummary.latestByDay[dayNumber] || null;
      const prerequisiteDay = isFuture
        ? unlockPrerequisiteDay(dayNumber, fixtureDays, currentDayForView)
        : null;
      const revealed = isCombiSubmissionLocked(dayNumber, dayDates, new Date(now));
      const scoresReady = isDayScorePublished(dayNumber, dayDates, new Date(now));
      const scoreMap: Record<string, { score: number; slams: number }> = {};
      for (const s of dayScores) {
        if (s.dayNumber === dayNumber) scoreMap[s.userId] = { score: s.score, slams: s.slams };
      }
      const mineCombi = resolveEffectiveTeamCombi({
        team: myTeamRow,
        dayNumber,
        roundFormats,
        userGradeMap,
      });
      const oppCombi = resolveEffectiveTeamCombi({
        team: oppRow,
        dayNumber,
        roundFormats,
        userGradeMap,
      });
      const myEvent =
        fix && myTeamRow && !oppMissing
          ? playerMatchEvent({
              userId,
              playerIsTeam1: isT1,
              revealed,
              scoresReady,
              roundsMine: mineCombi.rounds,
              roundsOpp: oppCombi.rounds,
              rosterMine: rosterOf(myTeamRow),
              rosterOpp: rosterOf(oppRow || undefined),
              scores: scoreMap,
            })
          : null;
      return {
        dayNumber,
        label: `Day ${dayNumber}`,
        title,
        timeRange,
        startIso,
        endIso,
        calendarDate,
        status,
        canGoLive,
        canPracticeGoLive: true,
        canTieBreakGoLive: true,
        lockedReason: canGoLive
          ? null
          : isPast
            ? 'Go Live is closed for this match day (closed at 8:00pm IST). Existing live sessions started before 8:00pm IST can continue recording.'
            : prerequisiteDay
              ? `Play Day ${prerequisiteDay} (go live or save a score) before Day ${dayNumber} unlocks.`
              : 'This day is not unlocked yet.',
        prerequisiteDay,
        hasYoutube: Boolean(latest),
        latestYoutubeUrl: latest?.youtubeUrl || null,
        latestYoutubeVideoId: latest?.youtubeVideoId || null,
        streamCount: streamSummary.streamCountByDay[dayNumber] || 0,
        stageName: scheduled?.stageName || title,
        stageLabel: scheduled?.stageLabel || title,
        teamName: myFace.name,
        teamTag: myFace.tag,
        teamLogo: myFace.logo,
        opponentName: oppFace.name,
        opponentTag: oppFace.tag,
        opponentLogo: oppFace.logo,
        tableNumber: 1,
        editionId: edition?.id || null,
        editionTitle: edition?.title || fallbackEditionTitle,
        editionNumber: edition?.number ?? 0,
        editionDescription: edition?.themeDescription || edition?.theme || edition?.rules || '',
        editionRules: '',
        editionTheme: edition?.theme || '',
        myEvent,
      };
    });

  const live = days.find((d) => d && d.status === 'live') || null;
  const advanceRestricted = isAdvancePlay && (!hasStages || !isEnrolledInEdition);
  const warning = !team
    ? 'Your account is not assigned to a team yet.'
    : isAdvancePlay && !hasStages
      ? 'Tournament stages and schedule for this edition have not been saved yet.'
      : isAdvancePlay && !isEnrolledInEdition
        ? `Advance play and match schedules are available only for players enrolled in ${edition?.title || 'this edition'}. Please complete enrollment to get access.`
        : isSpocView && days.length === 0
          ? 'No Spoc exhibition match is scheduled for your team yet.'
          : undefined;

  return {
    user: {
      id: user.id,
      name: user.name || user.username,
      username: user.username,
      role: user.role,
    },
    edition: edition
      ? { id: edition.id, title: edition.title, number: edition.number }
      : null,
    team: team
      ? { id: team.id, name: team.name, tag: team.tag, logo: team.logo }
      : null,
    playerTeams,
    captainDesks,
    liveDay: live?.dayNumber ?? null,
    liveLabel: live?.label ?? null,
    currentDay: advanceRestricted ? 0 : currentDayForView,
    playableFromDay: advanceRestricted ? 0 : isSpocView ? (fixtureDays[0] || 1) : 1,
    playableUntilDay: advanceRestricted ? 0 : isSpocView ? (fixtureDays[fixtureDays.length - 1] || currentDayForView) : totalDays,
    daysWithYoutube: [...daysPlayed].sort((a, b) => a - b),
    tournamentOptions: {
      ...tournamentOptions,
      activeSlot,
    },
    isEnrolled: isEnrolledInEdition,
    warning,
    days,
  };
}
