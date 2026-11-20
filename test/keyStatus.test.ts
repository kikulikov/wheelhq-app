import { describe, expect, it } from 'vitest';
import { keyStatus } from '../src/lib/keyStatus';

const key = { keyId: 'PKTEST', secret: 'test' };

describe('keyStatus', () => {
  it('explains the no-key state', () => {
    const status = keyStatus(null, false);
    expect(status.label).toBe('No key');
    expect(status.detail).toMatch(/connect alpaca/i);
  });

  it('marks a session key as cleared on tab close', () => {
    const status = keyStatus(key, false);
    expect(status.label).toBe('Alpaca: session key');
    expect(status.detail).toMatch(/cleared when this tab closes/i);
  });

  it('marks a remembered key as saved on this device', () => {
    const status = keyStatus(key, true);
    expect(status.label).toBe('Alpaca: saved key');
    expect(status.detail).toMatch(/kept on this device/i);
  });
});
