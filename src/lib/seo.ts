import { isProductionHost } from './environment';

/** Keep the dev/preview hosts out of search results. */
export function applyRobotsPolicy(hostname: string, doc: Document = document): void {
  if (isProductionHost(hostname)) return;
  doc.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex,nofollow');
}
