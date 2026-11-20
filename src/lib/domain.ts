import {
  DEFAULT_EXPIRY,
  DEFAULT_PRICE_BUCKET,
  EXPIRATIONS,
  FILTER_LIMITS,
  MAX_ABS_DELTA,
  MAX_DTE,
  MAX_LIST_SYMBOLS,
  PRICE_BUCKETS,
  TV_EXCHANGES,
} from './config';
import { nextDividend, dividendsForRow } from './dividends';
import { nextEarnings } from './earnings';
import { cleanSector } from './sectors';
import type {
  ChainScope,
  Computed,
  DividendContext,
  EarningsContext,
  Filters,
  Row,
  StrategyKey,
} from './types';

export const cleanSymbols = (symbols: unknown): string[] => [
  ...new Set(
    (Array.isArray(symbols) ? symbols : [])
      .map((symbol) => String(symbol).trim().toUpperCase())
      .filter((symbol) => /^[A-Z][A-Z.-]{0,9}$/.test(symbol)),
  ),
];

export const cleanListSymbols = (symbols: unknown): string[] =>
  cleanSymbols(symbols).slice(0, MAX_LIST_SYMBOLS);

export function priceBucketFor(filters: Filters): string {
  return (
    PRICE_BUCKETS.find(
      (bucket) => bucket.minPrice === filters.minPrice && bucket.maxPrice === filters.maxPrice,
    )?.key ?? DEFAULT_PRICE_BUCKET
  );
}

export function priceBucket(key: string) {
  return PRICE_BUCKETS.find((bucket) => bucket.key === key) ?? null;
}

export function inPriceBucket(price: number | null, filters: Filters): boolean {
  return price != null && price >= filters.minPrice && price < filters.maxPrice;
}

export function matchRisk(
  filters: Filters,
  profiles: Record<string, { filters: Partial<Filters> }>,
): string | null {
  return (
    Object.keys(profiles).find((key) =>
      Object.entries(profiles[key].filters).every(
        ([field, value]) => filters[field as keyof Filters] === value,
      ),
    ) || null
  );
}

export function matchExpiry(
  filters: Filters,
  expirations: Record<string, { dte: readonly number[] }>,
): string | null {
  return (
    Object.keys(expirations).find(
      (key) =>
        expirations[key].dte[0] === filters.minDte && expirations[key].dte[1] === filters.maxDte,
    ) || null
  );
}

export function normalizeExpiry(
  value: string,
  filters: Filters | null,
  presets = EXPIRATIONS,
): string {
  if (value === 'custom') return 'custom';
  if (presets[value as keyof typeof presets]) return value;
  return filters ? 'custom' : DEFAULT_EXPIRY;
}

function clampNumber(value: unknown, min: number, max: number): number {
  const parsed = Number(value);
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : 0, min), max);
}

export function sanitizeFilters(input: Filters): Filters {
  const filters: Filters = { ...input };
  filters.maxDte = Math.round(clampNumber(filters.maxDte, 0, MAX_DTE));
  filters.minDte = Math.round(clampNumber(filters.minDte, 0, filters.maxDte));
  filters.maxDelta = clampNumber(filters.maxDelta, 0, MAX_ABS_DELTA);
  filters.minDelta = clampNumber(filters.minDelta, 0, filters.maxDelta);
  for (const [field, limit] of Object.entries(FILTER_LIMITS)) {
    filters[field as keyof typeof FILTER_LIMITS] = clampNumber(
      filters[field as keyof typeof FILTER_LIMITS],
      limit.min,
      limit.max,
    );
  }
  const bucket = priceBucket(priceBucketFor(filters))!;
  filters.minPrice = bucket.minPrice;
  filters.maxPrice = bucket.maxPrice;
  filters.sector = cleanSector(filters.sector);
  filters.avoidEarnings = filters.avoidEarnings === true;
  filters.avoidDividends = filters.avoidDividends === true;
  return filters;
}

export function applyFilterPatch(filters: Filters, patch: Partial<Filters>): Filters {
  return sanitizeFilters({ ...filters, ...patch });
}

export interface NormalizedQuote {
  bid: number;
  ask: number;
  mid: number;
  /** True when a side is present but not a usable number, or bid exceeds ask. */
  invalid: boolean;
}

/**
 * Turn raw provider quote fields into a usable quote. Missing sides become
 * zero; a crossed or non-numeric side is flagged so no metric is derived
 * from it. The row itself is kept so the contract stays visible.
 */
export function normalizeQuote(bp: unknown, ap: unknown): NormalizedQuote {
  const side = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  const bid = side(bp);
  const ask = side(ap);
  const invalid = (bp != null && bid === null) || (ap != null && ask === null);
  const crossed = bid != null && ask != null && bid > 0 && ask > 0 && bid > ask;
  return {
    bid: bid ?? 0,
    ask: ask ?? 0,
    mid: bid != null && ask != null && bid > 0 && ask > 0 ? (bid + ask) / 2 : 0,
    invalid: invalid || crossed,
  };
}

export function chainScopeFor(strategy: StrategyKey, filters: Filters): ChainScope {
  return {
    type: strategy === 'cc' ? 'call' : 'put',
    minDte: Math.round(clampNumber(filters.minDte, 0, MAX_DTE)),
    maxDte: Math.round(clampNumber(filters.maxDte, 0, MAX_DTE)),
  };
}

export function chainScopeCovers(loaded: ChainScope | null, next: ChainScope): boolean {
  return (
    loaded != null &&
    loaded.type === next.type &&
    loaded.minDte === next.minDte &&
    loaded.maxDte === next.maxDte
  );
}

export function parseContract(sym: string, todayUtc = Date.now()) {
  const match = /^([A-Z]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/.exec(sym);
  if (!match) return null;
  const year = 2000 + Number(match[2]);
  const month = Number(match[3]);
  const day = Number(match[4]);
  return {
    root: match[1],
    side: match[5] as 'P' | 'C',
    expiry: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    dte: Math.round((Date.UTC(year, month - 1, day) - todayUtc) / 864e5),
    strike: Number(match[6]) / 1000,
  };
}

export function computed(row: Row): Computed {
  const price = row.price ?? 0;
  const quoteOk =
    !row.quoteInvalid &&
    Number.isFinite(row.bid) &&
    Number.isFinite(row.ask) &&
    row.bid >= 0 &&
    row.ask >= 0 &&
    !(row.ask > 0 && row.bid > row.ask);
  const yld = !quoteOk
    ? null
    : row.side === 'C'
      ? price > 0
        ? (row.bid / price) * 100
        : null
      : row.strike > 0
        ? (row.bid / row.strike) * 100
        : null;
  const ann = yld != null ? (yld * 365) / Math.max(row.dte, 1) : null;
  const otm = price > 0 ? ((row.strike - price) / price) * 100 * (row.side === 'C' ? 1 : -1) : null;
  const spread =
    quoteOk && row.ask > 0 && row.mid > 0 ? ((row.ask - row.bid) / row.mid) * 100 : null;
  const be = !quoteOk
    ? null
    : row.side === 'C'
      ? row.price == null
        ? null
        : row.price - row.bid
      : row.strike - row.bid;
  return { yld, ann, otm, spread, be };
}

const computedCache = new WeakMap<Row, Computed>();

/** Memoize `computed()` per row object; rows are replaced on refresh. */
export function computedFor(row: Row): Computed {
  const cached = computedCache.get(row);
  if (cached) return cached;
  const value = computed(row);
  computedCache.set(row, value);
  return value;
}

export function pass(
  row: Row,
  c: Computed,
  side: 'P' | 'C',
  filters: Filters,
  earnings?: EarningsContext,
  dividends?: DividendContext,
): boolean {
  if (row.side !== side) return false;
  // A quote from an earlier session cannot be screened on: the premium may be
  // a day old even though the stock price is current.
  if (row.quoteStale) return false;
  if (filters.avoidEarnings && earnings) {
    const event = nextEarnings(
      earnings.events,
      earnings.today,
      row.expiry,
      row.underlying ?? row.symbol,
    );
    if (event) return false;
  }
  if (filters.avoidDividends && dividends) {
    const event = nextDividend(
      dividendsForRow(dividends.bySymbol, row),
      dividends.today,
      row.expiry,
    );
    if (event) return false;
  }
  if (!inPriceBucket(row.price, filters)) return false;
  if (row.dte < filters.minDte || row.dte > filters.maxDte) return false;
  if (
    row.delta == null ||
    Math.abs(row.delta) < filters.minDelta ||
    Math.abs(row.delta) > filters.maxDelta
  )
    return false;
  if (c.ann == null ? filters.minAnn > 0 : c.ann < filters.minAnn) return false;
  if (c.yld == null ? filters.minYield > 0 : c.yld < filters.minYield) return false;
  if (filters.maxSpread > 0 && (c.spread == null || c.spread > filters.maxSpread)) {
    return false;
  }
  if (filters.maxIv > 0 && (row.iv == null || row.iv * 100 > filters.maxIv)) return false;
  return true;
}

export function tradingViewUrl(symbol: string, equity = symbol, exchange = ''): string {
  const prefix = TV_EXCHANGES[exchange];
  return prefix
    ? `https://www.tradingview.com/symbols/${prefix}-${encodeURIComponent(equity)}/`
    : `https://www.tradingview.com/symbols/${encodeURIComponent(equity)}/`;
}

export function retryDelayMs(attempt: number, retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 10_000);
  return Math.min(1000 * 2 ** attempt, 8_000);
}

export const dteToPos = (dte: number): number =>
  Math.round((Math.log1p(Math.max(0, Math.min(dte, MAX_DTE))) / Math.log1p(MAX_DTE)) * 1000);

export const posToDte = (pos: number): number =>
  Math.round(Math.expm1((Math.max(0, Math.min(pos, 1000)) / 1000) * Math.log1p(MAX_DTE)));
