import { fullDate } from './date';

export type EarningsStatus = 'loading' | 'ready' | 'failed';
export type DividendStatus = 'loading' | 'ready' | 'partial' | 'failed' | 'stale';

export interface CoverageInput {
  avoidEarnings: boolean;
  avoidDividends: boolean;
  earnings: { status: EarningsStatus; effectiveDate: string; expectedDate: string };
  dividends: { status: DividendStatus; date: string };
}

/**
 * Say out loud when an active event filter has no data to filter on. Absent
 * coverage is not the same as "no event", and the filter must never look
 * applied while it is inert.
 */
export function coverageWarnings(input: CoverageInput): string[] {
  const warnings: string[] = [];

  if (input.avoidEarnings) {
    const { status, effectiveDate, expectedDate } = input.earnings;
    if (status === 'failed') {
      warnings.push('Earnings data is unavailable — the “Avoid earnings” filter is not applied.');
    } else if (status === 'loading') {
      warnings.push(
        'Earnings dates are still loading — the “Avoid earnings” filter is not applied yet.',
      );
    } else if (effectiveDate < expectedDate) {
      warnings.push(
        `Earnings data is from ${fullDate(effectiveDate)} and the ${fullDate(expectedDate)} daily build is missing. Refresh to retry, and check earnings dates manually until it updates.`,
      );
    }
  }

  if (input.avoidDividends) {
    const { status, date } = input.dividends;
    if (status === 'failed') {
      warnings.push('Dividend data is unavailable — the “Avoid dividends” filter is not applied.');
    } else if (status === 'partial') {
      warnings.push(
        'Dividend dates are missing for some scanned symbols — the “Avoid dividends” filter did not check them.',
      );
    } else if (status === 'loading') {
      warnings.push(
        'Dividend dates are still loading — the “Avoid dividends” filter is not applied yet.',
      );
    } else if (status === 'stale') {
      warnings.push(
        `Dividend dates are from ${fullDate(date)} — the “Avoid dividends” filter is not applied for today.`,
      );
    }
  }

  return warnings;
}
