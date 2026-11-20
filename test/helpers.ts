/** Deterministic ticker-like symbols that pass the app's symbol validator. */
export function tickers(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const first = String.fromCharCode(65 + (Math.floor(index / 676) % 26));
    const second = String.fromCharCode(65 + (Math.floor(index / 26) % 26));
    const third = String.fromCharCode(65 + (index % 26));
    return `${first}${second}${third}`;
  });
}
