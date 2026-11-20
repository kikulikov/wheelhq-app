<script lang="ts">
  let {
    open,
    url,
    onClose,
  }: {
    open: boolean;
    url: string;
    onClose: () => void;
  } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let urlInput = $state<HTMLInputElement | null>(null);
  let copied = $state(false);
  let failed = $state(false);

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) {
      copied = false;
      failed = false;
    }
  });

  async function copy() {
    failed = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      urlInput?.select();
      copied = false;
      failed = true;
    }
  }
</script>

<dialog
  class="modal"
  aria-labelledby="share-title"
  onclose={onClose}
  oncancel={onClose}
  bind:this={dialog}
>
  <div class="modal-box">
    <h2 id="share-title" class="text-base font-semibold">Share screen</h2>
    <p class="mt-2 text-xs leading-relaxed text-base-content/70">
      Anyone with this link can view this screening configuration. It contains the universe and
      filters only — never your Alpaca key. Each viewer screens with their own key, so results
      depend on their data access and market conditions.
    </p>
    <div class="mt-4 flex items-center gap-2">
      <input
        bind:this={urlInput}
        class="input-bordered input w-full font-mono input-sm"
        aria-label="Shareable screen URL"
        readonly
        value={url}
        onfocus={(event) => event.currentTarget.select()}
      />
      <button type="button" class="btn btn-primary btn-sm" onclick={copy}>
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
    {#if failed}
      <p class="mt-2 text-xs text-warning">
        The browser blocked clipboard access — the link is selected, copy it manually.
      </p>
    {/if}
    <div class="modal-action">
      <button type="button" class="btn btn-ghost btn-sm" onclick={onClose}>Close</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button onclick={onClose}>close</button></form>
</dialog>
