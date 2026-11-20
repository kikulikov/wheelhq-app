import type { Dividend } from './dividends';

export type OptionSide = 'P' | 'C';
export type StrategyKey = 'csp' | 'cc';

export interface Filters {
  minDte: number;
  maxDte: number;
  minDelta: number;
  maxDelta: number;
  minAnn: number;
  minYield: number;
  maxSpread: number;
  maxIv: number;
  minPrice: number;
  maxPrice: number;
  sector: string;
  avoidEarnings: boolean;
  avoidDividends: boolean;
}

export interface Row {
  contract: string;
  symbol: string;
  underlying?: string;
  side: OptionSide;
  expiry: string;
  dte: number;
  strike: number;
  bid: number;
  ask: number;
  mid: number;
  delta: number | null;
  iv: number | null;
  volume: number | null;
  price: number | null;
  change: number | null;
  changePts: number | null;
  /** Provider timestamps (ISO). Null when the provider did not send one. */
  quoteTime?: string | null;
  priceTime?: string | null;
  /** True when a quote side was crossed or not a usable number. */
  quoteInvalid?: boolean;
  /** True when the option quote is from an earlier session than the stock price. */
  quoteStale?: boolean;
}

export interface Computed {
  yld: number | null;
  ann: number | null;
  otm: number | null;
  spread: number | null;
  be: number | null;
}

export interface AssetInfo {
  symbol: string;
  name: string;
  exchange: string;
}

export interface KeyPair {
  keyId: string;
  secret: string;
}

export interface UserList {
  id: string;
  name: string;
  symbols: string[];
}

export interface SharedList extends UserList {
  id: 'shared';
}

export interface ChainScope {
  type: 'call' | 'put';
  minDte: number;
  maxDte: number;
}

export interface ScreenResult {
  generatedAt: string;
  delayed: boolean;
  errors: Record<string, string>;
  priceError: string;
  missingPrices: string[];
  truncatedChains: string[];
  chainPages: number;
  rows: Row[];
}

export interface SortState {
  key: string;
  dir: 1 | -1;
}

export interface IndexesData {
  schemaVersion: 1;
  effectiveDate: string;
  generatedAt: string;
  indexes: { sp500: string[]; ndx: string[] };
  sectors: Record<string, string>;
}

export interface EarningsEvent {
  date: string;
  session: 'before_open' | 'after_close' | 'unknown';
  status: 'expected' | 'estimated';
  name: string | null;
  marketCap: number | null;
}

export interface EarningsData {
  schemaVersion: 1;
  effectiveDate: string;
  generatedAt: string;
  horizonEnd: string;
  currency: 'USD';
  earnings: Record<string, EarningsEvent>;
  /** Entries dropped by the parser; kept so the UI can disclose them. */
  rejected?: number;
}

export interface Dataset<T> {
  data: T;
  source: 'remote' | 'bundled';
}

export interface EarningsContext {
  events: Record<string, EarningsEvent>;
  today: string;
}

export interface DividendContext {
  bySymbol: Record<string, Dividend[]>;
  today: string;
}
