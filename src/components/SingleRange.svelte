<script lang="ts">
  import { Slider } from 'bits-ui';
  import InfoTip from './InfoTip.svelte';

  let {
    value,
    min,
    max,
    step = 1,
    label,
    info,
    format = (v: number) => String(v),
    onChange,
  }: {
    value: number;
    min: number;
    max: number;
    step?: number;
    label: string;
    info?: string;
    format?: (value: number) => string;
    onChange: (value: number) => void;
  } = $props();
</script>

<div>
  <div class="mb-1 flex items-center justify-between gap-2">
    <span class="flex items-center gap-1">
      <span class="text-xs font-medium">{label}</span>
      {#if info}<InfoTip {label} text={info} />{/if}
    </span>
    <span class="range-value">{format(value)}</span>
  </div>
  <Slider.Root
    type="single"
    {min}
    {max}
    {step}
    {value}
    onValueChange={(next) => {
      if (typeof next === 'number' && next !== value) onChange(next);
    }}
    class="relative flex h-6 w-full touch-none items-center select-none"
  >
    <span class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-base-300">
      <Slider.Range class="strategy-range absolute h-full" />
    </span>
    <Slider.Thumb
      index={0}
      aria-label={label}
      class="strategy-thumb block size-4 cursor-pointer rounded-full border-2 bg-base-100 shadow transition-transform data-[active]:scale-110"
    />
  </Slider.Root>
</div>
