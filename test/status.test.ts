import { describe, expect, it } from 'vitest';
import { connectionStatus } from '../src/lib/status';

const base = {
  hasKey: true,
  error: '',
  loading: false,
  delayed: false,
  scanned: 0,
  succeeded: 0,
  updatedAt: '',
};

describe('connectionStatus', () => {
  it('asks for a key when none is saved', () => {
    expect(connectionStatus({ ...base, hasKey: false })).toEqual({
      label: 'No key',
      tone: 'ghost',
    });
  });

  it('reports a connection error first', () => {
    expect(connectionStatus({ ...base, error: 'HTTP 500' })).toEqual({
      label: 'Connection error',
      tone: 'error',
    });
  });

  it('reports loading while a scan runs', () => {
    expect(connectionStatus({ ...base, loading: true, scanned: 2, succeeded: 1 })).toEqual({
      label: 'Loading…',
      tone: 'ghost',
    });
  });

  it('never claims Live when every chain failed', () => {
    expect(connectionStatus({ ...base, scanned: 3, succeeded: 0, updatedAt: '10:00:00' })).toEqual({
      label: 'No data',
      tone: 'error',
    });
  });

  it('reports indicative quotes for data that arrived', () => {
    expect(connectionStatus({ ...base, delayed: true, scanned: 3, succeeded: 2 })).toEqual({
      label: 'Indicative quotes',
      tone: 'warning',
    });
  });

  it('reports Live only after a successful chain', () => {
    expect(connectionStatus({ ...base, scanned: 3, succeeded: 2, updatedAt: '10:00:00' })).toEqual({
      label: 'Live',
      tone: 'success',
    });
  });

  it('stays idle before the first scan', () => {
    expect(connectionStatus(base)).toEqual({ label: 'Idle', tone: 'ghost' });
  });
});
