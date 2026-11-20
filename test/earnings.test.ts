import { describe, expect, it } from 'vitest';
import { earningsTooltip, nextEarnings } from '../src/lib/earnings';
import type { EarningsEvent } from '../src/lib/types';

const expected: EarningsEvent = {
  date: '2026-11-17',
  session: 'after_close',
  status: 'expected',
  name: 'NVIDIA Corporation',
  marketCap: 5_000_000_000_000,
};

const estimated: EarningsEvent = {
  date: '2027-01-28',
  session: 'unknown',
  status: 'estimated',
  name: null,
  marketCap: null,
};

const events = { NVDA: expected, AAPL: estimated };

describe('nextEarnings', () => {
  it('finds an expected report inside the row window', () => {
    expect(nextEarnings(events, '2026-11-11', '2026-11-20', 'NVDA')).toEqual(expected);
  });

  it('includes a before-open event exactly on the expiry', () => {
    const beforeOpen = { ...expected, session: 'before_open' as const };
    expect(nextEarnings({ NVDA: beforeOpen }, '2026-11-11', '2026-11-17', 'NVDA')).toEqual(
      beforeOpen,
    );
  });

  it('keeps an after-close event on the expiry day', () => {
    // Exercise instructions can follow the close, so the contract is still exposed.
    expect(nextEarnings(events, '2026-11-11', '2026-11-17', 'NVDA')).toEqual(expected);
  });

  it('keeps a same-day after-close report on a 0DTE contract', () => {
    expect(nextEarnings(events, '2026-11-17', '2026-11-17', 'NVDA')).toEqual(expected);
  });

  it("counts a report after today's close for later expiries", () => {
    expect(nextEarnings(events, '2026-11-17', '2026-11-20', 'NVDA')).toEqual(expected);
  });

  it('counts before-open and unknown reports today for later expiries', () => {
    const beforeOpen = { ...expected, session: 'before_open' as const };
    const unknown = { ...expected, session: 'unknown' as const };
    expect(nextEarnings({ NVDA: beforeOpen }, '2026-11-17', '2026-11-20', 'NVDA')).toEqual(
      beforeOpen,
    );
    expect(nextEarnings({ NVDA: unknown }, '2026-11-17', '2026-11-20', 'NVDA')).toEqual(unknown);
    expect(nextEarnings(events, '2026-11-18', '2026-11-20', 'NVDA')).toBeNull();
  });

  it('ignores dates beyond the expiry and unknown symbols', () => {
    expect(nextEarnings(events, '2026-11-11', '2026-11-14', 'NVDA')).toBeNull();
    expect(nextEarnings(events, '2026-11-11', '2026-11-20', 'MSFT')).toBeNull();
  });
});

describe('earningsTooltip', () => {
  it('uses the session wording', () => {
    expect(earningsTooltip(expected)).toEqual([
      'Earnings Nov 17, after the close',
      'Volatility is usually inflated before earnings and drops after.',
    ]);
    expect(earningsTooltip({ ...expected, session: 'before_open' })[0]).toBe(
      'Earnings Nov 17, before the open',
    );
    expect(earningsTooltip({ ...expected, session: 'unknown' })[0]).toBe('Earnings Nov 17');
  });

  it('marks estimates with a tilde', () => {
    expect(earningsTooltip(estimated)[0]).toBe('Earnings ~Jan 28 (estimated)');
  });
});
