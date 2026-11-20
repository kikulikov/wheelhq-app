// @ts-expect-error - plain Node helper used by scripts/sync-datasets.mjs
import { ageInDays, datasetProblem } from '../scripts/dataset-contract.mjs';
import { describe, expect, it } from 'vitest';

const indexes = {
  schemaVersion: 1,
  effectiveDate: '2026-11-13',
  generatedAt: '2026-11-13T23:00:00Z',
  indexes: { sp500: ['AAPL'], ndx: ['AAPL'] },
  sectors: { AAPL: 'Information Technology' },
};

const earnings = {
  schemaVersion: 1,
  effectiveDate: '2026-11-13',
  generatedAt: '2026-11-13T23:00:00Z',
  horizonEnd: '2027-01-04',
  currency: 'USD',
  earnings: { AAPL: { date: '2026-11-17' } },
};

describe('datasetProblem', () => {
  it('accepts the published shapes', () => {
    expect(datasetProblem('indexes.json', indexes)).toBeNull();
    expect(datasetProblem('earnings.json', earnings)).toBeNull();
  });

  it('rejects empty or malformed payloads before bundling', () => {
    expect(datasetProblem('indexes.json', { ...indexes, indexes: { sp500: [], ndx: [] } })).toBe(
      'sp500 is empty',
    );
    expect(datasetProblem('indexes.json', { ...indexes, sectors: {} })).toBe('sectors are empty');
    expect(datasetProblem('earnings.json', { ...earnings, earnings: {} })).toBe(
      'earnings are empty',
    );
    expect(datasetProblem('earnings.json', { ...earnings, schemaVersion: 2 })).toBe(
      'schemaVersion is not 1',
    );
    expect(datasetProblem('other.json', {})).toBe('unknown dataset');
  });
});

describe('ageInDays', () => {
  it('measures whole days since the effective date', () => {
    expect(ageInDays('2026-11-13', new Date('2026-11-17T12:00:00Z'))).toBe(4);
    expect(ageInDays('nope')).toBeNull();
  });
});
