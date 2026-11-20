import { describe, expect, it } from 'vitest';
import { paginate } from '../src/lib/pagination';

const items = Array.from({ length: 250 }, (_, index) => index);

describe('paginate', () => {
  it('returns the requested page with a one-based range', () => {
    expect(paginate(items, 1)).toMatchObject({
      page: 1,
      pageCount: 3,
      start: 1,
      end: 100,
      total: 250,
    });
    expect(paginate(items, 2)).toMatchObject({ start: 101, end: 200 });
    expect(paginate(items, 3).items).toEqual(items.slice(200));
  });

  it('clamps a page past the end instead of returning nothing', () => {
    expect(paginate(items, 99)).toMatchObject({ page: 3, start: 201, end: 250 });
  });

  it('clamps zero and negative pages to the first page', () => {
    expect(paginate(items, 0).page).toBe(1);
    expect(paginate(items, -4).page).toBe(1);
    expect(paginate(items, Number.NaN).page).toBe(1);
  });

  it('reports an empty result as one empty page', () => {
    expect(paginate([], 4)).toEqual({
      items: [],
      page: 1,
      pageCount: 1,
      start: 0,
      end: 0,
      total: 0,
    });
  });

  it('honours a custom page size', () => {
    expect(paginate([1, 2, 3], 2, 2)).toMatchObject({
      items: [3],
      page: 2,
      pageCount: 2,
      start: 3,
      end: 3,
    });
  });
});
