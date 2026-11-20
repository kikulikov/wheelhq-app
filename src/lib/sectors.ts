export type SectorKey =
  | 'materials'
  | 'media'
  | 'retail'
  | 'staples'
  | 'energy'
  | 'finance'
  | 'health'
  | 'industrial'
  | 'realestate'
  | 'tech'
  | 'utilities'
  | 'other';

/** Stock-sector order as shown in the Sector dropdown. */
export const SECTOR_ORDER: SectorKey[] = [
  'materials',
  'media',
  'retail',
  'staples',
  'energy',
  'finance',
  'health',
  'industrial',
  'realestate',
  'tech',
  'utilities',
];

export const SECTOR_LABELS: Record<SectorKey, string> = {
  materials: 'Basic Materials',
  media: 'Communication Services',
  retail: 'Consumer Cyclical',
  staples: 'Consumer Defensive',
  energy: 'Energy',
  finance: 'Financial Services',
  health: 'Healthcare',
  industrial: 'Industrials',
  realestate: 'Real Estate',
  tech: 'Technology',
  utilities: 'Utilities',
  other: 'Other',
};

const GICS_LABELS: Record<Exclude<SectorKey, 'other'>, string> = {
  tech: 'Information Technology',
  media: 'Communication Services',
  retail: 'Consumer Discretionary',
  staples: 'Consumer Staples',
  health: 'Health Care',
  finance: 'Financials',
  industrial: 'Industrials',
  energy: 'Energy',
  utilities: 'Utilities',
  materials: 'Materials',
  realestate: 'Real Estate',
};

const SECTOR_KEYS = new Set<string>([...Object.keys(SECTOR_LABELS), 'all']);

const GICS_TO_CHIP: Record<string, SectorKey> = Object.fromEntries(
  Object.entries(GICS_LABELS).map(([chip, label]) => [label, chip as SectorKey]),
);

export function sectorFor(symbol: string, sectors: Record<string, string>): SectorKey {
  return GICS_TO_CHIP[sectors[symbol]] ?? 'other';
}

export function chipFor(symbol: string, sectors: Record<string, string>): SectorKey {
  return sectorFor(symbol, sectors);
}

export const SECTOR_ALL = 'all';

export interface SectorOption {
  key: string;
  label: string;
}

/** Dropdown options for the active universe. */
export function sectorOptions(): SectorOption[] {
  const all = { key: SECTOR_ALL, label: 'All Sectors' };
  return [
    all,
    ...SECTOR_ORDER.map((key) => ({ key, label: SECTOR_LABELS[key] })),
    { key: 'other', label: SECTOR_LABELS.other },
  ];
}

export function sectorMatches(
  symbol: string,
  sectors: Record<string, string>,
  selected: string,
): boolean {
  if (!selected || selected === SECTOR_ALL) return true;
  return chipFor(symbol, sectors) === selected;
}

/** Remove unknown sector values from persisted or URL state. */
export function cleanSector(value: unknown): string {
  return typeof value === 'string' && SECTOR_KEYS.has(value) ? value : SECTOR_ALL;
}
