import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearDatasetCache,
  loadEarnings,
  loadIndexes,
  parseEarnings,
  parseIndexes,
} from '../src/lib/datasets';

const indexes = {
  schemaVersion: 1,
  effectiveDate: '2026-11-11',
  generatedAt: '2026-11-11T23:00:00Z',
  indexes: { sp500: ['AAPL', 'MSFT'], ndx: ['AAPL'] },
  sectors: { AAPL: 'Information Technology', MSFT: 'Information Technology' },
};

const earnings = {
  schemaVersion: 1,
  effectiveDate: '2026-11-11',
  generatedAt: '2026-11-11T23:00:00Z',
  horizonEnd: '2026-12-30',
  currency: 'USD',
  earnings: {
    AAPL: {
      date: '2026-11-17',
      session: 'after_close',
      status: 'expected',
      name: 'Apple Inc.',
      marketCap: 100,
    },
  },
};

afterEach(() => {
  clearDatasetCache();
  vi.useRealTimers();
});

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function remoteFetch(body: unknown, calls: string[] = []) {
  return vi.fn(async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return response(body);
  });
}

describe('parseIndexes', () => {
  it('accepts the published schema', () => {
    expect(parseIndexes(indexes)).toEqual(indexes);
  });

  it('rejects a different schema version or missing pieces', () => {
    expect(parseIndexes({ ...indexes, schemaVersion: 2 })).toBeNull();
    expect(parseIndexes({ ...indexes, sectors: [] })).toBeNull();
    expect(parseIndexes({ ...indexes, indexes: { sp500: ['AAPL'] } })).toBeNull();
    expect(parseIndexes(null)).toBeNull();
  });
});

describe('parseEarnings', () => {
  it('accepts the published schema and normalises null fields', () => {
    const parsed = parseEarnings({
      ...earnings,
      earnings: {
        AAPL: { ...earnings.earnings.AAPL, name: null, marketCap: null },
      },
    });
    expect(parsed?.earnings.AAPL).toMatchObject({ session: 'after_close', status: 'expected' });
  });

  it('drops invalid events but keeps the file valid', () => {
    const parsed = parseEarnings({
      ...earnings,
      earnings: {
        BAD: { date: 'soon', session: 'lunch', status: 'expected' },
        AAPL: earnings.earnings.AAPL,
      },
    });
    expect(parsed?.earnings.AAPL).toBeDefined();
    expect(parsed?.earnings.BAD).toBeUndefined();
    expect(parsed?.rejected).toBe(1);
  });

  it('rejects a file with no usable events so the fallback can run', () => {
    expect(
      parseEarnings({
        ...earnings,
        earnings: { BAD: { date: 'soon', session: 'lunch', status: 'expected' } },
      }),
    ).toBeNull();
  });

  it('rejects a missing horizon or wrong currency', () => {
    expect(parseEarnings({ ...earnings, horizonEnd: undefined })).toBeNull();
    expect(parseEarnings({ ...earnings, currency: 'EUR' })).toBeNull();
  });
});

describe('loadIndexes', () => {
  it('fetches the production dataset host', async () => {
    const calls: string[] = [];
    const dataset = await loadIndexes({
      hostname: 'wheelhq.xyz',
      fetchImpl: remoteFetch(indexes, calls),
      bundledBase: 'https://app.test/data/',
    });
    expect(dataset).toEqual({ data: indexes, source: 'remote' });
    expect(calls).toEqual(['https://datasets.wheelhq.xyz/indexes.json']);
  });

  it('derives the dev dataset host from the -app hostname', async () => {
    const calls: string[] = [];
    await loadIndexes({
      hostname: 'wheelhq-app.onrender.com',
      fetchImpl: remoteFetch(indexes, calls),
      bundledBase: 'https://app.test/data/',
    });
    expect(calls).toEqual(['https://wheelhq-datasets.onrender.com/indexes.json']);
  });

  it('reads the bundled snapshot on localhost without a remote call', async () => {
    const calls: string[] = [];
    const dataset = await loadIndexes({
      hostname: 'localhost',
      fetchImpl: remoteFetch(indexes, calls),
      bundledBase: 'https://app.test/data/',
    });
    expect(dataset.source).toBe('bundled');
    expect(calls).toEqual(['https://app.test/data/indexes.json']);
  });

  it('falls back to the bundled snapshot after an HTTP error', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      return url.includes('datasets.wheelhq.xyz') ? response({}, 500) : response(indexes);
    });
    const dataset = await loadIndexes({
      hostname: 'wheelhq.xyz',
      fetchImpl,
      bundledBase: 'https://app.test/data/',
    });
    expect(dataset).toEqual({ data: indexes, source: 'bundled' });
    expect(calls).toEqual([
      'https://datasets.wheelhq.xyz/indexes.json',
      'https://app.test/data/indexes.json',
    ]);
  });

  it('falls back when the remote schema is wrong', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('datasets.wheelhq.xyz')
        ? response({ schemaVersion: 99 })
        : response(indexes),
    );
    const dataset = await loadIndexes({
      hostname: 'wheelhq.xyz',
      fetchImpl,
      bundledBase: 'https://app.test/data/',
    });
    expect(dataset.source).toBe('bundled');
  });

  it('falls back when the remote request times out', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          if (String(input).includes('datasets.wheelhq.xyz')) {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
            return;
          }
          resolve(response(indexes));
        }),
    );
    const pending = loadIndexes({
      hostname: 'wheelhq.xyz',
      fetchImpl,
      bundledBase: 'https://app.test/data/',
      timeoutMs: 50,
    });
    await vi.advanceTimersByTimeAsync(60);
    await expect(pending).resolves.toMatchObject({ source: 'bundled' });
  });

  it('fetches once per page lifetime', async () => {
    const calls: string[] = [];
    const options = {
      hostname: 'wheelhq.xyz',
      fetchImpl: remoteFetch(indexes, calls),
      bundledBase: 'https://app.test/data/',
    };
    await loadIndexes(options);
    await loadIndexes(options);
    expect(calls).toHaveLength(1);
  });
});

describe('loadEarnings', () => {
  it('loads and validates earnings', async () => {
    const dataset = await loadEarnings({
      hostname: 'localhost',
      fetchImpl: remoteFetch(earnings),
      bundledBase: 'https://app.test/data/',
    });
    expect(dataset.data.earnings.AAPL.status).toBe('expected');
    expect(dataset.source).toBe('bundled');
  });

  it('falls back when the remote file has no usable events', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('datasets.wheelhq.xyz')
        ? response({ ...earnings, earnings: { BAD: { date: 'soon' } } })
        : response(earnings),
    );
    const dataset = await loadEarnings({
      hostname: 'wheelhq.xyz',
      fetchImpl,
      bundledBase: 'https://app.test/data/',
    });
    expect(dataset.source).toBe('bundled');
    expect(dataset.data.earnings.AAPL.status).toBe('expected');
  });

  it('falls back when both sources are unavailable', async () => {
    const fetchImpl = vi.fn(async () => response({}, 500));
    const dataset = await loadEarnings({
      hostname: 'wheelhq.xyz',
      fetchImpl,
      bundledBase: 'https://app.test/data/',
    });
    expect(dataset.source).toBe('bundled');
    expect(dataset.data.earnings).toEqual({});
    expect(dataset.data.horizonEnd).toBe('');
  });
});
