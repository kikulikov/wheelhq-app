<script lang="ts">
  import {
    EXPIRATIONS,
    FILTER_LIMITS,
    MAX_ABS_DELTA,
    PRICE_BUCKETS,
    RISK_PROFILES,
    STRATEGIES,
  } from '../lib/config';
  import type { Filters, StrategyKey } from '../lib/types';
  import { store } from '../lib/storage';
  import DteRange from './DteRange.svelte';
  import DualRange from './DualRange.svelte';
  import InfoTip from './InfoTip.svelte';
  import SingleRange from './SingleRange.svelte';

  let fineTuneOpen = $state(store.getSession('fineTuneOpen', true));

  function toggleFineTune(event: MouseEvent) {
    event.preventDefault();
    fineTuneOpen = !fineTuneOpen;
    store.setSession('fineTuneOpen', fineTuneOpen);
  }

  let {
    strategy,
    riskKey,
    expiryKey,
    filters,
    sectorOptions,
    priceEnabled,
    onStrategyChange,
    onRiskChange,
    onExpiryChange,
    onUpdate,
    onDteChange,
    onDteCommit,
    onDeltaChange,
  }: {
    strategy: StrategyKey;
    riskKey: string;
    expiryKey: string;
    filters: Filters;
    sectorOptions: { key: string; label: string }[];
    priceEnabled: boolean;
    onStrategyChange: (strategy: StrategyKey) => void;
    onRiskChange: (risk: string) => void;
    onExpiryChange: (expiry: string) => void;
    onUpdate: (patch: Partial<Filters>) => void;
    onDteChange: (min: number, max: number) => void;
    onDteCommit: () => void;
    onDeltaChange: (min: number, max: number) => void;
  } = $props();
</script>

<aside
  class="flex w-full flex-col gap-4 border-b border-base-300 bg-base-100 p-4 lg:sticky lg:top-0 lg:max-h-screen lg:w-[21.25rem] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0"
>
  <div>
    <div
      class="mb-1 flex items-center gap-1 text-[0.6875rem] font-semibold tracking-wide text-base-content/70 uppercase"
    >
      <span>Strategy</span>
      <InfoTip label="Strategy" text="CSP sells puts; CC sells calls against shares you own." />
    </div>
    <div class="grid w-full grid-cols-2 gap-1">
      {#each Object.entries(STRATEGIES) as [key, value] (key)}
        <button
          type="button"
          class="btn border btn-sm"
          class:border-base-300={strategy !== key}
          class:btn-primary={strategy === key && key === 'csp'}
          class:btn-secondary={strategy === key && key === 'cc'}
          class:btn-ghost={strategy !== key}
          aria-pressed={strategy === key}
          aria-label={`${value.label}: ${value.description}`}
          title={value.description}
          onclick={() => onStrategyChange(key as StrategyKey)}>{value.label}</button
        >
      {/each}
    </div>
  </div>

  <div>
    <div
      class="mb-1.5 flex items-center gap-1 text-[0.6875rem] font-semibold tracking-wide text-base-content/70 uppercase"
    >
      <span>Sector</span>
      <InfoTip label="Sector" text="Limit the scan to one sector." />
    </div>
    <select
      class="select-bordered select w-full select-sm"
      aria-label="Sector"
      value={filters.sector}
      onchange={(event) => onUpdate({ sector: event.currentTarget.value })}
    >
      {#each sectorOptions as option (option.key)}
        <option value={option.key}>{option.label}</option>
      {/each}
    </select>
  </div>

  <div>
    <div
      class="mb-1.5 flex items-center gap-1 text-[0.6875rem] font-semibold tracking-wide text-base-content/70 uppercase"
    >
      <span>Risk profile</span>
      <InfoTip
        label="Risk profile"
        text="Preset delta, yield and spread ranges; fine-tune any value to override."
      />
    </div>
    <div class="grid w-full grid-cols-3 gap-1">
      {#each Object.entries(RISK_PROFILES) as [key, profile] (key)}
        <button
          type="button"
          class="btn border px-1 text-xs btn-sm"
          class:border-base-300={riskKey !== key}
          class:btn-primary={riskKey === key && strategy === 'csp'}
          class:btn-secondary={riskKey === key && strategy === 'cc'}
          class:btn-ghost={riskKey !== key}
          aria-pressed={riskKey === key}
          onclick={() => onRiskChange(key)}>{profile.label}</button
        >
      {/each}
    </div>
  </div>

  <div>
    <div
      class="mb-1.5 flex items-center gap-1 text-[0.6875rem] font-semibold tracking-wide text-base-content/70 uppercase"
    >
      <span>Expiration</span>
      <InfoTip label="Expiration" text="Contracts expiring in this window; Today means 0DTE." />
    </div>
    <div class="grid w-full grid-cols-6 gap-1">
      {#each Object.entries(EXPIRATIONS) as [key, expiry], index (key)}
        <button
          type="button"
          class="btn border px-1 text-[0.6875rem] leading-tight whitespace-normal btn-sm"
          class:col-span-2={index < 3}
          class:col-span-3={index >= 3}
          class:border-base-300={expiryKey !== key}
          class:btn-primary={expiryKey === key && strategy === 'csp'}
          class:btn-secondary={expiryKey === key && strategy === 'cc'}
          class:btn-ghost={expiryKey !== key}
          aria-pressed={expiryKey === key}
          onclick={() => onExpiryChange(key)}>{expiry.label}</button
        >
      {/each}
    </div>
  </div>

  <div>
    <div
      class="mb-1.5 flex items-center gap-1 text-[0.6875rem] font-semibold tracking-wide text-base-content/70 uppercase"
    >
      <span>Share price bucket</span>
      <InfoTip
        label="Share price bucket"
        text="Only stocks in this price range. Not applicable to saved lists; all share prices are included."
      />
    </div>
    <div class="grid w-full grid-cols-4 gap-1">
      {#each PRICE_BUCKETS as bucket (bucket.key)}
        <button
          type="button"
          class="btn border px-1 text-xs whitespace-nowrap btn-sm"
          class:border-base-300={filters.minPrice !== bucket.minPrice ||
            filters.maxPrice !== bucket.maxPrice}
          class:btn-primary={strategy === 'csp' &&
            filters.minPrice === bucket.minPrice &&
            filters.maxPrice === bucket.maxPrice}
          class:btn-secondary={strategy === 'cc' &&
            filters.minPrice === bucket.minPrice &&
            filters.maxPrice === bucket.maxPrice}
          class:btn-ghost={filters.minPrice !== bucket.minPrice ||
            filters.maxPrice !== bucket.maxPrice}
          aria-pressed={filters.minPrice === bucket.minPrice &&
            filters.maxPrice === bucket.maxPrice}
          disabled={!priceEnabled}
          title={priceEnabled ? undefined : 'Saved lists scan every price'}
          onclick={() => onUpdate({ minPrice: bucket.minPrice, maxPrice: bucket.maxPrice })}
          >{bucket.label}</button
        >
      {/each}
    </div>
  </div>

  <details bind:open={fineTuneOpen}>
    <summary
      class="flex cursor-pointer list-none items-center justify-between gap-2 text-[0.6875rem] font-semibold tracking-wide text-base-content/70 uppercase"
      onclick={toggleFineTune}
    >
      <span class="flex items-center gap-1">
        <span>Fine-tune</span>
        <InfoTip
          label="Fine-tune"
          text="Narrow the active preset; the preset chip stays the baseline."
        />
      </span>
      <span class="text-xs transition-transform" class:rotate-180={fineTuneOpen} aria-hidden="true"
        >⌄</span
      >
    </summary>
    <div class="flex flex-col gap-3 pt-3">
      <div>
        <div class="mb-1 flex items-center justify-between gap-2">
          <span class="flex items-center gap-1">
            <span class="text-xs font-medium">Delta |Δ|</span>
            <InfoTip
              label="Delta"
              text="Absolute delta range; lower delta is further out of the money."
            />
          </span>
          <span class="range-value"
            >{filters.minDelta.toFixed(2)}–{filters.maxDelta.toFixed(2)}</span
          >
        </div>
        <DualRange
          value={[filters.minDelta, filters.maxDelta]}
          min={0}
          max={MAX_ABS_DELTA}
          step={0.01}
          minLabel="Minimum absolute delta"
          maxLabel="Maximum absolute delta"
          onChange={(value) => onDeltaChange(value[0], value[1])}
        />
      </div>
      <DteRange
        minDte={filters.minDte}
        maxDte={filters.maxDte}
        onChange={onDteChange}
        onCommit={onDteCommit}
      />
      <SingleRange
        label="Max IV %"
        info="Hide contracts above this implied volatility; off means no limit."
        value={filters.maxIv}
        min={FILTER_LIMITS.maxIv.min}
        max={FILTER_LIMITS.maxIv.max}
        step={FILTER_LIMITS.maxIv.step}
        format={(value) => (value > 0 ? `≤ ${value}%` : 'off')}
        onChange={(value) => onUpdate({ maxIv: value })}
      />
      <SingleRange
        label="Min yield %"
        info="Minimum premium yield; off means no minimum."
        value={filters.minYield}
        min={FILTER_LIMITS.minYield.min}
        max={FILTER_LIMITS.minYield.max}
        step={FILTER_LIMITS.minYield.step}
        format={(value) => (value > 0 ? `≥ ${value}%` : 'off')}
        onChange={(value) => onUpdate({ minYield: value })}
      />
      <SingleRange
        label="Annualised yield"
        info="Minimum annualised return: yield × 365 ÷ DTE."
        value={filters.minAnn}
        min={FILTER_LIMITS.minAnn.min}
        max={FILTER_LIMITS.minAnn.max}
        step={FILTER_LIMITS.minAnn.step}
        format={(value) => (value > 0 ? `≥ ${value}%` : 'off')}
        onChange={(value) => onUpdate({ minAnn: value })}
      />
      <SingleRange
        label="Max spread %"
        info="Maximum bid-ask spread as a percent of mid."
        value={filters.maxSpread}
        min={FILTER_LIMITS.maxSpread.min}
        max={FILTER_LIMITS.maxSpread.max}
        step={FILTER_LIMITS.maxSpread.step}
        format={(value) => (value > 0 ? `≤ ${value}%` : 'off')}
        onChange={(value) => onUpdate({ maxSpread: value })}
      />
    </div>
  </details>

  <div class="flex flex-col gap-2">
    <div class="text-[0.6875rem] font-semibold tracking-wide text-base-content/70 uppercase">
      Event exclusions
    </div>
    <div class="flex items-center gap-1.5 text-xs">
      <input
        id="avoid-earnings"
        type="checkbox"
        class="checkbox checkbox-sm"
        checked={filters.avoidEarnings}
        onchange={() => onUpdate({ avoidEarnings: !filters.avoidEarnings })}
      />
      <label for="avoid-earnings" class="font-medium">Avoid earnings</label>
      <InfoTip
        label="Avoid earnings"
        text="Hide contracts whose expiry spans an expected or estimated earnings date."
      />
    </div>
    <div class="flex items-center gap-1.5 text-xs">
      <input
        id="avoid-dividends"
        type="checkbox"
        class="checkbox checkbox-sm"
        checked={filters.avoidDividends}
        onchange={() => onUpdate({ avoidDividends: !filters.avoidDividends })}
      />
      <label for="avoid-dividends" class="font-medium">Avoid dividends</label>
      <InfoTip
        label="Avoid dividends"
        text="Hide contracts whose expiry spans an expected or estimated ex-dividend date."
      />
    </div>
  </div>
</aside>

<style>
  summary {
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }
</style>
