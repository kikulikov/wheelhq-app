import { describe, expect, it } from 'vitest';
import { cashRequired } from '../src/lib/format';

describe('cashRequired', () => {
  it('multiplies the strike by the 100-share contract size', () => {
    expect(cashRequired(190)).toBe('$19,000');
    expect(cashRequired(12.5)).toBe('$1,250');
    expect(cashRequired(3.333)).toBe('$333');
  });

  it('keeps group separators for six-figure collateral', () => {
    expect(cashRequired(1250)).toBe('$125,000');
  });
});
