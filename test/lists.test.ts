import { describe, expect, it } from 'vitest';
import {
  exportListsFile,
  importLists,
  parseListsFile,
  removeList,
  upsertList,
} from '../src/lib/lists';
import type { UserList } from '../src/lib/types';

const makeId = () => 'list-new';

const lists: UserList[] = [
  { id: 'a', name: 'Alpha', symbols: ['AAPL'] },
  { id: 'b', name: 'Beta', symbols: ['MSFT'] },
];

describe('upsertList', () => {
  it('appends a new list with cleaned symbols', () => {
    const result = upsertList(
      lists,
      { id: null, name: 'Gamma', symbols: [' nvda ', 'NVDA', 'bad symbol!'] },
      makeId,
    );

    expect(result.id).toBe('list-new');
    expect(result.lists).toHaveLength(3);
    expect(result.lists[2]).toEqual({ id: 'list-new', name: 'Gamma', symbols: ['NVDA'] });
    expect(lists).toHaveLength(2);
  });

  it('updates a list in place without mutating the input', () => {
    const result = upsertList(lists, { id: 'b', name: 'Beta 2', symbols: ['msft', 'amd'] }, makeId);

    expect(result.id).toBe('b');
    expect(result.lists.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(result.lists[1]).toEqual({ id: 'b', name: 'Beta 2', symbols: ['MSFT', 'AMD'] });
    expect(lists[1]).toEqual({ id: 'b', name: 'Beta', symbols: ['MSFT'] });
  });

  it('rejects unknown ids and empty symbol lists', () => {
    expect(upsertList(lists, { id: 'missing', name: 'X', symbols: ['AAPL'] }, makeId)).toEqual({
      lists,
      id: null,
    });
    expect(upsertList(lists, { id: null, name: 'X', symbols: [] }, makeId)).toEqual({
      lists,
      id: null,
    });
  });
});

describe('removeList', () => {
  it('removes only the matching list', () => {
    expect(removeList(lists, 'a')).toEqual([lists[1]]);
    expect(removeList(lists, 'missing')).toEqual(lists);
  });
});

describe('exportListsFile', () => {
  it('includes Favourites first and every custom list', () => {
    expect(exportListsFile(['AAPL'], lists)).toEqual({
      version: 1,
      lists: [
        { name: 'Favourites', symbols: ['AAPL'] },
        { name: 'Alpha', symbols: ['AAPL'] },
        { name: 'Beta', symbols: ['MSFT'] },
      ],
    });
  });
});

describe('parseListsFile', () => {
  it('normalizes names and symbols from a valid file', () => {
    const result = parseListsFile(
      JSON.stringify({
        version: 1,
        lists: [{ name: '  My list  ', symbols: [' aapl ', 'AAPL', 'msft'] }],
      }),
    );

    expect(result).toEqual({
      ok: true,
      lists: [{ name: 'My list', symbols: ['AAPL', 'MSFT'] }],
    });
  });

  it('rejects malformed JSON, wrong versions, and missing lists', () => {
    expect(parseListsFile('{')).toEqual({ ok: false, error: 'That file is not valid JSON.' });
    expect(parseListsFile(JSON.stringify({ version: 2, lists: [] }))).toEqual({
      ok: false,
      error: 'Unsupported lists file version.',
    });
    expect(parseListsFile(JSON.stringify({ version: 1 }))).toEqual({
      ok: false,
      error: 'This file does not contain a lists array.',
    });
  });

  it('rejects an invalid list and a list over the symbol cap', () => {
    expect(
      parseListsFile(JSON.stringify({ version: 1, lists: [{ name: '', symbols: ['AAPL'] }] })),
    ).toEqual({ ok: false, error: 'List 1 needs a name.' });
    expect(
      parseListsFile(
        JSON.stringify({
          version: 1,
          lists: [
            {
              name: 'Too big',
              symbols: Array.from(
                { length: 51 },
                (_, index) =>
                  `T${String.fromCharCode(65 + (index % 26))}${String.fromCharCode(
                    65 + Math.floor(index / 26),
                  )}`,
              ),
            },
          ],
        }),
      ),
    ).toEqual({ ok: false, error: 'Too big has more than 50 symbols.' });
  });
});

describe('importLists', () => {
  const makeSequenceId = () => {
    let index = 0;
    return () => `imported-${++index}`;
  };

  it('blends in a list that already has the same name and symbols', () => {
    const result = importLists(
      ['AAPL'],
      [{ id: 'a', name: 'Alpha', symbols: ['AAPL'] }],
      [{ name: 'alpha', symbols: ['aapl'] }],
      makeSequenceId(),
    );

    expect(result.lists).toEqual([{ id: 'a', name: 'Alpha', symbols: ['AAPL'] }]);
    expect(result.watchlist).toEqual(['AAPL']);
    expect(result).toMatchObject({ imported: 0, skipped: 1, renamed: 0 });
  });

  it('renames a conflicting list with _1 and _2 suffixes', () => {
    const result = importLists(
      [],
      [{ id: 'a', name: 'Alpha', symbols: ['AAPL'] }],
      [
        { name: 'Alpha', symbols: ['MSFT'] },
        { name: 'Alpha', symbols: ['NVDA'] },
      ],
      makeSequenceId(),
    );

    expect(result.lists.map((list) => list.name)).toEqual(['Alpha', 'Alpha_1', 'Alpha_2']);
    expect(result.lists.slice(1)).toEqual([
      { id: 'imported-1', name: 'Alpha_1', symbols: ['MSFT'] },
      { id: 'imported-2', name: 'Alpha_2', symbols: ['NVDA'] },
    ]);
    expect(result).toMatchObject({ imported: 2, skipped: 0, renamed: 2 });
  });

  it('imports Favourites as a normal list when it differs from the local one', () => {
    const result = importLists(
      ['AAPL'],
      [],
      [{ name: 'Favourites', symbols: ['MSFT'] }],
      makeSequenceId(),
    );

    expect(result.watchlist).toEqual(['AAPL']);
    expect(result.lists).toEqual([{ id: 'imported-1', name: 'Favourites_1', symbols: ['MSFT'] }]);
  });

  it('does not import a Favourites list that matches the local one', () => {
    const result = importLists(
      ['AAPL'],
      [],
      [{ name: 'favourites', symbols: ['aapl'] }],
      makeSequenceId(),
    );

    expect(result.lists).toEqual([]);
    expect(result).toMatchObject({ imported: 0, skipped: 1, renamed: 0 });
  });
});
