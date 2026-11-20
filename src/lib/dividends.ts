import { addMonths, monthDay, ymdPlus } from './date';

export const DIVIDEND_CACHE_VERSION = 1;

export interface Dividend {
  ex: string;
  rate: number;
  special: boolean;
}

export interface DividendCache {
  version: number;
  date: string;
  bySymbol: Record<string, Dividend[]>;
}

export interface DividendEvent {
  date: string;
  rate: number;
  estimated: boolean;
}

export interface DividendPosition {
  side: 'P' | 'C';
  strike: number;
  bid: number;
  price: number | null;
}

const DAY_MS = 86_400_000;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function dividendWindow(today: string): { start: string; end: string } {
  return { start: addMonths(today, -13), end: addMonths(today, 3) };
}

/** Convert Alpaca corporate-action rows into sorted per-symbol history. */
export function parseDividendRows(raw: unknown): Record<string, Dividend[]> {
  const bySymbol: Record<string, Dividend[]> = {};
  if (!Array.isArray(raw)) return bySymbol;

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const symbol = typeof row.symbol === 'string' ? row.symbol.trim().toUpperCase() : '';
    const ex = typeof row.ex_date === 'string' ? row.ex_date : '';
    const rate = Number(row.rate);
    if (!symbol || !/^\d{4}-\d{2}-\d{2}$/.test(ex) || !Number.isFinite(rate) || rate <= 0) continue;
    (bySymbol[symbol] ??= []).push({ ex, rate, special: row.special === true });
  }

  for (const rows of Object.values(bySymbol)) rows.sort((a, b) => a.ex.localeCompare(b.ex));
  return bySymbol;
}

export function mergeDividendCache(
  cache: DividendCache,
  bySymbol: Record<string, Dividend[]>,
): DividendCache {
  return { ...cache, bySymbol: { ...cache.bySymbol, ...bySymbol } };
}

/** Look up the underlying symbol, falling back to the option root. */
export function dividendsForRow(
  bySymbol: Record<string, Dividend[]>,
  row: { symbol: string; underlying?: string },
): Dividend[] {
  return bySymbol[row.underlying ?? row.symbol] ?? [];
}

/** Estimate the next regular ex-date from the median interval between past regular rows. */
export function estimateDividend(rows: Dividend[], today: string): DividendEvent | null {
  const regular = rows.filter((row) => !row.special).sort((a, b) => a.ex.localeCompare(b.ex));
  if (regular.length < 2) return null;

  const intervals = regular
    .slice(1)
    .map((row, index) =>
      Math.round(
        (Date.parse(`${row.ex}T00:00:00Z`) - Date.parse(`${regular[index].ex}T00:00:00Z`)) / DAY_MS,
      ),
    )
    .filter((days) => days > 0);
  if (!intervals.length) return null;

  const interval = Math.round(median(intervals));
  if (interval <= 0) return null;

  const last = regular[regular.length - 1];
  const staleAfter = Date.parse(`${last.ex}T00:00:00Z`) + 2 * interval * DAY_MS;
  if (staleAfter < Date.parse(`${today}T00:00:00Z`)) return null;

  let date = last.ex;
  while (date <= today) date = ymdPlus(interval, date);

  return { date, rate: last.rate, estimated: true };
}

/** The next dividend between today and the row's expiry, if any. */
export function nextDividend(
  rows: Dividend[],
  today: string,
  expiry: string,
): DividendEvent | null {
  const announced = rows
    .filter((row) => row.ex > today)
    .sort((a, b) => a.ex.localeCompare(b.ex))[0];
  if (announced) {
    return announced.ex <= expiry
      ? { date: announced.ex, rate: announced.rate, estimated: false }
      : null;
  }

  const estimate = estimateDividend(rows, today);
  return estimate && estimate.date <= expiry ? estimate : null;
}

/** Tooltip lines for the D marker; the last line flags early-assignment risk when relevant. */
export function dividendTooltip(event: DividendEvent, row: DividendPosition): string[] {
  const when = `${event.estimated ? '~' : ''}${monthDay(event.date)}`;
  const amount = `${event.estimated ? '~' : ''}$${event.rate.toFixed(2)}`;
  const lines = [
    `Ex-dividend ${when} · ${amount}${event.estimated ? ' (estimated)' : ''}`,
    'Calls are cheaper and puts dearer by about the dividend.',
  ];

  if (row.side === 'C' && row.price != null && row.price > row.strike) {
    const extrinsic = row.bid - (row.price - row.strike);
    if (extrinsic < event.rate) {
      lines.push(
        `Early-assignment risk: time value $${Math.max(0, extrinsic).toFixed(2)} < dividend.`,
      );
    }
  }
  return lines;
}
