/** GoatCounter's image endpoint for this site. Fixed: the CSP allows exactly this host. */
export const GOATCOUNTER_ENDPOINT = 'https://wheelhq.goatcounter.com/count';

const MARKER = 'data-wheelhq-analytics';
const SAFE_PATH = /^\/(?:[A-Za-z0-9._-]+\/)*$/;

/**
 * A 1x1 image request. The path is always a fixed, query-free page name:
 * WheelHQ keeps tickers, lists and filters in the URL, so nothing from
 * `location` may reach the analytics provider.
 */
export function buildPixelTag(path: string, endpoint = GOATCOUNTER_ENDPOINT): string {
  if (!SAFE_PATH.test(path)) {
    throw new Error(`analytics path must be a fixed path without a query: ${path}`);
  }
  return `<img src="${endpoint}?p=${encodeURIComponent(path)}" width="1" height="1" alt="" referrerpolicy="no-referrer" ${MARKER}>`;
}

/** Analytics is opt-in at build time and never injected by the dev server. */
export function resolvePixelTag({
  enabled,
  serving,
  path,
}: {
  enabled: boolean;
  serving: boolean;
  path: string;
}): string {
  if (!enabled || serving) return '';
  return buildPixelTag(path);
}

/** Insert the pixel before `</body>`, once. Empty tags and repeat runs are no-ops. */
export function injectPixel(html: string, tag: string): string {
  if (!tag || html.includes(MARKER)) return html;
  if (!/<\/body>/i.test(html)) return `${html}${tag}`;
  return html.replace(/<\/body>/i, `${tag}\n</body>`);
}
