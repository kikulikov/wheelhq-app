import { MAX_LIST_SYMBOLS } from './config';
import { cleanListSymbols, cleanSymbols } from './domain';
import type { UserList } from './types';

export interface ListInput {
  id: string | null;
  name: string;
  symbols: string[];
}

export interface UpsertListResult {
  lists: UserList[];
  id: string | null;
}

export interface SerializedList {
  name: string;
  symbols: string[];
}

export interface ListsFile {
  version: 1;
  lists: SerializedList[];
}

export type ParseListsResult = { ok: true; lists: SerializedList[] } | { ok: false; error: string };

export interface ImportListsResult {
  lists: UserList[];
  watchlist: string[];
  imported: number;
  skipped: number;
  renamed: number;
}

const LISTS_FILE_VERSION = 1;
const NAME_LIMIT = 40;

/** The portable JSON payload for every list, Favourites first. */
export function exportListsFile(favourites: string[], lists: UserList[]): ListsFile {
  return {
    version: LISTS_FILE_VERSION,
    lists: [
      { name: 'Favourites', symbols: cleanListSymbols(favourites) },
      ...lists.map((list) => ({ name: list.name, symbols: cleanListSymbols(list.symbols) })),
    ],
  };
}

/** Validate and normalize an imported lists file before anything is persisted. */
export function parseListsFile(raw: string): ParseListsResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'That file is not a WheelHQ lists file.' };
  }
  const file = data as { version?: unknown; lists?: unknown };
  if (file.version !== LISTS_FILE_VERSION) {
    return { ok: false, error: 'Unsupported lists file version.' };
  }
  if (!Array.isArray(file.lists)) {
    return { ok: false, error: 'This file does not contain a lists array.' };
  }

  const lists: SerializedList[] = [];
  for (const [index, entry] of file.lists.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false, error: `List ${index + 1} is invalid.` };
    }
    const candidate = entry as { name?: unknown; symbols?: unknown };
    const name =
      typeof candidate.name === 'string' ? candidate.name.trim().slice(0, NAME_LIMIT) : '';
    if (!name) return { ok: false, error: `List ${index + 1} needs a name.` };
    if (!Array.isArray(candidate.symbols)) {
      return { ok: false, error: `${name} does not contain a symbols array.` };
    }
    const symbols = cleanSymbols(candidate.symbols);
    if (!symbols.length) return { ok: false, error: `${name} has no valid symbols.` };
    if (symbols.length > MAX_LIST_SYMBOLS) {
      return { ok: false, error: `${name} has more than ${MAX_LIST_SYMBOLS} symbols.` };
    }
    lists.push({ name, symbols });
  }
  return { ok: true, lists };
}

function contentKey(name: string, symbols: string[]): string {
  return `${name.trim().toLowerCase()}\u0000${[...symbols].sort().join(',')}`;
}

function availableName(name: string, taken: Set<string>): string {
  if (!taken.has(name.toLowerCase())) return name;
  for (let index = 1; ; index++) {
    const suffix = `_${index}`;
    const candidate = `${name.slice(0, NAME_LIMIT - suffix.length).trimEnd()}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/**
 * Merge an imported file into the local lists. Identical lists are skipped; a name
 * conflict with different contents gets a `_1`, `_2`, ... suffix.
 */
export function importLists(
  favourites: string[],
  lists: UserList[],
  incoming: SerializedList[],
  makeId: () => string,
): ImportListsResult {
  const watchlist = cleanListSymbols(favourites);
  const nextLists = [...lists];
  const taken = new Set<string>(['favourites', ...lists.map((list) => list.name.toLowerCase())]);
  const seen = new Set<string>([
    contentKey('Favourites', watchlist),
    ...lists.map((list) => contentKey(list.name, list.symbols)),
  ]);

  let imported = 0;
  let skipped = 0;
  let renamed = 0;
  for (const entry of incoming) {
    const symbols = cleanListSymbols(entry.symbols);
    if (!symbols.length) {
      skipped++;
      continue;
    }
    const key = contentKey(entry.name, symbols);
    if (seen.has(key)) {
      skipped++;
      continue;
    }

    const name = availableName(entry.name, taken);
    if (name !== entry.name) renamed++;
    taken.add(name.toLowerCase());
    seen.add(contentKey(name, symbols));
    nextLists.push({ id: makeId(), name, symbols });
    imported++;
  }

  return { lists: nextLists, watchlist, imported, skipped, renamed };
}

/** Create or update a list; returns `id: null` when the input is empty or the id is unknown. */
export function upsertList(
  lists: UserList[],
  input: ListInput,
  makeId: () => string,
): UpsertListResult {
  const symbols = cleanListSymbols(input.symbols);
  if (!symbols.length) return { lists, id: null };

  if (input.id) {
    const index = lists.findIndex((entry) => entry.id === input.id);
    if (index === -1) return { lists, id: null };
    const next = lists.map((entry, position) =>
      position === index ? { ...entry, name: input.name, symbols } : entry,
    );
    return { lists: next, id: input.id };
  }

  const id = makeId();
  return { lists: [...lists, { id, name: input.name, symbols }], id };
}

export function removeList(lists: UserList[], id: string): UserList[] {
  return lists.filter((entry) => entry.id !== id);
}
