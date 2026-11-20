import { PAGE_CAP } from './config';
import type { ScreenResult } from './types';

export function alertsFor(data: ScreenResult, hasSkipMessage = false): string[] {
  const result: string[] = [];
  const isAuthError = (message: string) => /\bHTTP (401|403)\b/.test(message);
  const isRateLimitError = (message: string) => /\bHTTP 429\b/.test(message);
  const authFailed = [data.priceError, ...Object.values(data.errors)].some((message) =>
    isAuthError(message || ''),
  );
  if (authFailed) {
    result.push('Alpaca rejected the saved key. Replace it or remove it.');
  }
  if (data.priceError && !isAuthError(data.priceError)) {
    result.push(`Stock prices unavailable: ${data.priceError}. Price-based metrics are hidden.`);
  } else if (!data.priceError && data.missingPrices.length) {
    result.push(
      `No stock snapshot for ${data.missingPrices.join(', ')}. Price-based metrics are hidden.`,
    );
  }
  const rateLimited = Object.values(data.errors).some((message) => /\bHTTP 429\b/.test(message));
  for (const [symbol, message] of Object.entries(data.errors)) {
    if (isAuthError(message) || isRateLimitError(message)) continue;
    result.push(`${symbol}: ${message}`);
  }
  if (rateLimited && !hasSkipMessage) {
    result.push('Alpaca rate limit reached — try again in a minute.');
  }
  if (data.truncatedChains.length) {
    result.push(
      `Chains truncated at ${(PAGE_CAP * 1000).toLocaleString('en-US')} contracts for ${data.truncatedChains.join(', ')}; narrow the DTE range or refresh.`,
    );
  }
  return result;
}
