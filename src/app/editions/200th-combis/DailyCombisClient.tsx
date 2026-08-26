'use client';

import * as React from 'react';
import Link from 'next/link';
import { Calendar, Clock, Lock, Unlock, Shield, Trophy, Eye, Search, Sparkles, CheckCircle2, ChevronRight, Users, Download, FileSpreadsheet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { get200thEditionCombisData } from '@/lib/actions/combisActions';
import { officialMatchDays, monumentStatus } from '@/lib/bicentennial-monuments';
import { resolveOrganizerPairings } from '@/lib/organizer-schedule';
import { resolveTeamFace } from '@/lib/team-identity';
import { stageSpanDays } from '@/lib/tournament-stages';
import { combiCalendarDate } from '@/lib/combi-cutoff';
import { DEFAULT_WEBSITE_CMS, type WebsitePageHeading } from '@/lib/website-cms';
import * as XLSX from 'xlsx';
interface TeamInfo {
  name: string;
  tag: string;
  captain: string;
  logo: string;
  color: string;
  border: string;
}

const TEAMS_INFO: Record<string, TeamInfo> = {
  'PLYWOOD PIONEERS': {
    name: 'Plywood Pioneers',
    tag: 'PP',
    captain: 'ABHIJIT',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/plywood-pioneers.jpeg',
    color: 'text-amber-400',
    border: 'border-amber-500/40',
  },
  'SUPERNOVA QUEEN': {
    name: 'Supernova Queen',
    tag: 'SQ',
    captain: 'CHARI',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/supernova-queen.jpeg',
    color: 'text-pink-400',
    border: 'border-pink-500/40',
  },
  'POCKET DYNAMOS': {
    name: 'Pocket Dynamos',
    tag: 'PD',
    captain: 'RAMESH',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/pocket-dynamos.jpeg',
    color: 'text-sky-400',
    border: 'border-sky-500/40',
  },
  'LUMEN PILLAR': {
    name: 'Lumen Pillar',
    tag: 'LP',
    captain: 'SRIVISHNU',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/lumen-pillar.jpeg',
    color: 'text-yellow-400',
    border: 'border-yellow-500/40',
  },
  'VANILLA FALCONS': {
    name: 'Vanilla Falcons',
    tag: 'VF',
    captain: 'RAKESH',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/vanilla-falcons.jpeg',
    color: 'text-emerald-400',
    border: 'border-emerald-500/40',
  },
  'VINTAGE STRIKERS': {
    name: 'Vintage Strikers',
    tag: 'VS',
    captain: 'VINOD',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/vintage-strikers.jpeg',
    color: 'text-orange-400',
    border: 'border-orange-500/40',
  },
  'EBONY OVERLORDS': {
    name: 'Ebony Overlords',
    tag: 'EO',
    captain: 'LALIT',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/ebony-overlords.jpeg',
    color: 'text-purple-400',
    border: 'border-purple-500/40',
  },
  'BORIC SPEEDSTERS': {
    name: 'Boric Speedsters',
    tag: 'BS',
    captain: 'BALU',
    logo: 'https://otvbywtuyvufxxvlizqp.supabase.co/storage/v1/object/public/teams/boric-speedsters.jpeg',
    color: 'text-cyan-400',
    border: 'border-cyan-500/40',
  },
};

interface EventSlot {
  label: string;
  leftPlayers: string;
  rightPlayers: string;
}

interface MatchCombiData {
  team1Key: string;
  team2Key: string;
  events: EventSlot[];
}

interface DayCombiFixture {
  dayNumber: number;
  title: string;
  dateStr: string;
  cutoffDateStr: string;
  startIso: string;
  endIso: string;
  cutoffIso: string;
  calendarDate: string;
  matches: MatchCombiData[];
}

const OFFICIAL_TEAM_COMBIS: Record<string, {
  singles1: string;
  singles2: string;
  singles3: string;
  singles4: string;
  doubles1: string;
  doubles2: string;
  doubles3: string;
  triples1: string;
  triples2: string;
}> = {
  'BORIC SPEEDSTERS': {
    singles1: 'UMESH N',
    singles2: 'AMARNATH PANJIYAR',
    singles3: 'ANANDLAL',
    singles4: 'BALU',
    doubles1: 'ROHIT PASWAN, PACKIYA',
    doubles2: 'VISHAL SHERGAL, YUVI',
    doubles3: 'KIRAN BHAT, PRIYA BHAT',
    triples1: 'DAYAKAR, HARIKRISHNA, RK TOLETY',
    triples2: 'KALYANI, RAVI KUMAR S, PRASANNA KUMAR',
  },
  'SUPERNOVA QUEEN': {
    singles1: 'MOKSHA P',
    singles2: 'ANAS AHMED',
    singles3: 'AMARENDAR',
    singles4: 'MANSUR ATTAR',
    doubles1: 'ANUJ SINHA, MOHAN KUMAR D',
    doubles2: 'CHARI, AJIT ZIBA',
    doubles3: 'HEMANTH NS, SYAM PRAKASH',
    triples1: 'RAVINDER, ARUN VENKATESH, MANJUNATH',
    triples2: 'ADARSH SA, PADMA, VINCY',
  },
  'VANILLA FALCONS': {
    singles1: 'VAIBHAV JOIL',
    singles2: 'VAIBHAV PETHE',
    singles3: 'NISHANTHA FERNANDO',
    singles4: 'CH SUDHA',
    doubles1: 'ABDUL MANNAN, SUNIL',
    doubles2: 'HARIKA MSK, SURESH KUMAR',
    doubles3: 'DEEPAK HEGDE, PRAMATH',
    triples1: 'AARUSHI P, SREEVIDYA R, VIRAJ NAKHAWA',
    triples2: 'SAJEEVNATH S, RAKESH, SHALINI BHAT',
  },
  'LUMEN PILLAR': {
    singles1: 'GURMIT SINGH',
    singles2: 'ZIYAD BAWA',
    singles3: 'SUNANDA TAMULI',
    singles4: 'PRASENJIT',
    doubles1: 'SRIVISHNU, RUBAN',
    doubles2: 'RIZWAN NOOR, S KRISHNAMURTHY',
    doubles3: 'ELANGOVAN, GIRISH K',
    triples1: 'AMAR INGLE, SIRAJ, PRAVEEN H',
    triples2: 'V SHIVALKAR, MANOJ PS, KRUTIKA',
  },
  'PLYWOOD PIONEERS': {
    singles1: 'ABHIJIT',
    singles2: 'JP JAYARAJ',
    singles3: 'JAYAKUMAR AP',
    singles4: 'ADITYA SAREPALLI',
    doubles1: 'IMTIYAZ AHAMED, SHASHIREKHA KK',
    doubles2: 'TN MAHESH, SHRIKANT',
    doubles3: 'SACHIN SURVE, PADMARAJ',
    triples1: 'HARIPRASAD D, MATHAIS, JAINUDDIN SHEIKH',
    triples2: 'ARUNASRI, BALWANT SINGH, ANIL BHATIA',
  },
  'VINTAGE STRIKERS': {
    singles1: 'SHYAM SUNDAR',
    singles2: 'VINOD',
    singles3: 'YOANN OLIVIER',
    singles4: 'AKHIL',
    doubles1: 'DIN, HEMEM KAKATI',
    doubles2: 'KRISHNA, V RAJAMANICKAM',
    doubles3: 'M PADMAJA, JYOTI MURTY',
    triples1: 'TELVIN THANKACHAN, BOBBY, ANIL S',
    triples2: 'A KUMAR, RV SRINIVASA RAO, KANNAN',
  },
  'EBONY OVERLORDS': {
    singles1: 'LALIT',
    singles2: 'PIERRE DUBOIS',
    singles3: 'CHANDRU',
    singles4: 'SUBHO',
    doubles1: 'KIRAN KUMAR REGI, NSK',
    doubles2: 'ALOK SINGH, SREERANJ RS',
    doubles3: 'PRATHAMESH GHARAT, TRIVIKRAM',
    triples1: 'POORNIMA, VENKATESWARLU Y, VIVEK N',
    triples2: 'SURENDER, NEELA, SRIDEVI',
  },
  'POCKET DYNAMOS': {
    singles1: 'RAMESH',
    singles2: 'BALACHANDRA HEGDE',
    singles3: 'SRIKANTH VETSA',
    singles4: 'UDIPTA DEKA',
    doubles1: 'SWAPNIL DESHPANDE, SATISH DALVI',
    doubles2: 'ISMAILNEAL AZMEEN, AJAY SINHA',
    doubles3: 'VEERA SEKHAR, APEKSHA BANDARI',
    triples1: 'VINEETH VIJAYAPURAM, KIRAN SOMAN, SHEKHAR DHARA',
    triples2: 'SUMA NAVEEN, ROHIT PACKIYA, HEMACHANDRA KUMAR Y',
  },
};

function getTeamCombiForDay(
  teamKey: string,
  dayNum: number,
  teamsList: any[]
): Record<string, string> {
  const isDay1 = Number(dayNum) === 1;
  const keyUpper = teamKey.trim().toUpperCase();
  const defaultCombi: any = isDay1 ? (OFFICIAL_TEAM_COMBIS[keyUpper] || {}) : {};

  const notSubmittedFallback = isDay1 ? 'Player' : 'Not Submitted Yet';

  if (!teamsList || teamsList.length === 0) {
    return {
      singles1: defaultCombi.singles1 || (isDay1 ? 'Player 1' : 'Not Submitted Yet'),
      singles2: defaultCombi.singles2 || (isDay1 ? 'Player 2' : 'Not Submitted Yet'),
      singles3: defaultCombi.singles3 || (isDay1 ? 'Player 3' : 'Not Submitted Yet'),
      singles4: defaultCombi.singles4 || (isDay1 ? 'Player 4' : 'Not Submitted Yet'),
      doubles1: defaultCombi.doubles1 || (isDay1 ? 'Doubles 1' : 'Not Submitted Yet'),
      doubles2: defaultCombi.doubles2 || (isDay1 ? 'Doubles 2' : 'Not Submitted Yet'),
      doubles3: defaultCombi.doubles3 || (isDay1 ? 'Doubles 3' : 'Not Submitted Yet'),
      triples1: defaultCombi.triples1 || (isDay1 ? 'Triples 1' : 'Not Submitted Yet'),
      triples2: defaultCombi.triples2 || (isDay1 ? 'Triples 2' : 'Not Submitted Yet'),
    };
  }

  const team = teamsList.find((t: any) => {
    if (!t || !t.name) return false;
    const nameUpper = t.name.trim().toUpperCase();
    const tagUpper = t.tag?.trim().toUpperCase();
    const teamInfoName = TEAMS_INFO[keyUpper]?.name?.trim().toUpperCase();
    return nameUpper === keyUpper || tagUpper === keyUpper || (teamInfoName && nameUpper === teamInfoName);
  });

  if (team?.savedLineups) {
    try {
      const parsed = typeof team.savedLineups === 'string' ? JSON.parse(team.savedLineups) : team.savedLineups;
      const dayData = parsed[dayNum] || parsed[dayNum.toString()];
      if (dayData && dayData.rounds && Array.isArray(dayData.rounds) && dayData.rounds.length > 0) {
        const result: Record<string, string> = {};
        const slots = [
          'singles1', 'singles2', 'singles3', 'singles4',
          'doubles1', 'doubles2', 'doubles3',
          'triples1', 'triples2'
        ];

        dayData.rounds.forEach((r: any, idx: number) => {
          if (!r) return;
          const rName = r.name ? r.name.toLowerCase().replace(/\s+/g, '') : '';
          let playersStr = '';
          if (Array.isArray(r.players) && r.players.length > 0) {
            playersStr = r.players.filter((p: any) => p && String(p).trim() !== '').join(', ');
          }

          if (rName && slots.includes(rName)) {
            result[rName] = playersStr;
          } else if (slots[idx]) {
            if (!result[slots[idx]]) {
              result[slots[idx]] = playersStr;
            }
          }
        });

        slots.forEach((s) => {
          if (!result[s]) {
            result[s] = (defaultCombi as any)[s] || notSubmittedFallback;
          }
        });

        return result;
      }
    } catch (e) {
      console.error(`Error parsing savedLineups for team ${teamKey} on day ${dayNum}:`, e);
    }
  }

  return {
    singles1: defaultCombi.singles1 || (isDay1 ? 'Player 1' : 'Not Submitted Yet'),
    singles2: defaultCombi.singles2 || (isDay1 ? 'Player 2' : 'Not Submitted Yet'),
    singles3: defaultCombi.singles3 || (isDay1 ? 'Player 3' : 'Not Submitted Yet'),
    singles4: defaultCombi.singles4 || (isDay1 ? 'Player 4' : 'Not Submitted Yet'),
    doubles1: defaultCombi.doubles1 || (isDay1 ? 'Doubles 1' : 'Not Submitted Yet'),
    doubles2: defaultCombi.doubles2 || (isDay1 ? 'Doubles 2' : 'Not Submitted Yet'),
    doubles3: defaultCombi.doubles3 || (isDay1 ? 'Doubles 3' : 'Not Submitted Yet'),
    triples1: defaultCombi.triples1 || (isDay1 ? 'Triples 1' : 'Not Submitted Yet'),
    triples2: defaultCombi.triples2 || (isDay1 ? 'Triples 2' : 'Not Submitted Yet'),
  };
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}TH`;
  if (v % 10 === 1) return `${n}ST`;
  if (v % 10 === 2) return `${n}ND`;
  if (v % 10 === 3) return `${n}RD`;
  return `${n}TH`;
}

function formatCutoffLabel(iso: string) {
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  return `9:30 PM IST, ${ordinal(d)} ${MONTHS[(m || 1) - 1]} ${y}`;
}

function formatDayRange(startIso: string, endIso: string) {
  const fmt = (iso: string, withTime = true) => {
    const [datePart, timePart] = iso.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    const hour = timePart ? parseInt(timePart.slice(0, 2), 10) : 20;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${ordinal(d)} ${MONTHS[(m || 1) - 1]}${withTime ? ` ${h12} ${ampm}` : ''}`;
  };
  return `${fmt(startIso)} TO ${fmt(endIso)}`;
}

function addDaysIsoDate(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().slice(0, 10);
}

function calendarDateForDay(
  dayNumber: number,
  dayDates?: Record<number, string> | Record<string, string>
) {
  return combiCalendarDate(dayNumber, dayDates);
}

function toCombiDay(
  dayNumber: number,
  title: string,
  startIso: string,
  endIso: string,
  timeRange: string,
  matches: Array<{ team1: string; team2: string }>,
  calendarDate?: string
): DayCombiFixture {
  const cutoffDate = calendarDate || calendarDateForDay(dayNumber);
  const cutoffIso = `${cutoffDate}T21:30:00+05:30`;
  return {
    dayNumber,
    title,
    dateStr: timeRange,
    cutoffDateStr: formatCutoffLabel(cutoffIso),
    startIso,
    endIso,
    cutoffIso,
    calendarDate: cutoffDate,
    matches: matches.map((m) => ({
      team1Key: m.team1.toUpperCase().trim(),
      team2Key: m.team2.toUpperCase().trim(),
      events: [],
    })),
  };
}

function buildCombiSchedule(opts?: {
  totalDays?: number;
  dayDates?: Record<number, string> | Record<string, string>;
  pairings?: Array<{ dayNumber?: number; team1Name?: string; team2Name?: string }>;
  stages?: Array<{ startDay?: number; durationDays?: number; kind?: string; name?: string }>;
}): DayCombiFixture[] {
  const dates = opts?.dayDates;
  const official = officialMatchDays().map((d) => {
    const calendarDate = calendarDateForDay(d.dayNumber, dates);
    // The monument keeps its own play window only while it still falls on its original
    // day; once the organizer moves the calendar, the window follows the new date.
    const onOriginalDate = d.endIso.slice(0, 10) === calendarDate;
    const startIso = onOriginalDate ? d.startIso : `${addDaysIsoDate(calendarDate, -1)}T20:00:00+05:30`;
    const endIso = onOriginalDate ? d.endIso : `${calendarDate}T20:00:00+05:30`;
    return toCombiDay(
      d.dayNumber,
      d.title,
      startIso,
      endIso,
      onOriginalDate ? d.timeRange : formatDayRange(startIso, endIso),
      d.matches,
      calendarDate
    );
  });
  const byDay = new Map(official.map((d) => [d.dayNumber, d]));

  (opts?.pairings || []).forEach((p) => {
    const dayNumber = p.dayNumber;
    if (!dayNumber || !p.team1Name || !p.team2Name) return;
    const existing = byDay.get(dayNumber);
    const match = {
      team1Key: p.team1Name.toUpperCase().trim(),
      team2Key: p.team2Name.toUpperCase().trim(),
      events: [],
    };
    if (existing) {
      const dup = existing.matches.some(
        (m) =>
          (m.team1Key === match.team1Key && m.team2Key === match.team2Key) ||
          (m.team1Key === match.team2Key && m.team2Key === match.team1Key)
      );
      if (!dup) existing.matches.push(match);
      return;
    }
    const dateStr = calendarDateForDay(dayNumber, opts?.dayDates);
    const startIso = `${addDaysIsoDate(dateStr, -1)}T20:00:00+05:30`;
    const endIso = `${dateStr}T20:00:00+05:30`;
    const stage = (opts?.stages || []).find((s) => {
      const start = s.startDay || 0;
      const end = start + (s.durationDays || 1) - 1;
      return dayNumber >= start && dayNumber <= end;
    });
    byDay.set(
      dayNumber,
      toCombiDay(
        dayNumber,
        stage?.name ? `${stage.name.toUpperCase()} · DAY ${dayNumber}` : `DAY ${dayNumber}`,
        startIso,
        endIso,
        formatDayRange(startIso, endIso),
        [{ team1: match.team1Key, team2: match.team2Key }],
        dateStr
      )
    );
  });

  const officialMax = official.reduce((max, d) => Math.max(max, d.dayNumber), 7);
  const stageMax = opts?.stages?.length ? stageSpanDays(opts.stages as any) : 0;
  const totalDays = Math.max(officialMax, opts?.totalDays || 0, stageMax, 7);

  const days: DayCombiFixture[] = [];
  for (let n = 1; n <= totalDays; n += 1) {
    if (byDay.has(n)) {
      days.push(byDay.get(n)!);
      continue;
    }
    const dateStr = calendarDateForDay(n, opts?.dayDates);
    const startIso = `${addDaysIsoDate(dateStr, -1)}T20:00:00+05:30`;
    const endIso = `${dateStr}T20:00:00+05:30`;
    const stage = (opts?.stages || []).find((s) => {
      const start = s.startDay || 0;
      const end = start + (s.durationDays || 1) - 1;
      return n >= start && n <= end;
    });
    days.push(
      toCombiDay(
        n,
        stage?.name ? `${stage.name.toUpperCase()} · DAY ${n}` : `DAY ${n}`,
        startIso,
        endIso,
        formatDayRange(startIso, endIso),
        [],
        dateStr
      )
    );
  }
  return days;
}

function buildMatchEvents(t1Key: string, t2Key: string, dayNum: number = 1, teamsList: any[] = []): EventSlot[] {
  const c1 = getTeamCombiForDay(t1Key, dayNum, teamsList);
  const c2 = getTeamCombiForDay(t2Key, dayNum, teamsList);

  return [
    { label: 'Singles 1', leftPlayers: c1?.singles1 || 'Player 1', rightPlayers: c2?.singles1 || 'Player 1' },
    { label: 'Singles 2', leftPlayers: c1?.singles2 || 'Player 2', rightPlayers: c2?.singles2 || 'Player 2' },
    { label: 'Singles 3', leftPlayers: c1?.singles3 || 'Player 3', rightPlayers: c2?.singles3 || 'Player 3' },
    { label: 'Singles 4', leftPlayers: c1?.singles4 || 'Player 4', rightPlayers: c2?.singles4 || 'Player 4' },
    { label: 'Doubles 1', leftPlayers: c1?.doubles1 || 'Doubles 1', rightPlayers: c2?.doubles1 || 'Doubles 1' },
    { label: 'Doubles 2', leftPlayers: c1?.doubles2 || 'Doubles 2', rightPlayers: c2?.doubles2 || 'Doubles 2' },
    { label: 'Doubles 3', leftPlayers: c1?.doubles3 || 'Doubles 3', rightPlayers: c2?.doubles3 || 'Doubles 3' },
    { label: 'Triples 1', leftPlayers: c1?.triples1 || 'Triples 1', rightPlayers: c2?.triples1 || 'Triples 1' },
    { label: 'Triples 2', leftPlayers: c1?.triples2 || 'Triples 2', rightPlayers: c2?.triples2 || 'Triples 2' },
  ];
}

function filenameToken(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function DailyCombisClient({
  initialTeams = [],
  pageCms = DEFAULT_WEBSITE_CMS.pages.combis,
  shortName = DEFAULT_WEBSITE_CMS.site.shortName,
  editionLabel = DEFAULT_WEBSITE_CMS.site.editionLabel,
}: {
  initialTeams?: any[];
  pageCms?: WebsitePageHeading;
  shortName?: string;
  editionLabel?: string;
}) {
  const [dbTeams, setDbTeams] = React.useState<any[]>(initialTeams);
  const [pickedDayNum, setPickedDayNum] = React.useState<number>(0);
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [scheduleMeta, setScheduleMeta] = React.useState<{
    totalDays?: number;
    dayDates?: Record<number, string>;
    pairings?: Array<{ dayNumber?: number; team1Name?: string; team2Name?: string }>;
    stages?: Array<{ startDay?: number; durationDays?: number; kind?: string; name?: string }>;
  }>({});
  const nowMs = new Date().getTime();

  const scheduleDays = React.useMemo(
    () =>
      buildCombiSchedule({
        totalDays: scheduleMeta.totalDays,
        dayDates: scheduleMeta.dayDates,
        pairings: scheduleMeta.pairings,
        stages: scheduleMeta.stages,
      }),
    [scheduleMeta]
  );

  // Derived rather than stored, so the very first paint already shows a real day
  // instead of "Day 0" while the schedule loads.
  const selectedDayNum = React.useMemo(() => {
    if (pickedDayNum && scheduleDays.some((d) => d.dayNumber === pickedDayNum)) return pickedDayNum;
    if (!scheduleDays.length) return 1;
    const now = Date.now();
    const live = scheduleDays.find((d) => monumentStatus(d, now) === 'live');
    const revealed = [...scheduleDays].reverse().find((d) => now >= new Date(d.cutoffIso).getTime());
    return live?.dayNumber || revealed?.dayNumber || scheduleDays[0].dayNumber;
  }, [pickedDayNum, scheduleDays]);

  // Update captain names and sync teams
  React.useEffect(() => {
    if (initialTeams && initialTeams.length > 0) {
      setDbTeams(initialTeams);
      initialTeams.forEach((t: any) => {
        const k = t.name.toUpperCase();
        if (TEAMS_INFO[k] && t.captain?.name) {
          TEAMS_INFO[k].captain = t.captain.name;
        }
      });
    }

    async function fetchSupabaseData() {
      try {
        const res = await get200thEditionCombisData();
        if (res.success) {
          if (res.teams && res.teams.length > 0) {
            setDbTeams(res.teams);
            res.teams.forEach((t: any) => {
              const k = t.name.toUpperCase();
              if (TEAMS_INFO[k] && t.captain?.name) {
                TEAMS_INFO[k].captain = t.captain.name;
              }
            });
          }
          const pairings = resolveOrganizerPairings(
            (res as any).stageConfig?.stages || [],
            res.teams || [],
          ).map((p) => ({
            dayNumber: p.dayNumber,
            team1Name: p.team1Name,
            team2Name: p.team2Name,
          }));
          let dayDates: Record<number, string> = {};
          if (res.edition?.dayDates) {
            try {
              dayDates = JSON.parse(res.edition.dayDates);
            } catch {}
          }
          setScheduleMeta({
            totalDays: res.edition?.totalDays,
            dayDates,
            pairings,
            stages: (res as any).stageConfig?.stages || [],
          });
        }
      } catch (e) {
        console.error('Supabase live fetch error:', e);
      }
    }
    fetchSupabaseData();
  }, [initialTeams]);

  const activeDayFixture = scheduleDays.find((d) => d.dayNumber === selectedDayNum) || scheduleDays[0];

  // Cutoff calculation (9:30 PM IST on start date)
  const cutoffTimeMs = new Date(activeDayFixture.cutoffIso).getTime();
  const isRevealed = nowMs >= cutoffTimeMs;

  const filteredMatches = activeDayFixture.matches.map((m) => ({
    ...m,
    events: buildMatchEvents(m.team1Key, m.team2Key, selectedDayNum, dbTeams),
  })).filter((m) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const t1KeyUpper = m.team1Key?.trim().toUpperCase();
    const t2KeyUpper = m.team2Key?.trim().toUpperCase();
    const t1 = TEAMS_INFO[t1KeyUpper]?.name.toLowerCase() || '';
    const t2 = TEAMS_INFO[t2KeyUpper]?.name.toLowerCase() || '';
    const c1 = TEAMS_INFO[t1KeyUpper]?.captain.toLowerCase() || '';
    const c2 = TEAMS_INFO[t2KeyUpper]?.captain.toLowerCase() || '';
    const inEvents = m.events.some((e) => e.leftPlayers.toLowerCase().includes(term) || e.rightPlayers.toLowerCase().includes(term));
    return t1.includes(term) || t2.includes(term) || c1.includes(term) || c2.includes(term) || inEvents;
  });

  const handleDownloadExcel = () => {
    const activeMatches = activeDayFixture.matches.map((m) => ({
      ...m,
      events: buildMatchEvents(m.team1Key, m.team2Key, selectedDayNum, dbTeams),
    }));

    const rows: any[] = [];

    activeMatches.forEach((match, matchIdx) => {
      const t1Name = TEAMS_INFO[match.team1Key]?.name || match.team1Key;
      const t1Capt = TEAMS_INFO[match.team1Key]?.captain || '';
      const t2Name = TEAMS_INFO[match.team2Key]?.name || match.team2Key;
      const t2Capt = TEAMS_INFO[match.team2Key]?.captain || '';

      match.events.forEach((evt) => {
        rows.push({
          'Match No': `Match ${matchIdx + 1}`,
          'Team 1': `${t1Name} (${match.team1Key})`,
          'Team 1 Captain': t1Capt,
          'Event Slot': evt.label,
          'Team 1 Player(s)': evt.leftPlayers,
          'VS': 'VS',
          'Team 2 Player(s)': evt.rightPlayers,
          'Team 2': `${t2Name} (${match.team2Key})`,
          'Team 2 Captain': t2Capt,
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 10 },
      { wch: 25 },
      { wch: 18 },
      { wch: 14 },
      { wch: 38 },
      { wch: 6 },
      { wch: 38 },
      { wch: 25 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Day ${selectedDayNum} Combis`);
    const filePrefix = filenameToken(`${shortName} ${editionLabel}`) || 'Combis';
    XLSX.writeFile(workbook, `${filePrefix}_Day_${selectedDayNum}_Combis.xlsx`);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* BANNER HEADER */}
      <div className="relative rounded-3xl overflow-hidden border border-amber-500/40 bg-gradient-to-b from-amber-950/40 via-card to-background p-6 sm:p-10 shadow-2xl space-y-6">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-teal-500/5 to-amber-500/10 pointer-events-none blur-3xl" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-amber-500/20 pb-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="CBOT Logo" className="h-10 w-10 object-contain drop-shadow-md" />
              <Badge variant="carrom" className="px-3.5 py-1 font-black text-xs uppercase tracking-widest bg-amber-500/20 text-amber-400 border-amber-500/40">
                {pageCms.badge}
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground">
              {pageCms.title}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">
              {pageCms.subtitle}
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
            {isRevealed ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 shadow-lg shadow-emerald-500/10">
                <Unlock className="h-4 w-4 text-emerald-400 animate-pulse" />
                <div>
                  <div className="text-xs font-black uppercase tracking-wider">Day {selectedDayNum} Combis Published</div>
                  <div className="text-[10px] font-bold text-emerald-300/80">Auto-Revealed @ {activeDayFixture.cutoffDateStr}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-400 shadow-lg shadow-amber-500/10">
                <Lock className="h-4 w-4 text-amber-400 animate-bounce" />
                <div>
                  <div className="text-xs font-black uppercase tracking-wider">Day {selectedDayNum} Combis Locked</div>
                  <div className="text-[10px] font-bold text-amber-300/80">Will Auto-Reveal @ {activeDayFixture.cutoffDateStr}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DAY SELECTOR TABS & SEARCH & EXCEL DOWNLOAD */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 relative z-10 pt-1">
          <div className="flex items-center gap-2 flex-wrap w-full pb-2 md:pb-0">
            {scheduleDays.map((d) => {
              const isSelected = d.dayNumber === selectedDayNum;
              const dCutoff = new Date(d.cutoffIso).getTime();
              const dRevealed = nowMs >= dCutoff;

              return (
                <button
                  key={d.dayNumber}
                  onClick={() => setPickedDayNum(d.dayNumber)}
                  className={`px-4 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30 scale-105'
                      : dRevealed
                      ? 'bg-card/90 text-foreground border-border/70 hover:border-amber-500/40'
                      : 'bg-muted/40 text-muted-foreground border-border/40 hover:text-foreground'
                  }`}
                >
                  <span>Day {d.dayNumber}</span>
                  {dRevealed ? (
                    <CheckCircle2 className={`h-3.5 w-3.5 ${isSelected ? 'text-slate-950' : 'text-emerald-400'}`} />
                  ) : (
                    <Lock className={`h-3 w-3 ${isSelected ? 'text-slate-950' : 'text-amber-400'}`} />
                  )}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search player, captain or team..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs font-bold bg-background border-border/60"
            />
          </div>
        </div>
      </div>

      {/* REVEAL LOCK NOTICE (IF NOT YET 9:30 PM ON FUTURE DAY) */}
      {!isRevealed ? (
        <div className="rounded-3xl border-2 border-amber-500/50 bg-amber-500/10 p-8 sm:p-12 text-center space-y-4 shadow-xl">
          <div className="h-16 w-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/20">
            <Lock className="h-8 w-8 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-amber-400">
              Day {selectedDayNum} Team Combis are Currently Locked
            </h2>
            <p className="text-sm font-bold text-muted-foreground max-w-lg mx-auto">
              Captains are currently saving their event match combinations. All combis for Day {selectedDayNum} will automatically publish on this website at <span className="text-amber-400 font-extrabold">{activeDayFixture.cutoffDateStr}</span>.
            </p>
          </div>
          <Badge variant="carrom" className="px-4 py-1.5 font-black text-xs uppercase tracking-wider">
            CUTOFF TIME: {activeDayFixture.cutoffDateStr}
          </Badge>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gradient-to-r from-card via-card/90 to-background border border-emerald-500/30 rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-foreground">
                  Official Day {selectedDayNum} Combinations Spreadsheet
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  {activeDayFixture.title} · {activeDayFixture.calendarDate} · {activeDayFixture.dateStr}
                </p>
              </div>
            </div>
            <Button
              onClick={handleDownloadExcel}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow-md flex items-center gap-2 border border-emerald-400 hover:scale-105 transition-all cursor-pointer shrink-0"
            >
              <Download className="h-4 w-4 text-slate-950" />
              <span>Download Excel (.xlsx)</span>
            </Button>
          </div>

          {/* MATCH CARDS GRID (2x2 LAYOUT TO FIT ALL 4 MATCHES IN FRAME) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredMatches.length === 0 ? (
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No matches scheduled for Day {selectedDayNum} yet.
            </div>
          ) : null}
          {filteredMatches.map((match, mIdx) => {
            const t1Face = resolveTeamFace({ name: match.team1Key });
            const t2Face = resolveTeamFace({ name: match.team2Key });
            const t1Info = TEAMS_INFO[t1Face.name];
            const t2Info = TEAMS_INFO[t2Face.name];
            const t1 = {
              name: t1Face.name,
              tag: t1Face.tag,
              captain: t1Info?.captain || 'Captain',
              logo: t1Face.logo,
              color: t1Info?.color || t1Face.color || 'text-foreground',
              border: t1Info?.border || t1Face.border || 'border-border',
            };
            const t2 = {
              name: t2Face.name,
              tag: t2Face.tag,
              captain: t2Info?.captain || 'Captain',
              logo: t2Face.logo,
              color: t2Info?.color || t2Face.color || 'text-foreground',
              border: t2Info?.border || t2Face.border || 'border-border',
            };

            return (
              <div
                key={mIdx}
                className="rounded-2xl border border-border/80 bg-card shadow-xl overflow-hidden space-y-0 transition-all hover:border-amber-500/40"
              >
                {/* REFINED MATCH HEADER */}
                <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-3 border-b border-amber-500/20 grid grid-cols-12 gap-2 items-center relative">
                  {/* Left Team */}
                  <div className="col-span-5 flex items-center gap-3 min-w-0">
                    <div className={`h-14 w-14 sm:h-16 sm:w-16 rounded-xl overflow-hidden bg-slate-950/90 p-1 border-2 ${t1.border} shrink-0 shadow-lg flex items-center justify-center`}>
                      <img
                        src={t1.logo}
                        alt={t1.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="leading-tight min-w-0">
                      <div className="text-xs sm:text-sm font-black text-foreground truncate">
                        <span className={t1.color}>{t1.name}</span> <span className="text-[10px] opacity-80">({t1.tag})</span>
                      </div>
                      <div className="text-[10px] font-bold text-muted-foreground truncate mt-0.5">
                        Capt: <span className="text-foreground uppercase font-extrabold">{t1.captain}</span>
                      </div>
                    </div>
                  </div>

                  {/* Center VS Badge */}
                  <div className="col-span-2 flex items-center justify-center">
                    <div className="h-8 w-8 rounded-full bg-amber-500/10 border border-amber-500/50 flex items-center justify-center text-xs font-black text-amber-400 shadow-md">
                      VS
                    </div>
                  </div>

                  {/* Right Team */}
                  <div className="col-span-5 flex items-center justify-end gap-3 text-right min-w-0">
                    <div className="leading-tight min-w-0">
                      <div className="text-xs sm:text-sm font-black text-foreground truncate">
                        <span className={t2.color}>{t2.name}</span> <span className="text-[10px] opacity-80">({t2.tag})</span>
                      </div>
                      <div className="text-[10px] font-bold text-muted-foreground truncate mt-0.5">
                        Capt: <span className="text-foreground uppercase font-extrabold">{t2.captain}</span>
                      </div>
                    </div>
                    <div className={`h-14 w-14 sm:h-16 sm:w-16 rounded-xl overflow-hidden bg-slate-950/90 p-1 border-2 ${t2.border} shrink-0 shadow-lg flex items-center justify-center`}>
                      <img
                        src={t2.logo}
                        alt={t2.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </div>
                </div>

                {/* 9 EVENT ROWS TABLE */}
                <div className="p-2.5 space-y-1 bg-background/50">
                  {match.events.map((evt, eIdx) => {
                    const isSingles = evt.label.toLowerCase().includes('singles');
                    const isDoubles = evt.label.toLowerCase().includes('doubles');

                    return (
                      <div
                        key={eIdx}
                        className="grid grid-cols-12 items-center gap-1.5 p-1.5 rounded-lg border border-border/40 bg-card/90 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all shadow-none"
                      >
                        {/* Left Team Player(s) */}
                        <div className="col-span-5 text-center font-extrabold text-[10.5px] sm:text-[11.5px] text-foreground uppercase tracking-tight break-words leading-tight whitespace-normal px-1" title={evt.leftPlayers}>
                          {evt.leftPlayers}
                        </div>

                        {/* Center Event Badge */}
                        <div className="col-span-2 flex items-center justify-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-black tracking-wider uppercase border whitespace-nowrap ${
                              isSingles
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : isDoubles
                                ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                                : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            }`}
                          >
                            {evt.label}
                          </span>
                        </div>

                        {/* Right Team Player(s) */}
                        <div className="col-span-5 text-center font-extrabold text-[10.5px] sm:text-[11.5px] text-foreground uppercase tracking-tight break-words leading-tight whitespace-normal px-1" title={evt.rightPlayers}>
                          {evt.rightPlayers}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
  </div>
);
}
