import { eventDayWindows, monumentStatus } from '@/lib/bicentennial-monuments';

/**
 * Go-live unlock is sequential by YouTube saves — not a calendar lookahead window.
 *
 * - A player's first scheduled day is always open.
 * - Day N unlocks only after that player has ≥1 real YouTube link for the previous
 *   scheduled day (Day N-1 in their fixture list).
 * - Unlocked days stay open forever so players can GO LIVE AGAIN; the latest link is shown.
 */

export type PlayWindowDay = {
  dayNumber: number;
  status: string;
};

export function currentPlayDayNumber(days: PlayWindowDay[]): number {
  const live = days.find((d) => d.status === 'live' || d.status === 'LIVE');
  if (live?.dayNumber) return live.dayNumber;

  const completed = days
    .filter((d) => d.status === 'completed' || d.status === 'COMPLETED')
    .map((d) => d.dayNumber)
    .filter((n) => n > 0);
  if (completed.length) return Math.max(...completed) + 1;

  const upcoming = days.filter((d) => d.dayNumber > 0).map((d) => d.dayNumber);
  if (upcoming.length) return Math.min(...upcoming);
  return 1;
}

/** @deprecated Kept for callers; sequential YouTube unlock no longer uses a lookahead ceiling. */
export const MATCH_LOOKAHEAD_DAYS = 0;

/** @deprecated All scheduled days can unlock; sequence is enforced via YouTube saves. */
export function maxPlayableDayNumber(_currentDay: number, totalDays: number) {
  return Math.max(1, totalDays || 1);
}

export function dayNumberFromMatchRef(opts: {
  matchId?: string | null;
  round?: number | null;
  matchNumber?: number | null;
  label?: string | null;
}): number {
  const matchId = opts.matchId || '';
  const mon = matchId.match(/monument_(\d+)/i);
  if (mon) return parseInt(mon[1], 10);
  const dayDash = matchId.match(/(?:^|[_-])day[_-]?(\d+)(?:$|[_-])/i) || matchId.match(/^day-(\d+)$/i);
  if (dayDash) return parseInt(dayDash[1], 10);
  const schedule = matchId.match(/schedule_(\d+)/i);
  if (schedule) return parseInt(schedule[1], 10);
  if (opts.label) {
    const fromLabel = opts.label.match(/day\s*(\d+)/i);
    if (fromLabel) return parseInt(fromLabel[1], 10);
  }
  if (opts.round && opts.round > 0) return opts.round;
  if (opts.matchNumber && opts.matchNumber > 0) return opts.matchNumber;
  return 0;
}

export function isRealYoutubeLink(stream: {
  youtubeUrl?: string | null;
  youtubeVideoId?: string | null;
  youtubeEmbedUrl?: string | null;
  status?: string | null;
}): boolean {
  const id = stream.youtubeVideoId || '';
  if (id && !id.startsWith('cbot_yt_')) return true;
  const url = stream.youtubeUrl || stream.youtubeEmbedUrl || '';
  if (!url || url.includes('cbot_yt_')) return false;
  return /^https?:\/\//i.test(url) && /youtu(\.be|be\.com)/i.test(url);
}

export function resolveYoutubeWatchUrl(stream: {
  youtubeUrl?: string | null;
  youtubeVideoId?: string | null;
  youtubeEmbedUrl?: string | null;
}): string | null {
  if (!isRealYoutubeLink(stream)) return null;
  const raw = stream.youtubeUrl || stream.youtubeEmbedUrl || '';
  if (raw) {
    const embed = raw.match(/youtube\.com\/embed\/([^?&/]+)/i);
    if (embed) return `https://www.youtube.com/watch?v=${embed[1]}`;
    if (/youtu(\.be|be\.com)/i.test(raw)) return raw;
  }
  if (stream.youtubeVideoId && !stream.youtubeVideoId.startsWith('cbot_yt_')) {
    return `https://www.youtube.com/watch?v=${stream.youtubeVideoId}`;
  }
  return null;
}

export type PlayerDayStreamSummary = {
  daysWithYoutube: number[];
  latestByDay: Record<
    number,
    {
      youtubeUrl: string;
      youtubeVideoId: string | null;
      streamId: string;
      status: string;
      recordedAt: string | null;
    }
  >;
  streamCountByDay: Record<number, number>;
};

export function summarizePlayerDayStreams(
  streams: Array<{
    id: string;
    matchId?: string | null;
    youtubeUrl?: string | null;
    youtubeVideoId?: string | null;
    youtubeEmbedUrl?: string | null;
    status?: string | null;
    createdAt?: Date | string | null;
    recordedAt?: Date | string | null;
    match?: { round?: number | null; matchNumber?: number | null } | null;
  }>,
): PlayerDayStreamSummary {
  const latestByDay: PlayerDayStreamSummary['latestByDay'] = {};
  const streamCountByDay: Record<number, number> = {};
  const daysWithYoutubeSet = new Set<number>();

  const sorted = [...streams].sort((a, b) => {
    const ta = new Date(a.recordedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.recordedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });

  for (const s of sorted) {
    const day = dayNumberFromMatchRef({
      matchId: s.matchId,
      round: s.match?.round,
      matchNumber: s.match?.matchNumber,
    });
    if (day < 1) continue;
    streamCountByDay[day] = (streamCountByDay[day] || 0) + 1;
    const url = resolveYoutubeWatchUrl(s);
    if (!url) continue;
    daysWithYoutubeSet.add(day);
    if (!latestByDay[day]) {
      latestByDay[day] = {
        youtubeUrl: url,
        youtubeVideoId: s.youtubeVideoId && !s.youtubeVideoId.startsWith('cbot_yt_') ? s.youtubeVideoId : null,
        streamId: s.id,
        status: s.status || 'ARCHIVED',
        recordedAt: s.recordedAt
          ? new Date(s.recordedAt).toISOString()
          : s.createdAt
            ? new Date(s.createdAt).toISOString()
            : null,
      };
    }
  }

  return {
    daysWithYoutube: [...daysWithYoutubeSet].sort((a, b) => a - b),
    latestByDay,
    streamCountByDay,
  };
}

/** Unlock by sequence among this player's scheduled days. */
export function isDayUnlockedByYoutubeSequence(
  dayNumber: number,
  scheduledDays: number[],
  daysWithYoutube: Iterable<number>,
): boolean {
  if (dayNumber < 1) return false;
  const sorted = [...new Set(scheduledDays)].filter((d) => d > 0).sort((a, b) => a - b);
  const idx = sorted.indexOf(dayNumber);
  if (idx < 0) return false;
  if (idx === 0) return true;
  const prev = sorted[idx - 1];
  const have = daysWithYoutube instanceof Set ? daysWithYoutube : new Set(daysWithYoutube);
  return have.has(prev);
}

export function unlockPrerequisiteDay(dayNumber: number, scheduledDays: number[]): number | null {
  const sorted = [...new Set(scheduledDays)].filter((d) => d > 0).sort((a, b) => a - b);
  const idx = sorted.indexOf(dayNumber);
  if (idx <= 0) return null;
  return sorted[idx - 1];
}

/** @deprecated Use isDayUnlockedByYoutubeSequence — calendar lookahead removed. */
export function isDayPlayable(dayNumber: number, _currentDay: number, totalDays: number) {
  if (dayNumber < 1) return false;
  return dayNumber <= Math.max(1, totalDays || 1);
}

/** Calendar info only — go-live gating uses YouTube sequence helpers above. */
export function tournamentPlayWindow(nowMs = Date.now(), extraTotalDays = 0) {
  const official = eventDayWindows();
  const currentDay = currentPlayDayNumber(
    official.map((window) => ({
      dayNumber: window.dayNumber,
      status: monumentStatus(window, nowMs),
    })),
  );
  const totalDays = Math.max(
    extraTotalDays || 0,
    ...official.map((window) => window.dayNumber),
    currentDay,
    1,
  );
  return {
    currentDay,
    totalDays,
    playableFromDay: 1,
    playableUntilDay: totalDays,
  };
}
