import { describe, expect, it } from 'vitest';
import {
  GOATCOUNTER_ENDPOINT,
  buildPixelTag,
  injectPixel,
  resolvePixelTag,
} from '../src/lib/analytics';

const MARKER = 'data-wheelhq-analytics';

describe('buildPixelTag', () => {
  it('builds a 1x1 image with an encoded fixed path', () => {
    const tag = buildPixelTag('/about/');

    expect(tag).toContain(`src="${GOATCOUNTER_ENDPOINT}?p=%2Fabout%2F"`);
    expect(tag).toContain('width="1"');
    expect(tag).toContain('height="1"');
    expect(tag).toContain('alt=""');
    expect(tag).toContain(MARKER);
  });

  it('never includes a script or an event handler', () => {
    const tag = buildPixelTag('/');
    expect(tag.startsWith('<img')).toBe(true);
    expect(tag).not.toContain('<script');
    expect(tag).not.toContain('onload');
    expect(tag).not.toContain('onerror');
  });

  it('suppresses the referrer so query strings cannot leak through it', () => {
    expect(buildPixelTag('/')).toContain('referrerpolicy="no-referrer"');
  });

  it('rejects a path carrying a query, fragment or full URL', () => {
    expect(() => buildPixelTag('/?q=AAPL&sector=tech')).toThrow();
    expect(() => buildPixelTag('/about/#contact')).toThrow();
    expect(() => buildPixelTag('https://wheelhq.xyz/?q=AAPL')).toThrow();
    expect(() => buildPixelTag('')).toThrow();
  });

  it('only sends the page parameter', () => {
    const src = /src="([^"]+)"/.exec(buildPixelTag('/'))?.[1];
    expect(src).toBeTruthy();
    const params = new URL(src!).searchParams;
    expect([...params.keys()]).toEqual(['p']);
    expect(params.get('p')).toBe('/');
  });
});

describe('resolvePixelTag', () => {
  it('stays empty unless analytics is explicitly enabled', () => {
    expect(resolvePixelTag({ enabled: false, serving: false, path: '/' })).toBe('');
  });

  it('never emits analytics from the dev server', () => {
    expect(resolvePixelTag({ enabled: true, serving: true, path: '/' })).toBe('');
  });

  it('emits the pixel for an enabled production build', () => {
    expect(resolvePixelTag({ enabled: true, serving: false, path: '/' })).toBe(buildPixelTag('/'));
  });
});

describe('injectPixel', () => {
  it('inserts the pixel before the closing body tag', () => {
    expect(injectPixel('<html><body>hi</body></html>', '<img>')).toBe(
      '<html><body>hi<img>\n</body></html>',
    );
  });

  it('is idempotent', () => {
    const once = injectPixel('<body>hi</body>', buildPixelTag('/'));
    expect(injectPixel(once, buildPixelTag('/'))).toBe(once);
  });

  it('is a no-op without a tag', () => {
    expect(injectPixel('<body>hi</body>', '')).toBe('<body>hi</body>');
  });
});
