export interface ListSummaryInput {
  listId: string;
  symbols: string[];
  marketCount: number;
  indexesReady: boolean;
}

/**
 * The one-line description under the universe bar. Market and index universes
 * stay counts; saved lists and Favourites print every name they will screen.
 */
export function listSummary({
  listId,
  symbols,
  marketCount,
  indexesReady,
}: ListSummaryInput): string {
  if (listId === 'all') {
    return `${marketCount.toLocaleString('en-US')} symbols`;
  }

  if ((listId === 'sp500' || listId === 'ndx') && !symbols.length && !indexesReady) {
    return 'Index data unavailable, try again later.';
  }

  if (!symbols.length) {
    return 'This list has no symbols — use Manage lists to add some.';
  }

  const count = `${symbols.length} symbol${symbols.length === 1 ? '' : 's'}`;
  if (listId === 'sp500' || listId === 'ndx') return count;
  return `${count} — ${symbols.join(', ')}`;
}
