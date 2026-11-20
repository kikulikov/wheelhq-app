<script lang="ts">
  let {
    page,
    pageCount,
    label = 'Results pages',
    onPage,
  }: {
    page: number;
    pageCount: number;
    label?: string;
    onPage: (page: number) => void;
  } = $props();
</script>

{#if pageCount > 1}
  <nav class="flex items-center justify-between gap-2 py-2" aria-label={label}>
    <button
      type="button"
      class="btn btn-ghost btn-xs"
      aria-label="Previous page"
      disabled={page <= 1}
      onclick={() => onPage(page - 1)}>‹ Previous</button
    >
    <span class="text-xs text-base-content/70">Page {page} of {pageCount}</span>
    <button
      type="button"
      class="btn btn-ghost btn-xs"
      aria-label="Next page"
      disabled={page >= pageCount}
      onclick={() => onPage(page + 1)}>Next ›</button
    >
  </nav>
{/if}
