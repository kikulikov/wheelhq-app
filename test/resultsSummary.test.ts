import { describe, expect, it } from 'vitest';
import { resultsSummary } from '../src/lib/resultsSummary';

const base = {
  matching: 0,
  page: 1,
  pageCount: 1,
  start: 0,
  end: 0,
  scannedContracts: 0,
  scannedSymbols: 0,
};

describe('resultsSummary', () => {
  it('separates matching contracts from scanned totals', () => {
    expect(
      resultsSummary({ ...base, matching: 13, scannedContracts: 213, scannedSymbols: 18 }),
    ).toEqual({
      primary: '13 matching contracts',
      secondary: 'From 213 contracts scanned across 18 symbols',
    });
  });

  it('uses singular forms', () => {
    expect(
      resultsSummary({ ...base, matching: 1, scannedContracts: 1, scannedSymbols: 1 }),
    ).toEqual({
      primary: '1 matching contract',
      secondary: 'From 1 contract scanned across 1 symbol',
    });
  });

  it('shows the current page range and the full total', () => {
    expect(
      resultsSummary({
        ...base,
        matching: 600,
        page: 2,
        pageCount: 6,
        start: 101,
        end: 200,
        scannedContracts: 800,
        scannedSymbols: 20,
      }),
    ).toEqual({
      primary: 'Showing 101–200 of 600 matching contracts',
      secondary: 'From 800 contracts scanned across 20 symbols',
    });
  });

  it('omits the secondary line when nothing was scanned', () => {
    expect(resultsSummary(base)).toEqual({ primary: '0 matching contracts', secondary: null });
  });

  it('names the global search scope instead of counting symbols', () => {
    expect(
      resultsSummary({
        ...base,
        matching: 4,
        scannedContracts: 24,
        scannedSymbols: 1,
        scopeLabel: 'IBM',
      }),
    ).toEqual({
      primary: '4 matching contracts',
      secondary: 'From 24 contracts scanned for IBM',
    });
  });
});
