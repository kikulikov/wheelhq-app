import { describe, expect, it } from 'vitest';
import { scanSymbols } from '../src/lib/scan';

const item = (overrides: { pages?: number; truncated?: boolean; error?: string } = {}) => ({
  pages: 0,
  truncated: false,
  ...overrides,
});

describe('scanSymbols', () => {
  it('runs at most the requested concurrency', async () => {
    let active = 0;
    let peak = 0;
    const symbols = Array.from({ length: 10 }, (_, index) => `S${index}`);

    await scanSymbols(
      symbols,
      3,
      async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        return item();
      },
      () => {},
    );

    expect(peak).toBe(3);
  });

  it('stops scheduling when canContinue turns false and reports skipped symbols', async () => {
    let budget = 1;
    const seen: string[] = [];
    const scan = await scanSymbols(
      ['A', 'B', 'C'],
      1,
      async () => item(),
      (symbol) => seen.push(symbol),
      { canContinue: () => budget-- > 0 },
    );

    expect(scan.scanned).toEqual(['A']);
    expect(scan.skipped).toEqual(['B', 'C']);
    expect(seen).toEqual(['A']);
  });

  it('stops on abort and leaves the remaining symbols skipped', async () => {
    const controller = new AbortController();
    controller.abort();

    const scan = await scanSymbols(
      ['A', 'B'],
      2,
      async () => item(),
      () => {
        throw new Error('should not run');
      },
      { signal: controller.signal },
    );

    expect(scan.scanned).toEqual([]);
    expect(scan.skipped).toEqual(['A', 'B']);
  });

  it('aggregates errors, pages and truncation and calls onResult in order', async () => {
    const seen: string[] = [];
    const scan = await scanSymbols(
      ['A', 'B', 'C'],
      1,
      async (symbol) =>
        symbol === 'B' ? item({ pages: 2, truncated: true, error: 'boom' }) : item({ pages: 1 }),
      (symbol) => seen.push(symbol),
    );

    expect(seen).toEqual(['A', 'B', 'C']);
    expect(scan.errors).toEqual({ B: 'boom' });
    expect(scan.pages).toBe(4);
    expect(scan.truncated).toEqual(['B']);
  });

  it('turns a thrown fetch into a per-symbol error', async () => {
    const seen: string[] = [];
    const scan = await scanSymbols(
      ['A', 'B'],
      1,
      async (symbol) => {
        if (symbol === 'A') throw new Error('network down');
        return item();
      },
      (symbol) => seen.push(symbol),
    );

    expect(scan.errors).toEqual({ A: 'network down' });
    expect(scan.scanned).toEqual(['A', 'B']);
    expect(seen).toEqual(['A', 'B']);
  });
});
