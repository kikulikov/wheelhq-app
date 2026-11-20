import { describe, expect, it } from 'vitest';
import indexes from '../static/data/indexes.json';
import {
  cleanSector,
  sectorFor,
  sectorMatches,
  sectorOptions,
  SECTOR_LABELS,
  SECTOR_ORDER,
} from '../src/lib/sectors';

const sectors = {
  AAPL: 'Information Technology',
  MSFT: 'Information Technology',
  GOOGL: 'Communication Services',
  META: 'Communication Services',
  AMZN: 'Consumer Discretionary',
  KO: 'Consumer Staples',
  JNJ: 'Health Care',
  JPM: 'Financials',
  CAT: 'Industrials',
  XOM: 'Energy',
  NEE: 'Utilities',
  LIN: 'Materials',
  PLD: 'Real Estate',
  XYZ: 'Something Else',
};

const screenshotLabels = [
  'Basic Materials',
  'Communication Services',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Energy',
  'Financial Services',
  'Healthcare',
  'Industrials',
  'Real Estate',
  'Technology',
  'Utilities',
];

describe('sectorFor', () => {
  it('maps every GICS sector to its dropdown sector', () => {
    expect(sectorFor('AAPL', sectors)).toBe('tech');
    expect(sectorFor('GOOGL', sectors)).toBe('media');
    expect(sectorFor('AMZN', sectors)).toBe('retail');
    expect(sectorFor('KO', sectors)).toBe('staples');
    expect(sectorFor('JNJ', sectors)).toBe('health');
    expect(sectorFor('JPM', sectors)).toBe('finance');
    expect(sectorFor('CAT', sectors)).toBe('industrial');
    expect(sectorFor('XOM', sectors)).toBe('energy');
    expect(sectorFor('NEE', sectors)).toBe('utilities');
    expect(sectorFor('LIN', sectors)).toBe('materials');
    expect(sectorFor('PLD', sectors)).toBe('realestate');
  });

  it('puts unknown, unmapped, and missing symbols in Other', () => {
    expect(sectorFor('XYZ', sectors)).toBe('other');
    expect(sectorFor('MISSING', sectors)).toBe('other');
    expect(sectorFor('AAPL', {})).toBe('other');
  });
});

describe('labels and order', () => {
  it('matches the requested dropdown labels in order', () => {
    expect(SECTOR_ORDER.map((key) => SECTOR_LABELS[key])).toEqual(screenshotLabels);
  });
});

describe('sectorOptions', () => {
  it('offers All Sectors plus every stock sector', () => {
    const options = sectorOptions();
    expect(options[0]).toEqual({ key: 'all', label: 'All Sectors' });
    expect(options.slice(1, 12).map((option) => option.label)).toEqual(screenshotLabels);
    expect(options.at(-1)).toEqual({ key: 'other', label: 'Other' });
  });
});

describe('sectorMatches', () => {
  it('keeps everything for All Sectors', () => {
    expect(sectorMatches('AAPL', sectors, 'all')).toBe(true);
    expect(sectorMatches('XYZ', sectors, 'all')).toBe(true);
  });

  it('keeps only the selected sector', () => {
    expect(sectorMatches('AAPL', sectors, 'tech')).toBe(true);
    expect(sectorMatches('GOOGL', sectors, 'tech')).toBe(false);
    expect(sectorMatches('XYZ', sectors, 'other')).toBe(true);
  });
});

describe('cleanSector', () => {
  it('accepts known keys and All Sectors, and clears everything else', () => {
    expect(cleanSector('tech')).toBe('tech');
    expect(cleanSector('all')).toBe('all');
    expect(cleanSector('bogus')).toBe('all');
    expect(cleanSector(null)).toBe('all');
  });
});

describe('published sector coverage', () => {
  it('contains every sector used by the dropdown', () => {
    const published = new Set(Object.values(indexes.sectors));
    const expected = [
      'Materials',
      'Communication Services',
      'Consumer Discretionary',
      'Consumer Staples',
      'Energy',
      'Financials',
      'Health Care',
      'Industrials',
      'Real Estate',
      'Information Technology',
      'Utilities',
    ];
    for (const label of expected) expect([...published]).toContain(label);
    for (const gics of published) expect(sectorFor('X', { X: gics })).not.toBe('other');
  });
});
