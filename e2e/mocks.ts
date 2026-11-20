import type { Page, Route } from '@playwright/test';

export const SYMBOL = 'AAPL';
export const OTHER_SYMBOL = 'IBM';
export const KEY = { keyId: 'PKTEST', secret: 'test' };
export const SITE_URL = 'https://wheelhq.xyz/';

export function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function occSymbol(root: string, expiry: string, side: 'P' | 'C', strike: number): string {
  const [year, month, day] = expiry.split('-');
  return `${root}${year.slice(2)}${month}${day}${side}${String(Math.round(strike * 1000)).padStart(8, '0')}`;
}

function optionSnapshot(
  side: 'P' | 'C',
  strike: number,
  {
    crossed = false,
    noVolume = false,
    stale = false,
  }: { crossed?: boolean; noVolume?: boolean; stale?: boolean } = {},
) {
  return {
    latestQuote: crossed
      ? { bp: 2, ap: 1 }
      : { bp: 2, ap: 2.2, ...(stale ? { t: `${dateOffset(-1)}T20:00:00Z` } : {}) },
    greeks: { delta: side === 'P' ? -0.25 : 0.25 },
    impliedVolatility: 0.3,
    ...(noVolume ? {} : { dailyBar: { v: 120 } }),
    strike,
  };
}

function stockSnapshot(dollarVolume: number) {
  const now = new Date();
  const previous = new Date(now.getTime() - 86_400_000);
  return {
    latestTrade: { p: 200 },
    dailyBar: { t: now.toISOString(), c: 200, v: dollarVolume, n: 1000 },
    prevDailyBar: { t: previous.toISOString(), c: 198, v: dollarVolume, n: 1000 },
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });
}

/** Mock every Alpaca request the app makes, including CORS preflights. */
export async function installAlpacaMocks(
  page: Page,
  {
    chains429 = false,
    snapshots401 = false,
    bars401 = false,
    crossed = false,
    noVolume = false,
    staleQuote = false,
    slowPutMs = 0,
    contracts = 0,
    expiry = dateOffset(5),
  }: {
    chains429?: boolean;
    snapshots401?: boolean;
    bars401?: boolean;
    crossed?: boolean;
    noVolume?: boolean;
    staleQuote?: boolean;
    slowPutMs?: number;
    contracts?: number;
    /** Expiry for the mocked chain; pin it when the test fixes the clock. */
    expiry?: string;
  } = {},
) {
  const put = occSymbol(SYMBOL, expiry, 'P', 190);
  const call = occSymbol(SYMBOL, expiry, 'C', 210);
  const otherPut = occSymbol(OTHER_SYMBOL, expiry, 'P', 190);
  const crossedPut = occSymbol(SYMBOL, expiry, 'P', 185);
  const quoteOptions = { crossed, noVolume, stale: staleQuote };

  function manyPuts(count: number) {
    const snapshots: Record<string, unknown> = {};
    for (let index = 1; index <= count; index++) {
      const strike = 100 + index;
      snapshots[occSymbol(SYMBOL, expiry, 'P', strike)] = optionSnapshot('P', strike, quoteOptions);
    }
    return snapshots;
  }

  const handle = async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'GET,OPTIONS',
        },
      });
      return;
    }

    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/v2/assets')) {
      await fulfillJson(route, [
        { symbol: SYMBOL, name: 'Apple Inc.', exchange: 'NASDAQ' },
        { symbol: OTHER_SYMBOL, name: 'IBM', exchange: 'NYSE' },
      ]);
      return;
    }

    if (url.pathname.endsWith('/v2/stocks/bars')) {
      if (bars401) {
        await fulfillJson(route, { message: 'unauthorized' }, 401);
        return;
      }
      await fulfillJson(route, { bars: [], symbol: 'SPY', next_page_token: null });
      return;
    }

    if (url.pathname.endsWith('/v1beta1/screener/stocks/most-actives')) {
      await fulfillJson(route, { most_actives: [{ symbol: SYMBOL }] });
      return;
    }

    if (url.pathname.endsWith('/v1/corporate-actions')) {
      const symbols = (url.searchParams.get('symbols') ?? '').split(',');
      await fulfillJson(route, {
        corporate_actions: {
          cash_dividends: symbols.includes(SYMBOL)
            ? [{ symbol: SYMBOL, ex_date: dateOffset(2), rate: 0.27, special: false }]
            : [],
        },
        next_page_token: null,
      });
      return;
    }

    if (url.pathname.endsWith('/v2/stocks/snapshots')) {
      if (snapshots401) {
        await fulfillJson(route, { message: 'unauthorized' }, 401);
        return;
      }
      const symbols = (url.searchParams.get('symbols') ?? '').split(',').filter(Boolean);
      const body = Object.fromEntries(
        symbols.map((symbol) => [
          symbol,
          stockSnapshot(symbol === SYMBOL ? 1_000_000_000 : 1_000_000),
        ]),
      );
      await fulfillJson(route, body);
      return;
    }

    if (url.pathname.includes('/v1beta1/options/snapshots/')) {
      if (chains429) {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          headers: {
            'access-control-allow-origin': '*',
            'access-control-expose-headers': 'retry-after',
            'retry-after': '0.001',
          },
          body: JSON.stringify({ message: 'too many requests' }),
        });
        return;
      }
      const symbol = decodeURIComponent(url.pathname.split('/').pop() ?? '');
      const type = url.searchParams.get('type');
      const send = async (snapshots: Record<string, unknown>) => {
        if (type !== 'call' && slowPutMs) {
          await new Promise((resolve) => setTimeout(resolve, slowPutMs));
        }
        try {
          await fulfillJson(route, { snapshots });
        } catch {
          /* a newer refresh aborted this request */
        }
      };
      if (symbol === OTHER_SYMBOL) {
        await send(
          type === 'call'
            ? { [occSymbol(OTHER_SYMBOL, expiry, 'C', 210)]: optionSnapshot('C', 210) }
            : { [otherPut]: optionSnapshot('P', 190) },
        );
        return;
      }
      if (symbol !== SYMBOL) {
        await send({});
        return;
      }
      await send(
        type === 'call'
          ? { [call]: optionSnapshot('C', 210, quoteOptions) }
          : contracts > 0
            ? manyPuts(contracts)
            : {
                [put]: optionSnapshot('P', 190, quoteOptions),
                ...(crossed ? { [crossedPut]: optionSnapshot('P', 185, { crossed: true }) } : {}),
              },
      );
      return;
    }

    await fulfillJson(route, { message: `Unmocked request: ${url.pathname}` }, 404);
  };

  await page.route('https://data.alpaca.markets/**', handle);
  await page.route('https://paper-api.alpaca.markets/**', handle);
  await page.route('https://api.alpaca.markets/**', handle);
}

export async function installEarningsMock(
  page: Page,
  eventDate: string,
  { effectiveDate = dateOffset(0) }: { effectiveDate?: string } = {},
) {
  await page.route('**/data/earnings.json', (route) =>
    fulfillJson(route, {
      schemaVersion: 1,
      effectiveDate,
      generatedAt: new Date().toISOString(),
      horizonEnd: dateOffset(30),
      currency: 'USD',
      earnings: {
        [SYMBOL]: {
          date: eventDate,
          session: 'after_close',
          status: 'expected',
          name: 'Apple Inc.',
          marketCap: 3_000_000_000_000,
        },
      },
    }),
  );
}

export async function seedState(
  page: Page,
  {
    key = false,
    rememberKey = false,
    watchlist = [],
    lists = [],
    theme,
  }: {
    key?: boolean;
    rememberKey?: boolean;
    watchlist?: string[];
    lists?: { id: string; name: string; symbols: string[] }[];
    theme?: string;
  } = {},
) {
  await page.addInitScript(
    ({ keyPair, remembered, symbols, storedLists, storedTheme }) => {
      if (keyPair && !sessionStorage.getItem('wheelhq.seedKey')) {
        const storage = remembered ? localStorage : sessionStorage;
        storage.setItem('wheelhq.alpacaKey', JSON.stringify(keyPair));
        sessionStorage.setItem('wheelhq.seedKey', '1');
      }
      if (symbols.length) localStorage.setItem('wheelhq.watchlist', JSON.stringify(symbols));
      if (storedLists.length) localStorage.setItem('wheelhq.lists', JSON.stringify(storedLists));
      if (storedTheme) localStorage.setItem('wheelhq.theme', storedTheme);
    },
    {
      keyPair: key ? KEY : null,
      remembered: rememberKey,
      symbols: watchlist,
      storedLists: lists,
      storedTheme: theme ?? null,
    },
  );
}
