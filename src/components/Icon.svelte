<script lang="ts">
  type IconName = 'share' | 'refresh' | 'search' | 'cup' | 'alert' | 'filter' | 'github';

  let {
    name,
    class: className = '',
    size = 'md',
  }: {
    name: IconName;
    class?: string;
    size?: 'sm' | 'md';
  } = $props();

  const sizeClass = $derived(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4');
</script>

<!-- Decorative only: every icon sits beside a visible text label. -->
<svg
  class="{sizeClass} shrink-0 {className}"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#if name === 'share'}
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  {:else if name === 'refresh'}
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  {:else if name === 'search'}
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  {:else if name === 'filter'}
    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" />
  {:else if name === 'alert'}
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  {:else if name === 'github'}
    <path
      fill="currentColor"
      stroke="none"
      d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z"
    />
  {:else if name === 'cup'}
    <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
    <path d="M6 2v2M10 2v2M14 2v2" />
  {/if}
</svg>
