<script lang="ts">
  import { tick } from 'svelte';
  import Icon from './Icon.svelte';
  import { AUTO_REFRESH_OPTIONS, autoRefreshLabel, autoRefreshShort } from '../lib/refresh';
  import type { AutoRefreshMinutes } from '../lib/refresh';

  let {
    loading,
    minutes,
    onRefresh,
    onChange,
  }: {
    loading: boolean;
    minutes: AutoRefreshMinutes;
    onRefresh: () => void;
    onChange: (minutes: AutoRefreshMinutes) => void;
  } = $props();

  let open = $state(false);
  let root = $state<HTMLDivElement | null>(null);
  let trigger = $state<HTMLButtonElement | null>(null);
  let menu = $state<HTMLDivElement | null>(null);

  const label = $derived(autoRefreshLabel(minutes));
  const short = $derived(autoRefreshShort(minutes));

  function close({ focusTrigger = false } = {}) {
    open = false;
    if (focusTrigger) trigger?.focus();
  }

  function choose(next: AutoRefreshMinutes) {
    open = false;
    onChange(next);
    trigger?.focus();
  }

  function onMenuKey(event: KeyboardEvent) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = [...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    const next = (index + step + items.length) % items.length;
    items[next].focus();
  }

  $effect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close({ focusTrigger: true });
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    void tick().then(() => {
      const checked = menu?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
      (checked ?? menu?.querySelector<HTMLButtonElement>('[role="menuitemradio"]'))?.focus();
    });
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  });
</script>

<div class="relative join" bind:this={root}>
  <button
    type="button"
    class="btn join-item gap-1.5 btn-neutral btn-sm"
    disabled={loading}
    onclick={() => {
      open = false;
      onRefresh();
    }}
  >
    <Icon name="refresh" class={loading ? 'animate-spin motion-reduce:animate-none' : ''} />
    <span>{loading ? 'Loading…' : 'Refresh'}</span>
  </button>
  <button
    bind:this={trigger}
    type="button"
    class="btn join-item gap-1 px-2 btn-neutral btn-sm"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label={`Auto-refresh: ${label}`}
    title={`Auto-refresh: ${label}`}
    onclick={() => (open = !open)}
  >
    <span class="text-[0.6875rem] font-medium">{short}</span>
    <span aria-hidden="true" class="text-[0.625rem]">▾</span>
  </button>

  {#if open}
    <div
      bind:this={menu}
      class="absolute top-full right-0 z-50 mt-1 w-36 rounded-box border border-base-300 bg-base-100 p-1 shadow-lg"
      role="menu"
      aria-label="Auto-refresh interval"
      tabindex="-1"
      onkeydown={onMenuKey}
    >
      {#each AUTO_REFRESH_OPTIONS as option (option)}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={minutes === option}
          class="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-base-200 focus-visible:bg-base-200 focus-visible:outline-none"
          onclick={() => choose(option)}
        >
          <span>{autoRefreshLabel(option)}</span>
          {#if minutes === option}<span aria-hidden="true">✓</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
