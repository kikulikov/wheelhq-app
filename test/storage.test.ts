import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getKey,
  loadDividendCache,
  loadLists,
  loadTheme,
  loadWatchlist,
  onStorageFailure,
  removeKey,
  saveDividendCache,
  saveKey,
  saveTheme,
  store,
} from '../src/lib/storage';
import { DIVIDEND_CACHE_VERSION } from '../src/lib/dividends';
import { MAX_LIST_SYMBOLS } from '../src/lib/config';
import { tickers } from './helpers';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

const local = new MemoryStorage();
const session = new MemoryStorage();

Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: session, configurable: true });

beforeEach(() => {
  local.clear();
  session.clear();
});

describe('key storage', () => {
  it('reports whether the key really persisted', () => {
    expect(saveKey({ keyId: 'PKDURABLE', secret: 's' }, true)).toBe('durable');
    expect(saveKey({ keyId: 'PKSESSION2', secret: 's' }, false)).toBe('session');

    const localSpy = vi.spyOn(local, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(saveKey({ keyId: 'PKSESSION3', secret: 's' }, true)).toBe('session');

    const sessionSpy = vi.spyOn(session, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(saveKey({ keyId: 'PKMEMORY', secret: 's' }, true)).toBe('memory');
    localSpy.mockRestore();
    sessionSpy.mockRestore();
  });

  it('stores keys in sessionStorage by default', () => {
    saveKey({ keyId: 'PKSESSION', secret: 's' }, false);
    expect(getKey()).toEqual({ keyId: 'PKSESSION', secret: 's' });
    expect(store.get('alpacaKey', null)).toBeNull();
    expect(session.getItem('wheelhq.alpacaKey')).toContain('PKSESSION');
  });

  it('stores remembered keys in localStorage', () => {
    saveKey({ keyId: 'PKSAVED', secret: 's' }, true);
    expect(getKey()).toEqual({ keyId: 'PKSAVED', secret: 's' });
    expect(store.getSession('alpacaKey', null)).toBeNull();
    expect(JSON.stringify(store.get('alpacaKey', null))).toContain('PKSAVED');
  });

  it('removes both stored copies', () => {
    saveKey({ keyId: 'PKSAVED', secret: 's' }, true);
    removeKey();
    expect(getKey()).toBeNull();
    expect(store.get('alpacaKey', null)).toBeNull();
    expect(store.getSession('alpacaKey', null)).toBeNull();
  });
});

describe('theme storage', () => {
  it('migrates legacy and previous theme names', () => {
    local.setItem('turnwise.theme', 'light');
    expect(loadTheme()).toBe('emerald');
    local.removeItem('wheelhq.theme');
    local.setItem('turnwise.theme', 'corporate');
    expect(loadTheme()).toBe('emerald');
    local.removeItem('wheelhq.theme');
    local.setItem('turnwise.theme', 'dark');
    expect(loadTheme()).toBe('night');
  });

  it('round-trips the current theme names', () => {
    saveTheme('night');
    expect(loadTheme()).toBe('night');
    saveTheme('emerald');
    expect(loadTheme()).toBe('emerald');
  });

  it('defaults to the system preference when nothing is stored', () => {
    expect(loadTheme(true)).toBe('night');
    expect(loadTheme(false)).toBe('emerald');
  });
});

describe('list storage', () => {
  it('caps loaded lists at the documented maximum', () => {
    const symbols = tickers(MAX_LIST_SYMBOLS + 10);
    local.setItem('turnwise.lists', JSON.stringify([{ id: 'list-big', name: 'Big', symbols }]));

    expect(loadLists()[0].symbols).toHaveLength(MAX_LIST_SYMBOLS);
  });
});

describe('dividend cache', () => {
  it('round-trips a per-symbol cache', () => {
    const cache = {
      version: DIVIDEND_CACHE_VERSION,
      date: '2026-11-09',
      bySymbol: { AAPL: [{ ex: '2026-11-12', rate: 0.27, special: false }], MSFT: [] },
    };
    saveDividendCache(cache);
    expect(loadDividendCache()).toEqual(cache);
  });

  it('drops invalid rows and lets affected symbols be refetched', () => {
    store.set('dividends', {
      version: DIVIDEND_CACHE_VERSION,
      date: '2026-11-09',
      bySymbol: {
        AAPL: [null],
        MSFT: [],
        GOOG: [{ ex: '2026-11-12', rate: 0.2, special: false }, null],
      },
    });

    expect(loadDividendCache()).toEqual({
      version: DIVIDEND_CACHE_VERSION,
      date: '2026-11-09',
      bySymbol: {
        MSFT: [],
        GOOG: [{ ex: '2026-11-12', rate: 0.2, special: false }],
      },
    });
  });

  it('ignores malformed or old-version entries', () => {
    store.set('dividends', { version: 0, date: '2026-11-09', bySymbol: {} });
    expect(loadDividendCache()).toBeNull();
    store.set('dividends', { version: DIVIDEND_CACHE_VERSION, bySymbol: {} });
    expect(loadDividendCache()).toBeNull();
    store.set('dividends', {
      version: DIVIDEND_CACHE_VERSION,
      date: '2026-11-09',
      bySymbol: { AAPL: 'not-an-array' },
    });
    expect(loadDividendCache()).toBeNull();
  });
});

describe('storage failures', () => {
  it('returns false and notifies instead of swallowing a failed write', () => {
    const failures: number[] = [];
    onStorageFailure(() => failures.push(1));

    const spy = vi.spyOn(local, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(store.set('theme', 'night')).toBe(false);
    expect(failures).toHaveLength(1);
    spy.mockRestore();

    expect(store.set('theme', 'night')).toBe(true);
    expect(failures).toHaveLength(1);
  });
});

describe('legacy prefix migration', () => {
  it('migrates a legacy local value on read', () => {
    local.setItem('turnwise.watchlist', JSON.stringify(['SPY', 'QQQ']));
    expect(loadWatchlist()).toEqual(['SPY', 'QQQ']);
    expect(local.getItem('wheelhq.watchlist')).toBe(JSON.stringify(['SPY', 'QQQ']));
  });

  it('migrates a legacy session key', () => {
    session.setItem('turnwise.alpacaKey', JSON.stringify({ keyId: 'PKOLD', secret: 'old' }));
    expect(getKey()).toEqual({ keyId: 'PKOLD', secret: 'old' });
    expect(session.getItem('wheelhq.alpacaKey')).toContain('PKOLD');
  });

  it('does not resurrect a removed legacy key', () => {
    session.setItem('turnwise.alpacaKey', JSON.stringify({ keyId: 'PKOLD', secret: 'old' }));
    removeKey();
    expect(getKey()).toBeNull();
  });
});
