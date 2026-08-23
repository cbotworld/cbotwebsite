import { eventDayWindows, monumentStatus } from '@/lib/bicentennial-monuments';

/**
 * Go-live unlock is sequential by YouTube saves from the current calendar day forward.
 *
 * - Past days cannot be played (watch-only). Skipping a past day does not block later days.
 * - The current calendar day is always open, even if earlier days were not played.
 * - Day N+1 unlocks only after that player has ≥1 real YouTube link for Day N
 *   (among remaining days from today forward). Example: play Day 9 and save a
 *   video, then Day 10 unlocks the same day; Day 11 needs a Day 10 video.
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

/** Practice / tie-break streams must not unlock the next official match day. */
export function isBonusPlayRef(opts: { matchId?: string | null; label?: string | null; extra?: string | null }) {
  return /practice|tie[\s._-]*break|cbot=(practice|tiebreak)/i.test(
    `${opts.matchId || ''} ${opts.label || ''} ${opts.extra || ''}`,
  );
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
      label: typeof (s as { title?: string }).title === 'string' ? (s as { title?: string }).title : null,
    });
    if (day < 1) continue;
    streamCountByDay[day] = (streamCountByDay[day] || 0) + 1;
    const url = resolveYoutubeWatchUrl(s);
    if (!url) continue;
    const bonusLabel =
      typeof (s as { title?: string }).title === 'string' ? (s as { title?: string }).title : null;
    if (
      !isBonusPlayRef({
        matchId: s.matchId,
        label: bonusLabel,
        extra: `${s.youtubeUrl || ''} ${s.youtubeEmbedUrl || ''}`,
      })
    ) {
      daysWithYoutubeSet.add(day);
    }
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

/**
 * Sequential YouTube lock applies to FUTURE days only.
 * - Past (day < currentDay): not playable.
 * - Current day: always playable — past days never block it.
 * - Future (day > currentDay): needs a YouTube save on the previous remaining day.
 */
export function isDayUnlockedByYoutubeSequence(
  dayNumber: number,
  scheduledDays: number[],
  daysWithYoutube: Iterable<number>,
  currentDay?: number,
): boolean {
  if (dayNumber < 1) return false;
  const sorted = [...new Set(scheduledDays)].filter((d) => d > 0).sort((a, b) => a - b);
  if (!sorted.length) return false;
  const fromDay = currentDay && currentDay > 0 ? currentDay : sorted[0];
  if (dayNumber < fromDay) return false;
  if (dayNumber === fromDay) return true;
  const playable = sorted.filter((d) => d >= fromDay);
  const idx = playable.indexOf(dayNumber);
  if (idx < 0) return false;
  const prev = playable[idx - 1];
  const have = daysWithYoutube instanceof Set ? daysWithYoutube : new Set(daysWithYoutube);
  return have.has(prev);
}

export function unlockPrerequisiteDay(
  dayNumber: number,
  scheduledDays: number[],
  currentDay?: number,
): number | null {
  const sorted = [...new Set(scheduledDays)].filter((d) => d > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const fromDay = currentDay && currentDay > 0 ? currentDay : sorted[0];
  if (dayNumber <= fromDay) return null;
  const playable = sorted.filter((d) => d >= fromDay);
  const idx = playable.indexOf(dayNumber);
  if (idx <= 0) return null;
  return playable[idx - 1];
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
