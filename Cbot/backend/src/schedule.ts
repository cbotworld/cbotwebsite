export type ScheduleDayStatus = "live" | "completed" | "upcoming";

export type ScheduleDay = {
  dayNumber: number;
  label: string;
  title: string;
  timeRange: string;
  startIso: string;
  endIso: string;
  status: ScheduleDayStatus;
};

/** Same 8pm→8pm IST windows as CBOT Match Schedule (website). No database. */
const OFFICIAL_DAYS: Array<Omit<ScheduleDay, "label" | "status">> = [
  {
    dayNumber: 1,
    title: "BICENTENNIAL MONUMENT 1",
    timeRange: "9TH AUG 9 PM TO 10TH AUG 8 PM",
    startIso: "2026-08-09T21:00:00+05:30",
    endIso: "2026-08-10T20:00:00+05:30",
  },
  {
    dayNumber: 2,
    title: "BICENTENNIAL MONUMENT 2",
    timeRange: "10TH AUG 8 PM TO 11TH AUG 8 PM",
    startIso: "2026-08-10T20:00:00+05:30",
    endIso: "2026-08-11T20:00:00+05:30",
  },
  {
    dayNumber: 3,
    title: "BICENTENNIAL MONUMENT 3",
    timeRange: "11TH AUG 8 PM TO 12TH AUG 8 PM",
    startIso: "2026-08-11T20:00:00+05:30",
    endIso: "2026-08-12T20:00:00+05:30",
  },
  {
    dayNumber: 4,
    title: "BICENTENNIAL MONUMENT 4",
    timeRange: "12TH AUG 8 PM TO 13TH AUG 8 PM",
    startIso: "2026-08-12T20:00:00+05:30",
    endIso: "2026-08-13T20:00:00+05:30",
  },
  {
    dayNumber: 5,
    title: "BICENTENNIAL MONUMENT 5",
    timeRange: "13TH AUG 8 PM TO 14TH AUG 8 PM",
    startIso: "2026-08-13T20:00:00+05:30",
    endIso: "2026-08-14T20:00:00+05:30",
  },
  {
    dayNumber: 6,
    title: "BICENTENNIAL MONUMENT 6",
    timeRange: "14TH AUG 8 PM TO 15TH AUG 8 PM",
    startIso: "2026-08-14T20:00:00+05:30",
    endIso: "2026-08-15T20:00:00+05:30",
  },
  {
    dayNumber: 7,
    title: "BICENTENNIAL MONUMENT 7",
    timeRange: "15TH AUG 8 PM TO 16TH AUG 8 PM",
    startIso: "2026-08-15T20:00:00+05:30",
    endIso: "2026-08-16T20:00:00+05:30",
  },
  {
    dayNumber: 8,
    title: "ROYAL CARROMS 1",
    timeRange: "16TH AUG 8 PM TO 17TH AUG 8 PM",
    startIso: "2026-08-16T20:00:00+05:30",
    endIso: "2026-08-17T20:00:00+05:30",
  },
  {
    dayNumber: 9,
    title: "ROYAL CARROMS 2",
    timeRange: "17TH AUG 8 PM TO 18TH AUG 8 PM",
    startIso: "2026-08-17T20:00:00+05:30",
    endIso: "2026-08-18T20:00:00+05:30",
  },
  {
    dayNumber: 10,
    title: "ROYAL CARROMS 3",
    timeRange: "18TH AUG 8 PM TO 19TH AUG 8 PM",
    startIso: "2026-08-18T20:00:00+05:30",
    endIso: "2026-08-19T20:00:00+05:30",
  },
];

function dayStatus(startIso: string, endIso: string, nowMs: number): ScheduleDayStatus {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (nowMs >= endMs) return "completed";
  if (nowMs >= startMs && nowMs < endMs) return "live";
  return "upcoming";
}

export function getLocalSchedule(nowMs = Date.now()) {
  const days: ScheduleDay[] = OFFICIAL_DAYS.map((d) => ({
    ...d,
    label: `Day ${d.dayNumber}`,
    status: dayStatus(d.startIso, d.endIso, nowMs),
  }));
  const live = days.find((d) => d.status === "live") ?? null;
  return {
    now: new Date(nowMs).toISOString(),
    liveDay: live?.dayNumber ?? null,
    liveLabel: live?.label ?? null,
    days,
  };
}

export async function getConnectedSchedule(nowMs = Date.now()) {
  const website = (process.env.CBOT_WEBSITE_URL ?? "https://cbotworld.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${website}/api/public/schedule`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        liveDay?: number | null;
        liveLabel?: string | null;
        days?: ScheduleDay[];
      };
      if (Array.isArray(data.days) && data.days.length) {
        return {
          now: new Date(nowMs).toISOString(),
          liveDay: data.liveDay ?? null,
          liveLabel: data.liveLabel ?? (data.liveDay ? `Day ${data.liveDay}` : null),
          days: data.days,
        };
      }
    }
  } catch {
    // Fall back to the official local windows.
  }
  return getLocalSchedule(nowMs);
}
