import { describe, expect, it } from 'vitest';
import { coverageWarnings } from '../src/lib/coverage';

const base = {
  avoidEarnings: false,
  avoidDividends: false,
  earnings: {
    status: 'ready' as const,
    effectiveDate: '2026-11-16',
    expectedDate: '2026-11-16',
  },
  dividends: { status: 'ready' as const, date: '2026-11-16' },
};

describe('coverageWarnings', () => {
  it('says nothing when filters are off or coverage is current', () => {
    expect(coverageWarnings(base)).toEqual([]);
    expect(
      coverageWarnings({
        ...base,
        avoidEarnings: true,
        avoidDividends: true,
      }),
    ).toEqual([]);
  });

  it('reports failed earnings coverage instead of implying no event', () => {
    expect(
      coverageWarnings({
        ...base,
        avoidEarnings: true,
        earnings: { status: 'failed', effectiveDate: '', expectedDate: '2026-11-16' },
      }),
    ).toEqual(['Earnings data is unavailable — the “Avoid earnings” filter is not applied.']);
  });

  it('reports earnings still loading', () => {
    expect(
      coverageWarnings({
        ...base,
        avoidEarnings: true,
        earnings: { status: 'loading', effectiveDate: '', expectedDate: '2026-11-16' },
      })[0],
    ).toContain('still loading');
  });

  it('warns when the daily build is missing', () => {
    expect(
      coverageWarnings({
        ...base,
        avoidEarnings: true,
        earnings: { status: 'ready', effectiveDate: '2026-11-16', expectedDate: '2026-11-17' },
      })[0],
    ).toBe(
      'Earnings data is from 16 Nov 2026 and the 17 Nov 2026 daily build is missing. Refresh to retry, and check earnings dates manually until it updates.',
    );
  });

  it('accepts the newest expected build as current', () => {
    expect(
      coverageWarnings({
        ...base,
        avoidEarnings: true,
        earnings: { status: 'ready', effectiveDate: '2026-11-17', expectedDate: '2026-11-17' },
      }),
    ).toEqual([]);
  });

  it('does not warn when the dataset is ahead of the expected build', () => {
    expect(
      coverageWarnings({
        ...base,
        avoidEarnings: true,
        earnings: { status: 'ready', effectiveDate: '2026-11-18', expectedDate: '2026-11-17' },
      }),
    ).toEqual([]);
  });

  it('reports dividend data that is loading, partial, failed, or stale', () => {
    const dividend = (status: 'loading' | 'partial' | 'failed' | 'stale', date = '2026-11-16') =>
      coverageWarnings({ ...base, avoidDividends: true, dividends: { status, date } })[0];

    expect(dividend('loading')).toContain('still loading');
    expect(dividend('partial')).toContain('missing for some scanned symbols');
    expect(dividend('failed')).toContain('unavailable');
    expect(dividend('stale', '2026-11-15')).toContain('from 15 Nov 2026');
  });

  it('ignores disabled filters even when their data is missing', () => {
    expect(
      coverageWarnings({
        ...base,
        earnings: { status: 'failed', effectiveDate: '', expectedDate: '2026-11-16' },
        dividends: { status: 'failed', date: '' },
      }),
    ).toEqual([]);
  });
});
