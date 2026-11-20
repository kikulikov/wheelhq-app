<script lang="ts">
  import { untrack } from 'svelte';
  import { MAX_LIST_SYMBOLS } from '../lib/config';
  import { cleanSymbols } from '../lib/domain';
  import {
    exportListsFile,
    parseListsFile,
    type ImportListsResult,
    type SerializedList,
  } from '../lib/lists';
  import type { UserList } from '../lib/types';

  let {
    open,
    lists,
    watchlist,
    initialId = 'favourites',
    onClose,
    onSave,
    onDelete,
    onUse,
    onImport,
  }: {
    open: boolean;
    lists: UserList[];
    watchlist: string[];
    initialId?: string;
    onClose: () => void;
    onSave: (list: { id: string | null; name: string; symbols: string[] }) => string | null;
    onDelete: (id: string) => void;
    onUse: (id: string) => void;
    onImport: (incoming: SerializedList[]) => ImportListsResult;
  } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);
  let editingId = $state<string | null>('favourites');
  let name = $state('');
  let symbolsText = $state('');
  let message = $state('');
  let messageError = $state(false);

  const sideItems = $derived([
    { id: 'favourites', name: 'Favourites', symbols: watchlist },
    ...lists,
  ]);

  function syncForm(id: string | null) {
    editingId = id;
    const list = sideItems.find((item) => item.id === id);
    name = list?.name || '';
    symbolsText = list?.symbols.join(', ') || '';
    message = '';
    messageError = false;
  }

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>('input[maxlength="40"]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  });

  $effect(() => {
    if (open) untrack(() => syncForm(initialId));
  });

  function readSymbols(): string[] {
    return cleanSymbols(symbolsText.toUpperCase().split(/[^A-Z.-]+/));
  }

  function onSymbolsInput(event: Event) {
    const input = event.currentTarget as HTMLTextAreaElement;
    const value = input.value.toUpperCase();
    if (input.value !== value) input.value = value;
    symbolsText = value;
  }

  function save(): string | null {
    const symbols = readSymbols();
    if (!symbols.length) {
      message = 'Add at least one symbol.';
      messageError = true;
      return null;
    }
    if (symbols.length > MAX_LIST_SYMBOLS) {
      message = `Lists are limited to ${MAX_LIST_SYMBOLS} symbols — remove ${symbols.length - MAX_LIST_SYMBOLS}.`;
      messageError = true;
      return null;
    }
    const savedId = onSave({ id: editingId, name: name.trim() || 'My list', symbols });
    if (!savedId) {
      message = 'Could not save this list.';
      messageError = true;
      return null;
    }
    editingId = savedId;
    symbolsText = symbols.join(', ');
    message = `${symbols.length} symbol${symbols.length === 1 ? '' : 's'} saved.`;
    messageError = false;
    return savedId;
  }

  function useList() {
    const id = save();
    if (id) onUse(id);
  }

  function deleteList() {
    if (!editingId || editingId === 'favourites') return;
    if (!window.confirm(`Delete “${name}”?`)) return;
    const remaining = lists.filter((list) => list.id !== editingId);
    onDelete(editingId);
    syncForm(remaining[0]?.id || 'favourites');
  }

  function exportFile() {
    const file = exportListsFile(watchlist, lists);
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wheelhq-lists-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    message = `Exported ${file.lists.length} lists.`;
    messageError = false;
  }

  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const parsed = parseListsFile(await file.text());
    if (!parsed.ok) {
      message = parsed.error;
      messageError = true;
      return;
    }

    const result = onImport(parsed.lists);
    if (!result.imported) {
      message = result.skipped
        ? 'Nothing new to import — those lists already exist.'
        : 'No lists found in that file.';
      messageError = false;
      return;
    }

    const details = [
      `Imported ${result.imported} list${result.imported === 1 ? '' : 's'}`,
      result.skipped ? `${result.skipped} already existed` : '',
      result.renamed ? `${result.renamed} renamed` : '',
    ].filter(Boolean);
    message = `${details.join('; ')}.`;
    messageError = false;
  }
</script>

<dialog bind:this={dialog} class="modal" aria-labelledby="lists-title" onclose={onClose}>
  <div class="modal-box max-w-3xl">
    <h2 id="lists-title" class="text-base font-semibold">Lists</h2>
    <div class="mt-4 grid gap-4 md:grid-cols-[12rem_1fr]">
      <div class="flex flex-col gap-2">
        <div class="flex max-h-72 flex-col gap-1 overflow-auto">
          {#each sideItems as item (item.id)}
            <button
              type="button"
              class="btn justify-between btn-sm"
              class:btn-primary={editingId === item.id}
              class:btn-ghost={editingId !== item.id}
              onclick={() => syncForm(item.id)}
            >
              <span class="truncate">{item.name}</span>
              <span class="badge badge-ghost badge-xs">{item.symbols.length}</span>
            </button>
          {/each}
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick={() => syncForm(null)}
          >New list</button
        >
        <div class="mt-2 grid grid-cols-2 gap-1">
          <button type="button" class="btn border btn-sm" onclick={exportFile}>Export lists</button>
          <button type="button" class="btn border btn-sm" onclick={() => fileInput?.click()}
            >Import lists</button
          >
        </div>
        <input
          bind:this={fileInput}
          class="hidden"
          type="file"
          accept="application/json,.json"
          aria-label="Import lists file"
          onchange={importFile}
        />
      </div>

      <form
        class="flex flex-col gap-3"
        onsubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label class="form-control">
          <span class="label-text text-xs text-base-content/80">Name</span>
          <input
            class="input-bordered input input-sm"
            maxlength="40"
            bind:value={name}
            readonly={editingId === 'favourites'}
          />
        </label>
        <label class="form-control">
          <span class="label-text text-xs text-base-content/80">Symbols</span>
          <textarea
            class="textarea-bordered textarea min-h-36 font-mono text-xs textarea-sm"
            spellcheck="false"
            placeholder="Tickers separated by commas, spaces or new lines"
            value={symbolsText}
            oninput={onSymbolsInput}></textarea>
        </label>
        {#if message}<p
            class="text-xs"
            class:text-error={messageError}
            role="status"
            aria-live="polite"
          >
            {message}
          </p>{/if}
        <div class="modal-action">
          <button type="submit" class="btn btn-primary btn-sm">Save</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick={useList}>Use this list</button
          >
          {#if editingId && editingId !== 'favourites'}
            <button type="button" class="btn btn-ghost text-error btn-sm" onclick={deleteList}
              >Delete</button
            >
          {/if}
          <button type="button" class="btn btn-ghost btn-sm" onclick={onClose}>Close</button>
        </div>
      </form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>
