export interface ScanItem {
  error?: string;
  pages: number;
  truncated: boolean;
}

export interface ScanOptions {
  signal?: AbortSignal | null;
  /** Return false to stop taking new symbols; in-flight symbols finish. */
  canContinue?: () => boolean;
}

export interface ScanSummary {
  scanned: string[];
  skipped: string[];
  errors: Record<string, string>;
  pages: number;
  truncated: string[];
}

/**
 * Run `fetchOne` over the symbols with at most `concurrency` in flight.
 * There is no queue: once `canContinue` turns false, the remaining symbols
 * are reported as skipped and never fetched.
 */
export async function scanSymbols<T extends ScanItem>(
  symbols: string[],
  concurrency: number,
  fetchOne: (symbol: string) => Promise<T>,
  onResult: (symbol: string, result: T) => void,
  options: ScanOptions = {},
): Promise<ScanSummary> {
  const summary: ScanSummary = {
    scanned: [],
    skipped: [],
    errors: {},
    pages: 0,
    truncated: [],
  };
  let next = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      if (options.signal?.aborted) return;
      if (options.canContinue && !options.canContinue()) return;
      const index = next++;
      if (index >= symbols.length) return;
      const symbol = symbols[index];

      let result: T;
      try {
        result = await fetchOne(symbol);
      } catch (error) {
        result = {
          error: (error as Error).message,
          pages: 0,
          truncated: false,
        } as T;
      }
      if (options.signal?.aborted) return;

      summary.scanned.push(symbol);
      if (result.error) summary.errors[symbol] = result.error;
      summary.pages += result.pages;
      if (result.truncated) summary.truncated.push(symbol);
      onResult(symbol, result);
    }
  };

  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), symbols.length) },
    worker,
  );
  await Promise.all(workers);

  const taken = new Set(summary.scanned);
  summary.skipped = symbols.filter((symbol) => !taken.has(symbol));
  return summary;
}
