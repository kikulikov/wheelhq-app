import { describe, expect, it } from 'vitest';
import { filterChips } from '../src/lib/filtersSummary';
import { DEFAULT_FILTERS, RISK_PROFILES } from '../src/lib/config';
import type { Filters } from '../src/lib/types';

const base: Filters = { ...DEFAULT_FILTERS };

describe('filterChips', () => {
  it('shows the complete default configuration as read-only chips', () => {
    const chips = filterChips(base, 'balanced', '1-7', []);
    expect(chips.map((chip) => chip.label)).toEqual([
      'Balanced',
      'Weekly',
      '$75–150',
      'All Sectors',
      'Δ 0.15–0.35',
      'Ann ≥ 10%',
      'Earnings: allowed',
      'Dividends: allowed',
    ]);
    expect(chips.every((chip) => !chip.removable)).toBe(true);
  });

  it('marks non-default presets and exclusions as removable', () => {
    const chips = filterChips(
      { ...base, sector: 'tech', minPrice: 150, maxPrice: 300 },
      'balanced',
      '15-28',
      ['AAPL'],
    );
    const byKey = Object.fromEntries(chips.map((chip) => [chip.key, chip]));
    expect(byKey.expiry.label).toBe('2–4 weeks out');
    expect(byKey.expiry.removable).toBe(false);
    expect(byKey.price.label).toBe('$150–300');
    expect(byKey.price.removable).toBe(true);
    expect(byKey.sector.label).toBe('Technology');
    expect(byKey.sector.removable).toBe(true);
    expect(byKey['exclude:AAPL'].removable).toBe(true);
  });

  it('uses the active risk profile as the baseline for fine-tune chips', () => {
    const chips = filterChips(
      { ...base, ...RISK_PROFILES.conservative.filters },
      'conservative',
      '1-7',
      [],
    );
    const byKey = Object.fromEntries(chips.map((chip) => [chip.key, chip]));
    expect(byKey.risk.label).toBe('Conservative');
    expect(byKey.risk.removable).toBe(true);
    expect(byKey.delta.label).toBe('Δ 0.10–0.25');
    expect(byKey.delta.removable).toBe(false);
    expect(byKey.ann.label).toBe('Ann ≥ 8%');
    expect(byKey.ann.removable).toBe(false);
    // Spread stays off in every profile until the user sets a cap.
    expect(byKey.spread).toBeUndefined();
  });

  it('omits a chip when its filter is switched off', () => {
    const chips = filterChips(
      { ...base, maxIv: 0, minYield: 0, maxSpread: 0 },
      'balanced',
      '1-7',
      [],
    );
    const keys = chips.map((chip) => chip.key);
    expect(keys).not.toContain('iv');
    expect(keys).not.toContain('yield');
    expect(keys).not.toContain('spread');
    expect(chips.some((chip) => chip.label.endsWith(' off'))).toBe(false);
  });

  it('marks tweaked profile values removable', () => {
    const chips = filterChips(
      { ...base, ...RISK_PROFILES.conservative.filters, minDelta: 0.05 },
      'conservative',
      '1-7',
      [],
    );
    const delta = chips.find((chip) => chip.key === 'delta');
    expect(delta?.label).toBe('Δ 0.05–0.25');
    expect(delta?.removable).toBe(true);
  });

  it('labels numeric filters and event exclusions', () => {
    const chips = filterChips(
      {
        ...base,
        maxIv: 60,
        minYield: 2,
        minAnn: 25,
        maxSpread: 12,
        avoidEarnings: true,
        avoidDividends: true,
      },
      'balanced',
      '1-7',
      [],
    );
    const labels = chips.map((chip) => chip.label);
    expect(labels).toContain('IV ≤ 60%');
    expect(labels).toContain('Yield ≥ 2%');
    expect(labels).toContain('Ann ≥ 25%');
    expect(labels).toContain('Spread ≤ 12%');
    expect(labels).toContain('Avoid earnings');
    expect(labels).toContain('Avoid dividends');
    expect(chips.find((chip) => chip.key === 'iv')?.removable).toBe(true);
    expect(chips.find((chip) => chip.key === 'avoidEarnings')?.removable).toBe(true);
  });

  it('uses a custom DTE label when no preset matches', () => {
    const chips = filterChips({ ...base, minDte: 3, maxDte: 9 }, 'balanced', 'custom', []);
    const expiry = chips.find((chip) => chip.key === 'expiry');
    expect(expiry).toEqual({ key: 'expiry', label: '3–9d', removable: true });
  });
});
