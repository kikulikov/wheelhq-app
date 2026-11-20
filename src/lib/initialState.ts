import {
  BUILTIN_LIST_IDS,
  COLUMNS,
  DEFAULT_EXPIRY,
  DEFAULT_FILTERS,
  DEFAULT_LIST,
  EXPIRATIONS,
  RISK_PROFILES,
  STRATEGIES,
} from './config';
import { matchExpiry, matchRisk, normalizeExpiry, sanitizeFilters } from './domain';
import { SECTOR_ALL, sectorOptions } from './sectors';
import type { Filters, SharedList, SortState, StrategyKey, UserList } from './types';
import { parseUrl, type ParsedUrl } from './url';

export interface InitialStateInput {
  search: string;
  lists: UserList[];
  storedFilters: Filters | null;
  storedStrategy: string;
  storedRisk: string;
  storedExpiry: string;
  storedActiveList: string;
}

export interface InitialScreenState {
  parsedUrl: ParsedUrl;
  filters: Filters;
  strategy: StrategyKey;
  risk: string;
  expiry: string;
  list: string;
  sharedList: SharedList | null;
  sort: SortState;
}

/** Resolve URL, saved filters, and defaults into the first rendered screen state. */
export function resolveInitialScreenState(input: InitialStateInput): InitialScreenState {
  const parsedUrl = parseUrl(input.search, input.lists);
  const filters: Filters = { ...DEFAULT_FILTERS, ...(input.storedFilters ?? {}) };
  if (parsedUrl.sector !== null) filters.sector = parsedUrl.sector;
  if (parsedUrl.avoidEarnings !== null) filters.avoidEarnings = parsedUrl.avoidEarnings;
  if (parsedUrl.avoidDividends !== null) filters.avoidDividends = parsedUrl.avoidDividends;

  const strategy: StrategyKey =
    parsedUrl.strategy ??
    (STRATEGIES[input.storedStrategy as StrategyKey]
      ? (input.storedStrategy as StrategyKey)
      : 'csp');

  const risk =
    parsedUrl.risk ??
    (RISK_PROFILES[input.storedRisk as keyof typeof RISK_PROFILES]
      ? input.storedRisk
      : (matchRisk(filters, RISK_PROFILES) ?? 'balanced'));
  if (parsedUrl.risk) {
    Object.assign(filters, RISK_PROFILES[parsedUrl.risk as keyof typeof RISK_PROFILES].filters);
  }

  let expiry: string =
    parsedUrl.expiry ??
    (EXPIRATIONS[input.storedExpiry as keyof typeof EXPIRATIONS]
      ? input.storedExpiry
      : input.storedExpiry === 'custom'
        ? 'custom'
        : input.storedFilters
          ? (matchExpiry(filters, EXPIRATIONS) ?? 'custom')
          : DEFAULT_EXPIRY);
  if (parsedUrl.expiry && EXPIRATIONS[parsedUrl.expiry as keyof typeof EXPIRATIONS]) {
    const [min, max] = EXPIRATIONS[parsedUrl.expiry as keyof typeof EXPIRATIONS].dte;
    filters.minDte = min;
    filters.maxDte = max;
  }
  Object.assign(filters, parsedUrl.filters);
  Object.assign(filters, sanitizeFilters(filters));
  expiry = normalizeExpiry(expiry, input.storedFilters);
  if (
    EXPIRATIONS[expiry as keyof typeof EXPIRATIONS] &&
    (filters.minDte !== EXPIRATIONS[expiry as keyof typeof EXPIRATIONS].dte[0] ||
      filters.maxDte !== EXPIRATIONS[expiry as keyof typeof EXPIRATIONS].dte[1])
  ) {
    expiry = 'custom';
  }

  const params = new URLSearchParams(input.search);
  const storedListValid =
    BUILTIN_LIST_IDS.has(input.storedActiveList) ||
    input.lists.some((list) => list.id === input.storedActiveList);
  let list =
    params.has('list') || params.has('symbols')
      ? parsedUrl.list
      : storedListValid
        ? input.storedActiveList
        : DEFAULT_LIST;
  const sharedList = parsedUrl.sharedList;
  if (list === 'shared' && !sharedList) list = DEFAULT_LIST;
  if (!sectorOptions().some((option) => option.key === filters.sector)) {
    filters.sector = SECTOR_ALL;
  }

  const sortKey = COLUMNS.some((column) => column.key === parsedUrl.sortKey)
    ? parsedUrl.sortKey!
    : 'dte';

  return {
    parsedUrl,
    filters,
    strategy,
    risk,
    expiry,
    list,
    sharedList,
    sort: { key: sortKey, dir: parsedUrl.sortDir },
  };
}
