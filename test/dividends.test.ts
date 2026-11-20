import { describe, expect, it } from 'vitest';
import {
  DIVIDEND_CACHE_VERSION,
  dividendTooltip,
  dividendWindow,
  dividendsForRow,
  estimateDividend,
  mergeDividendCache,
  nextDividend,
  parseDividendRows,
} from '../src/lib/dividends';

const dividend = (ex: string, rate: number, special = false) => ({ ex, rate, special });

describe('dividendsForRow', () => {
  it('looks up the underlying rather than the option root', () => {
    const rows = [dividend('2026-11-20', 0.25)];
    expect(dividendsForRow({ 'BRK.B': rows }, { symbol: 'BRKB', underlying: 'BRK.B' })).toBe(rows);
    expect(dividendsForRow({ BRKB: rows }, { symbol: 'BRKB' })).toBe(rows);
    expect(dividendsForRow({}, { symbol: 'BRKB' })).toEqual([]);
  });
});

describe('dividendWindow', () => {
  it('spans thirteen months back and three months forward', () => {
    expect(dividendWindow('2026-11-09')).toEqual({
      start: '2025-10-09',
      end: '2027-02-09',
    });
  });
});

describe('parseDividendRows', () => {
  it('keeps valid rows and sorts them by ex-date', () => {
    const parsed = parseDividendRows([
      { symbol: 'AAPL', ex_date: '2026-11-12', rate: 0.27, special: false },
      { symbol: 'AAPL', ex_date: '2026-08-10', rate: '0.25', special: false },
      { symbol: 'JPM', ex_date: '2026-09-01', rate: 1.2, special: true },
      { symbol: 'BAD', ex_date: 'not-a-date', rate: 1 },
      { symbol: 'BAD', ex_date: '2026-09-01', rate: Number.NaN },
      null,
    ]);

    expect(parsed.AAPL).toEqual([
      { ex: '2026-08-10', rate: 0.25, special: false },
      { ex: '2026-11-12', rate: 0.27, special: false },
    ]);
    expect(parsed.JPM).toEqual([{ ex: '2026-09-01', rate: 1.2, special: true }]);
    expect(parsed.BAD).toBeUndefined();
  });
});

describe('mergeDividendCache', () => {
  it('merges successful symbols and preserves the date', () => {
    const cache = {
      version: DIVIDEND_CACHE_VERSION,
      date: '2026-11-09',
      bySymbol: { AAPL: [dividend('2026-11-12', 0.27)] },
    };
    expect(mergeDividendCache(cache, { MSFT: [] })).toEqual({
      version: DIVIDEND_CACHE_VERSION,
      date: '2026-11-09',
      bySymbol: { AAPL: [dividend('2026-11-12', 0.27)], MSFT: [] },
    });
  });
});

describe('estimateDividend', () => {
  it('rolls the median interval past today', () => {
    const estimate = estimateDividend(
      [
        dividend('2025-11-07', 1),
        dividend('2026-02-06', 1.1),
        dividend('2026-05-08', 1.2),
        dividend('2026-08-07', 1.3),
      ],
      '2026-11-09',
    );

    expect(estimate).toEqual({ date: '2027-02-05', rate: 1.3, estimated: true });
  });

  it('handles monthly payers', () => {
    expect(
      estimateDividend([dividend('2026-09-01', 0.1), dividend('2026-10-01', 0.1)], '2026-11-09'),
    ).toEqual({ date: '2026-11-30', rate: 0.1, estimated: true });
  });

  it('returns nothing for a suspended payer', () => {
    expect(
      estimateDividend([dividend('2024-11-07', 1), dividend('2025-02-06', 1.1)], '2026-11-09'),
    ).toBeNull();
  });

  it('requires at least two regular rows and ignores specials', () => {
    expect(estimateDividend([dividend('2026-09-01', 0.1, true)], '2026-11-09')).toBeNull();
    expect(
      estimateDividend(
        [dividend('2026-09-01', 0.1), dividend('2026-10-01', 5, true)],
        '2026-11-09',
      ),
    ).toBeNull();
  });
});

describe('nextDividend', () => {
  const rows = [dividend('2026-11-12', 0.27), dividend('2027-02-01', 0.3)];

  it('returns an announced date inside the expiry window', () => {
    expect(nextDividend(rows, '2026-11-09', '2026-11-15')).toEqual({
      date: '2026-11-12',
      rate: 0.27,
      estimated: false,
    });
  });

  it('returns nothing when the announced date is after expiry', () => {
    expect(nextDividend(rows, '2026-11-09', '2026-11-10')).toBeNull();
  });

  it('falls back to an estimate only when no announced date exists', () => {
    const history = [dividend('2026-09-01', 0.1), dividend('2026-10-01', 0.1)];
    expect(nextDividend(history, '2026-11-09', '2026-12-01')).toEqual({
      date: '2026-11-30',
      rate: 0.1,
      estimated: true,
    });
    expect(nextDividend(history, '2026-11-09', '2026-11-15')).toBeNull();
  });
});

describe('dividendTooltip', () => {
  const announced = { date: '2026-11-12', rate: 0.27, estimated: false };
  const estimated = { date: '2026-12-18', rate: 1.89, estimated: true };

  it('uses plain announced and estimated wording', () => {
    expect(dividendTooltip(announced, { side: 'P', strike: 190, bid: 2, price: 200 })[0]).toBe(
      'Ex-dividend Nov 12 · $0.27',
    );
    expect(dividendTooltip(estimated, { side: 'P', strike: 190, bid: 2, price: 200 })[0]).toBe(
      'Ex-dividend ~Dec 18 · ~$1.89 (estimated)',
    );
  });

  it('adds an early-assignment line for an in-the-money covered call', () => {
    expect(
      dividendTooltip(announced, { side: 'C', strike: 190, bid: 10.05, price: 200 }),
    ).toContain('Early-assignment risk: time value $0.05 < dividend.');
    expect(
      dividendTooltip(announced, { side: 'C', strike: 210, bid: 2, price: 200 }).some((line) =>
        line.startsWith('Early-assignment'),
      ),
    ).toBe(false);
  });
});
