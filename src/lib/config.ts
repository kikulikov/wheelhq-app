import type { Filters, OptionSide, StrategyKey } from './types';

export const DATA_BASE = 'https://data.alpaca.markets';
export const PAPER_BROKER_BASE = 'https://paper-api.alpaca.markets';
export const LIVE_BROKER_BASE = 'https://api.alpaca.markets';
export const MAX_DTE = 63;
export const PAGE_CAP = 5;

export const DEFAULT_WATCHLIST =
  'AAPL MSFT NVDA TSLA AMD AMZN GOOGL META NFLX JPM XOM JNJ KO PG WMT T VZ BA CAT HD DIS NKE SBUX PLTR'.split(
    ' ',
  );

export const MAX_LIST_SYMBOLS = 50;
export const MIN_SHARE_PRICE = 0;
export const PRICE_MAX = 1_000_000;
export const MAX_ABS_DELTA = 0.5;

export const PRICE_BUCKETS = [
  { key: 'under75', label: '< $75', minPrice: 0, maxPrice: 75 },
  { key: '75-150', label: '$75–150', minPrice: 75, maxPrice: 150 },
  { key: '150-300', label: '$150–300', minPrice: 150, maxPrice: 300 },
  { key: '300plus', label: '$300+', minPrice: 300, maxPrice: PRICE_MAX },
] as const;

export const DEFAULT_PRICE_BUCKET = '75-150';

export const BUILTIN_LISTS = {
  sp500: { id: 'sp500', name: 'S&P 500' },
  ndx: { id: 'ndx', name: 'Nasdaq-100' },
} as const;

export const BUILTIN_LIST_IDS = new Set(['all', 'favourites', ...Object.keys(BUILTIN_LISTS)]);

/** Universes scanned market-wide, where the price bucket bounds the request budget. */
export const MARKET_LIST_IDS = new Set(['all', ...Object.keys(BUILTIN_LISTS)]);

export const DEFAULT_LIST = 'ndx';

export const SNAPSHOT_BATCH_SIZE = 200;
// Corporate actions has no documented per-symbol cap; 200 keeps URLs short.
// Stock snapshots accept 200 symbols per request.
export const DIVIDEND_BATCH_SIZE = 200;
export const DIVIDEND_PAGE_CAP = 10;
export const REQUEST_TIMEOUT_MS = 20_000;

export const DEFAULT_FILTERS: Filters = {
  minDte: 1,
  maxDte: 7,
  minDelta: 0.15,
  maxDelta: 0.35,
  minAnn: 10,
  minYield: 0,
  maxSpread: 0,
  maxIv: 0,
  minPrice: 75,
  maxPrice: 150,
  sector: 'all',
  avoidEarnings: false,
  avoidDividends: false,
};

export const STRATEGIES: Record<
  StrategyKey,
  {
    label: string;
    name: string;
    side: OptionSide;
    description: string;
  }
> = {
  csp: {
    label: 'CSP',
    name: 'Cash-secured put',
    side: 'P',
    description: 'Sell cash-secured puts to get paid while waiting to buy shares at your strike.',
  },
  cc: {
    label: 'CC',
    name: 'Covered call',
    side: 'C',
    description: 'Sell covered calls against shares you already own to collect premium.',
  },
};

export const FILTER_LIMITS = {
  maxIv: { min: 0, max: 150, step: 5 },
  minYield: { min: 0, max: 50, step: 0.5 },
  minAnn: { min: 0, max: 200, step: 1 },
  maxSpread: { min: 0, max: 100, step: 1 },
} as const;

export const RISK_PROFILES = {
  conservative: {
    label: 'Conservative',
    filters: { minDelta: 0.1, maxDelta: 0.25, minAnn: 8, maxSpread: 0 },
  },
  balanced: {
    label: 'Balanced',
    filters: { minDelta: 0.15, maxDelta: 0.35, minAnn: 10, maxSpread: 0 },
  },
  aggressive: {
    label: 'Aggressive',
    filters: { minDelta: 0.3, maxDelta: 0.5, minAnn: 20, maxSpread: 0 },
  },
};

export const EXPIRATIONS = {
  '0d': { label: 'Today', dte: [0, 0] as const },
  '1-7': { label: 'Weekly', dte: [1, 7] as const },
  '8-14': { label: '1–2 weeks out', dte: [8, 14] as const },
  '15-28': { label: '2–4 weeks out', dte: [15, 28] as const },
  '29-63': { label: '1–2 months out', dte: [29, MAX_DTE] as const },
};

export const DEFAULT_EXPIRY = '1-7';

export const COLUMNS = [
  { key: 'symbol', label: 'Ticker' },
  { key: 'expiry', label: 'Expiry' },
  { key: 'dte', label: 'DTE' },
  { key: 'strike', label: 'Strike' },
  { key: 'price', label: 'Equity' },
  { key: 'change', label: 'Today %' },
  { key: 'bid', label: 'Bid' },
  { key: 'spread', label: 'Spread %' },
  { key: 'yld', label: 'Yield %' },
  { key: 'ann', label: 'Ann %' },
  { key: 'otm', label: 'OTM %' },
  { key: 'delta', label: 'Delta' },
  { key: 'iv', label: 'IV %' },
  { key: 'volume', label: 'Vol' },
  { key: 'be', label: 'Breakeven' },
];

export const FILTER_PARAMS = {
  dteMin: 'minDte',
  dteMax: 'maxDte',
  deltaMin: 'minDelta',
  deltaMax: 'maxDelta',
  ann: 'minAnn',
  yield: 'minYield',
  spread: 'maxSpread',
  iv: 'maxIv',
} as const;

export const TV_EXCHANGES: Record<string, string> = {
  NASDAQ: 'NASDAQ',
  NYSE: 'NYSE',
  AMEX: 'AMEX',
  ARCA: 'AMEX',
  NYSEARCA: 'AMEX',
  BATS: 'CBOE',
};
