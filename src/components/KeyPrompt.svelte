<script lang="ts">
  let { onAddKey }: { onAddKey: () => void } = $props();
</script>

<section
  class="rounded-box border border-base-300 bg-base-100 p-4"
  aria-labelledby="key-prompt-title"
>
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div class="max-w-2xl">
      <h2 id="key-prompt-title" class="text-base font-semibold">
        Connect Alpaca to load option chains
      </h2>
      <p class="mt-1 text-sm leading-relaxed text-base-content/80">
        WheelHQ is a screener, not a broker. It reads market data with your key and never places
        trades.
      </p>
    </div>
    <button type="button" class="btn btn-primary btn-sm" onclick={onAddKey}>
      Add Alpaca key
    </button>
  </div>

  <ol class="mt-3 grid gap-2 text-sm sm:grid-cols-3">
    <li class="flex gap-2">
      <span class="badge badge-ghost badge-sm">1</span>
      <span>Create a free Alpaca account.</span>
    </li>
    <li class="flex gap-2">
      <span class="badge badge-ghost badge-sm">2</span>
      <span>Create a paper-trading key or a market-data-only key.</span>
    </li>
    <li class="flex gap-2">
      <span class="badge badge-ghost badge-sm">3</span>
      <span>Paste the Key ID and Secret here.</span>
    </li>
  </ol>

  <p class="mt-3 text-xs leading-relaxed text-base-content/70">
    Session-only by default. Tick “Keep this key on this device” to keep it after the tab closes.
    Requests go only to Alpaca.
    <a class="link link-primary" href="/about/#keys">How keys work</a>
  </p>
</section>
