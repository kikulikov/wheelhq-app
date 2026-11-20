<script lang="ts">
  let { label, text }: { label: string; text: string } = $props();

  const WIDTH = 224;
  const MARGIN = 8;
  const ESTIMATED_HEIGHT = 72;

  let open = $state(false);
  let button = $state<HTMLButtonElement | null>(null);
  let left = $state(0);
  let top = $state(0);

  function place() {
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const container = button.closest('aside')?.getBoundingClientRect();
    const minLeft = (container?.left ?? 0) + MARGIN;
    const maxLeft = (container?.right ?? window.innerWidth) - WIDTH - MARGIN;
    left = Math.min(Math.max(rect.left + 16, minLeft), Math.max(minLeft, maxLeft));
    top = Math.min(
      Math.max(rect.top + rect.height / 2 - ESTIMATED_HEIGHT / 2, MARGIN),
      window.innerHeight - ESTIMATED_HEIGHT - MARGIN,
    );
  }

  function show() {
    place();
    open = true;
  }

  function hide() {
    open = false;
  }

  function onClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }
</script>

<span class="relative inline-flex">
  <button
    bind:this={button}
    type="button"
    class="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-base-300 text-[0.6875rem] leading-none font-semibold text-base-content/60 hover:border-primary hover:text-primary focus-visible:rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    aria-label={`${label}: ${text}`}
    onmouseenter={show}
    onmouseleave={hide}
    onfocus={show}
    onblur={hide}
    onclick={onClick}>?</button
  >
  {#if open}
    <span
      role="tooltip"
      class="pointer-events-none fixed z-50 w-56 rounded-box border border-base-300 bg-base-100 p-2 text-left text-xs leading-snug font-normal tracking-normal text-base-content normal-case shadow-lg"
      style:left={`${left}px`}
      style:top={`${top}px`}>{text}</span
    >
  {/if}
</span>
