import { describe, expect, it } from 'vitest';
import {
  applyFilterPatch,
  chainScopeFor,
  chainScopeCovers,
  cleanListSymbols,
  cleanSymbols,
  computed,
  computedFor,
  dteToPos,
  matchExpiry,
  matchRisk,
  normalizeExpiry,
  normalizeQuote,
  parseContract,
  pass,
  posToDte,
  retryDelayMs,
  sanitizeFilters,
  tradingViewUrl,
} from '../src/lib/domain';
import {
  COLUMNS,
  DEFAULT_FILTERS,
  EXPIRATIONS,
  MAX_DTE,
  MAX_LIST_SYMBOLS,
  PRICE_BUCKETS,
  PRICE_MAX,
  RISK_PROFILES,
} from '../src/lib/config';
import type { DividendContext, EarningsContext, Filters, Row } from '../src/lib/types';
import { tickers } from './helpers';

const TODAY_UTC = Date.parse('2026-11-06T00:00:00Z');

const baseRow: Row = {
  contract: 'AAPL261120P00100000',
  symbol: 'AAPL',
  underlying: 'AAPL',
  side: 'P',
  expiry: '2026-11-20',
  dte: 14,
  strike: 100,
  bid: 2,
  ask: 2.2,
  mid: 2.1,
  delta: -0.2,
  iv: 0.3,
  volume: 10,
  price: 105,
  change: 1,
  changePts: 1,
};

const baseFilters: Filters = {
  minPrice: 0,
  maxPrice: PRICE_MAX,
  minDte: 1,
  maxDte: 30,
  minDelta: 0.15,
  maxDelta: 0.35,
  minAnn: 0,
  minYield: 0,
  maxSpread: 15,
  maxIv: 0,
  sector: 'all',
  avoidEarnings: false,
  avoidDividends: false,
};

describe('parseContract', () => {
  it('parses OCC symbols and DTE from the provided UTC day', () => {
    expect(parseContract('AAPL261107P00100000', TODAY_UTC)).toEqual({
      root: 'AAPL',
      side: 'P',
      expiry: '2026-11-07',
      dte: 1,
      strike: 100,
    });
  });

  it('accepts longer roots', () => {
    expect(parseContract('BRKB261107P00400000', TODAY_UTC)?.root).toBe('BRKB');
  });

  it('rejects malformed symbols', () => {
    expect(parseContract('AAPL-INVALID', TODAY_UTC)).toBeNull();
  });
});

describe('computed', () => {
  it('calculates CSP metrics', () => {
    const c = computed(baseRow);
    expect(c.yld).toBe(2);
    expect(c.ann).toBeCloseTo(52.142857142857146);
    expect(c.otm).toBeCloseTo(4.761904761904762);
    expect(c.spread).toBeCloseTo(9.523809523809524);
    expect(c.be).toBe(98);
  });

  it('calculates CC metrics with price-based breakeven', () => {
    const row = { ...baseRow, side: 'C' as const, strike: 110 };
    const c = computed(row);
    expect(c.yld).toBeCloseTo(1.9047619047619047);
    expect(c.be).toBe(103);
    expect(computed({ ...row, price: null }).be).toBeNull();
  });

  it('returns null spread when the ask is missing', () => {
    expect(computed({ ...baseRow, ask: 0, mid: 0 }).spread).toBeNull();
  });

  it('annualises same-day contracts over one day', () => {
    const row = { ...baseRow, dte: 0 };
    expect(computed(row).ann).toBeCloseTo(730);
  });

  it('withholds every quote-derived metric from a flagged row', () => {
    const row = { ...baseRow, bid: 2, ask: 1, mid: 1.5, quoteInvalid: true };
    const c = computed(row);

    expect(c.yld).toBeNull();
    expect(c.ann).toBeNull();
    expect(c.spread).toBeNull();
    expect(c.be).toBeNull();
    expect(c.otm).not.toBeNull();
  });
});

describe('normalizeQuote', () => {
  it('keeps a two-sided quote', () => {
    expect(normalizeQuote(1, 2)).toEqual({ bid: 1, ask: 2, mid: 1.5, invalid: false });
  });

  it('flags a crossed quote instead of computing a negative spread', () => {
    expect(normalizeQuote(2, 1)).toEqual({ bid: 2, ask: 1, mid: 1.5, invalid: true });
  });

  it('flags non-numeric and negative sides', () => {
    expect(normalizeQuote(Number.NaN, 2).invalid).toBe(true);
    expect(normalizeQuote(2, Number.POSITIVE_INFINITY).invalid).toBe(true);
    expect(normalizeQuote(-2, 1).invalid).toBe(true);
    expect(normalizeQuote('2', 1).invalid).toBe(true);
  });

  it('treats a missing ask as one-sided, not invalid', () => {
    expect(normalizeQuote(1, null)).toEqual({ bid: 1, ask: 0, mid: 0, invalid: false });
  });
});

describe('computedFor', () => {
  it('reuses a row calculation for the same row object', () => {
    const row = { ...baseRow, side: 'C' as const, strike: 110 };
    const first = computedFor(row);

    expect(computedFor(row)).toBe(first);
    expect(computedFor({ ...row })).not.toBe(first);
  });
});

describe('pass', () => {
  it('enforces side, delta, and missing-spread rules', () => {
    const c = computed(baseRow);
    expect(pass(baseRow, c, 'P', baseFilters)).toBe(true);
    expect(pass(baseRow, c, 'C', baseFilters)).toBe(false);

    const badRow = { ...baseRow, delta: -0.5 };
    expect(pass(badRow, computed(badRow), 'P', baseFilters)).toBe(false);

    const noSpread = { ...baseRow, ask: 0, mid: 0 };
    const noSpreadComputed = computed(noSpread);
    expect(pass(noSpread, noSpreadComputed, 'P', baseFilters)).toBe(false);
    expect(pass(noSpread, noSpreadComputed, 'P', { ...baseFilters, maxSpread: 0 })).toBe(true);
  });

  it('never shows a row whose quote is from an earlier session', () => {
    const stale = { ...baseRow, quoteStale: true };
    const filters = { ...baseFilters, maxSpread: 0 };
    expect(pass(stale, computed(stale), 'P', filters)).toBe(false);
  });

  it('never lets an invalid quote satisfy a metric filter', () => {
    const row = { ...baseRow, bid: 2, ask: 1, mid: 1.5, quoteInvalid: true };
    const c = computed(row);

    expect(pass(row, c, 'P', baseFilters)).toBe(false);
    expect(pass(row, c, 'P', { ...baseFilters, maxSpread: 0 })).toBe(true);
    expect(pass(row, c, 'P', { ...baseFilters, maxSpread: 0, minYield: 1 })).toBe(false);
  });

  it('applies both share-price bounds', () => {
    const row = { ...baseRow, price: 75 };
    const filters = { ...baseFilters, minPrice: 75, maxPrice: 150 };
    expect(pass(row, computed(row), 'P', filters)).toBe(true);
    expect(pass({ ...row, price: 150 }, computed(row), 'P', filters)).toBe(false);
    expect(pass({ ...row, price: 74.99 }, computed(row), 'P', filters)).toBe(false);
    expect(pass({ ...row, price: null }, computed(row), 'P', filters)).toBe(false);
  });

  it('keeps same-day contracts when the range includes 0', () => {
    const row = { ...baseRow, dte: 0 };
    expect(pass(row, computed(row), 'P', { ...baseFilters, minDte: 0, maxDte: 0 })).toBe(true);
  });

  it('avoids rows that span an upcoming earnings date', () => {
    const filters = { ...baseFilters, avoidEarnings: true };
    const context: EarningsContext = {
      events: {
        NVDA: {
          date: '2026-11-17',
          session: 'after_close',
          status: 'expected' as const,
          name: null,
          marketCap: null,
        },
      },
      today: '2026-11-11',
    };
    const row = { ...baseRow, symbol: 'NVDA', underlying: 'NVDA', expiry: '2026-11-20' };
    const c = computed(row);

    expect(pass(row, c, 'P', filters, context)).toBe(false);
    expect(pass(row, c, 'P', baseFilters, context)).toBe(true);
  });

  it('matches earnings by the underlying symbol, not the option root', () => {
    const filters = { ...baseFilters, avoidEarnings: true };
    const context: EarningsContext = {
      events: {
        'BRK.B': {
          date: '2026-11-17',
          session: 'after_close',
          status: 'expected',
          name: null,
          marketCap: null,
        },
      },
      today: '2026-11-11',
    };
    const row = { ...baseRow, symbol: 'BRKB', underlying: 'BRK.B', expiry: '2026-11-20' };
    expect(pass(row, computed(row), 'P', filters, context)).toBe(false);
  });

  it('hides a row exposed to a report today and keeps rows without one', () => {
    const filters = { ...baseFilters, avoidEarnings: true };
    const event = {
      date: '2026-11-11',
      session: 'before_open' as const,
      status: 'expected' as const,
      name: null,
      marketCap: null,
    };
    const context: EarningsContext = {
      events: { NVDA: event },
      today: '2026-11-11',
    };
    const row = { ...baseRow, symbol: 'NVDA', underlying: 'NVDA', expiry: '2026-11-20' };
    expect(pass(row, computed(row), 'P', filters, context)).toBe(false);

    const none: EarningsContext = { ...context, events: {} };
    const later = { ...row, expiry: '2027-01-15' };
    expect(pass(later, computed(later), 'P', filters, none)).toBe(true);
  });

  it('avoids rows that span an upcoming ex-dividend date', () => {
    const filters = { ...baseFilters, avoidDividends: true };
    const context: DividendContext = {
      bySymbol: { AAPL: [{ ex: '2026-11-16', rate: 0.25, special: false }] },
      today: '2026-11-11',
    };
    const c = computed(baseRow);

    expect(pass(baseRow, c, 'P', filters, undefined, context)).toBe(false);
    expect(pass(baseRow, c, 'P', baseFilters, undefined, context)).toBe(true);

    const later = { ...baseRow, expiry: '2026-11-13' };
    expect(pass(later, computed(later), 'P', filters, undefined, context)).toBe(true);
  });
});

describe('symbols and config', () => {
  it('normalizes, deduplicates, and validates symbols', () => {
    expect(cleanSymbols(['aapl', 'AAPL', ' bad!', 'BRK.B', 'BRK-B', ''])).toEqual([
      'AAPL',
      'BRK.B',
      'BRK-B',
    ]);
  });

  it('caps list symbols at the documented maximum', () => {
    const symbols = tickers(MAX_LIST_SYMBOLS + 25);
    expect(cleanListSymbols(symbols)).toEqual(symbols.slice(0, MAX_LIST_SYMBOLS));
  });

  it('places Spread % directly after Bid', () => {
    const keys = COLUMNS.map((column) => column.key);
    expect(keys[keys.indexOf('bid') + 1]).toBe('spread');
    expect(keys).toHaveLength(15);
  });

  it('leaves Max spread off by default and has no volume filter', () => {
    expect(DEFAULT_FILTERS.maxSpread).toBe(0);
    expect(RISK_PROFILES.balanced.filters.maxSpread).toBe(0);
    expect(RISK_PROFILES.conservative.filters.maxSpread).toBe(0);
    expect(RISK_PROFILES.aggressive.filters.maxSpread).toBe(0);
    expect('minVol' in DEFAULT_FILTERS).toBe(false);
  });

  it('exposes the documented price buckets', () => {
    expect(PRICE_BUCKETS.map((bucket) => bucket.label)).toEqual([
      '< $75',
      '$75–150',
      '$150–300',
      '$300+',
    ]);
    expect(PRICE_BUCKETS[0]).toMatchObject({ minPrice: 0, maxPrice: 75 });
    expect(PRICE_BUCKETS.at(-1)).toMatchObject({ minPrice: 300, maxPrice: PRICE_MAX });
  });
});

describe('preset matching', () => {
  it('matches risk and expiry filters', () => {
    const profiles = {
      balanced: { filters: { minDelta: 0.15, maxDelta: 0.35, minAnn: 10, maxSpread: 15 } },
    };
    expect(
      matchRisk(
        {
          ...baseFilters,
          minDelta: 0.15,
          maxDelta: 0.35,
          minAnn: 10,
          maxSpread: 15,
        },
        profiles,
      ),
    ).toBe('balanced');
    expect(matchRisk({ ...baseFilters, minDelta: 0.1 }, profiles)).toBeNull();
    expect(
      matchExpiry({ ...baseFilters, minDte: 8, maxDte: 14 }, { '8-14': { dte: [8, 14] } }),
    ).toBe('8-14');
  });
});

describe('expiration buckets', () => {
  it('covers 0 through MAX_DTE with no gaps or overlaps', () => {
    expect(MAX_DTE).toBe(63);
    expect(Object.values(EXPIRATIONS).map((preset) => preset.label)).toEqual([
      'Today',
      'Weekly',
      '1–2 weeks out',
      '2–4 weeks out',
      '1–2 months out',
    ]);
    const ranges = Object.values(EXPIRATIONS)
      .map((preset) => preset.dte)
      .sort((a, b) => a[0] - b[0]);
    expect(ranges[0][0]).toBe(0);
    expect(ranges[ranges.length - 1][1]).toBe(MAX_DTE);
    for (let index = 1; index < ranges.length; index++) {
      expect(ranges[index][0]).toBe(ranges[index - 1][1] + 1);
    }
  });

  it('matches each bucket by its exact range', () => {
    expect(matchExpiry({ ...baseFilters, minDte: 0, maxDte: 0 }, EXPIRATIONS)).toBe('0d');
    expect(matchExpiry({ ...baseFilters, minDte: 1, maxDte: 7 }, EXPIRATIONS)).toBe('1-7');
    expect(matchExpiry({ ...baseFilters, minDte: 8, maxDte: 14 }, EXPIRATIONS)).toBe('8-14');
    expect(matchExpiry({ ...baseFilters, minDte: 15, maxDte: 28 }, EXPIRATIONS)).toBe('15-28');
    expect(matchExpiry({ ...baseFilters, minDte: 29, maxDte: 63 }, EXPIRATIONS)).toBe('29-63');
    expect(matchExpiry({ ...baseFilters, minDte: 15, maxDte: 29 }, EXPIRATIONS)).toBeNull();
    expect(matchExpiry({ ...baseFilters, minDte: 21, maxDte: 45 }, EXPIRATIONS)).toBeNull();
  });
});

describe('tradingViewUrl', () => {
  it('maps exchanges and falls back to the bare symbol', () => {
    const base = 'https://www.tradingview.com/symbols/';
    expect(tradingViewUrl('AAPL', 'AAPL', 'NASDAQ')).toBe(`${base}NASDAQ-AAPL/`);
    expect(tradingViewUrl('JPM', 'JPM', 'NYSE')).toBe(`${base}NYSE-JPM/`);
    expect(tradingViewUrl('SPY', 'SPY', 'NYSEARCA')).toBe(`${base}AMEX-SPY/`);
    expect(tradingViewUrl('SPY', 'SPY', 'ARCA')).toBe(`${base}AMEX-SPY/`);
    expect(tradingViewUrl('IWM', 'IWM', 'AMEX')).toBe(`${base}AMEX-IWM/`);
    expect(tradingViewUrl('FETH', 'FETH', 'BATS')).toBe(`${base}CBOE-FETH/`);
    expect(tradingViewUrl('BRKB', 'BRK.B', 'NYSE')).toBe(`${base}NYSE-BRK.B/`);
    expect(tradingViewUrl('MSFT', 'MSFT', '')).toBe(`${base}MSFT/`);
  });
});

describe('retryDelayMs', () => {
  it('uses Retry-After when numeric and exponential fallback otherwise', () => {
    expect(retryDelayMs(0, null)).toBe(1000);
    expect(retryDelayMs(1, '')).toBe(2000);
    expect(retryDelayMs(0, '3')).toBe(3000);
    expect(retryDelayMs(0, 'Wed, 21 Oct 2026 07:28:00 GMT')).toBe(1000);
    expect(retryDelayMs(0, '30')).toBe(10000);
  });
});

describe('DTE slider mapping', () => {
  it('round-trips representative DTE values', () => {
    for (const dte of [0, 1, 7, 21, 45, 63]) {
      expect(posToDte(dteToPos(dte))).toBe(dte);
    }
  });
});

describe('normalizeExpiry', () => {
  it('keeps current preset keys', () => {
    expect(normalizeExpiry('8-14', null)).toBe('8-14');
    expect(normalizeExpiry('0d', null)).toBe('0d');
    expect(normalizeExpiry('custom', null)).toBe('custom');
  });

  it('falls back to the default for legacy values without saved filters', () => {
    expect(normalizeExpiry('weekly', null)).toBe('1-7');
    expect(normalizeExpiry('monthly', null)).toBe('1-7');
  });

  it('preserves a saved range as custom for legacy values', () => {
    expect(normalizeExpiry('monthly', baseFilters)).toBe('custom');
  });
});

describe('sanitizeFilters', () => {
  it('clamps every numeric filter to its documented range', () => {
    const sanitized = sanitizeFilters({
      ...baseFilters,
      minDte: 12,
      maxDte: 120,
      minDelta: 0.8,
      maxDelta: 1.4,
      maxIv: 900,
      minYield: -5,
      minAnn: 500,
      maxSpread: 250,
    });

    expect(sanitized.maxDte).toBe(MAX_DTE);
    expect(sanitized.minDte).toBe(12);
    expect(sanitized.maxDelta).toBe(0.5);
    expect(sanitized.minDelta).toBe(0.5);
    expect(sanitized.maxIv).toBe(150);
    expect(sanitized.minYield).toBe(0);
    expect(sanitized.minAnn).toBe(200);
    expect(sanitized.maxSpread).toBe(100);
  });

  it('sanitises the sector and avoid flags', () => {
    const valid = sanitizeFilters({ ...baseFilters, sector: 'tech' });
    expect(valid.sector).toBe('tech');

    const sanitized = sanitizeFilters({
      ...baseFilters,
      sector: 'bogus',
      avoidEarnings: 'yes' as unknown as boolean,
      avoidDividends: 1 as unknown as boolean,
    });
    expect(sanitized.sector).toBe('all');
    expect(sanitized.avoidEarnings).toBe(false);
    expect(sanitized.avoidDividends).toBe(false);
  });

  it('falls back to zero for non-numeric values', () => {
    const sanitized = sanitizeFilters({
      ...baseFilters,
      maxIv: Number.NaN,
      minYield: 'nope' as unknown as number,
      minAnn: undefined as unknown as number,
      maxSpread: Number.POSITIVE_INFINITY,
    });

    expect(sanitized.maxIv).toBe(0);
    expect(sanitized.minYield).toBe(0);
    expect(sanitized.minAnn).toBe(0);
    expect(sanitized.maxSpread).toBe(0);
  });

  it('snaps an unknown price pair to the default bucket', () => {
    expect(sanitizeFilters({ ...baseFilters, minPrice: 20, maxPrice: 400 })).toMatchObject({
      minPrice: 75,
      maxPrice: 150,
    });
    expect(sanitizeFilters({ ...baseFilters, minPrice: 150, maxPrice: 300 })).toMatchObject({
      minPrice: 150,
      maxPrice: 300,
    });
  });

  it('caps the maximum delta at 0.5', () => {
    expect(sanitizeFilters({ ...baseFilters, maxDelta: 1 }).maxDelta).toBe(0.5);
  });

  it('sanitises a filter patch before it reaches the URL or inputs', () => {
    expect(applyFilterPatch(baseFilters, { maxDte: 500 }).maxDte).toBe(MAX_DTE);
    expect(applyFilterPatch(baseFilters, { maxDte: Number.NaN }).maxDte).toBe(0);
  });

  it('rounds fractional DTE values', () => {
    const sanitized = sanitizeFilters({ ...baseFilters, minDte: 2.5, maxDte: 7.4 });
    expect(sanitized.minDte).toBe(3);
    expect(sanitized.maxDte).toBe(7);
  });
});

describe('chain scope', () => {
  it('scopes calls and puts by strategy and DTE', () => {
    expect(chainScopeFor('cc', { ...baseFilters, maxDte: 21 })).toEqual({
      type: 'call',
      minDte: 1,
      maxDte: 21,
    });
    expect(chainScopeFor('csp', { ...baseFilters, maxDte: 21 })).toEqual({
      type: 'put',
      minDte: 1,
      maxDte: 21,
    });
  });

  it('covers only an identical scope', () => {
    const base = chainScopeFor('cc', { ...baseFilters, maxDte: 7 });
    expect(chainScopeCovers(base, chainScopeFor('cc', { ...baseFilters, maxDte: 21 }))).toBe(false);
    expect(chainScopeCovers(base, chainScopeFor('csp', { ...baseFilters, maxDte: 7 }))).toBe(false);
    expect(chainScopeCovers(base, chainScopeFor('cc', { ...baseFilters, maxDte: 7 }))).toBe(true);
    expect(chainScopeCovers(null, base)).toBe(false);
  });

  it('clamps the DTE window', () => {
    const scope = chainScopeFor('cc', { ...baseFilters, maxDte: 500 });
    expect(scope.maxDte).toBe(MAX_DTE);
  });
});
