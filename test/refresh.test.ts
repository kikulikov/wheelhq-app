import { describe, expect, it } from 'vitest';
import {
  AUX_REFRESH_MS,
  AUTO_REFRESH_OPTIONS,
  autoRefreshLabel,
  autoRefreshMs,
  autoRefreshShort,
  forceInputReload,
  sanitizeAutoRefresh,
  shouldReloadAssets,
  shouldReloadAux,
} from '../src/lib/refresh';

describe('auto-refresh options', () => {
  it('offers off, one, five and ten minutes', () => {
    expect(AUTO_REFRESH_OPTIONS).toEqual([0, 1, 5, 10]);
  });

  it('sanitises a stored value to a known interval', () => {
    expect(sanitizeAutoRefresh(0)).toBe(0);
    expect(sanitizeAutoRefresh(1)).toBe(1);
    expect(sanitizeAutoRefresh(5)).toBe(5);
    expect(sanitizeAutoRefresh(10)).toBe(10);
    expect(sanitizeAutoRefresh(3)).toBe(0);
    expect(sanitizeAutoRefresh('5')).toBe(5);
    expect(sanitizeAutoRefresh('never')).toBe(0);
    expect(sanitizeAutoRefresh(null)).toBe(0);
    expect(sanitizeAutoRefresh(undefined)).toBe(0);
    expect(sanitizeAutoRefresh(-1)).toBe(0);
    expect(sanitizeAutoRefresh(Number.NaN)).toBe(0);
  });

  it('labels the current interval', () => {
    expect(autoRefreshLabel(0)).toBe('Off');
    expect(autoRefreshLabel(1)).toBe('1 min');
    expect(autoRefreshLabel(10)).toBe('10 min');
    expect(autoRefreshShort(0)).toBe('Off');
    expect(autoRefreshShort(5)).toBe('5m');
  });

  it('converts minutes to milliseconds', () => {
    expect(autoRefreshMs(0)).toBe(0);
    expect(autoRefreshMs(1)).toBe(60_000);
    expect(autoRefreshMs(10)).toBe(600_000);
  });
});

describe('refresh reasons', () => {
  it('forces dataset reloads only for an explicit refresh', () => {
    expect(forceInputReload('initial')).toBe(true);
    expect(forceInputReload('manual')).toBe(true);
    expect(forceInputReload('scope')).toBe(false);
    expect(forceInputReload('auto')).toBe(false);
  });
});

describe('auxiliary-data cadence', () => {
  const HOUR = 60 * 60 * 1000;

  it('always reloads on a manual refresh', () => {
    expect(shouldReloadAux({ manual: true, lastLoadAt: 0, now: 1 })).toBe(true);
  });

  it('reloads datasets at most once an hour on auto ticks', () => {
    const lastLoadAt = Date.parse('2026-11-17T10:00:00Z');
    expect(shouldReloadAux({ manual: false, lastLoadAt, now: lastLoadAt + HOUR - 1 })).toBe(false);
    expect(shouldReloadAux({ manual: false, lastLoadAt, now: lastLoadAt + HOUR })).toBe(true);
    expect(AUX_REFRESH_MS).toBe(HOUR);
  });

  it('reloads asset metadata once per New York day', () => {
    expect(shouldReloadAssets({ manual: true, loadedOn: '2026-11-17', today: '2026-11-17' })).toBe(
      true,
    );
    expect(shouldReloadAssets({ manual: false, loadedOn: '2026-11-17', today: '2026-11-17' })).toBe(
      false,
    );
    expect(shouldReloadAssets({ manual: false, loadedOn: '2026-11-16', today: '2026-11-17' })).toBe(
      true,
    );
    expect(shouldReloadAssets({ manual: false, loadedOn: '', today: '2026-11-17' })).toBe(true);
  });
});
