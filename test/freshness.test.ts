import { describe, expect, it } from 'vitest';
import { latestExpectedEarningsDate } from '../src/lib/freshness';

const at = (iso: string) => new Date(iso);

describe('latestExpectedEarningsDate', () => {
  it('expects today once the weekday build window has passed', () => {
    expect(latestExpectedEarningsDate(at('2026-11-17T23:45:00Z'))).toBe('2026-11-17');
  });

  it('expects the previous weekday before the build window', () => {
    expect(latestExpectedEarningsDate(at('2026-11-17T10:00:00Z'))).toBe('2026-11-16');
    expect(latestExpectedEarningsDate(at('2026-11-18T12:00:00Z'))).toBe('2026-11-17');
  });

  it('waits out the build grace period', () => {
    expect(latestExpectedEarningsDate(at('2026-11-17T23:10:00Z'))).toBe('2026-11-16');
    expect(latestExpectedEarningsDate(at('2026-11-17T23:31:00Z'))).toBe('2026-11-17');
  });

  it('keeps Friday as the latest build over the weekend', () => {
    expect(latestExpectedEarningsDate(at('2026-11-21T12:00:00Z'))).toBe('2026-11-20');
    expect(latestExpectedEarningsDate(at('2026-11-22T12:00:00Z'))).toBe('2026-11-20');
  });

  it('expects Friday on Monday morning and Monday after the build', () => {
    expect(latestExpectedEarningsDate(at('2026-11-23T12:00:00Z'))).toBe('2026-11-20');
    expect(latestExpectedEarningsDate(at('2026-11-23T23:45:00Z'))).toBe('2026-11-23');
  });
});
