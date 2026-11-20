import {
  BUILTIN_LIST_IDS,
  DEFAULT_LIST,
  EXPIRATIONS,
  FILTER_PARAMS,
  RISK_PROFILES,
  STRATEGIES,
} from './config';
import { cleanListSymbols, cleanSymbols, priceBucket, priceBucketFor } from './domain';
import { cleanSector } from './sectors';
import type { Filters, SharedList, StrategyKey, UserList } from './types';

export interface ParsedUrl {
  list: string;
  sharedList: SharedList | null;
  q: string;
  strategy: StrategyKey | null;
  risk: string | null;
  expiry: string | null;
  filters: Partial<Filters>;
  sector: string | null;
  avoidEarnings: boolean | null;
  avoidDividends: boolean | null;
  exclude: string[];
  sortKey: string | null;
  sortDir: 1 | -1;
}

type NumericFilterKey = {
  [K in keyof Filters]: Filters[K] extends number ? K : never;
}[keyof Filters];

export function parseUrl(search: string, lists: UserList[]): ParsedUrl {
  const params = new URLSearchParams(search);
  const listParam = params.get('list');
  const symbolsParam = params.get('symbols');
  const sharedSymbols = symbolsParam
    ? cleanListSymbols(symbolsParam.toUpperCase().split(/[^A-Z.-]+/))
    : [];
  const listKnown =
    (listParam !== null && BUILTIN_LIST_IDS.has(listParam)) ||
    lists.some((list) => list.id === listParam);

  let sharedList: SharedList | null = null;
  if (sharedSymbols.length && !listKnown) {
    sharedList = {
      id: 'shared',
      name: (params.get('listName') || '').trim().slice(0, 40) || 'Shared list',
      symbols: sharedSymbols,
    };
  }

  const filters: Partial<Filters> = {};
  for (const [param, field] of Object.entries(FILTER_PARAMS)) {
    if (!params.has(param)) continue;
    const value = Number(params.get(param));
    if (Number.isFinite(value)) filters[field as NumericFilterKey] = value;
  }
  const bucket = params.has('price') ? priceBucket(params.get('price')!) : null;
  if (bucket) {
    filters.minPrice = bucket.minPrice;
    filters.maxPrice = bucket.maxPrice;
  }

  const strategyParam = params.get('strategy');
  const riskParam = params.get('risk');
  const expiryParam = params.get('expiry');
  const sortParam = params.get('sort') || 'dte';
  const sortKey = sortParam.replace(/^-/, '');

  return {
    list: listKnown ? listParam! : sharedList ? 'shared' : DEFAULT_LIST,
    sharedList,
    q: params.get('q') || '',
    strategy: STRATEGIES[strategyParam as StrategyKey] ? (strategyParam as StrategyKey) : null,
    risk: riskParam && RISK_PROFILES[riskParam as keyof typeof RISK_PROFILES] ? riskParam : null,
    expiry:
      expiryParam &&
      (EXPIRATIONS[expiryParam as keyof typeof EXPIRATIONS] || expiryParam === 'custom')
        ? expiryParam
        : null,
    filters,
    sector: params.has('sector') ? cleanSector(params.get('sector')) : null,
    avoidEarnings: params.has('avoid') ? params.get('avoid') === '1' : null,
    avoidDividends: params.has('avoidDiv') ? params.get('avoidDiv') === '1' : null,
    exclude: cleanSymbols((params.get('exclude') ?? '').toUpperCase().split(/[^A-Z.-]+/)),
    sortKey,
    sortDir: sortParam.startsWith('-') ? -1 : 1,
  };
}

export interface UrlSnapshot {
  list: string;
  listName?: string;
  symbols?: string[];
  q: string;
  strategy: StrategyKey;
  risk: string;
  expiry: string;
  sortKey: string;
  sortDir: 1 | -1;
  filters: Filters;
  exclude?: string[];
}

export function buildUrl(snapshot: UrlSnapshot): string {
  const params = new URLSearchParams();
  params.set('list', snapshot.list);
  if (snapshot.symbols?.length && snapshot.list !== 'favourites' && snapshot.list !== 'all') {
    params.set('symbols', snapshot.symbols.join(','));
    if (snapshot.listName) params.set('listName', snapshot.listName);
  }
  params.set('strategy', snapshot.strategy);
  params.set('risk', snapshot.risk);
  params.set('expiry', snapshot.expiry);
  params.set('sort', `${snapshot.sortDir < 0 ? '-' : ''}${snapshot.sortKey}`);
  for (const [param, field] of Object.entries(FILTER_PARAMS)) {
    params.set(param, String(snapshot.filters[field as keyof Filters]));
  }
  params.set('price', priceBucketFor(snapshot.filters));
  params.set('sector', snapshot.filters.sector);
  params.set('avoid', snapshot.filters.avoidEarnings ? '1' : '0');
  params.set('avoidDiv', snapshot.filters.avoidDividends ? '1' : '0');
  if (snapshot.exclude?.length) params.set('exclude', snapshot.exclude.join(','));
  if (snapshot.q.trim()) params.set('q', snapshot.q.trim());
  return `?${params.toString()}`;
}
