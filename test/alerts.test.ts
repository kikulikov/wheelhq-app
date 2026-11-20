import { describe, expect, it } from 'vitest';
import { alertsFor } from '../src/lib/alerts';
import type { ScreenResult } from '../src/lib/types';

const base: ScreenResult = {
  generatedAt: '2026-11-09T12:00:00Z',
  delayed: false,
  errors: {},
  priceError: '',
  missingPrices: [],
  truncatedChains: [],
  chainPages: 0,
  rows: [],
};

describe('alertsFor', () => {
  it('reports an auth failure once', () => {
    expect(alertsFor({ ...base, errors: { AAPL: 'HTTP 401' } })).toEqual([
      'Alpaca rejected the saved key. Replace it or remove it.',
    ]);
  });

  it('reports prices and missing snapshots', () => {
    expect(alertsFor({ ...base, priceError: 'HTTP 500' })[0]).toContain('Stock prices unavailable');
    expect(alertsFor({ ...base, missingPrices: ['GHOST'] })[0]).toContain('No stock snapshot');
  });

  it('derives the truncation limit', () => {
    expect(alertsFor({ ...base, truncatedChains: ['AAPL'] })[0]).toContain('5,000 contracts');
  });

  it('lists per-symbol errors', () => {
    expect(alertsFor({ ...base, errors: { AAPL: 'HTTP 422' } })).toEqual(['AAPL: HTTP 422']);
  });

  it('collapses a persistent 429 into one rate-limit line', () => {
    expect(
      alertsFor({ ...base, errors: { AAPL: 'HTTP 429', MSFT: 'HTTP 429 — too many requests' } }),
    ).toEqual(['Alpaca rate limit reached — try again in a minute.']);
  });

  it('defers to the scan-level skip message when one will be shown', () => {
    expect(alertsFor({ ...base, errors: { AAPL: 'HTTP 429' } }, true)).toEqual([]);
  });
});
