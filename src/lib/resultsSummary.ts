export interface ResultsSummaryInput {
  matching: number;
  page: number;
  pageCount: number;
  /** One-based first row on the page; 0 when there are no matches. */
  start: number;
  /** One-based last row on the page; 0 when there are no matches. */
  end: number;
  scannedContracts: number;
  scannedSymbols: number;
  scopeLabel?: string | null;
}

export interface ResultsSummary {
  primary: string;
  secondary: string | null;
}

const plural = (count: number, singular: string, pluralForm = `${singular}s`): string =>
  `${count.toLocaleString('en-US')} ${count === 1 ? singular : pluralForm}`;

const range = (start: number, end: number): string =>
  `${start.toLocaleString('en-US')}–${end.toLocaleString('en-US')}`;

/**
 * Two plain-language lines above the table: what is on this page of the matches,
 * then how much was scanned. Page range and match total stay separate so
 * truncation or paging never hides the scan totals.
 */
export function resultsSummary({
  matching,
  pageCount,
  start,
  end,
  scannedContracts,
  scannedSymbols,
  scopeLabel,
}: ResultsSummaryInput): ResultsSummary {
  const contracts = plural(matching, 'matching contract');
  const primary = pageCount > 1 ? `Showing ${range(start, end)} of ${contracts}` : contracts;

  if (scannedContracts === 0) return { primary, secondary: null };

  const secondary = scopeLabel
    ? `From ${plural(scannedContracts, 'contract')} scanned for ${scopeLabel}`
    : `From ${plural(scannedContracts, 'contract')} scanned across ${plural(scannedSymbols, 'symbol')}`;

  return { primary, secondary };
}
