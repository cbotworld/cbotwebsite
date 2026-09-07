/**
 * Centralized IST (Indian Standard Time, Asia/Kolkata, UTC+5:30) Date & Time Utilities
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Returns the client browser's IANA timezone (e.g. "Asia/Singapore", "America/New_York", "Asia/Kolkata").
 */
export function getClientTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

/**
 * Converts any Date, ISO string, timestamp number, or legacy formatted string into standardized IST:
 * e.g. "06 Sep, 08:33 PM IST"
 */
export function formatToIst(dateInput?: Date | string | number | null, fallbackCalendarDate?: string): string {
  if (!dateInput) return '';

  // If already a complete formatted IST string with date (e.g. "06 Sep, 08:33 PM IST")
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // Check if it's an ISO string or epoch
    const isIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed);
    if (!isIso) {
      // If it already has both Month and Time (e.g., "06 Sep, 08:33 PM IST")
      const hasMonthAndDay = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(trimmed) && /\d{1,2}/.test(trimmed);
      if (hasMonthAndDay) {
        return trimmed;
      }

      // If only time was stored (e.g. "11:03 pm IST" or "08:33 PM IST") without a date
      if (fallbackCalendarDate) {
        const [y, m, d] = fallbackCalendarDate.split('-').map(Number);
        if (d && m) {
          const dayLabel = `${String(d).padStart(2, '0')} ${MONTHS[(m || 1) - 1]}`;
          return `${dayLabel}, ${trimmed}`;
        }
      }
      return trimmed;
    }
  }

  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const parts = formatter.formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  const monthNum = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10);
  const month = MONTHS[(monthNum || 1) - 1] || 'Jan';
  const hour = parts.find((p) => p.type === 'hour')?.value || '12';
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
  const dayPeriod = (parts.find((p) => p.type === 'dayPeriod')?.value || 'AM').toUpperCase();

  return `${day} ${month}, ${hour}:${minute} ${dayPeriod} IST`;
}

/**
 * Returns current server time in standardized IST format: "06 Sep, 08:33 PM IST"
 */
export function currentServerIstTimestamp(): {
  formattedIst: string;
  isoString: string;
} {
  const now = new Date();
  return {
    formattedIst: formatToIst(now),
    isoString: now.toISOString(),
  };
}
