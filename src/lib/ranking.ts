import { ymd } from './date';

/** The window after the official close where today's daily bar is treated as final. */
const AFTER_CLOSE_MINUTES = 16 * 60 + 15;

export interface Bar {
  t?: string;
  c?: number;
  v?: number;
  n?: number;
}

export interface RawSnapshot {
  latestTrade?: { p?: number; t?: string };
  dailyBar?: Bar;
  prevDailyBar?: Bar;
}

export interface Liquidity {
  dv: number;
  trades: number;
  /** Underlying price, when the snapshot supplied one. */
  price?: number | null;
}

export interface SnapshotInfo extends Liquidity {
  price: number | null;
  previous: number | null;
  barDate: string | null;
  /** When the chosen price observation was published, when the provider says. */
  priceTime: string | null;
  /** False when Alpaca returned no snapshot entry for the symbol at all. */
  present: boolean;
}

/**
 * The most recent completed session, given what the snapshot returned.
 * While today's bar exists and it is before the close, today is still in
 * progress, so the previous session is the one to rank on.
 */
export function sessionBar(
  raw: RawSnapshot | null | undefined,
  today: string,
  minutes: number,
): Bar | null {
  const daily = raw?.dailyBar;
  const previous = raw?.prevDailyBar;
  const dailyIsToday = !!daily?.t && ymd(new Date(daily.t)) === today;
  const usePrev = dailyIsToday && minutes < AFTER_CLOSE_MINUTES;
  const chosen = usePrev ? previous : daily;
  const other = usePrev ? daily : previous;
  return chosen ?? other ?? null;
}

export function snapshotInfo(
  raw: RawSnapshot | null | undefined,
  today: string,
  minutes: number,
): SnapshotInfo {
  const chosen = sessionBar(raw, today, minutes);
  const alt = chosen === raw?.dailyBar ? raw?.prevDailyBar : raw?.dailyBar;
  const bar = (chosen?.v ?? 0) > 0 ? chosen : (alt?.v ?? 0) > 0 ? alt : null;
  const price = newestObservation(
    observation(raw?.latestTrade?.p, raw?.latestTrade?.t),
    observation(raw?.dailyBar?.c, raw?.dailyBar?.t),
  );
  return {
    price: price?.value ?? null,
    previous: raw?.prevDailyBar?.c ?? null,
    dv: bar ? (bar.v ?? 0) * (bar.c ?? 0) : 0,
    trades: bar?.n ?? 0,
    barDate: bar?.t ? ymd(new Date(bar.t)) : null,
    priceTime: price?.time ?? null,
    present: raw != null,
  };
}

interface Observation {
  value: number;
  time: string | null;
}

function observation(value: number | undefined, time: string | undefined): Observation | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const parsed = typeof time === 'string' ? Date.parse(time) : Number.NaN;
  return { value, time: Number.isFinite(parsed) ? time! : null };
}

/**
 * The newest price the provider sent. A trade without a timestamp cannot be
 * shown to be newer than a timestamped close, so the close wins; when neither
 * is timestamped the trade keeps its historical preference.
 */
function newestObservation(
  trade: Observation | null,
  close: Observation | null,
): Observation | null {
  if (!trade || !close) return trade ?? close;
  if (!close.time) return trade;
  if (!trade.time) return close;
  return Date.parse(close.time) > Date.parse(trade.time) ? close : trade;
}

/**
 * Dollar volume, then trade count, then symbol. Symbols without a usable
 * score keep their input order at the end.
 */
export function rankByLiquidity(symbols: string[], scores: Record<string, Liquidity>): string[] {
  const scored: string[] = [];
  const rest: string[] = [];
  for (const symbol of symbols) {
    const score = scores[symbol];
    if (score && score.dv > 0) scored.push(symbol);
    else rest.push(symbol);
  }
  scored.sort((a, b) => {
    const left = scores[a];
    const right = scores[b];
    if (right.dv !== left.dv) return right.dv - left.dv;
    if (right.trades !== left.trades) return right.trades - left.trades;
    return a.localeCompare(b);
  });
  return [...scored, ...rest];
}
