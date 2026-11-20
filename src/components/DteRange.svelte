<script lang="ts">
  import DualRange from './DualRange.svelte';
  import InfoTip from './InfoTip.svelte';
  import { MAX_DTE } from '../lib/config';
  import { dteToPos, posToDte } from '../lib/domain';

  let {
    minDte,
    maxDte,
    onChange,
    onCommit,
  }: {
    minDte: number;
    maxDte: number;
    onChange: (min: number, max: number) => void;
    onCommit?: (min: number, max: number) => void;
  } = $props();

  const DTE_POS_MAX = 1000;

  const positions: [number, number] = $derived([dteToPos(minDte), dteToPos(maxDte)]);
  const dayText = (days: number) => `${days} day${days === 1 ? '' : 's'}`;

  function apply(min: number, max: number) {
    const clampedMin = Math.max(0, Math.min(max, min));
    const clampedMax = Math.min(MAX_DTE, Math.max(clampedMin, max));
    if (clampedMin === minDte && clampedMax === maxDte) return;
    onChange(clampedMin, clampedMax);
    onCommit?.(clampedMin, clampedMax);
  }

  function handleKey(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    const thumb = target?.closest<HTMLElement>('[role="slider"]');
    if (!thumb) return;
    const isMin = thumb.getAttribute('aria-label')?.startsWith('Minimum') ?? false;
    const current = isMin ? minDte : maxDte;
    const step = event.shiftKey ? 7 : 1;
    let next: number;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = current - step;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = current + step;
        break;
      case 'PageDown':
        next = current - 10;
        break;
      case 'PageUp':
        next = current + 10;
        break;
      case 'Home':
        next = isMin ? 0 : minDte;
        break;
      case 'End':
        next = isMin ? maxDte : MAX_DTE;
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (isMin) apply(Math.min(next, maxDte), maxDte);
    else apply(minDte, Math.max(next, minDte));
  }
</script>

<div onkeydowncapture={handleKey}>
  <div class="mb-1 flex items-center justify-between gap-2">
    <span class="flex items-center gap-1">
      <span class="text-xs font-medium">DTE range</span>
      <InfoTip label="DTE range" text="Days to expiration range." />
    </span>
    <span class="range-value">{minDte}–{maxDte}d</span>
  </div>
  <DualRange
    value={positions}
    min={0}
    max={DTE_POS_MAX}
    step={1}
    minLabel="Minimum DTE in days"
    maxLabel="Maximum DTE in days"
    minValueText={dayText(minDte)}
    maxValueText={dayText(maxDte)}
    onChange={(value) => onChange(posToDte(value[0]), posToDte(value[1]))}
    onCommit={(value) => onCommit?.(posToDte(value[0]), posToDte(value[1]))}
  />
</div>
