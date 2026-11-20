import { describe, expect, it } from 'vitest';
import { datasetBaseUrl, isProductionHost } from '../src/lib/environment';

describe('isProductionHost', () => {
  it('recognises the production hosts', () => {
    expect(isProductionHost('wheelhq.xyz')).toBe(true);
    expect(isProductionHost('www.wheelhq.xyz')).toBe(true);
  });

  it('treats the dev and local hosts as non-production', () => {
    expect(isProductionHost('wheelhq-app.onrender.com')).toBe(false);
    expect(isProductionHost('localhost')).toBe(false);
    expect(isProductionHost('127.0.0.1')).toBe(false);
  });
});

describe('datasetBaseUrl', () => {
  it('uses the production dataset subdomain', () => {
    expect(datasetBaseUrl('wheelhq.xyz')).toBe('https://datasets.wheelhq.xyz');
    expect(datasetBaseUrl('www.wheelhq.xyz')).toBe('https://datasets.wheelhq.xyz');
  });

  it('derives the dev dataset from the -app host', () => {
    expect(datasetBaseUrl('wheelhq-app.onrender.com')).toBe(
      'https://wheelhq-datasets.onrender.com',
    );
  });

  it('returns null for hosts without the convention', () => {
    expect(datasetBaseUrl('localhost')).toBeNull();
    expect(datasetBaseUrl('127.0.0.1')).toBeNull();
    expect(datasetBaseUrl('myapp.onrender.com')).toBeNull();
  });
});
