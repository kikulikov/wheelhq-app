import { describe, expect, it } from 'vitest';
import {
  addMonths,
  expiryText,
  fullDate,
  nyMinutes,
  todayYmd,
  ymd,
  ymdPlus,
} from '../src/lib/date';

describe('New York calendar dates', () => {
  it('uses the New York day around midnight UTC', () => {
    expect(ymd(new Date('2026-11-07T04:30:00Z'))).toBe('2026-11-06');
    expect(ymd(new Date('2026-11-07T05:30:00Z'))).toBe('2026-11-07');
  });

  it('handles the DST change boundary', () => {
    expect(ymd(new Date('2026-03-08T04:30:00Z'))).toBe('2026-03-07');
    expect(ymd(new Date('2026-03-08T05:30:00Z'))).toBe('2026-03-08');
  });

  it('adds whole days to the current New York date', () => {
    const today = Date.parse(`${todayYmd()}T00:00:00Z`);
    const plusSeven = Date.parse(`${ymdPlus(7)}T00:00:00Z`);
    expect(plusSeven - today).toBe(7 * 864e5);
  });

  it('adds calendar months across year boundaries', () => {
    expect(addMonths('2026-11-09', -13)).toBe('2025-10-09');
    expect(addMonths('2026-11-09', 3)).toBe('2027-02-09');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });
});

describe('fullDate', () => {
  it('renders a day-first date with the year', () => {
    expect(fullDate('2026-11-13')).toBe('13 Nov 2026');
    expect(fullDate('2026-01-05')).toBe('5 Jan 2026');
    expect(fullDate('2027-12-31')).toBe('31 Dec 2027');
  });
});

describe('expiryText', () => {
  it('omits the year for an expiry in the current year', () => {
    expect(expiryText('2026-11-23', '2026-11-18')).toBe('Nov 23');
  });

  it('adds a short year for an expiry in another year', () => {
    expect(expiryText('2027-01-15', '2026-11-18')).toBe("Jan 15 '27");
    expect(expiryText('2025-12-19', '2026-01-06')).toBe("Dec 19 '25");
  });
});

describe('New York clock time', () => {
  it('returns minutes since New York midnight', () => {
    expect(nyMinutes(new Date('2026-11-06T05:00:00Z'))).toBe(0); // 00:00 EST
    expect(nyMinutes(new Date('2026-11-06T14:30:00Z'))).toBe(570); // 09:30 EST
    expect(nyMinutes(new Date('2026-11-06T21:00:00Z'))).toBe(960); // 16:00 EST
  });
});
