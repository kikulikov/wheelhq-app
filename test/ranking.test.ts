import { describe, expect, it } from 'vitest';
import { rankByLiquidity, sessionBar, snapshotInfo, type RawSnapshot } from '../src/lib/ranking';

const raw = {
  latestTrade: { p: 100 },
  dailyBar: { t: '2026-11-06T05:00:00Z', c: 100, v: 1000, n: 10 },
  prevDailyBar: { t: '2026-11-05T05:00:00Z', c: 90, v: 2000, n: 20 },
};
describe('sessionBar', () => {
  it('uses the previous session while today is live', () => {
    expect(sessionBar(raw, '2026-11-06', 600)).toBe(raw.prevDailyBar);
  });

  it('uses today after the close', () => {
    expect(sessionBar(raw, '2026-11-06', 1000)).toBe(raw.dailyBar);
  });

  it('uses the latest complete session on a weekend', () => {
    expect(sessionBar(raw, '2026-11-08', 600)).toBe(raw.dailyBar);
  });

  it('returns null when no bar exists', () => {
    expect(sessionBar(undefined, '2026-11-06', 600)).toBeNull();
  });
});

describe('snapshotInfo', () => {
  it('computes dollar volume and trades from the chosen session', () => {
    expect(snapshotInfo(raw, '2026-11-06', 600)).toEqual({
      price: 100,
      previous: 90,
      dv: 180000,
      trades: 20,
      barDate: '2026-11-05',
      priceTime: '2026-11-06T05:00:00Z',
      present: true,
    });
    expect(snapshotInfo(raw, '2026-11-06', 1000)).toEqual({
      price: 100,
      previous: 90,
      dv: 100000,
      trades: 10,
      barDate: '2026-11-06',
      priceTime: '2026-11-06T05:00:00Z',
      present: true,
    });
  });

  it('falls back to the other bar when the chosen one has no volume', () => {
    const empty = { ...raw, prevDailyBar: { ...raw.prevDailyBar, v: 0, n: 0 } };
    expect(snapshotInfo(empty, '2026-11-06', 600)).toEqual({
      price: 100,
      previous: 90,
      dv: 100000,
      trades: 10,
      barDate: '2026-11-06',
      priceTime: '2026-11-06T05:00:00Z',
      present: true,
    });
  });

  it('scores zero when neither bar has volume', () => {
    expect(snapshotInfo(undefined, '2026-11-06', 600)).toEqual({
      price: null,
      previous: null,
      dv: 0,
      trades: 0,
      barDate: null,
      priceTime: null,
      present: false,
    });
  });

  it('treats a null snapshot as absent', () => {
    expect(snapshotInfo(null as unknown as RawSnapshot, '2026-11-06', 600).present).toBe(false);
  });

  it('prefers a newer daily close over a stale trade', () => {
    const stale = {
      latestTrade: { p: 97, t: '2026-11-04T20:00:00Z' },
      dailyBar: { t: '2026-11-06T21:00:00Z', c: 101, v: 1000, n: 10 },
      prevDailyBar: { t: '2026-11-05T21:00:00Z', c: 100, v: 1000, n: 10 },
    };
    const info = snapshotInfo(stale, '2026-11-06', 1000);

    expect(info.price).toBe(101);
    expect(info.priceTime).toBe('2026-11-06T21:00:00Z');
  });

  it('prefers a newer trade over the daily close', () => {
    const fresh = {
      latestTrade: { p: 102, t: '2026-11-06T21:30:00Z' },
      dailyBar: { t: '2026-11-06T20:00:00Z', c: 101, v: 1000, n: 10 },
      prevDailyBar: { t: '2026-11-05T20:00:00Z', c: 100, v: 1000, n: 10 },
    };
    expect(snapshotInfo(fresh, '2026-11-06', 1000).price).toBe(102);
  });

  it('keeps the trade price when no observation is timestamped', () => {
    const untimed = {
      latestTrade: { p: 102 },
      dailyBar: { c: 101, v: 1000, n: 10 },
      prevDailyBar: { c: 100, v: 1000, n: 10 },
    };
    const info = snapshotInfo(untimed, '2026-11-06', 1000);
    expect(info.price).toBe(102);
    expect(info.priceTime).toBeNull();
  });

  it('ignores a non-numeric price observation', () => {
    const broken = {
      latestTrade: { p: Number.NaN, t: '2026-11-06T21:30:00Z' },
      dailyBar: { t: '2026-11-06T21:00:00Z', c: 101, v: 1000, n: 10 },
      prevDailyBar: { t: '2026-11-05T21:00:00Z', c: 100, v: 1000, n: 10 },
    };
    expect(snapshotInfo(broken, '2026-11-06', 1000).price).toBe(101);
  });
});

describe('rankByLiquidity', () => {
  it('sorts by dollar volume, then trades, then symbol', () => {
    expect(
      rankByLiquidity(['A', 'B', 'C'], {
        A: { dv: 100, trades: 5 },
        B: { dv: 300, trades: 1 },
        C: { dv: 100, trades: 9 },
      }),
    ).toEqual(['B', 'C', 'A']);
  });

  it('keeps unscored and zero-volume symbols last in input order', () => {
    expect(
      rankByLiquidity(['A', 'D', 'B', 'E'], {
        A: { dv: 100, trades: 1 },
        B: { dv: 200, trades: 1 },
        D: { dv: 0, trades: 0 },
      }),
    ).toEqual(['B', 'A', 'D', 'E']);
  });
});
