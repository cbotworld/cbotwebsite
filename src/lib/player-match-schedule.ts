import { prisma } from '@/lib/prisma';
import { monumentStatus } from '@/lib/bicentennial-monuments';
import {
  currentPlayDayNumber,
  isDayUnlockedByYoutubeSequence,
  summarizePlayerDayStreams,
  tournamentPlayWindow,
  unlockPrerequisiteDay,
} from '@/lib/match-play-window';
import { buildOrganizerScheduleDays, calendarDateForDay, addDaysIsoDate, formatDayRange, resolveOrganizerPairings } from '@/lib/organizer-schedule';
import { listCaptainDesks, listPlayerTeams } from '@/lib/mobile-team';
import { resolveTeamFace } from '@/lib/team-identity';
import { stageConfigKey } from '@/lib/tournament-stages';
export async function getPlayerMatchSchedule(
  userId: string,
  opts?: { teamId?: string; view?: 'MAIN' | 'SPOC' },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const edition = await prisma.edition.findFirst({
    where: { OR: [{ number: 200 }, { status: 'IN_PROGRESS' }] },
    orderBy: { number: 'desc' },
  });

  const participation = await prisma.editionParticipant.findFirst({
    where: edition?.id ? { userId, editionId: edition.id } : { userId },
    include: { team: true },
    orderBy: { createdAt: 'desc' },
  });

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
    : participation?.team || null;

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
        select: { id: true, name: true, tag: true, logo: true },
      })
    : [];
  const teamByName = new Map(teams.map((t) => [t.name.toUpperCase().trim(), t]));
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
    Math.max(edition?.totalDays || 0, scheduleDays.length, ...scheduleDays.map((d) => d.dayNumber), 0),
  );
  const liveScheduleDay = scheduleDays.find((d) => monumentStatus(d, now) === 'live')?.dayNumber;
  const scheduleCurrentDay = currentPlayDayNumber(
    scheduleDays.map((d) => ({
      dayNumber: d.dayNumber,
      status: monumentStatus(d, now),
    })),
  );
  // Prefer the live schedule day so past official days never constrain today.
  const currentDay = liveScheduleDay || scheduleCurrentDay || officialWindow.currentDay || 1;
  const totalDays = Math.max(
    officialWindow.totalDays,
    edition?.totalDays || 0,
    scheduleDays.length,
    ...scheduleDays.map((d) => d.dayNumber),
    currentDay,
    1,
  );

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
  const daysWithYoutube = new Set(streamSummary.daysWithYoutube);

  const daysByNumber = new Map(scheduleDays.map((d) => [d.dayNumber, d]));
  const allCalendarDays = Array.from({ length: totalDays }, (_, i) => i + 1);
  const fixtureDays = isSpocView
    ? scheduleDays
        .filter((d) => Boolean(matchForTeam(d)))
        .map((d) => d.dayNumber)
        .filter((n, i, arr) => n > 0 && arr.indexOf(n) === i)
        .sort((a, b) => a - b)
    : allCalendarDays;
  const currentDayForView = isSpocView
    ? fixtureDays.find((d) => d === currentDay) ||
      fixtureDays.find((d) => {
        const scheduled = daysByNumber.get(d);
        return scheduled ? monumentStatus(scheduled, now) === 'live' : d === currentDay;
      }) ||
      fixtureDays.find((d) => d >= currentDay) ||
      (fixtureDays.length ? fixtureDays[fixtureDays.length - 1] : currentDay)
    : currentDay;

  const days = !team
    ? []
    : fixtureDays.map((dayNumber) => {
      const scheduled = daysByNumber.get(dayNumber);
      const calendarDate = scheduled?.calendarDate || calendarDateForDay(dayNumber, dayDates);
      const startIso = scheduled?.startIso || `${addDaysIsoDate(calendarDate, -1)}T20:00:00+05:30`;
      const endIso = scheduled?.endIso || `${calendarDate}T20:00:00+05:30`;
      const timeRange = scheduled?.timeRange || formatDayRange(startIso, endIso);
      const title = scheduled?.title || `DAY ${dayNumber}`;
      const fix = teamNameUpper && scheduled ? matchForTeam(scheduled) : null;
      const isT1 = fix
        ? fix.team1 === teamNameUpper || (!!teamTag && fix.team1Tag === teamTag)
        : true;
      const oppNameRaw = fix ? (isT1 ? fix.team2 : fix.team1) : '';
      const oppMissing = !oppNameRaw || /^tbd$/i.test(oppNameRaw);
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
          : isDayUnlockedByYoutubeSequence(dayNumber, fixtureDays, daysWithYoutube, currentDayForView);
      const latest = streamSummary.latestByDay[dayNumber] || null;
      const prerequisiteDay = isFuture
        ? unlockPrerequisiteDay(dayNumber, fixtureDays, currentDayForView)
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
            ? 'This match day is completed. Watch the saved YouTube video, or use Practice / Tie Breaker.'
            : prerequisiteDay
              ? `Go live on Day ${prerequisiteDay} and save at least one YouTube video before Day ${dayNumber} unlocks.`
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
        editionTitle: edition?.title || 'CBOT 200th Edition',
        editionNumber: edition?.number || 200,
      };
    });

  const live = days.find((d) => d && d.status === 'live') || null;
  const warning = !team
    ? 'Your account is not assigned to a team yet.'
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
    team: team
      ? { id: team.id, name: team.name, tag: team.tag, logo: team.logo }
      : null,
    playerTeams,
    captainDesks,
    liveDay: live?.dayNumber ?? null,
    liveLabel: live?.label ?? null,
    currentDay: currentDayForView,
    playableFromDay: isSpocView ? (fixtureDays[0] || 1) : 1,
    playableUntilDay: isSpocView ? (fixtureDays[fixtureDays.length - 1] || currentDayForView) : totalDays,
    daysWithYoutube: streamSummary.daysWithYoutube,
    warning,
    days,
  };
}
