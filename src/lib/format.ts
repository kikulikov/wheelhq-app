export const fmt2 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const fmt1 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
export const fmtK = (value: number | null): string => {
  if (value == null) return '—';
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return String(value);
};

export const pct1 = (value: number | null): string =>
  value == null ? '—' : `${fmt1.format(value)}%`;

export const signedPts = (value: number | null): string =>
  value == null ? '—' : `${value > 0 ? '+' : ''}${fmt2.format(value)}`;

export const signedPct = (value: number | null): string =>
  value == null ? '—' : `${value > 0 ? '+' : ''}${fmt1.format(value)}%`;

export const priceText = (value: number | null): string =>
  value == null ? '—' : `$${fmt2.format(value)}`;

const fmt0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Cash reserved for one option contract at the strike (100 shares). */
export const cashRequired = (strike: number): string => `$${fmt0.format(strike * 100)}`;
