import {
  DATA_BASE,
  DIVIDEND_BATCH_SIZE,
  DIVIDEND_PAGE_CAP,
  LIVE_BROKER_BASE,
  PAGE_CAP,
  PAPER_BROKER_BASE,
  REQUEST_TIMEOUT_MS,
  SNAPSHOT_BATCH_SIZE,
} from './config';
import { normalizeQuote, parseContract, retryDelayMs } from './domain';
import { nyMinutes, todayYmd, ymd, ymdPlus } from './date';
import { dividendWindow, parseDividendRows } from './dividends';
import { snapshotInfo } from './ranking';
import type { AssetInfo, ChainScope, KeyPair, Row, ScreenResult } from './types';
import type { Dividend } from './dividends';
import type { RawSnapshot, SnapshotInfo } from './ranking';

const abortError = () => new DOMException('Aborted', 'AbortError');

const isFatal = (error: unknown, signal: AbortSignal | null): boolean => {
  const status = (error as { status?: number }).status;
  return (
    (error as Error)?.name === 'AbortError' ||
    Boolean(signal?.aborted) ||
    status === 401 ||
    status === 403 ||
    status === 429
  );
};

export function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export const keyHeaders = (key: KeyPair | null): Record<string, string> | undefined =>
  key?.keyId && key?.secret
    ? { 'APCA-API-KEY-ID': key.keyId, 'APCA-API-SECRET-KEY': key.secret }
    : undefined;

export async function fetchJson<T>(
  url: string,
  opts: RequestInit & { signal?: AbortSignal | null } = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    if (opts.signal?.aborted) throw abortError();
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = opts.signal ? AbortSignal.any([opts.signal, deadline]) : deadline;
    const timedOut = () => deadline.aborted && deadline.reason?.name === 'TimeoutError';
    const timeoutError = () => {
      const error = new Error(
        `Request timed out after ${Math.round(timeoutMs / 1000)}s`,
      ) as Error & { status?: number };
      error.name = 'TimeoutError';
      return error;
    };
    let response: Response;
    try {
      response = await fetch(url, { ...opts, signal });
    } catch (error) {
      if (timedOut()) throw timeoutError();
      throw error;
    }
    const retry = response.status === 429 ? attempt < 3 : response.status >= 500 && attempt < 1;
    if (retry) {
      try {
        await response.body?.cancel();
      } catch {
        /* the body is being discarded anyway */
      }
      const retryAfter = response.headers.get('retry-after');
      await sleep(retryDelayMs(attempt, retryAfter), opts.signal);
      continue;
    }
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        if (body?.message) detail += ` — ${body.message}`;
      } catch {
        if (timedOut()) throw timeoutError();
        /* ignore malformed error bodies */
      }
      const error = new Error(detail) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    try {
      return (await response.json()) as T;
    } catch (error) {
      if (timedOut()) throw timeoutError();
      throw error;
    }
  }
}

const isLiveKey = (keyId?: string | null): boolean =>
  String(keyId || '')
    .trim()
    .toUpperCase()
    .startsWith('AK');

const brokerOrderFor = (keyId?: string | null): string[] =>
  isLiveKey(keyId) ? [LIVE_BROKER_BASE, PAPER_BROKER_BASE] : [PAPER_BROKER_BASE, LIVE_BROKER_BASE];

type ChainPage = { rows: Row[]; truncated: boolean; pages: number };

interface RawOptionSnapshot {
  latestQuote?: { bp?: number; ap?: number; t?: string };
  greeks?: { delta?: number };
  impliedVolatility?: number;
  dailyBar?: { v?: number };
}

interface OptionsPage {
  snapshots?: Record<string, RawOptionSnapshot | null>;
  next_page_token?: string;
}

interface RawAsset {
  symbol?: string;
  name?: string;
  exchange?: string;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

export interface StockSnapshots {
  bySymbol: Record<string, SnapshotInfo>;
  failed: string[];
}

export async function fetchStockSnapshots(
  symbols: string[],
  key: KeyPair,
  signal: AbortSignal | null = null,
  now: { today: string; minutes: number } = { today: todayYmd(), minutes: nyMinutes() },
): Promise<StockSnapshots> {
  const bySymbol: Record<string, SnapshotInfo> = {};
  const failed: string[] = [];
  for (let index = 0; index < symbols.length; index += SNAPSHOT_BATCH_SIZE) {
    const batch = symbols.slice(index, index + SNAPSHOT_BATCH_SIZE);
    try {
      const data = await fetchJson<Record<string, RawSnapshot>>(
        `${DATA_BASE}/v2/stocks/snapshots?symbols=${batch.join(',')}&feed=iex`,
        { headers: keyHeaders(key), signal },
      );
      for (const symbol of batch) {
        bySymbol[symbol] = snapshotInfo(data[symbol], now.today, now.minutes);
      }
    } catch (error) {
      if (isFatal(error, signal)) throw error;
      // One bad symbol (or a transient batch failure) must not hide the other
      // batches' prices. Mark only this batch as missing.
      for (const symbol of batch) {
        bySymbol[symbol] = snapshotInfo(undefined, now.today, now.minutes);
      }
      failed.push(...batch);
    }
  }
  return { bySymbol, failed };
}

interface RawDividendRow {
  symbol?: string;
  ex_date?: string;
  rate?: number | string;
  special?: boolean;
}

interface DividendPage {
  corporate_actions?: { cash_dividends?: RawDividendRow[] };
  next_page_token?: string;
}

export interface DividendFetchResult {
  bySymbol: Record<string, Dividend[]>;
  failed: string[];
}

/**
 * Fetch cash dividends for the symbols, batch by batch. A successful batch
 * writes an array for every requested symbol (empty means checked, no rows);
 * a failed batch is reported separately and left unchecked for a later retry.
 */
export async function fetchCashDividends(
  symbols: string[],
  key: KeyPair,
  signal: AbortSignal | null = null,
  today = todayYmd(),
): Promise<DividendFetchResult> {
  const bySymbol: Record<string, Dividend[]> = {};
  const failed: string[] = [];
  const window = dividendWindow(today);

  for (let index = 0; index < symbols.length; index += DIVIDEND_BATCH_SIZE) {
    const batch = symbols.slice(index, index + DIVIDEND_BATCH_SIZE);
    try {
      const rows: RawDividendRow[] = [];
      let pageToken: string | null = null;
      let complete = false;
      for (let page = 0; page < DIVIDEND_PAGE_CAP; page++) {
        const params = new URLSearchParams({
          symbols: batch.join(','),
          types: 'cash_dividend',
          start: window.start,
          end: window.end,
          limit: '1000',
        });
        if (pageToken) params.set('page_token', pageToken);
        const data = await fetchJson<DividendPage>(`${DATA_BASE}/v1/corporate-actions?${params}`, {
          headers: keyHeaders(key),
          signal,
        });
        rows.push(...(data.corporate_actions?.cash_dividends ?? []));
        if (!data.next_page_token) {
          complete = true;
          break;
        }
        pageToken = data.next_page_token;
      }
      if (!complete) throw new Error('Dividend pagination limit reached');

      const parsed = parseDividendRows(rows);
      for (const symbol of batch) bySymbol[symbol] = parsed[symbol] ?? [];
    } catch (error) {
      if (isFatal(error, signal)) throw error;
      failed.push(...batch);
    }
  }

  return { bySymbol, failed };
}

async function fetchChainDirect(
  symbol: string,
  key: KeyPair,
  feed: 'opra' | 'indicative',
  scope: ChainScope,
  signal: AbortSignal | null,
  spot: number | null = null,
): Promise<ChainPage> {
  const rows: Row[] = [];
  const todayUtc = Date.parse(`${todayYmd()}T00:00:00Z`);
  let pageToken: string | null = null;
  let truncated = false;
  let pages = 0;

  for (let page = 0; page < PAGE_CAP; page++) {
    const params = new URLSearchParams({
      feed,
      type: scope.type,
      limit: '1000',
      expiration_date_gte: ymdPlus(scope.minDte),
      expiration_date_lte: ymdPlus(scope.maxDte),
    });
    if (spot != null && Number.isFinite(spot) && spot > 0) {
      if (scope.type === 'put') {
        params.set('strike_price_lte', String(round2(spot)));
      } else {
        params.set('strike_price_gte', String(round2(spot)));
      }
    }
    if (pageToken) params.set('page_token', pageToken);
    pages++;
    const data = await fetchJson<OptionsPage>(
      `${DATA_BASE}/v1beta1/options/snapshots/${symbol}?${params}`,
      { headers: keyHeaders(key), signal },
    );
    for (const [contract, snapshot] of Object.entries(data.snapshots || {})) {
      const parsed = parseContract(contract, todayUtc);
      if (!parsed) continue;
      const quote = normalizeQuote(snapshot?.latestQuote?.bp, snapshot?.latestQuote?.ap);
      if (quote.bid <= 0) continue;
      const quoteTime = snapshot?.latestQuote?.t;
      const rawVolume = snapshot?.dailyBar?.v;
      rows.push({
        contract,
        symbol: parsed.root,
        underlying: symbol,
        side: parsed.side,
        expiry: parsed.expiry,
        dte: parsed.dte,
        strike: parsed.strike,
        bid: quote.bid,
        ask: quote.ask,
        mid: quote.mid,
        delta: snapshot?.greeks?.delta ?? null,
        iv: snapshot?.impliedVolatility ?? null,
        volume: typeof rawVolume === 'number' && Number.isFinite(rawVolume) ? rawVolume : null,
        price: null,
        change: null,
        changePts: null,
        quoteTime: typeof quoteTime === 'string' ? quoteTime : null,
        quoteInvalid: quote.invalid,
      });
    }
    if (!data.next_page_token) break;
    pageToken = data.next_page_token;
    if (page === PAGE_CAP - 1) truncated = true;
  }
  return { rows, truncated, pages };
}

export interface FeedState {
  value: 'opra' | 'indicative';
}

export function feedFor(key: KeyPair): FeedState {
  return { value: isLiveKey(key.keyId) ? 'opra' : 'indicative' };
}

export interface SymbolScreenResult {
  rows: Row[];
  error?: string;
  pages: number;
  truncated: boolean;
  delayed: boolean;
  missingPrice: boolean;
  rateLimited: boolean;
}

export async function screenSymbol(
  symbol: string,
  key: KeyPair,
  scope: ChainScope,
  signal: AbortSignal | null,
  snapshot: SnapshotInfo | null,
  feed: FeedState = feedFor(key),
): Promise<SymbolScreenResult> {
  const price = snapshot?.price ?? null;
  const previous = snapshot?.previous ?? null;
  const missingPrice = !snapshot?.present;
  const used = feed.value;
  let delayed = used === 'indicative';
  let page: ChainPage;

  try {
    page = await fetchChainDirect(symbol, key, used, scope, signal, price);
  } catch (error) {
    const status = (error as { status?: number }).status;
    const rateLimited = status === 429;
    if (used === 'opra' && (status === 401 || status === 403)) {
      feed.value = 'indicative';
      delayed = true;
      try {
        page = await fetchChainDirect(symbol, key, 'indicative', scope, signal, price);
      } catch (secondError) {
        return {
          rows: [],
          error: (secondError as Error).message,
          pages: 0,
          truncated: false,
          delayed,
          missingPrice,
          rateLimited: (secondError as { status?: number }).status === 429,
        };
      }
    } else {
      return {
        rows: [],
        error: (error as Error).message,
        pages: 0,
        truncated: false,
        delayed,
        missingPrice,
        rateLimited,
      };
    }
  }

  const priceDate = snapshot?.priceTime ? ymd(new Date(snapshot.priceTime)) : null;
  const rows = page.rows.map((row) => {
    const quoteDate = row.quoteTime ? ymd(new Date(row.quoteTime)) : null;
    return {
      ...row,
      price,
      priceTime: snapshot?.priceTime ?? null,
      quoteStale: quoteDate != null && priceDate != null && quoteDate < priceDate,
      change:
        price != null && previous != null && previous > 0
          ? ((price - previous) / previous) * 100
          : null,
      changePts: price != null && previous != null && previous > 0 ? price - previous : null,
    };
  });

  return {
    rows,
    pages: page.pages,
    truncated: page.truncated,
    delayed,
    missingPrice,
    rateLimited: false,
  };
}

export async function screenDirect(
  symbols: string[],
  key: KeyPair,
  scope: ChainScope,
  signal: AbortSignal | null = null,
  options: {
    snapshots?: Record<string, SnapshotInfo>;
  } = {},
): Promise<ScreenResult> {
  const supplied = options.snapshots ?? {};
  const missing = symbols.filter((symbol) => !(symbol in supplied));
  let fetched: StockSnapshots | null = null;
  let priceError = '';

  try {
    if (missing.length) fetched = await fetchStockSnapshots(missing, key, signal);
  } catch (error) {
    if (signal?.aborted) throw abortError();
    priceError = (error as Error).message;
  }
  if (signal?.aborted) throw abortError();

  const feed = feedFor(key);
  const results = await mapPool(symbols, 6, (symbol) =>
    screenSymbol(
      symbol,
      key,
      scope,
      signal,
      supplied[symbol] ?? fetched?.bySymbol[symbol] ?? null,
      feed,
    ),
  );
  if (signal?.aborted) throw abortError();

  const errors: Record<string, string> = {};
  const rows: Row[] = [];
  const truncatedChains: string[] = [];
  const missingPrices: string[] = [];
  let chainPages = 0;
  let delayed = false;

  symbols.forEach((symbol, index) => {
    const result = results[index];
    if (result.error) {
      errors[symbol] = result.error;
      return;
    }
    chainPages += result.pages;
    if (result.truncated) truncatedChains.push(symbol);
    if (result.missingPrice) missingPrices.push(symbol);
    delayed = delayed || result.delayed;
    rows.push(...result.rows);
  });

  return {
    generatedAt: new Date().toISOString(),
    delayed,
    errors,
    priceError,
    missingPrices,
    truncatedChains,
    chainPages,
    rows,
  };
}

export async function testKey(
  keyId: string,
  secret: string,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<string> {
  const deadline = AbortSignal.timeout(timeoutMs);
  try {
    const params = new URLSearchParams({
      symbols: 'SPY',
      timeframe: '1Day',
      limit: '1',
      feed: 'iex',
      start: new Date(Date.now() - 7 * 864e5).toISOString(),
      end: new Date().toISOString(),
    });
    const response = await fetch(`${DATA_BASE}/v2/stocks/bars?${params}`, {
      headers: { 'APCA-API-KEY-ID': keyId, 'APCA-API-SECRET-KEY': secret },
      signal: deadline,
    });
    if (response.status === 401) return 'Alpaca didn’t accept that key ID and secret.';
    if (response.status === 403) {
      let detail = '';
      try {
        const body = await response.json();
        detail = body?.message || '';
      } catch {
        /* ignore */
      }
      return detail
        ? `Alpaca rejected this request: ${detail}`
        : 'Alpaca rejected this key for market data.';
    }
    if (response.status === 429) return 'Alpaca rate limit reached — wait a minute and try again.';
    if (!response.ok) return `Alpaca returned ${response.status}. Try again in a minute.`;
    return '';
  } catch {
    return deadline.aborted && deadline.reason?.name === 'TimeoutError'
      ? 'Alpaca didn’t respond in time — try again.'
      : 'Couldn’t reach Alpaca. Check your connection.';
  }
}

export interface AssetMeta {
  bySymbol: Record<string, AssetInfo>;
  byRoot: Record<string, AssetInfo>;
}

export async function fetchAssetMeta(
  key: KeyPair,
  signal: AbortSignal | null = null,
): Promise<AssetMeta> {
  let lastError: unknown;
  for (const base of brokerOrderFor(key.keyId)) {
    try {
      const params = new URLSearchParams({
        status: 'active',
        asset_class: 'us_equity',
        attributes: 'has_options',
      });
      const data = await fetchJson<RawAsset[]>(`${base}/v2/assets?${params}`, {
        headers: keyHeaders(key),
        signal,
      });
      if (!Array.isArray(data) || !data.length) throw new Error('Empty asset list');
      const bySymbol: Record<string, AssetInfo> = {};
      const byRoot: Record<string, AssetInfo> = {};
      for (const asset of data) {
        if (!asset || typeof asset.symbol !== 'string') continue;
        const info: AssetInfo = {
          symbol: asset.symbol,
          name: asset.name || '',
          exchange: asset.exchange || '',
        };
        bySymbol[asset.symbol] = info;
        const root = asset.symbol.replace(/[^A-Z0-9]/g, '');
        if (root) byRoot[root] = info;
      }
      return { bySymbol, byRoot };
    } catch (error) {
      lastError = error;
      const status = (error as { status?: number }).status;
      if (status !== 401 && status !== 403) break;
    }
  }
  throw lastError;
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      output[current] = await fn(items[current]);
    }
  });
  await Promise.all(workers);
  return output;
}
