import { describe, expect, it } from 'vitest';
import {
  activeSymbols,
  candidateCount,
  exactTicker,
  searchSymbols,
  symbolAllowed,
  sortValue,
} from '../src/lib/selection';
import type { AssetInfo, Computed, IndexesData, Row } from '../src/lib/types';

const asset = (exchange: string): AssetInfo => ({ symbol: 'X', name: 'X', exchange }) as AssetInfo;

const indexes: IndexesData = {
  schemaVersion: 1,
  effectiveDate: '2026-11-11',
  generatedAt: '2026-11-11T23:00:00Z',
  indexes: { sp500: ['AAPL', 'MSFT', 'BRK.B'], ndx: ['AAPL', 'ASML'] },
  sectors: {},
};

describe('activeSymbols', () => {
  it('uses the selected list symbols', () => {
    expect(activeSymbols('favourites', { symbols: ['AAPL'] }, indexes)).toEqual(['AAPL']);
    expect(activeSymbols('missing', null, indexes)).toEqual([]);
  });

  it('uses the deduplicated S&P 500 and Nasdaq-100 union for All', () => {
    expect(activeSymbols('all', null, indexes)).toEqual(['AAPL', 'MSFT', 'BRK.B', 'ASML']);
  });

  it('returns no All symbols until the index dataset is available', () => {
    expect(activeSymbols('all', null, null)).toEqual([]);
  });

  it('selects the S&P 500 and Nasdaq-100 members', () => {
    expect(activeSymbols('sp500', null, indexes)).toEqual(['AAPL', 'MSFT', 'BRK.B']);
    expect(activeSymbols('ndx', null, indexes)).toEqual(['AAPL', 'ASML']);
  });

  it('returns no index symbols until the dataset is available', () => {
    expect(activeSymbols('sp500', null, null)).toEqual([]);
    expect(activeSymbols('ndx', null, null)).toEqual([]);
  });
});

describe('global ticker search', () => {
  it('uses the index union as the search pool', () => {
    expect(searchSymbols(indexes)).toEqual(['AAPL', 'MSFT', 'BRK.B', 'ASML']);
    expect(searchSymbols(null)).toEqual([]);
  });

  it('resolves exact tickers case-insensitively', () => {
    expect(exactTicker('AAPL', ['AAPL', 'IBM'])).toBe('AAPL');
    expect(exactTicker(' ibm ', ['AAPL', 'IBM'])).toBe('IBM');
  });

  it('leaves partial or empty queries to the local row filter', () => {
    expect(exactTicker('', ['AAPL', 'IBM'])).toBeNull();
    expect(exactTicker('IB', ['AAPL', 'IBM'])).toBeNull();
    expect(exactTicker('ZZZ', ['AAPL', 'IBM'])).toBeNull();
  });
});

describe('candidateCount', () => {
  const sectors = { AAPL: 'Information Technology', GOOGL: 'Communication Services' };
  const assets = { AAPL: asset('NASDAQ'), GOOGL: asset('NASDAQ'), XOM: asset('NYSE') };

  it('counts after the asset and sector filters', () => {
    expect(candidateCount(['AAPL', 'GOOGL', 'XOM'], assets, sectors, 'all')).toBe(3);
    expect(candidateCount(['AAPL', 'GOOGL', 'XOM'], assets, sectors, 'tech')).toBe(1);
    expect(candidateCount(['AAPL', 'GOOGL', 'XOM'], assets, sectors, 'media')).toBe(1);
  });

  it('does not enumerate the asset map for every candidate', () => {
    let enumerations = 0;
    const entries: Record<string, AssetInfo> = {};
    for (let index = 0; index < 6276; index++) entries[`S${index}`] = asset('NASDAQ');
    const assets = new Proxy(entries, {
      ownKeys(target) {
        enumerations++;
        return Reflect.ownKeys(target);
      },
    });

    expect(candidateCount(Object.keys(entries), assets, {}, 'all')).toBe(6276);
    expect(enumerations).toBe(0);
  });
});

describe('symbolAllowed', () => {
  const assets = {
    NYSE: asset('NYSE'),
    NASDAQ: asset('NASDAQ'),
    ARCA: asset('NYSEARCA'),
    BATS: asset('BATS'),
  };

  it('fails open when asset metadata is unavailable', () => {
    expect(symbolAllowed('AAPL', {})).toBe(true);
  });

  it('rejects names missing from the asset map', () => {
    expect(symbolAllowed('MISSING', assets)).toBe(false);
  });

  it('allows every resolved exchange', () => {
    for (const symbol of Object.keys(assets)) expect(symbolAllowed(symbol, assets)).toBe(true);
  });

  it('does not enumerate the asset map when the symbol exists', () => {
    let enumerations = 0;
    const assets = new Proxy(
      { AAPL: asset('NASDAQ') },
      {
        ownKeys(target) {
          enumerations++;
          return Reflect.ownKeys(target);
        },
      },
    );

    expect(symbolAllowed('AAPL', assets)).toBe(true);
    expect(enumerations).toBe(0);
  });
});

describe('sortValue', () => {
  it('prefers the computed value and falls back to the row', () => {
    const item = {
      row: { symbol: 'AAPL', strike: 190 },
      c: { yield: 1.1 },
    } as unknown as { row: Row; c: Computed };
    expect(sortValue(item, 'yield')).toBe(1.1);
    expect(sortValue(item, 'strike')).toBe(190);
    expect(sortValue(item, 'missing')).toBeUndefined();
  });
});
