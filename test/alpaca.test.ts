import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  feedFor,
  fetchAssetMeta,
  fetchCashDividends,
  fetchJson,
  fetchStockSnapshots,
  screenDirect,
  screenSymbol,
  testKey,
} from '../src/lib/alpaca';
import { DIVIDEND_BATCH_SIZE, DIVIDEND_PAGE_CAP } from '../src/lib/config';
import type { ChainScope } from '../src/lib/types';
import { ymdPlus } from '../src/lib/date';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function mockAlpaca(urls: string[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('/v2/stocks/snapshots')) {
        return json({ AAPL: { latestTrade: { p: 200 }, prevDailyBar: { c: 198 } } });
      }
      if (url.includes('/v1beta1/options/snapshots/')) return json({ snapshots: {} });
      return json({});
    }),
  );
}

const scope: ChainScope = { type: 'put', minDte: 2, maxDte: 7 };

describe('options feed by key prefix', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses indicative immediately for paper/non-AK keys', async () => {
    const urls: string[] = [];
    mockAlpaca(urls);
    await screenDirect(['AAPL'], { keyId: 'PKTEST', secret: 's' }, scope, null);
    expect(urls.some((url) => url.includes('feed=opra'))).toBe(false);
    expect(urls.some((url) => url.includes('feed=indicative'))).toBe(true);
  });

  it('tries opra first for live keys', async () => {
    const urls: string[] = [];
    mockAlpaca(urls);
    await screenDirect(['AAPL'], { keyId: 'AKTEST', secret: 's' }, scope, null);
    expect(urls.some((url) => url.includes('feed=opra'))).toBe(true);
  });

  it('falls back to indicative when a live key has no OPRA access', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        if (url.includes('/v2/stocks/snapshots')) {
          return json({ AAPL: { latestTrade: { p: 200 }, prevDailyBar: { c: 198 } } });
        }
        if (url.includes('/v1beta1/options/snapshots/')) {
          if (url.includes('feed=opra')) {
            return new Response(JSON.stringify({ message: 'OPRA agreement is not signed' }), {
              status: 403,
              headers: { 'content-type': 'application/json' },
            });
          }
          return json({ snapshots: {} });
        }
        return json({});
      }),
    );

    const result = await screenDirect(['AAPL'], { keyId: 'AKTEST', secret: 's' }, scope, null);
    expect(result.delayed).toBe(true);
    expect(result.delayed).toBe(true);
    expect(urls.some((url) => url.includes('feed=opra'))).toBe(true);
    expect(urls.some((url) => url.includes('feed=indicative'))).toBe(true);
  });
});

describe('strike bounds', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends only the upper bound for puts', async () => {
    const urls: string[] = [];
    mockAlpaca(urls);

    await screenDirect(['AAPL'], { keyId: 'PKTEST', secret: 's' }, scope, null);

    const chain = urls.find((url) => url.includes('/v1beta1/options/snapshots/'));
    expect(chain).toBeTruthy();
    const params = new URL(chain!).searchParams;
    expect(params.get('strike_price_lte')).toBe('200');
    expect(params.has('strike_price_gte')).toBe(false);
    expect(params.get('expiration_date_gte')).toBe(ymdPlus(2));
  });

  it('sends only the lower bound for calls, at spot', async () => {
    const urls: string[] = [];
    mockAlpaca(urls);
    const callScope: ChainScope = { ...scope, type: 'call' };

    await screenDirect(['AAPL'], { keyId: 'PKTEST', secret: 's' }, callScope, null);

    const chain = urls.find((url) => url.includes('/v1beta1/options/snapshots/'));
    expect(chain).toBeTruthy();
    const params = new URL(chain!).searchParams;
    expect(params.get('strike_price_gte')).toBe('200');
    expect(params.has('strike_price_lte')).toBe(false);
  });

  it('skips the bounds when the snapshot has no price', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        if (url.includes('/v2/stocks/snapshots')) {
          return json({ AAPL: { prevDailyBar: { c: 198 } } });
        }
        return json({ snapshots: {} });
      }),
    );

    await screenDirect(['AAPL'], { keyId: 'PKTEST', secret: 's' }, scope, null);

    const chain = urls.find((url) => url.includes('/v1beta1/options/snapshots/'));
    expect(chain).toBeTruthy();
    const params = new URL(chain!).searchParams;
    expect(params.has('strike_price_gte')).toBe(false);
    expect(params.has('strike_price_lte')).toBe(false);
  });
});

describe('screenSymbol feed fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to indicative for every concurrent worker', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/v1beta1/options/snapshots/')) {
          if (url.includes('feed=opra')) {
            await new Promise((resolve) => setTimeout(resolve, url.includes('/AAPL?') ? 0 : 10));
            return new Response(JSON.stringify({ message: 'OPRA agreement is not signed' }), {
              status: 403,
              headers: { 'content-type': 'application/json' },
            });
          }
          return json({ snapshots: {} });
        }
        return json({});
      }),
    );

    const key = { keyId: 'AKTEST', secret: 's' };
    const feed = feedFor(key);
    const [first, second] = await Promise.all([
      screenSymbol('AAPL', key, scope, null, null, feed),
      screenSymbol('MSFT', key, scope, null, null, feed),
    ]);

    expect(first.error).toBeUndefined();
    expect(second.error).toBeUndefined();
    expect(first.delayed).toBe(true);
    expect(second.delayed).toBe(true);
  });
});

describe('screenSymbol rate limiting', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('flags a persistent 429 as rate-limited after the retries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'too many requests' }), {
            status: 429,
            headers: { 'content-type': 'application/json', 'retry-after': '0.001' },
          }),
      ),
    );

    const result = await screenSymbol('AAPL', { keyId: 'PKTEST', secret: 's' }, scope, null, null);

    expect(result.rateLimited).toBe(true);
    expect(result.error).toMatch(/429/);
    expect(result.rows).toEqual([]);
  });

  it('does not halt on a transient 429 that succeeds on retry', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls++;
        if (calls === 1) {
          return new Response(JSON.stringify({ message: 'too many requests' }), {
            status: 429,
            headers: { 'content-type': 'application/json', 'retry-after': '0.001' },
          });
        }
        return json({ snapshots: {} });
      }),
    );

    const result = await screenSymbol('AAPL', { keyId: 'PKTEST', secret: 's' }, scope, null, null);

    expect(result.rateLimited).toBe(false);
    expect(result.error).toBeUndefined();
    expect(result.rows).toEqual([]);
    expect(calls).toBe(2);
  });
});

describe('fetchStockSnapshots', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps price, previous close, dollar volume, and trades', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          AAPL: {
            latestTrade: { p: 200 },
            dailyBar: { t: '2026-11-06T05:00:00Z', c: 200, v: 1000, n: 10 },
            prevDailyBar: { t: '2026-11-05T05:00:00Z', c: 198, v: 900, n: 9 },
          },
        }),
      ),
    );

    const result = await fetchStockSnapshots(['AAPL'], { keyId: 'PKTEST', secret: 's' }, null, {
      today: '2026-11-06',
      minutes: 1000,
    });

    expect(result.bySymbol.AAPL).toEqual({
      price: 200,
      previous: 198,
      dv: 200000,
      trades: 10,
      barDate: '2026-11-06',
      priceTime: '2026-11-06T05:00:00Z',
      present: true,
    });
  });

  it('requests symbols in chunks of at most 200', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        return json({});
      }),
    );

    const symbols = Array.from({ length: 250 }, (_, i) => `S${i}`);
    await fetchStockSnapshots(symbols, { keyId: 'PKTEST', secret: 's' }, null, {
      today: '2026-11-06',
      minutes: 1000,
    });

    expect(urls).toHaveLength(2);
    const counts = urls.map((url) => new URL(url).searchParams.get('symbols')!.split(',').length);
    expect(counts).toEqual([200, 50]);
  });
});

describe('screenDirect snapshot reuse', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not fetch prices for symbols already supplied', async () => {
    const urls: string[] = [];
    mockAlpaca(urls);

    await screenDirect(['AAPL'], { keyId: 'PKTEST', secret: 's' }, scope, null, {
      snapshots: {
        AAPL: {
          price: 200,
          previous: 198,
          dv: 1,
          trades: 1,
          barDate: '2026-11-06',
          priceTime: '2026-11-06T20:00:00Z',
          present: true,
        },
      },
    });

    expect(urls.some((url) => url.includes('/v2/stocks/snapshots'))).toBe(false);
  });

  it('fetches only the symbols missing from the supplied map', async () => {
    const urls: string[] = [];
    mockAlpaca(urls);

    await screenDirect(['AAPL', 'MSFT'], { keyId: 'PKTEST', secret: 's' }, scope, null, {
      snapshots: {
        AAPL: {
          price: 200,
          previous: 198,
          dv: 1,
          trades: 1,
          barDate: '2026-11-06',
          priceTime: '2026-11-06T20:00:00Z',
          present: true,
        },
      },
    });

    const priceUrl = urls.find((url) => url.includes('/v2/stocks/snapshots'));
    expect(priceUrl).toBeTruthy();
    expect(new URL(priceUrl!).searchParams.get('symbols')).toBe('MSFT');
  });

  it('still reports a symbol with no snapshot anywhere', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/v2/stocks/snapshots')) return json({});
        return json({ snapshots: {} });
      }),
    );

    const result = await screenDirect(['GHOST'], { keyId: 'PKTEST', secret: 's' }, scope, null);

    expect(result.missingPrices).toContain('GHOST');
  });

  it('reports a supplied snapshot that Alpaca never returned', async () => {
    const urls: string[] = [];
    mockAlpaca(urls);

    const result = await screenDirect(['AAPL'], { keyId: 'PKTEST', secret: 's' }, scope, null, {
      snapshots: {
        AAPL: {
          price: null,
          previous: null,
          dv: 0,
          trades: 0,
          barDate: null,
          priceTime: null,
          present: false,
        },
      },
    });

    expect(result.missingPrices).toContain('AAPL');
    expect(urls.some((url) => url.includes('/v2/stocks/snapshots'))).toBe(false);
  });
});

describe('fetchStockSnapshots batch isolation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps successful batches when one batch fails', async () => {
    const symbols = Array.from({ length: 201 }, (_, index) => `S${index}`);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const batch = new URL(String(input)).searchParams.get('symbols')!.split(',');
        if (batch.length < 200) {
          return new Response(JSON.stringify({ message: 'invalid symbols' }), {
            status: 422,
            headers: { 'content-type': 'application/json' },
          });
        }
        return json(
          Object.fromEntries(
            batch.map((symbol) => [symbol, { latestTrade: { p: 10 }, prevDailyBar: { c: 9 } }]),
          ),
        );
      }),
    );

    const result = await fetchStockSnapshots(symbols, { keyId: 'PKTEST', secret: 's' }, null, {
      today: '2026-11-06',
      minutes: 1000,
    });

    expect(result.bySymbol.S0).toMatchObject({ price: 10, previous: 9, present: true });
    expect(result.bySymbol.S200).toMatchObject({ price: null, previous: null, present: false });
    expect(result.failed).toEqual(['S200']);
  });

  it('lets the caller refetch only the failed batch', async () => {
    const urls: string[] = [];
    const symbols = Array.from({ length: 201 }, (_, index) => `S${index}`);
    let failSecondBatch = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        const batch = new URL(url).searchParams.get('symbols')!.split(',');
        if (batch.length < 200 && failSecondBatch) {
          return new Response(JSON.stringify({ message: 'server error' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          });
        }
        return json(
          Object.fromEntries(
            batch.map((symbol) => [symbol, { latestTrade: { p: 10 }, prevDailyBar: { c: 9 } }]),
          ),
        );
      }),
    );

    const first = await fetchStockSnapshots(symbols, { keyId: 'PKTEST', secret: 's' }, null, {
      today: '2026-11-06',
      minutes: 1000,
    });
    const retry = symbols.filter((symbol) => first.failed.includes(symbol));
    failSecondBatch = false;
    urls.length = 0;

    await fetchStockSnapshots(retry, { keyId: 'PKTEST', secret: 's' }, null, {
      today: '2026-11-06',
      minutes: 1000,
    });

    expect(retry).toHaveLength(1);
    expect(new URL(urls[0]).searchParams.get('symbols')).toBe('S200');
  });

  it('still propagates authentication failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'unauthorized' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );

    await expect(
      fetchStockSnapshots(['AAPL'], { keyId: 'PKTEST', secret: 's' }, null, {
        today: '2026-11-06',
        minutes: 1000,
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('screenDirect price batching', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests missing stock snapshots in batches of at most 200', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        if (url.includes('/v2/stocks/snapshots')) return json({});
        return json({ snapshots: {} });
      }),
    );

    const symbols = Array.from({ length: 250 }, (_, index) => `S${index}`);
    await screenDirect(symbols, { keyId: 'PKTEST', secret: 's' }, scope, null);

    const priceUrls = urls.filter((url) => url.includes('/v2/stocks/snapshots'));
    expect(priceUrls).toHaveLength(2);
    expect(
      priceUrls.map((url) => new URL(url).searchParams.get('symbols')!.split(',').length),
    ).toEqual([200, 50]);
  });

  it('skips contracts whose option snapshot is null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/v2/stocks/snapshots')) {
          return json({ AAPL: { latestTrade: { p: 200 }, prevDailyBar: { c: 198 } } });
        }
        return json({ snapshots: { AAPL261120P00100000: null } });
      }),
    );

    const result = await screenDirect(['AAPL'], { keyId: 'PKTEST', secret: 's' }, scope, null);

    expect(result.rows).toHaveLength(0);
    expect(result.errors.AAPL).toBeUndefined();
  });
});

describe('request timeouts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stalledFetch = () =>
    vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );

  it('fails a stalled request with a timeout error', async () => {
    vi.stubGlobal('fetch', stalledFetch());

    await expect(fetchJson('https://data.alpaca.markets/stall', {}, 10)).rejects.toThrow(
      /timed out/i,
    );
  }, 500);

  it('reports a key-validation timeout instead of a connection error', async () => {
    vi.stubGlobal('fetch', stalledFetch());

    await expect(testKey('PKTEST', 'secret', 10)).resolves.toMatch(/respond in time/i);
  }, 500);
});

describe('retry body handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cancels a discarded retry body', async () => {
    const cancel = vi.fn(async () => {});
    const responses = [
      {
        status: 429,
        ok: false,
        headers: new Headers({ 'retry-after': '0.001' }),
        body: { cancel },
        json: async () => ({}),
      },
      json({ ok: true }),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => responses.shift() as unknown as Response),
    );

    await fetchJson('https://example.test/data');

    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe('fetchCashDividends', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const page = (rows: unknown[], next: string | null = null) => ({
    corporate_actions: { cash_dividends: rows },
    next_page_token: next,
  });

  it('batches symbols, requests the window, and negative-caches misses', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        const symbols = new URL(url).searchParams.get('symbols')!.split(',');
        return json(
          page(symbols[0] ? [{ symbol: symbols[0], ex_date: '2026-11-12', rate: 0.27 }] : []),
        );
      }),
    );

    const symbols = Array.from({ length: DIVIDEND_BATCH_SIZE + 1 }, (_, index) => `S${index}`);
    const result = await fetchCashDividends(
      symbols,
      { keyId: 'PKTEST', secret: 's' },
      null,
      '2026-11-09',
    );

    expect(urls).toHaveLength(2);
    const first = new URL(urls[0]).searchParams;
    expect(first.get('symbols')!.split(',')).toHaveLength(DIVIDEND_BATCH_SIZE);
    expect(first.get('types')).toBe('cash_dividend');
    expect(first.get('start')).toBe('2025-10-09');
    expect(first.get('end')).toBe('2027-02-09');
    expect(first.get('limit')).toBe('1000');
    expect(urls[0].length).toBeLessThan(2000);
    expect(result.bySymbol.S0).toEqual([{ ex: '2026-11-12', rate: 0.27, special: false }]);
    expect(result.bySymbol.S1).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it('follows next_page_token to the end of a batch', async () => {
    const urls: string[] = [];
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(String(input));
        call++;
        return call === 1
          ? json(page([{ symbol: 'AAPL', ex_date: '2026-11-12', rate: 0.27 }], 'page-2'))
          : json(page([{ symbol: 'AAPL', ex_date: '2026-08-10', rate: 0.25 }]));
      }),
    );

    const result = await fetchCashDividends(
      ['AAPL'],
      { keyId: 'PKTEST', secret: 's' },
      null,
      '2026-11-09',
    );

    expect(urls).toHaveLength(2);
    expect(new URL(urls[1]).searchParams.get('page_token')).toBe('page-2');
    expect(result.bySymbol.AAPL).toHaveLength(2);
  });

  it('leaves a failed batch unchecked for the next refresh', async () => {
    const symbols = Array.from({ length: DIVIDEND_BATCH_SIZE + 1 }, (_, index) => `S${index}`);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const batch = new URL(String(input)).searchParams.get('symbols')!.split(',');
        if (batch.includes(`S${DIVIDEND_BATCH_SIZE}`)) {
          return new Response(JSON.stringify({ message: 'server error' }), {
            status: 422,
            headers: { 'content-type': 'application/json' },
          });
        }
        return json(page(batch.map((symbol) => ({ symbol, ex_date: '2026-11-12', rate: 0.27 }))));
      }),
    );

    const result = await fetchCashDividends(
      symbols,
      { keyId: 'PKTEST', secret: 's' },
      null,
      '2026-11-09',
    );

    expect(result.bySymbol.S0).toHaveLength(1);
    expect(result.bySymbol[`S${DIVIDEND_BATCH_SIZE}`]).toBeUndefined();
    expect(result.failed).toEqual([`S${DIVIDEND_BATCH_SIZE}`]);
  });

  it('marks a batch failed when pagination does not finish', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls++;
        return json(page([], `page-${calls}`));
      }),
    );

    const result = await fetchCashDividends(
      ['AAPL'],
      { keyId: 'PKTEST', secret: 's' },
      null,
      '2026-11-09',
    );

    expect(calls).toBe(DIVIDEND_PAGE_CAP);
    expect(result.bySymbol.AAPL).toBeUndefined();
    expect(result.failed).toEqual(['AAPL']);
  });

  it('propagates authentication failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'unauthorized' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );

    await expect(
      fetchCashDividends(['AAPL'], { keyId: 'PKTEST', secret: 's' }, null, '2026-11-09'),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('fetchAssetMeta', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests every exchange instead of filtering by exchange', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        return json([{ symbol: 'AAPL', name: 'Apple', exchange: 'NASDAQ' }]);
      }),
    );

    const meta = await fetchAssetMeta({ keyId: 'PKTEST', secret: 's' });
    expect(meta.bySymbol.AAPL.exchange).toBe('NASDAQ');
    expect(urls[0]).toContain('attributes=has_options');
    expect(urls[0]).not.toContain('exchange=');
  });
});

describe('option quote hygiene', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const snapshot = (quote: Record<string, unknown>, bar: Record<string, unknown> = {}) => ({
    latestQuote: quote,
    greeks: { delta: -0.25 },
    impliedVolatility: 0.3,
    dailyBar: bar,
  });

  async function screen(snapshots: Record<string, unknown>) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/v2/stocks/snapshots')) return json({});
        return json({ snapshots });
      }),
    );
    return screenSymbol('AAPL', { keyId: 'PKTEST', secret: 's' }, scope, null, null);
  }

  const stock = (priceTime: string) => ({
    price: 200,
    previous: 198,
    dv: 1_000_000,
    trades: 10,
    barDate: '2026-11-16',
    priceTime,
    present: true,
  });

  async function screenWith(
    stockInfo: ReturnType<typeof stock>,
    snapshots: Record<string, unknown>,
  ) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ snapshots })),
    );
    return screenSymbol(
      'AAPL',
      { keyId: 'PKTEST', secret: 's' },
      scope,
      null,
      stockInfo as Parameters<typeof screenSymbol>[4],
    );
  }

  it('keeps the stock observation time on every row', async () => {
    const result = await screenWith(stock('2026-11-16T15:00:00Z'), {
      AAPL261120P00100000: snapshot({ bp: 1, ap: 2 }),
    });
    expect(result.rows[0].priceTime).toBe('2026-11-16T15:00:00Z');
  });

  it('marks rows whose option quote is from an earlier session', async () => {
    const fresh = await screenWith(stock('2026-11-16T15:00:00Z'), {
      AAPL261120P00100000: snapshot({ bp: 1, ap: 2, t: '2026-11-16T14:00:00Z' }),
    });
    expect(fresh.rows[0].quoteStale).toBe(false);

    const stale = await screenWith(stock('2026-11-16T15:00:00Z'), {
      AAPL261120P00100000: snapshot({ bp: 1, ap: 2, t: '2026-11-13T20:59:59Z' }),
    });
    expect(stale.rows[0].quoteStale).toBe(true);
  });

  it('keeps a crossed quote but marks it invalid', async () => {
    const result = await screen({
      AAPL261120P00100000: snapshot({ bp: 2, ap: 1 }),
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].bid).toBe(2);
    expect(result.rows[0].quoteInvalid).toBe(true);
  });

  it('keeps a one-sided quote usable and marks a non-numeric side invalid', async () => {
    const oneSided = await screen({ AAPL261120P00100000: snapshot({ bp: 2 }) });
    expect(oneSided.rows[0].quoteInvalid).toBe(false);
    expect(oneSided.rows[0].ask).toBe(0);

    const broken = await screen({ AAPL261120P00100000: snapshot({ bp: 2, ap: 'wide' }) });
    expect(broken.rows[0].quoteInvalid).toBe(true);
  });

  it('preserves an unknown volume as null', async () => {
    const missing = await screen({ AAPL261120P00100000: snapshot({ bp: 1, ap: 2 }) });
    expect(missing.rows[0].volume).toBeNull();

    const zero = await screen({ AAPL261120P00100000: snapshot({ bp: 1, ap: 2 }, { v: 0 }) });
    expect(zero.rows[0].volume).toBe(0);
  });

  it('keeps the provider quote timestamp', async () => {
    const result = await screen({
      AAPL261120P00100000: snapshot({ bp: 1, ap: 2, t: '2026-11-14T20:59:59Z' }),
    });

    expect(result.rows[0].quoteTime).toBe('2026-11-14T20:59:59Z');
  });
});
