import { monthDay } from './date';
import type { EarningsEvent } from './types';

/**
 * True when the report creates risk for a contract with this expiry.
 * Any report from today through the expiry day counts, including an
 * after-close report on the expiry day itself: exercise and assignment
 * instructions can still follow that close. The report's session is shown in
 * the tooltip but does not narrow the window.
 */
export function earningsInWindow(event: EarningsEvent, today: string, expiry: string): boolean {
  return event.date >= today && event.date <= expiry;
}

/** The next report for a symbol that falls inside the row's window. */
export function nextEarnings(
  events: Record<string, EarningsEvent>,
  today: string,
  expiry: string,
  symbol: string,
): EarningsEvent | null {
  const event = events[symbol];
  return event && earningsInWindow(event, today, expiry) ? event : null;
}

const SESSION_WORDING: Record<EarningsEvent['session'], string> = {
  before_open: ', before the open',
  after_close: ', after the close',
  unknown: '',
};

export function earningsTooltip(event: EarningsEvent): string[] {
  const when = `${event.status === 'estimated' ? '~' : ''}${monthDay(event.date)}`;
  const session = event.status === 'estimated' ? '' : SESSION_WORDING[event.session];
  const suffix = event.status === 'estimated' ? ' (estimated)' : '';
  return [
    `Earnings ${when}${session}${suffix}`,
    'Volatility is usually inflated before earnings and drops after.',
  ];
}
