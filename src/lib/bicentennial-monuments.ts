export interface BicentennialMonument {
  monumentNumber: number;
  title: string;
  timeRange: string;
  startIso: string;
  endIso: string;
  matches: Array<{ team1: string; team2: string }>;
}

/** Stage 1 Round Robin for the 200th Edition: 7 days, 4 matches/day, each team plays once per day. */
export const BICENTENNIAL_MONUMENTS: BicentennialMonument[] = [
  {
    monumentNumber: 1,
    title: 'BICENTENNIAL MONUMENT 1',
    timeRange: '9TH AUG 9 PM TO 10TH AUG 8 PM',
    startIso: '2026-08-09T21:00:00+05:30',
    endIso: '2026-08-10T20:00:00+05:30',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'SUPERNOVA QUEEN' },
      { team1: 'POCKET DYNAMOS', team2: 'LUMEN PILLAR' },
      { team1: 'VANILLA FALCONS', team2: 'VINTAGE STRIKERS' },
      { team1: 'EBONY OVERLORDS', team2: 'BORIC SPEEDSTERS' },
    ],
  },
  {
    monumentNumber: 2,
    title: 'BICENTENNIAL MONUMENT 2',
    timeRange: '10TH AUG 8 PM TO 11TH AUG 8 PM',
    startIso: '2026-08-10T20:00:00+05:30',
    endIso: '2026-08-11T20:00:00+05:30',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'VINTAGE STRIKERS' },
      { team1: 'LUMEN PILLAR', team2: 'BORIC SPEEDSTERS' },
      { team1: 'SUPERNOVA QUEEN', team2: 'EBONY OVERLORDS' },
      { team1: 'POCKET DYNAMOS', team2: 'VANILLA FALCONS' },
    ],
  },
  {
    monumentNumber: 3,
    title: 'BICENTENNIAL MONUMENT 3',
    timeRange: '11TH AUG 8 PM TO 12TH AUG 8 PM',
    startIso: '2026-08-11T20:00:00+05:30',
    endIso: '2026-08-12T20:00:00+05:30',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'EBONY OVERLORDS' },
      { team1: 'BORIC SPEEDSTERS', team2: 'VANILLA FALCONS' },
      { team1: 'VINTAGE STRIKERS', team2: 'POCKET DYNAMOS' },
      { team1: 'LUMEN PILLAR', team2: 'SUPERNOVA QUEEN' },
    ],
  },
  {
    monumentNumber: 4,
    title: 'BICENTENNIAL MONUMENT 4',
    timeRange: '12TH AUG 8 PM TO 13TH AUG 8 PM',
    startIso: '2026-08-12T20:00:00+05:30',
    endIso: '2026-08-13T20:00:00+05:30',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'VANILLA FALCONS' },
      { team1: 'EBONY OVERLORDS', team2: 'POCKET DYNAMOS' },
      { team1: 'BORIC SPEEDSTERS', team2: 'SUPERNOVA QUEEN' },
      { team1: 'VINTAGE STRIKERS', team2: 'LUMEN PILLAR' },
    ],
  },
  {
    monumentNumber: 5,
    title: 'BICENTENNIAL MONUMENT 5',
    timeRange: '13TH AUG 8 PM TO 14TH AUG 8 PM',
    startIso: '2026-08-13T20:00:00+05:30',
    endIso: '2026-08-14T20:00:00+05:30',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'LUMEN PILLAR' },
      { team1: 'SUPERNOVA QUEEN', team2: 'VINTAGE STRIKERS' },
      { team1: 'POCKET DYNAMOS', team2: 'BORIC SPEEDSTERS' },
      { team1: 'VANILLA FALCONS', team2: 'EBONY OVERLORDS' },
    ],
  },
  {
    monumentNumber: 6,
    title: 'BICENTENNIAL MONUMENT 6',
    timeRange: '14TH AUG 8 PM TO 15TH AUG 8 PM',
    startIso: '2026-08-14T20:00:00+05:30',
    endIso: '2026-08-15T20:00:00+05:30',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'BORIC SPEEDSTERS' },
      { team1: 'VINTAGE STRIKERS', team2: 'EBONY OVERLORDS' },
      { team1: 'LUMEN PILLAR', team2: 'VANILLA FALCONS' },
      { team1: 'SUPERNOVA QUEEN', team2: 'POCKET DYNAMOS' },
    ],
  },
  {
    monumentNumber: 7,
    title: 'BICENTENNIAL MONUMENT 7',
    timeRange: '15TH AUG 8 PM TO 16TH AUG 8 PM',
    startIso: '2026-08-15T20:00:00+05:30',
    endIso: '2026-08-16T20:00:00+05:30',
    matches: [
      { team1: 'PLYWOOD PIONEERS', team2: 'POCKET DYNAMOS' },
      { team1: 'VANILLA FALCONS', team2: 'SUPERNOVA QUEEN' },
      { team1: 'EBONY OVERLORDS', team2: 'LUMEN PILLAR' },
      { team1: 'BORIC SPEEDSTERS', team2: 'VINTAGE STRIKERS' },
    ],
  },
];

export function monumentStatus(
  monument: Pick<BicentennialMonument, 'startIso' | 'endIso'>,
  nowMs = Date.now()
): 'live' | 'completed' | 'upcoming' {
  const startMs = new Date(monument.startIso).getTime();
  const endMs = new Date(monument.endIso).getTime();
  if (nowMs >= endMs) return 'completed';
  if (nowMs >= startMs && nowMs < endMs) return 'live';
  return 'upcoming';
}

export function activeMonumentNumber(nowMs = Date.now()): number | null {
  const live = BICENTENNIAL_MONUMENTS.find((m) => monumentStatus(m, nowMs) === 'live');
  return live?.monumentNumber ?? null;
}

export function lastCompletedMonumentDay(now = new Date()): number {
  const nowMs = now.getTime();
  let last = 0;
  eventDayWindows().forEach((window) => {
    if (nowMs >= new Date(window.endIso).getTime()) last = Math.max(last, window.dayNumber);
  });
  return last;
}

/** Returns true/false for official 8pm–8pm event days (RR 1–7, league 8–10); null otherwise. */
export function isMonumentDayCompleted(dayNumber: number, now = new Date()): boolean | null {
  const window = eventDayWindow(dayNumber);
  if (!window) return null;
  return now.getTime() >= new Date(window.endIso).getTime();
}

export function roundRobinMatchCount() {
  return BICENTENNIAL_MONUMENTS.reduce((sum, m) => sum + m.matches.length, 0);
}

export const ROYAL_CARROM_LEAGUE_GROUPS = [
  {
    name: 'Birchply',
    key: 'A',
    teams: ['VINTAGE STRIKERS', 'EBONY OVERLORDS', 'PLYWOOD PIONEERS', 'LUMEN PILLAR'],
  },
  {
    name: 'Rosewood',
    key: 'B',
    teams: ['POCKET DYNAMOS', 'VANILLA FALCONS', 'BORIC SPEEDSTERS', 'SUPERNOVA QUEEN'],
  },
] as const;

export function seedRoyalCarromLeague(teams: Array<{ id: string; name: string }>): Array<{
  name: string;
  key: string;
  teamIds: string[];
}> {
  const findId = (label: string) =>
    teams.find((t) => t.name.toUpperCase().trim() === label.toUpperCase().trim())?.id || '';
  return ROYAL_CARROM_LEAGUE_GROUPS.map((group) => ({
    name: group.name,
    key: group.key,
    teamIds: group.teams.map((teamName) => findId(teamName)),
  }));
}

export interface RoyalCarromLeagueDay {
  dayNumber: number;
  title: string;
  timeRange: string;
  startIso: string;
  endIso: string;
  round: number;
  matches: Array<{ team1: string; team2: string; group: 'A' | 'B' }>;
}

/** Stage 2 Royal Carroms league: Days 8–10, each 8pm IST to 8pm IST the next day. */
export const ROYAL_CARROM_LEAGUE_DAYS: RoyalCarromLeagueDay[] = [
  {
    dayNumber: 8,
    title: 'ROYAL CARROMS 1',
    timeRange: '16TH AUG 8 PM TO 17TH AUG 8 PM',
    startIso: '2026-08-16T20:00:00+05:30',
    endIso: '2026-08-17T20:00:00+05:30',
    round: 1,
    matches: [
      { team1: 'LUMEN PILLAR', team2: 'PLYWOOD PIONEERS', group: 'A' },
      { team1: 'EBONY OVERLORDS', team2: 'VINTAGE STRIKERS', group: 'A' },
      { team1: 'BORIC SPEEDSTERS', team2: 'SUPERNOVA QUEEN', group: 'B' },
      { team1: 'VANILLA FALCONS', team2: 'POCKET DYNAMOS', group: 'B' },
    ],
  },
  {
    dayNumber: 9,
    title: 'ROYAL CARROMS 2',
    timeRange: '17TH AUG 8 PM TO 18TH AUG 8 PM',
    startIso: '2026-08-17T20:00:00+05:30',
    endIso: '2026-08-18T20:00:00+05:30',
    round: 2,
    matches: [
      { team1: 'LUMEN PILLAR', team2: 'EBONY OVERLORDS', group: 'A' },
      { team1: 'VINTAGE STRIKERS', team2: 'PLYWOOD PIONEERS', group: 'A' },
      { team1: 'BORIC SPEEDSTERS', team2: 'POCKET DYNAMOS', group: 'B' },
      { team1: 'SUPERNOVA QUEEN', team2: 'VANILLA FALCONS', group: 'B' },
    ],
  },
  {
    dayNumber: 10,
    title: 'ROYAL CARROMS 3',
    timeRange: '18TH AUG 8 PM TO 19TH AUG 8 PM',
    startIso: '2026-08-18T20:00:00+05:30',
    endIso: '2026-08-19T20:00:00+05:30',
    round: 3,
    matches: [
      { team1: 'LUMEN PILLAR', team2: 'VINTAGE STRIKERS', group: 'A' },
      { team1: 'PLYWOOD PIONEERS', team2: 'EBONY OVERLORDS', group: 'A' },
      { team1: 'BORIC SPEEDSTERS', team2: 'VANILLA FALCONS', group: 'B' },
      { team1: 'POCKET DYNAMOS', team2: 'SUPERNOVA QUEEN', group: 'B' },
    ],
  },
];

export function eventDayWindows(): Array<{ dayNumber: number; startIso: string; endIso: string }> {
  return [
    ...BICENTENNIAL_MONUMENTS.map((m) => ({
      dayNumber: m.monumentNumber,
      startIso: m.startIso,
      endIso: m.endIso,
    })),
    ...ROYAL_CARROM_LEAGUE_DAYS.map((d) => ({
      dayNumber: d.dayNumber,
      startIso: d.startIso,
      endIso: d.endIso,
    })),
  ];
}

export function eventDayWindow(dayNumber: number): { startIso: string; endIso: string } | null {
  return eventDayWindows().find((w) => w.dayNumber === dayNumber) || null;
}

export function officialMatchDays(): Array<{
  dayNumber: number;
  title: string;
  timeRange: string;
  startIso: string;
  endIso: string;
  matches: Array<{ team1: string; team2: string }>;
}> {
  return [
    ...BICENTENNIAL_MONUMENTS.map((m) => ({
      dayNumber: m.monumentNumber,
      title: m.title,
      timeRange: m.timeRange,
      startIso: m.startIso,
      endIso: m.endIso,
      matches: m.matches,
    })),
    ...ROYAL_CARROM_LEAGUE_DAYS.map((d) => ({
      dayNumber: d.dayNumber,
      title: d.title,
      timeRange: d.timeRange,
      startIso: d.startIso,
      endIso: d.endIso,
      matches: d.matches.map(({ team1, team2 }) => ({ team1, team2 })),
    })),
  ];
}

export function seedRoyalCarromLeaguePairings(teams: Array<{ id: string; name: string }>): Array<{
  stage: string;
  label: string;
  team1Id: string;
  team2Id: string;
  team1Name?: string;
  team2Name?: string;
  round: number;
  dayNumber: number;
  scheduledTime: string;
  tableNumber: number;
}> {
  const findTeam = (label: string) =>
    teams.find((t) => t.name.toUpperCase().trim() === label.toUpperCase().trim());
  const groupName = (key: 'A' | 'B') =>
    ROYAL_CARROM_LEAGUE_GROUPS.find((g) => g.key === key)?.name || `Group ${key}`;

  return ROYAL_CARROM_LEAGUE_DAYS.flatMap((day) =>
    day.matches.map((match, idx) => {
      const team1 = findTeam(match.team1);
      const team2 = findTeam(match.team2);
      const label = groupName(match.group);
      return {
        stage: `LEAGUE_${match.group}`,
        label: `${label} · ${day.title} · Match ${idx + 1}`,
        team1Id: team1?.id || '',
        team2Id: team2?.id || '',
        team1Name: team1?.name || match.team1,
        team2Name: team2?.name || match.team2,
        round: day.round,
        dayNumber: day.dayNumber,
        scheduledTime: day.startIso,
        tableNumber: idx + 1,
      };
    })
  );
}
