<script lang="ts">
  import { Slider } from 'bits-ui';

  let {
    value,
    min,
    max,
    step = 1,
    minLabel = 'Minimum',
    maxLabel = 'Maximum',
    minValueText,
    maxValueText,
    onChange,
    onCommit,
  }: {
    value: [number, number];
    min: number;
    max: number;
    step?: number;
    minLabel?: string;
    maxLabel?: string;
    minValueText?: string;
    maxValueText?: string;
    onChange: (value: [number, number]) => void;
    onCommit?: (value: [number, number]) => void;
  } = $props();

  function asPair(input: number | number[]): [number, number] {
    const values = Array.isArray(input) ? input : [min, input];
    return [values[0] ?? min, values[1] ?? max];
  }
</script>

<Slider.Root
  type="multiple"
  {min}
  {max}
  {step}
  {value}
  onValueChange={(next) => {
    const pair = asPair(next);
    if (pair[0] !== value[0] || pair[1] !== value[1]) onChange(pair);
  }}
  onValueCommit={(next) => onCommit?.(asPair(next))}
  class="relative flex h-6 w-full touch-none items-center select-none"
>
  {#snippet children({ thumbItems })}
    <span class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-base-300">
      <Slider.Range class="strategy-range absolute h-full" />
    </span>
    {#each thumbItems as { index } (index)}
      <Slider.Thumb
        {index}
        aria-label={index === 0 ? minLabel : maxLabel}
        aria-valuetext={index === 0 ? minValueText : maxValueText}
        class="strategy-thumb block size-4 cursor-pointer rounded-full border-2 bg-base-100 shadow transition-transform data-[active]:scale-110"
      />
    {/each}
  {/snippet}
</Slider.Root>
