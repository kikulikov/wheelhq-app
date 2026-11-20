import { cleanSymbols } from './domain';
import { sectorMatches } from './sectors';
import type { AssetInfo, Computed, IndexesData, Row } from './types';

export function activeSymbols(
  activeListId: string,
  activeList: { symbols: string[] } | null,
  indexes: IndexesData | null,
): string[] {
  switch (activeListId) {
    case 'all':
      return cleanSymbols([...(indexes?.indexes.sp500 ?? []), ...(indexes?.indexes.ndx ?? [])]);
    case 'sp500':
      return indexes?.indexes.sp500 ?? [];
    case 'ndx':
      return indexes?.indexes.ndx ?? [];
    default:
      return activeList?.symbols ?? [];
  }
}

/** The symbol pool the global ticker search can reach, independent of the selected universe. */
export function searchSymbols(indexes: IndexesData | null): string[] {
  return activeSymbols('all', null, indexes);
}

/** Resolve a query to an exact supported ticker; empty or partial queries return null. */
export function exactTicker(query: string, symbols: readonly string[]): string | null {
  const ticker = query.trim().toUpperCase();
  return ticker && symbols.includes(ticker) ? ticker : null;
}

export function symbolAllowed(symbol: string, assetBySymbol: Record<string, AssetInfo>): boolean {
  // Look the symbol up before checking whether the map is empty. Enumerating
  // every key on each call is O(n²) and freezes the All universe (~6k names).
  const info = assetBySymbol[symbol];
  if (info) return Boolean(info.exchange);
  return Object.keys(assetBySymbol).length === 0;
}

/** Symbols left after the asset-membership and sector-chip filters. */
export function candidateCount(
  symbols: string[],
  assetBySymbol: Record<string, AssetInfo>,
  sectors: Record<string, string>,
  selectedSector: string,
): number {
  return symbols.filter(
    (symbol) =>
      symbolAllowed(symbol, assetBySymbol) && sectorMatches(symbol, sectors, selectedSector),
  ).length;
}

export function sortValue(item: { row: Row; c: Computed }, key: string): unknown {
  const computedValue = (item.c as unknown as Record<string, unknown>)[key];
  return computedValue !== undefined
    ? computedValue
    : (item.row as unknown as Record<string, unknown>)[key];
}
