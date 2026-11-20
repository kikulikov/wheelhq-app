<script lang="ts">
  import Icon from './Icon.svelte';

  let {
    status,
    statusTone,
    provider,
    updatedAt,
    indexNote,
    earningsNote,
    error,
  }: {
    status: string;
    statusTone: 'error' | 'warning' | 'success' | 'ghost';
    provider: string;
    updatedAt: string;
    indexNote: string;
    earningsNote: string;
    error: string;
  } = $props();
</script>

<details class="dropdown dropdown-end">
  <!-- svelte-ignore a11y_no_redundant_roles -->
  <summary
    class="btn gap-2 btn-ghost btn-sm"
    role="button"
    aria-label={`Data and API status: ${status}`}
  >
    <span class="flex flex-wrap items-center gap-2">
      {#if updatedAt}<span class="text-xs text-base-content/70">Last refreshed {updatedAt}</span
        >{/if}
      {#if statusTone === 'warning'}
        <span
          data-tone="warning"
          class="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-base-content"
        >
          <Icon name="alert" size="sm" class="text-warning" />
          {status}
        </span>
      {:else if statusTone === 'error'}
        <span
          data-tone="error"
          class="inline-flex items-center gap-1 rounded-full border border-error/30 bg-error/10 px-2 py-0.5 text-xs font-medium text-base-content"
        >
          <Icon name="alert" size="sm" class="text-error" />
          {status}
        </span>
      {:else if statusTone === 'success'}
        <span class="inline-flex items-center gap-1.5 text-xs font-medium">
          <span class="size-2 rounded-full bg-success" aria-hidden="true"></span>
          {status}
        </span>
      {:else}
        <span class="inline-flex items-center gap-1.5 text-xs font-medium text-base-content/70">
          <span class="size-2 rounded-full bg-base-content/30" aria-hidden="true"></span>
          {status}
        </span>
      {/if}
    </span>
  </summary>
  <div
    class="dropdown-content z-50 mt-1 w-80 rounded-box border border-base-300 bg-base-100 p-3 shadow-lg"
  >
    <div class="flex flex-col gap-2 text-xs">
      <div class="flex items-center justify-between gap-3">
        <span class="text-base-content/70">Provider</span>
        <span class="font-medium">{provider}</span>
      </div>
      <p class="text-[0.6875rem] leading-relaxed text-base-content/60">
        Option quotes are derived unless your API key has OPRA access. Stock prices use IEX, not the
        consolidated tape.
      </p>
      <div class="flex items-center justify-between gap-3">
        <span class="text-base-content/70">Last refreshed</span>
        <span class="font-medium">{updatedAt || 'Not yet'}</span>
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-base-content/70">Index data</span>
        <span class="font-medium">{indexNote || 'Unavailable'}</span>
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-base-content/70">Earnings data</span>
        <span class="font-medium">{earningsNote || 'Unavailable'}</span>
      </div>

      {#if error}
        <p class="rounded-box border border-error/30 bg-error/10 p-2 leading-relaxed">{error}</p>
      {/if}
    </div>
  </div>
</details>
