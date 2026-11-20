import { describe, expect, it } from 'vitest';
import { listSummary } from '../src/lib/listSummary';

const base = { symbols: [] as string[], marketCount: 0, indexesReady: true };

describe('listSummary', () => {
  it('formats the market-wide universe count', () => {
    expect(listSummary({ ...base, listId: 'all', marketCount: 1234 })).toBe('1,234 symbols');
  });

  it('counts index universes without printing every name', () => {
    expect(
      listSummary({ ...base, listId: 'sp500', symbols: ['AAPL', 'MSFT'], marketCount: 500 }),
    ).toBe('2 symbols');
  });

  it('explains unavailable index data', () => {
    expect(listSummary({ ...base, listId: 'ndx', indexesReady: false })).toBe(
      'Index data unavailable, try again later.',
    );
  });

  it('prints every symbol for a one-name list', () => {
    expect(listSummary({ ...base, listId: 'favourites', symbols: ['AAPL'] })).toBe(
      '1 symbol — AAPL',
    );
  });

  it('prints every symbol for a custom list', () => {
    expect(
      listSummary({ ...base, listId: 'list-main', symbols: ['BTI', 'CVS', 'GIS', 'KO'] }),
    ).toBe('4 symbols — BTI, CVS, GIS, KO');
  });

  it('prints all fifty names without a cutoff', () => {
    const symbols = Array.from({ length: 50 }, (_, index) => `S${index + 1}`);
    expect(listSummary({ ...base, listId: 'list-main', symbols })).toBe(
      `50 symbols — ${symbols.join(', ')}`,
    );
  });

  it('keeps the empty-list message', () => {
    expect(listSummary({ ...base, listId: 'list-main' })).toBe(
      'This list has no symbols — use Manage lists to add some.',
    );
  });
});
