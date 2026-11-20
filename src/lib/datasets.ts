import { datasetBaseUrl } from './environment';
import type { Dataset, EarningsData, EarningsEvent, IndexesData } from './types';

const REMOTE_TIMEOUT_MS = 8_000;

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface DatasetLoadOptions {
  /** App hostname; defaults to the browser host. */
  hostname?: string;
  /** Test seam; defaults to the global fetch. */
  fetchImpl?: FetchLike;
  /** Test seam; defaults to the Vite base URL plus `data/`. */
  bundledBase?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const cache = new Map<string, Promise<Dataset<unknown>>>();

export function clearDatasetCache(): void {
  cache.clear();
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

export function parseIndexes(raw: unknown): IndexesData | null {
  if (!isRecord(raw)) return null;
  if (raw.schemaVersion !== 1) return null;
  if (typeof raw.effectiveDate !== 'string' || typeof raw.generatedAt !== 'string') return null;
  if (!isRecord(raw.indexes)) return null;
  const { sp500, ndx } = raw.indexes;
  if (!isStringArray(sp500) || !isStringArray(ndx)) return null;
  if (!isRecord(raw.sectors)) return null;
  if (!Object.values(raw.sectors).every((sector) => typeof sector === 'string')) return null;
  return {
    schemaVersion: 1,
    effectiveDate: raw.effectiveDate,
    generatedAt: raw.generatedAt,
    indexes: { sp500, ndx },
    sectors: raw.sectors as Record<string, string>,
  };
}

function parseEarningsEvent(raw: unknown): EarningsEvent | null {
  if (!isRecord(raw)) return null;
  if (!isDate(raw.date)) return null;
  if (raw.session !== 'before_open' && raw.session !== 'after_close' && raw.session !== 'unknown')
    return null;
  if (raw.status !== 'expected' && raw.status !== 'estimated') return null;
  const name = raw.name == null ? null : typeof raw.name === 'string' ? raw.name : null;
  const marketCap =
    raw.marketCap == null
      ? null
      : typeof raw.marketCap === 'number' && Number.isFinite(raw.marketCap)
        ? raw.marketCap
        : null;
  return { date: raw.date, session: raw.session, status: raw.status, name, marketCap };
}

export function parseEarnings(raw: unknown): EarningsData | null {
  if (!isRecord(raw)) return null;
  if (raw.schemaVersion !== 1) return null;
  if (typeof raw.effectiveDate !== 'string' || typeof raw.generatedAt !== 'string') return null;
  if (!isDate(raw.horizonEnd)) return null;
  if (raw.currency !== 'USD') return null;
  if (!isRecord(raw.earnings)) return null;

  const events: Record<string, EarningsEvent> = {};
  let rejected = 0;
  for (const [symbol, value] of Object.entries(raw.earnings)) {
    const event = parseEarningsEvent(value);
    if (event) events[symbol] = event;
    else rejected++;
  }
  // A file with no usable events must not shadow the bundled fallback.
  if (!Object.keys(events).length) return null;
  return {
    schemaVersion: 1,
    effectiveDate: raw.effectiveDate,
    generatedAt: raw.generatedAt,
    horizonEnd: raw.horizonEnd,
    currency: 'USD',
    earnings: events,
    ...(rejected ? { rejected } : {}),
  };
}

const emptyIndexes = (): IndexesData => ({
  schemaVersion: 1,
  effectiveDate: '',
  generatedAt: '',
  indexes: { sp500: [], ndx: [] },
  sectors: {},
});

const emptyEarnings = (): EarningsData => ({
  schemaVersion: 1,
  effectiveDate: '',
  generatedAt: '',
  horizonEnd: '',
  currency: 'USD',
  earnings: {},
});

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

/** Let an in-flight (cached) load settle even when the caller aborts. */
function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

async function fetchJson(url: string, fetchImpl: FetchLike, timeoutMs: number): Promise<unknown> {
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

function defaultBundledBase(): string {
  return `${import.meta.env.BASE_URL}data/`;
}

function resolveHostname(options: DatasetLoadOptions): string {
  if (options.hostname) return options.hostname;
  return typeof location === 'undefined' ? 'localhost' : location.hostname;
}

async function load<T>(
  kind: 'indexes' | 'earnings',
  parse: (raw: unknown) => T | null,
  empty: () => T,
  options: DatasetLoadOptions,
): Promise<Dataset<T>> {
  const hostname = resolveHostname(options);
  const fetchImpl = options.fetchImpl ?? fetch;
  const bundledBase = options.bundledBase ?? defaultBundledBase();
  const withSlash = bundledBase.endsWith('/') ? bundledBase : `${bundledBase}/`;
  const remoteBase = datasetBaseUrl(hostname);
  const key = `${kind}|${remoteBase ?? withSlash}`;

  let pending = cache.get(key) as Promise<Dataset<T>> | undefined;
  if (!pending) {
    const attempts: { url: string; source: 'remote' | 'bundled' }[] = [];
    if (remoteBase) attempts.push({ url: `${remoteBase}/${kind}.json`, source: 'remote' });
    attempts.push({ url: `${withSlash}${kind}.json`, source: 'bundled' });

    pending = (async () => {
      for (const attempt of attempts) {
        try {
          const raw = await fetchJson(
            attempt.url,
            fetchImpl,
            options.timeoutMs ?? REMOTE_TIMEOUT_MS,
          );
          const data = parse(raw);
          if (data) return { data, source: attempt.source };
        } catch {
          /* try the next source */
        }
      }
      return { data: empty(), source: 'bundled' as const };
    })();
    cache.set(key, pending as Promise<Dataset<unknown>>);
  }
  return abortable(pending, options.signal);
}

export function loadIndexes(options: DatasetLoadOptions = {}): Promise<Dataset<IndexesData>> {
  return load('indexes', parseIndexes, emptyIndexes, options);
}

export function loadEarnings(options: DatasetLoadOptions = {}): Promise<Dataset<EarningsData>> {
  return load('earnings', parseEarnings, emptyEarnings, options);
}
