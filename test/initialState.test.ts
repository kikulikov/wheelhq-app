import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS } from '../src/lib/config';
import { resolveInitialScreenState } from '../src/lib/initialState';
import type { Filters } from '../src/lib/types';

const storedFilters: Filters = { ...DEFAULT_FILTERS, minPrice: 150, maxPrice: 300 };
const lists = [{ id: 'list-income', name: 'Income', symbols: ['JPM'] }];

const base = {
  search: '',
  lists,
  storedFilters,
  storedStrategy: 'cc',
  storedRisk: 'aggressive',
  storedExpiry: '1-7',
  storedActiveList: 'list-income',
};

describe('resolveInitialScreenState', () => {
  it('uses saved values when the URL has no overrides', () => {
    const state = resolveInitialScreenState(base);
    expect(state.strategy).toBe('cc');
    expect(state.risk).toBe('aggressive');
    expect(state.expiry).toBe('1-7');
    expect(state.list).toBe('list-income');
    expect(state.filters.maxPrice).toBe(300);
  });

  it('lets URL filters and list selection override saved values', () => {
    const state = resolveInitialScreenState({
      ...base,
      search: '?list=sp500&strategy=csp&risk=conservative&expiry=15-28&sector=tech&price=150-300',
    });
    expect(state.strategy).toBe('csp');
    expect(state.risk).toBe('conservative');
    expect(state.expiry).toBe('15-28');
    expect(state.list).toBe('sp500');
    expect(state.filters.sector).toBe('tech');
    expect(state.filters.minPrice).toBe(150);
    expect(state.filters.maxPrice).toBe(300);
  });

  it('starts on Nasdaq-100 when no list is saved', () => {
    expect(resolveInitialScreenState({ ...base, storedActiveList: '' }).list).toBe('ndx');
  });

  it('falls back to Nasdaq-100 for an unknown saved list', () => {
    expect(resolveInitialScreenState({ ...base, storedActiveList: 'gone' }).list).toBe('ndx');
  });

  it('falls back to Nasdaq-100 for a removed list and clears an unknown sector', () => {
    const state = resolveInitialScreenState({
      ...base,
      search: '?list=funds&sector=leveraged',
    });
    expect(state.list).toBe('ndx');
    expect(state.filters.sector).toBe('all');
  });
});
