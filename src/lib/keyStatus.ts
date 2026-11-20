import type { KeyPair } from './types';

export interface KeyStatus {
  label: string;
  detail: string;
  remembered: boolean;
}

/** One place for the words shown around the Alpaca key. */
export function keyStatus(key: KeyPair | null, remembered: boolean): KeyStatus {
  if (!key) {
    return {
      label: 'No key',
      detail: 'Connect Alpaca to load option chains.',
      remembered: false,
    };
  }
  if (remembered) {
    return {
      label: 'Alpaca: saved key',
      detail: 'Kept on this device after the tab closes.',
      remembered: true,
    };
  }
  return {
    label: 'Alpaca: session key',
    detail: 'Cleared when this tab closes.',
    remembered: false,
  };
}
