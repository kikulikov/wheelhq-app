/** Rows rendered per results page. */
export const RESULTS_PAGE_SIZE = 100;

export interface Page<T> {
  items: T[];
  /** The page actually shown, clamped to a valid range. */
  page: number;
  pageCount: number;
  /** One-based first row on this page; 0 when there are no rows. */
  start: number;
  /** One-based last row on this page; 0 when there are no rows. */
  end: number;
  total: number;
}

/** Slice a sorted result set into a clamped page, for client-side pagination. */
export function paginate<T>(items: T[], page: number, pageSize = RESULTS_PAGE_SIZE): Page<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const requested = Number.isFinite(page) ? Math.trunc(page) : 1;
  const safePage = Math.min(Math.max(1, requested), pageCount);
  const offset = (safePage - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    page: safePage,
    pageCount,
    start: total === 0 ? 0 : offset + 1,
    end: Math.min(offset + pageSize, total),
    total,
  };
}
