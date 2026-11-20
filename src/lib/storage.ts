import { DEFAULT_WATCHLIST } from './config';
import { DIVIDEND_CACHE_VERSION, type Dividend, type DividendCache } from './dividends';
import { cleanListSymbols } from './domain';
import { resolveTheme, type Theme } from './theme';
import type { Filters, KeyPair, UserList } from './types';

const PREFIX = 'wheelhq.';

let storageFailure: (() => void) | null = null;

/** Called when a write fails, so the UI can stop claiming data was saved. */
export function onStorageFailure(handler: () => void): void {
  storageFailure = handler;
}
// Legacy `turnwise.` migration is scheduled for removal in 2027-01.
const LEGACY_PREFIX = 'turnwise.';

/** Read the current key, copying a legacy `turnwise.` value forward once. */
function readMigrated(storage: Storage, key: string): string | null {
  try {
    const current = storage.getItem(PREFIX + key);
    if (current !== null) return current;
    const legacy = storage.getItem(LEGACY_PREFIX + key);
    if (legacy === null) return null;
    try {
      storage.setItem(PREFIX + key, legacy);
    } catch {
      /* still serve the legacy value if the copy cannot be written */
    }
    return legacy;
  } catch {
    return null;
  }
}

/** Remove the current and legacy copies so a deleted key cannot be resurrected. */
function removeStored(storage: Storage, key: string): void {
  try {
    storage.removeItem(PREFIX + key);
    storage.removeItem(LEGACY_PREFIX + key);
  } catch {
    /* storage may be unavailable */
  }
}

export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const value = JSON.parse(readMigrated(localStorage, key) ?? 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): boolean {
    try {
      if (value == null) removeStored(localStorage, key);
      else localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      storageFailure?.();
      return false;
    }
  },
  getRaw(key: string, fallback: string | null = null): string | null {
    return readMigrated(localStorage, key) ?? fallback;
  },
  setRaw(key: string, value: string): boolean {
    try {
      localStorage.setItem(PREFIX + key, value);
      return true;
    } catch {
      storageFailure?.();
      return false;
    }
  },
  getSession<T>(key: string, fallback: T): T {
    try {
      const value = JSON.parse(readMigrated(sessionStorage, key) ?? 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  },
  setSession(key: string, value: unknown): boolean {
    try {
      if (value == null) removeStored(sessionStorage, key);
      else sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      storageFailure?.();
      return false;
    }
  },
};

export const loadWatchlist = (): string[] =>
  cleanListSymbols(store.get<string[]>('watchlist', DEFAULT_WATCHLIST));

export function loadLists(): UserList[] {
  const raw = store.get<unknown[]>('lists', []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (list): list is UserList =>
        Boolean(list) &&
        typeof list === 'object' &&
        typeof (list as UserList).id === 'string' &&
        typeof (list as UserList).name === 'string' &&
        Array.isArray((list as UserList).symbols),
    )
    .map((list) => ({
      id: list.id,
      name: String(list.name).slice(0, 40),
      symbols: cleanListSymbols(list.symbols),
    }))
    .filter((list) => list.symbols.length > 0);
}

export const loadFilters = (): Filters | null => {
  const raw = store.get<Record<string, unknown> | null>('filters', null);
  return raw && typeof raw === 'object' ? (raw as unknown as Filters) : null;
};

const isDividend = (value: unknown): value is Dividend => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.ex === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(row.ex) &&
    typeof row.rate === 'number' &&
    Number.isFinite(row.rate) &&
    typeof row.special === 'boolean'
  );
};

export const loadDividendCache = (): DividendCache | null => {
  const raw = store.get<Partial<DividendCache> | null>('dividends', null);
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version !== DIVIDEND_CACHE_VERSION) return null;
  if (typeof raw.date !== 'string') return null;
  if (!raw.bySymbol || typeof raw.bySymbol !== 'object') return null;

  const bySymbol: Record<string, Dividend[]> = {};
  for (const [symbol, rows] of Object.entries(raw.bySymbol)) {
    if (!Array.isArray(rows)) return null;
    const valid = rows.filter(isDividend);
    // Keep a deliberate empty array (a checked symbol with no dividends), but
    // drop a symbol whose rows are all corrupt so it is fetched again.
    if (rows.length > 0 && valid.length === 0) continue;
    bySymbol[symbol] = valid;
  }
  return { version: raw.version, date: raw.date, bySymbol };
};

export const saveDividendCache = (cache: DividendCache): void => {
  store.set('dividends', cache);
};

export const getKey = (): KeyPair | null =>
  store.getSession<KeyPair | null>('alpacaKey', null) ||
  store.get<KeyPair | null>('alpacaKey', null);

export type KeyStorage = 'durable' | 'session' | 'memory';

/** Persist the key and report what actually survived, not what was requested. */
export const saveKey = (key: KeyPair, remember: boolean): KeyStorage => {
  store.setSession('alpacaKey', null);
  store.set('alpacaKey', null);
  if (remember && store.set('alpacaKey', key)) return 'durable';
  if (store.setSession('alpacaKey', key)) return 'session';
  return 'memory';
};

export const removeKey = (): void => {
  store.set('alpacaKey', null);
  store.setSession('alpacaKey', null);
};

export const loadTheme = (prefersDark = false): Theme =>
  resolveTheme(store.getRaw('theme'), prefersDark);

export const saveTheme = (theme: Theme): void => {
  store.setRaw('theme', theme);
};

export const uniqueListName = (base: string, lists: UserList[]): string => {
  const used = new Set(lists.map((list) => list.name.toLowerCase()));
  const name = (base || 'Shared list').slice(0, 40);
  if (!used.has(name.toLowerCase())) return name;
  const stem = name.replace(/\s+\(\d+\)$/, '').slice(0, 32);
  let index = 2;
  while (used.has(`${stem} (${index})`.toLowerCase())) index++;
  return `${stem} (${index})`;
};
