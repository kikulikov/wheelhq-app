export type ConnectionTone = 'error' | 'warning' | 'success' | 'ghost';

export interface ConnectionInput {
  hasKey: boolean;
  error: string;
  loading: boolean;
  delayed: boolean;
  /** Symbols the scan attempted. */
  scanned: number;
  /** Symbols whose chain request succeeded, including chains with zero rows. */
  succeeded: number;
  updatedAt: string;
}

export interface ConnectionStatus {
  label: string;
  tone: ConnectionTone;
}

/**
 * What the header may claim about the connection. "Live" requires at least one
 * successful chain response; an all-failed scan is an error even if a chain
 * request returned HTTP 200 with no rows.
 */
export function connectionStatus(input: ConnectionInput): ConnectionStatus {
  if (!input.hasKey) return { label: 'No key', tone: 'ghost' };
  if (input.error) return { label: 'Connection error', tone: 'error' };
  if (input.loading) return { label: 'Loading…', tone: 'ghost' };
  if (input.scanned > 0 && input.succeeded === 0) {
    return { label: 'No data', tone: 'error' };
  }
  if (input.delayed) return { label: 'Indicative quotes', tone: 'warning' };
  if (input.updatedAt) return { label: 'Live', tone: 'success' };
  return { label: 'Idle', tone: 'ghost' };
}
