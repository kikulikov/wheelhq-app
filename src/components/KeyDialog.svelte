<script lang="ts">
  let {
    open,
    hasKey,
    remember,
    busy,
    message,
    onClose,
    onSave,
    onRemove,
  }: {
    open: boolean;
    hasKey: boolean;
    remember: boolean;
    busy: boolean;
    message: string;
    onClose: () => void;
    onSave: (keyId: string, secret: string, remember: boolean) => void;
    onRemove: () => void;
  } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let keyId = $state('');
  let secret = $state('');
  let rememberKey = $state(false);

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>('input[placeholder="PK…"]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  });

  $effect(() => {
    if (open) {
      keyId = '';
      secret = '';
      rememberKey = remember;
    }
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    onSave(keyId.trim(), secret.trim(), rememberKey);
  }
</script>

<dialog
  bind:this={dialog}
  class="modal"
  aria-labelledby="key-title"
  aria-describedby="key-intro"
  onclose={onClose}
  oncancel={onClose}
>
  <div class="modal-box max-h-[90vh] max-w-xl overflow-y-auto">
    <h2 id="key-title" class="text-base font-semibold">Connect Alpaca market data</h2>
    <p id="key-intro" class="mt-2 text-xs leading-relaxed text-base-content/80">
      WheelHQ needs your own Alpaca key to read option chains and stock prices. There is no WheelHQ
      account. Session-only by default; the key goes only to <code>*.alpaca.markets</code>.
    </p>

    <div class="mt-3 rounded-box border border-base-300 bg-base-200/50 p-3 text-xs">
      <p class="font-medium text-base-content/80">Before you paste</p>
      <ul class="mt-1 list-disc space-y-1 pl-4 leading-relaxed text-base-content/75">
        <li>Prefer a paper-trading key. A live key can place trades if it leaks.</li>
        <li>A market-data-only key is enough for screening.</li>
        <li>
          Option quotes are <code>OPRA</code> only when the key has OPRA access; otherwise they are
          <code>indicative</code> derived quotes — not OPRA. Stock prices come from the IEX feed.
        </li>
        <li>Assets access only affects tooltip names and the optionable-membership filter.</li>
        <li>
          Free Alpaca plans have a limited request budget. A wide scan can hit the limit; WheelHQ
          pauses and asks you to wait. <a
            class="link link-primary"
            href="https://alpaca.markets/data"
            target="_blank"
            rel="noopener">Compare Alpaca’s data plans</a
          > if you screen often.
        </li>
      </ul>
      <a
        class="mt-1 inline-block link link-primary"
        href="https://app.alpaca.markets/keys"
        target="_blank"
        rel="noopener">Where to create a key</a
      >
    </div>

    {#if remember}
      <p class="mt-2 text-xs text-base-content/70">This key is remembered on this device.</p>
    {/if}

    <form class="mt-4 flex flex-col gap-3" onsubmit={submit}>
      <label class="form-control">
        <span class="label-text text-xs text-base-content/80">Key ID</span>
        <input
          class="input-bordered input input-sm"
          bind:value={keyId}
          autocomplete="off"
          spellcheck="false"
          placeholder="PK…"
        />
      </label>
      <label class="form-control">
        <span class="label-text text-xs text-base-content/80">Secret</span>
        <input
          class="input-bordered input input-sm"
          type="password"
          bind:value={secret}
          autocomplete="off"
        />
      </label>
      <label class="label cursor-pointer justify-start gap-2">
        <input
          class="checkbox checkbox-sm checkbox-primary"
          type="checkbox"
          bind:checked={rememberKey}
        />
        <span class="label-text text-xs text-base-content/80">
          Keep this key on this device after I close the tab
        </span>
      </label>
      <p class="-mt-2 text-xs leading-relaxed text-base-content/70">
        Stored in this browser’s local storage. Leave off for session-only.
      </p>
      {#if message}<p class="text-xs" class:text-error={!busy} role="status" aria-live="polite">
          {message}
        </p>{/if}
      <div class="modal-action">
        <button type="submit" class="btn btn-primary btn-sm" disabled={busy}
          >{busy ? 'Testing…' : 'Test & save'}</button
        >
        {#if hasKey}<button type="button" class="btn btn-ghost btn-sm" onclick={onRemove}
            >Remove</button
          >{/if}
        <button type="button" class="btn btn-ghost btn-sm" onclick={onClose}>Close</button>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop"><button onclick={onClose}>close</button></form>
</dialog>
