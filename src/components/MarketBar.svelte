<script lang="ts">
  import { BUILTIN_LISTS } from '../lib/config';
  import Icon from './Icon.svelte';
  import type { SharedList, UserList } from '../lib/types';

  let {
    lists,
    activeListId,
    sharedList,
    symbolFilter,
    listNote,
    searchSymbol,
    searchOutside,
    universeLabel,
    onListChange,
    onFilterInput,
    onClearSearch,
    onManageLists,
    onSaveShared,
  }: {
    lists: UserList[];
    activeListId: string;
    sharedList: SharedList | null;
    symbolFilter: string;
    listNote: string;
    searchSymbol: string | null;
    searchOutside: boolean;
    universeLabel: string;
    onListChange: (id: string) => void;
    onFilterInput: (value: string) => void;
    onClearSearch: () => void;
    onManageLists: () => void;
    onSaveShared: () => void;
  } = $props();

  let searchInput = $state<HTMLInputElement | null>(null);
  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl+K';

  const builtinUniverses = [
    { id: 'all', name: 'US Options' },
    { id: BUILTIN_LISTS.sp500.id, name: BUILTIN_LISTS.sp500.name },
    { id: BUILTIN_LISTS.ndx.id, name: BUILTIN_LISTS.ndx.name },
    { id: 'favourites', name: 'Favourites' },
  ];
  const savedUniverses = $derived(lists.map((list) => ({ id: list.id, name: list.name })));
  const sharedUniverse = $derived(sharedList ? { id: 'shared', name: sharedList.name } : null);

  $effect(() => {
    function onKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInput?.focus();
      }
    }
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  });
</script>

<div class="flex flex-wrap items-center gap-2 border-b border-base-300 bg-base-100 px-4 py-2">
  <div
    class="flex w-full flex-wrap items-center gap-1 sm:w-auto"
    role="group"
    aria-label="Universe"
  >
    <span class="mr-1 text-[0.6875rem] tracking-wide text-base-content/70 uppercase">Universe</span>
    <div class="flex flex-wrap items-center gap-1" role="group" aria-label="Predefined universes">
      {#each builtinUniverses as universe (universe.id)}
        <button
          type="button"
          class="btn max-w-48 truncate border btn-sm"
          class:border-base-300={activeListId !== universe.id}
          class:btn-primary={activeListId === universe.id}
          class:btn-ghost={activeListId !== universe.id}
          title={universe.name}
          aria-pressed={activeListId === universe.id}
          onclick={() => onListChange(universe.id)}>{universe.name}</button
        >
      {/each}
    </div>

    {#if savedUniverses.length}
      <span
        class="mx-1 h-5 w-px bg-base-300"
        role="separator"
        aria-orientation="vertical"
        aria-label="Saved lists"
      ></span>
      <div class="flex flex-wrap items-center gap-1" role="group" aria-label="Saved lists">
        {#each savedUniverses as universe (universe.id)}
          <button
            type="button"
            class="btn max-w-48 truncate border btn-sm"
            class:border-base-300={activeListId !== universe.id}
            class:btn-primary={activeListId === universe.id}
            class:btn-ghost={activeListId !== universe.id}
            title={`Saved list: ${universe.name}`}
            aria-pressed={activeListId === universe.id}
            onclick={() => onListChange(universe.id)}>{universe.name}</button
          >
        {/each}
      </div>
    {/if}

    {#if sharedUniverse}
      <span
        class="mx-1 h-5 w-px bg-base-300"
        role="separator"
        aria-orientation="vertical"
        aria-label="Shared list"
      ></span>
      <div class="flex flex-wrap items-center gap-1" role="group" aria-label="Shared list">
        <span class="badge badge-ghost badge-xs">Shared</span>
        <button
          type="button"
          class="btn max-w-48 truncate border btn-sm"
          class:border-base-300={activeListId !== sharedUniverse.id}
          class:btn-primary={activeListId === sharedUniverse.id}
          class:btn-ghost={activeListId !== sharedUniverse.id}
          title={`Shared list: ${sharedUniverse.name}`}
          aria-pressed={activeListId === sharedUniverse.id}
          onclick={() => onListChange(sharedUniverse.id)}>{sharedUniverse.name}</button
        >
      </div>
    {/if}

    <button type="button" class="btn btn-ghost btn-sm" onclick={onManageLists}>
      Manage lists
    </button>
  </div>

  {#if sharedList && activeListId === 'shared'}
    <button type="button" class="btn btn-ghost btn-sm" onclick={onSaveShared}>Save as list</button>
  {/if}

  <div class="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
    <div class="relative w-full sm:w-64">
      <Icon
        name="search"
        class="pointer-events-none absolute top-1/2 left-2.5 z-10 -translate-y-1/2 text-base-content/60"
      />
      <input
        bind:this={searchInput}
        class="input-bordered input w-full rounded-md pl-8 input-sm"
        placeholder={`Search (${shortcutLabel})`}
        aria-label="Global ticker search"
        aria-keyshortcuts="Control+K Meta+K"
        spellcheck="false"
        autocomplete="off"
        value={symbolFilter}
        oninput={(event) => onFilterInput(event.currentTarget.value)}
      />
    </div>

    {#if searchSymbol}
      <span
        class="badge gap-1 badge-outline badge-sm"
        aria-label={`Global search scope: ${searchSymbol}`}
        title={searchOutside ? `Outside ${universeLabel}` : 'Global search'}
      >
        <span class="font-medium">{searchSymbol}</span>
        <span class="text-base-content/70">· Global search</span>
        {#if searchOutside}
          <span class="text-[0.6875rem] text-base-content/60">· Outside {universeLabel}</span>
        {/if}
        <button
          type="button"
          class="ml-0.5 text-sm leading-none"
          aria-label="Clear ticker search"
          onclick={onClearSearch}>×</button
        >
      </span>
    {/if}
  </div>

  {#if listNote}
    <span class="basis-full text-xs text-base-content/70">{listNote}</span>
  {/if}
</div>
