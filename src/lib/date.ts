export const NY_TZ = 'America/New_York';

const nyDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: NY_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const nyTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: NY_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function ymd(date = new Date()): string {
  const parts = nyDateFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export const todayYmd = () => ymd();

export function nyMinutes(date = new Date()): number {
  const parts = nyTimeFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  return (get('hour') % 24) * 60 + get('minute');
}

export function ymdPlus(days: number, from = todayYmd()): string {
  const [year, month, day] = from.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * 864e5).toISOString().slice(0, 10);
}

/** Add calendar months to a YYYY-MM-DD date (UTC arithmetic). */
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + months, day)).toISOString().slice(0, 10);
}

/** A day-first date with the year, e.g. `13 Nov 2026`. */
export const fullDate = (date: string): string => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const monthDay = (expiry: string): string => {
  const [year, month, day] = expiry.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  });
};

/** `Nov 23`, or `Jan 15 '27` when the expiry falls outside the given year. */
export const expiryText = (expiry: string, today: string): string => {
  const [year] = expiry.split('-').map(Number);
  const [todayYear] = today.split('-').map(Number);
  if (year === todayYear) return monthDay(expiry);
  return `${monthDay(expiry)} '${String(year).slice(2)}`;
};
