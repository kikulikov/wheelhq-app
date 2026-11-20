import { describe, expect, it } from 'vitest';
import { buildUrl, parseUrl } from '../src/lib/url';
import { MAX_LIST_SYMBOLS, PRICE_MAX } from '../src/lib/config';
import type { Filters, UserList } from '../src/lib/types';
import { tickers } from './helpers';

const lists: UserList[] = [{ id: 'list-income', name: 'Income', symbols: ['JPM', 'KO'] }];

const filters: Filters = {
  minDte: 1,
  maxDte: 7,
  minDelta: 0.15,
  maxDelta: 0.35,
  minAnn: 10,
  minYield: 0,
  maxSpread: 15,
  maxIv: 0,
  minPrice: 75,
  maxPrice: 150,
  sector: 'all',
  avoidEarnings: false,
  avoidDividends: false,
};

describe('parseUrl', () => {
  it('reads list, strategy, filters, and sort params', () => {
    const parsed = parseUrl(
      '?market=nyse&list=list-income&q=JPM&strategy=cc&risk=aggressive&expiry=8-14&sort=-ann&dteMin=8&dteMax=14&yield=2&price=150-300',
      lists,
    );
    expect(parsed.list).toBe('list-income');
    expect(parsed.q).toBe('JPM');
    expect(parsed.strategy).toBe('cc');
    expect(parsed.risk).toBe('aggressive');
    expect(parsed.expiry).toBe('8-14');
    expect(parsed.sortKey).toBe('ann');
    expect(parsed.sortDir).toBe(-1);
    expect(parsed.filters).toMatchObject({ minDte: 8, maxDte: 14, minYield: 2 });
    expect(parsed.filters).toMatchObject({ minPrice: 150, maxPrice: 300 });
  });

  it('accepts current presets and ignores legacy ones', () => {
    expect(parseUrl('?expiry=0d', lists).expiry).toBe('0d');
    expect(parseUrl('?expiry=1-7', lists).expiry).toBe('1-7');
    expect(parseUrl('?expiry=15-28', lists).expiry).toBe('15-28');
    expect(parseUrl('?expiry=29-63', lists).expiry).toBe('29-63');
    expect(parseUrl('?expiry=15-29', lists).expiry).toBeNull();
    expect(parseUrl('?expiry=30plus', lists).expiry).toBeNull();
    expect(parseUrl('?expiry=weekly', lists).expiry).toBeNull();
    expect(parseUrl('?expiry=monthly', lists).expiry).toBeNull();
  });

  it('creates an ephemeral shared list from lowercase symbols', () => {
    const parsed = parseUrl('?list=list-unknown&symbols=aapl,msft&listName=Lower', lists);
    expect(parsed.list).toBe('shared');
    expect(parsed.sharedList).toEqual({
      id: 'shared',
      name: 'Lower',
      symbols: ['AAPL', 'MSFT'],
    });
  });

  it('caps shared-list symbols at the documented maximum', () => {
    const symbols = tickers(MAX_LIST_SYMBOLS + 10).join(',');
    const parsed = parseUrl(`?list=list-unknown&symbols=${symbols}`, lists);
    expect(parsed.sharedList?.symbols).toHaveLength(MAX_LIST_SYMBOLS);
  });

  it('keeps a known local list and does not create a shared duplicate', () => {
    const parsed = parseUrl('?list=list-income&symbols=aapl,msft&listName=Income', lists);
    expect(parsed.list).toBe('list-income');
    expect(parsed.sharedList).toBeNull();
  });

  it('falls back to the default universe for unknown list ids', () => {
    expect(parseUrl('?list=list-unknown', lists).list).toBe('ndx');
  });

  it('ignores the retired market parameter', () => {
    expect(parseUrl('?market=arca', lists).list).toBe('ndx');
    expect(parseUrl('?market=nyse&list=sp500', lists).list).toBe('sp500');
  });

  it('accepts the built-in universes', () => {
    for (const id of ['sp500', 'ndx']) {
      expect(parseUrl(`?list=${id}`, lists).list).toBe(id);
    }
  });

  it('ignores an unknown price bucket parameter', () => {
    expect(parseUrl('?price=under20,20-50', lists).filters.maxPrice).toBeUndefined();
  });

  it('reads the avoid-earnings and avoid-dividends flags', () => {
    expect(parseUrl('?avoid=1', lists).avoidEarnings).toBe(true);
    expect(parseUrl('?avoid=0', lists).avoidEarnings).toBe(false);
    expect(parseUrl('', lists).avoidEarnings).toBeNull();
    expect(parseUrl('?avoidDiv=1', lists).avoidDividends).toBe(true);
    expect(parseUrl('?avoidDiv=0', lists).avoidDividends).toBe(false);
    expect(parseUrl('', lists).avoidDividends).toBeNull();
  });

  it('reads and cleans excluded symbols', () => {
    expect(parseUrl('?exclude=aapl,MSFT,TOOLONGSYMBOL', lists).exclude).toEqual(['AAPL', 'MSFT']);
    expect(parseUrl('', lists).exclude).toEqual([]);
  });

  it('ignores the retired cost basis parameter', () => {
    expect(parseUrl('?basis=250', lists).filters).not.toHaveProperty('costBasis');
  });

  it('reads a single sector and clears unknown values', () => {
    expect(parseUrl('?sector=tech', lists).sector).toBe('tech');
    expect(parseUrl('?sector=bogus', lists).sector).toBe('all');
    expect(parseUrl('?sector=', lists).sector).toBe('all');
    expect(parseUrl('', lists).sector).toBeNull();
  });
});

describe('buildUrl', () => {
  it('round-trips a shared/custom list snapshot', () => {
    const query = buildUrl({
      list: 'list-income',
      listName: 'Income',
      symbols: ['JPM', 'KO'],
      q: 'JP',
      strategy: 'cc',
      risk: 'balanced',
      expiry: 'custom',
      sortKey: 'ann',
      sortDir: -1,
      filters: {
        ...filters,
        minDte: 10,
        maxDte: 20,
        minYield: 2,
        minPrice: 150,
        maxPrice: 300,
        sector: 'tech',
        avoidEarnings: true,
        avoidDividends: true,
      },
      exclude: ['AAPL'],
    });
    const parsed = parseUrl(query, lists);
    expect(parsed.list).toBe('list-income');
    expect(parsed.q).toBe('JP');
    expect(parsed.strategy).toBe('cc');
    expect(parsed.expiry).toBe('custom');
    expect(parsed.sortKey).toBe('ann');
    expect(parsed.sortDir).toBe(-1);
    expect(parsed.filters).toMatchObject({
      minDte: 10,
      maxDte: 20,
      minYield: 2,
      minPrice: 150,
      maxPrice: 300,
    });
    expect(parsed.sector).toBe('tech');
    expect(parsed.avoidEarnings).toBe(true);
    expect(parsed.avoidDividends).toBe(true);
    expect(parsed.exclude).toEqual(['AAPL']);
  });

  it('does not encode symbols for Favourites', () => {
    const query = buildUrl({
      list: 'favourites',
      symbols: ['AAPL'],
      q: '',
      strategy: 'csp',
      risk: 'balanced',
      expiry: '1-7',
      sortKey: 'dte',
      sortDir: 1,
      filters,
    });
    expect(query).not.toContain('symbols=');
    expect(query).not.toContain('listName=');
  });

  it('round-trips the price bucket', () => {
    const query = buildUrl({
      list: 'all',
      q: '',
      strategy: 'csp',
      risk: 'balanced',
      expiry: '1-7',
      sortKey: 'dte',
      sortDir: 1,
      filters: { ...filters, minPrice: 300, maxPrice: PRICE_MAX },
    });
    expect(query).toContain('price=300plus');
    expect(parseUrl(query, lists).filters).toMatchObject({ minPrice: 300, maxPrice: PRICE_MAX });
  });
});
