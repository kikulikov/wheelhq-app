export type RefreshReason = 'initial' | 'manual' | 'scope' | 'auto';

/** Only an explicit refresh (first load or the button) forces fresh datasets. */
export function forceInputReload(reason: RefreshReason): boolean {
  return reason === 'initial' || reason === 'manual';
}

export const AUTO_REFRESH_OPTIONS = [0, 1, 5, 10] as const;
export type AutoRefreshMinutes = (typeof AUTO_REFRESH_OPTIONS)[number];

/** Datasets are rebuilt about once a day; an hourly check is plenty on auto ticks. */
export const AUX_REFRESH_MS = 60 * 60 * 1000;

export function sanitizeAutoRefresh(value: unknown): AutoRefreshMinutes {
  const minutes = typeof value === 'number' ? value : Number(value);
  return (AUTO_REFRESH_OPTIONS as readonly number[]).includes(minutes)
    ? (minutes as AutoRefreshMinutes)
    : 0;
}

export function autoRefreshLabel(minutes: AutoRefreshMinutes): string {
  return minutes === 0 ? 'Off' : `${minutes} min`;
}

export function autoRefreshShort(minutes: AutoRefreshMinutes): string {
  return minutes === 0 ? 'Off' : `${minutes}m`;
}

export function autoRefreshMs(minutes: AutoRefreshMinutes): number {
  return minutes * 60_000;
}

/** Manual refreshes reload indexes and earnings; auto ticks do so at most hourly. */
export function shouldReloadAux({
  manual,
  lastLoadAt,
  now,
  intervalMs = AUX_REFRESH_MS,
}: {
  manual: boolean;
  lastLoadAt: number;
  now: number;
  intervalMs?: number;
}): boolean {
  return manual || now - lastLoadAt >= intervalMs;
}

/** Asset metadata is large and changes rarely: reload it once per New York day. */
export function shouldReloadAssets({
  manual,
  loadedOn,
  today,
}: {
  manual: boolean;
  loadedOn: string;
  today: string;
}): boolean {
  return manual || loadedOn !== today;
}
