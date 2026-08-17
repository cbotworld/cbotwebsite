import { prisma } from '@/lib/prisma';
import { monumentStatus } from '@/lib/bicentennial-monuments';
import { buildOrganizerScheduleDays } from '@/lib/organizer-schedule';
import { stageConfigKey } from '@/lib/tournament-stages';

export async function getPlayerMatchSchedule(userId: string) {
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

  const team = participation?.team || null;

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
  const teamsById = new Map(teams.map((t) => [t.id, t.name]));
  const teamByName = new Map(teams.map((t) => [t.name.toUpperCase().trim(), t]));
  const pairings = (stageConfig?.stages || []).flatMap((stage: any) =>
    (stage.matchPairings || []).map((p: any) => ({
      dayNumber: p.dayNumber,
      team1Name: p.team1Name || teamsById.get(p.team1Id) || '',
      team2Name: p.team2Name || teamsById.get(p.team2Id) || '',
    }))
  );

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
  });

  const now = Date.now();
  const teamNameUpper = (team?.name || '').toUpperCase().trim();

  const days = scheduleDays
    .map((day) => {
      const fix = teamNameUpper
        ? day.matches.find((m) => m.team1 === teamNameUpper || m.team2 === teamNameUpper)
        : null;
      if (!fix) return null;
      const isT1 = fix.team1 === teamNameUpper;
      const myName = isT1 ? fix.team1 : fix.team2;
      const oppName = isT1 ? fix.team2 : fix.team1;
      const myTeam = teamByName.get(myName);
      const oppTeam = teamByName.get(oppName);
      const status = monumentStatus(day, now);
      return {
        dayNumber: day.dayNumber,
        label: `Day ${day.dayNumber}`,
        title: day.title,
        timeRange: day.timeRange,
        startIso: day.startIso,
        endIso: day.endIso,
        calendarDate: day.calendarDate,
        status,
        canGoLive: status === 'live',
        teamName: myName,
        teamTag: myTeam?.tag || team?.tag || myName.slice(0, 3),
        teamLogo: myTeam?.logo || team?.logo || null,
        opponentName: oppName,
        opponentTag: oppTeam?.tag || oppName.slice(0, 3),
        opponentLogo: oppTeam?.logo || null,
        tableNumber: 1,
        editionTitle: edition?.title || 'CBOT 200th Edition',
        editionNumber: edition?.number || 200,
      };
    })
    .filter(Boolean);

  const live = days.find((d) => d && d.status === 'live') || null;
  const warning = !team
    ? 'Your account is not assigned to a team yet.'
    : days.length === 0
      ? 'No fixtures found for your team on the organizer schedule.'
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
    liveDay: live?.dayNumber ?? null,
    liveLabel: live?.label ?? null,
    warning,
    days,
  };
}
