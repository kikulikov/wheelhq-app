import { DEFAULT_FILTERS, EXPIRATIONS, PRICE_BUCKETS, RISK_PROFILES } from './config';
import { SECTOR_ALL, SECTOR_LABELS } from './sectors';
import type { Filters } from './types';

export interface FilterChip {
  key: string;
  label: string;
  /** A changed fine-tune or exclusion is removable; preset expiration chips are read-only. */
  removable: boolean;
}

/** The active preset values a fine-tune chip resets to. */
function baseline(riskKey: string): Partial<Filters> {
  return RISK_PROFILES[riskKey as keyof typeof RISK_PROFILES]?.filters ?? DEFAULT_FILTERS;
}

/**
 * Every active screening selection, including defaults. Universe and ticker search are
 * separate scope dimensions and are not part of this summary.
 */
export function filterChips(
  filters: Filters,
  riskKey: string,
  expiryKey: string,
  excluded: string[],
): FilterChip[] {
  const chips: FilterChip[] = [];
  const risk = RISK_PROFILES[riskKey as keyof typeof RISK_PROFILES];
  chips.push({
    key: 'risk',
    label: risk?.label ?? RISK_PROFILES.balanced.label,
    removable: riskKey !== 'balanced' && !!risk,
  });

  const expiryLabel =
    EXPIRATIONS[expiryKey as keyof typeof EXPIRATIONS]?.label ??
    `${filters.minDte}–${filters.maxDte}d`;
  chips.push({
    key: 'expiry',
    label: expiryLabel,
    removable: expiryKey === 'custom',
  });

  const bucket = PRICE_BUCKETS.find(
    (candidate) =>
      candidate.minPrice === filters.minPrice && candidate.maxPrice === filters.maxPrice,
  );
  chips.push({
    key: 'price',
    label: bucket?.label ?? `$${filters.minPrice}–${filters.maxPrice}`,
    removable:
      filters.minPrice !== DEFAULT_FILTERS.minPrice ||
      filters.maxPrice !== DEFAULT_FILTERS.maxPrice,
  });

  chips.push({
    key: 'sector',
    label:
      filters.sector === SECTOR_ALL
        ? 'All Sectors'
        : (SECTOR_LABELS[filters.sector as keyof typeof SECTOR_LABELS] ?? filters.sector),
    removable: filters.sector !== SECTOR_ALL,
  });

  const preset = baseline(riskKey);
  chips.push({
    key: 'delta',
    label: `Δ ${filters.minDelta.toFixed(2)}–${filters.maxDelta.toFixed(2)}`,
    removable: filters.minDelta !== preset.minDelta || filters.maxDelta !== preset.maxDelta,
  });
  // A switched-off filter is not a selection: omit it rather than saying "off".
  if (filters.maxIv > 0) {
    chips.push({
      key: 'iv',
      label: `IV ≤ ${filters.maxIv}%`,
      removable: true,
    });
  }
  if (filters.minYield > 0) {
    chips.push({
      key: 'yield',
      label: `Yield ≥ ${filters.minYield}%`,
      removable: true,
    });
  }
  chips.push({
    key: 'ann',
    label: `Ann ≥ ${filters.minAnn}%`,
    removable: filters.minAnn !== preset.minAnn,
  });
  if (filters.maxSpread > 0) {
    chips.push({
      key: 'spread',
      label: `Spread ≤ ${filters.maxSpread}%`,
      removable: filters.maxSpread !== preset.maxSpread,
    });
  }
  chips.push({
    key: 'avoidEarnings',
    label: filters.avoidEarnings ? 'Avoid earnings' : 'Earnings: allowed',
    removable: filters.avoidEarnings,
  });
  chips.push({
    key: 'avoidDividends',
    label: filters.avoidDividends ? 'Avoid dividends' : 'Dividends: allowed',
    removable: filters.avoidDividends,
  });

  for (const symbol of excluded) {
    chips.push({ key: `exclude:${symbol}`, label: `Exclude ${symbol}`, removable: true });
  }
  return chips;
}
