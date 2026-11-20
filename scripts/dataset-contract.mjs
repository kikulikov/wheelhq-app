const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A short reason why a dataset cannot be bundled, or null when it is usable. */
export function datasetProblem(name, data) {
  if (name !== 'indexes.json' && name !== 'earnings.json') return 'unknown dataset';
  if (!data || typeof data !== 'object') return 'not an object';
  if (data.schemaVersion !== 1) return 'schemaVersion is not 1';
  if (typeof data.effectiveDate !== 'string' || !DATE.test(data.effectiveDate)) {
    return 'effectiveDate is invalid';
  }
  if (typeof data.generatedAt !== 'string') return 'generatedAt is missing';

  if (name === 'indexes.json') {
    const sp500 = data.indexes?.sp500;
    const ndx = data.indexes?.ndx;
    if (!Array.isArray(sp500) || !sp500.length) return 'sp500 is empty';
    if (!Array.isArray(ndx) || !ndx.length) return 'ndx is empty';
    if (!data.sectors || typeof data.sectors !== 'object') return 'sectors are missing';
    if (!Object.keys(data.sectors).length) return 'sectors are empty';
  } else if (name === 'earnings.json') {
    if (typeof data.horizonEnd !== 'string' || !DATE.test(data.horizonEnd)) {
      return 'horizonEnd is invalid';
    }
    if (!data.earnings || typeof data.earnings !== 'object') return 'earnings are missing';
    if (!Object.keys(data.earnings).length) return 'earnings are empty';
  }

  return null;
}

/** Whole days between an effective date and now, or null when the date is unusable. */
export function ageInDays(effectiveDate, now = new Date()) {
  const then = Date.parse(`${effectiveDate}T00:00:00Z`);
  if (!Number.isFinite(then)) return null;
  return Math.floor((now.getTime() - then) / 864e5);
}
