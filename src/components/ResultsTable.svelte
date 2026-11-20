<script lang="ts">
  import type { AssetInfo, Computed, Row, SortState } from '../lib/types';
  import { tradingViewUrl } from '../lib/domain';
  import { fmt2, fmtK, pct1, priceText, signedPct, signedPts, cashRequired } from '../lib/format';
  import { expiryText } from '../lib/date';
  import { dividendTooltip, dividendsForRow, nextDividend } from '../lib/dividends';
  import type { Dividend } from '../lib/dividends';
  import { earningsTooltip } from '../lib/earnings';
  import type { EarningsEvent } from '../lib/types';

  let {
    items,
    columns,
    sort,
    emptyReason,
    loading = false,
    assetBySymbol,
    assetByRoot,
    dividendBySymbol,
    today,
    onSort,
    onExclude,
  }: {
    items: { row: Row; c: Computed; earning: EarningsEvent | null }[];
    columns: { key: string; label: string }[];
    sort: SortState;
    emptyReason: string;
    loading?: boolean;
    assetBySymbol: Record<string, AssetInfo>;
    assetByRoot: Record<string, AssetInfo>;
    dividendBySymbol: Record<string, Dividend[]>;
    today: string;
    onSort: (key: string) => void;
    onExclude: (symbol: string) => void;
  } = $props();

  const assetInfo = (symbol: string): AssetInfo | undefined =>
    assetBySymbol[symbol] || assetByRoot[symbol.replace(/[^A-Z0-9]/g, '')];

  interface TipState {
    visible: boolean;
    contract: string;
    x: number;
    y: number;
    name: string;
    exchange: string;
    price: number | null;
    priceTime: string;
    change: number | null;
    changePts: number | null;
    anchor?: DOMRect;
  }

  let tip = $state<TipState | null>(null);
  let tipElement = $state<HTMLDivElement | null>(null);
  let markerTip = $state<{ lines: string[]; x: number; y: number; anchor?: DOMRect } | null>(null);
  let markerTipElement = $state<HTMLDivElement | null>(null);
  let copyStatus = $state('');

  async function copyContract(row: Row) {
    try {
      await navigator.clipboard.writeText(row.contract);
      copyStatus = `Copied ${row.contract}`;
    } catch {
      copyStatus = `Could not copy ${row.contract}`;
    }
  }

  function hideTip() {
    tip = null;
  }

  function hideMarkerTip() {
    markerTip = null;
  }

  function placeTooltip(anchor: DOMRect, element: HTMLElement): { x: number; y: number } {
    const size = element.getBoundingClientRect();
    let left = anchor.left + anchor.width / 2 - size.width / 2;
    let top = anchor.top - size.height - 8;
    if (top < 8) top = anchor.bottom + 8;
    left = Math.max(8, Math.min(left, window.innerWidth - size.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - size.height - 8));
    return { x: Math.round(left), y: Math.round(top) };
  }

  function positionTip() {
    if (!tip || !tipElement || !tip.anchor) return;
    const { x, y } = placeTooltip(tip.anchor, tipElement);
    tip.x = x;
    tip.y = y;
  }

  function positionMarkerTip() {
    if (!markerTip || !markerTipElement || !markerTip.anchor) return;
    const { x, y } = placeTooltip(markerTip.anchor, markerTipElement);
    markerTip.x = x;
    markerTip.y = y;
  }

  function showMarkerTip(event: MouseEvent | FocusEvent, lines: string[]) {
    const anchor = (event.currentTarget as HTMLElement).getBoundingClientRect();
    markerTip = { lines, x: 0, y: 0, anchor };
    requestAnimationFrame(positionMarkerTip);
  }

  function showTip(event: MouseEvent | FocusEvent, row: Row, info: AssetInfo | undefined) {
    const anchor = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const state: TipState & { anchor: DOMRect } = {
      visible: true,
      contract: row.contract,
      x: 0,
      y: 0,
      name: info?.name || row.symbol,
      exchange: info?.exchange || 'Exchange unavailable',
      price: row.price,
      priceTime: row.priceTime ? asOfText(row.priceTime) : '',
      change: row.change,
      changePts: row.changePts,
      anchor,
    };
    tip = state;
    requestAnimationFrame(positionTip);
  }

  function asOfText(time: string): string {
    const date = new Date(time);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    if (sort.key !== key) return 'none';
    return sort.dir > 0 ? 'ascending' : 'descending';
  }

  $effect(() => {
    const hide = () => {
      hideTip();
      hideMarkerTip();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('keydown', onKey);
    };
  });

  $effect(() => {
    // Track the row set so a new result closes any open tooltip.
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    items;
    hideTip();
    hideMarkerTip();
  });
</script>

<div class="table-wrap" onscroll={hideTip}>
  <table>
    <thead>
      <tr>
        {#each columns as column (column.key)}
          <th
            scope="col"
            class={column.key === 'symbol' || column.key === 'expiry' ? 'l' : ''}
            data-key={column.key}
            aria-sort={ariaSort(column.key)}
          >
            <button type="button" onclick={() => onSort(column.key)}>
              {column.label}
              {#if sort.key === column.key}
                <span aria-hidden="true">{sort.dir > 0 ? ' ↑' : ' ↓'}</span>
              {/if}
            </button>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#if items.length === 0}
        <!-- The empty state renders below the table, outside the wide scroll row. -->
      {:else}
        {#each items as { row, c, earning } (row.contract)}
          {@const info = assetInfo(row.symbol)}
          {@const equity = row.underlying || info?.symbol || row.symbol}
          {@const dividend = nextDividend(
            dividendsForRow(dividendBySymbol, row),
            today,
            row.expiry,
          )}
          {@const dividendLines = dividend ? dividendTooltip(dividend, row) : []}
          {@const earningLines = earning ? earningsTooltip(earning) : []}
          <tr>
            <td class="l">
              <div class="ticker-cell">
                <button
                  type="button"
                  class="ticker"
                  data-symbol={row.symbol}
                  aria-describedby={tip?.contract === row.contract ? 'ticker-tip' : undefined}
                  aria-label={`${row.symbol} — copy contract ${row.contract}`}
                  onmouseenter={(event) => showTip(event, row, info)}
                  onmouseleave={hideTip}
                  onfocus={(event) => showTip(event, row, info)}
                  onblur={hideTip}
                  onclick={() => copyContract(row)}><b>{row.symbol}</b></button
                >
                <span class="ticker-actions">
                  <span
                    class="badge badge-sm"
                    class:badge-secondary={row.side === 'C'}
                    class:badge-primary={row.side === 'P'}
                  >
                    {row.side === 'C' ? 'Call' : 'Put'}
                  </span>
                  <button
                    type="button"
                    class="exclude-btn"
                    title={`Exclude ${equity} from results`}
                    aria-label={`Exclude ${equity} from results`}
                    onclick={() => onExclude(equity)}>−</button
                  >
                  <a
                    class="tv-link"
                    href={tradingViewUrl(row.symbol, equity, info?.exchange)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open ${equity} on TradingView`}
                    aria-label={`Open ${equity} on TradingView`}
                  >
                    <img src="tradingview.png" alt="" width="16" height="16" decoding="async" />
                  </a>
                </span>
              </div>
            </td>
            <td class="l"
              >{expiryText(row.expiry, today)}<span class="event-slot"
                >{#if earning}<button
                    type="button"
                    class="event-mark earn"
                    class:estimated={earning.status === 'estimated'}
                    aria-label={earningLines.join(' ')}
                    onmouseenter={(event) => showMarkerTip(event, earningLines)}
                    onmouseleave={hideMarkerTip}
                    onfocus={(event) => showMarkerTip(event, earningLines)}
                    onblur={hideMarkerTip}
                    onclick={(event) => showMarkerTip(event, earningLines)}>E</button
                  >{/if}{#if dividend}<button
                    type="button"
                    class="event-mark"
                    class:estimated={dividend.estimated}
                    aria-label={dividendLines.join(' ')}
                    onmouseenter={(event) => showMarkerTip(event, dividendLines)}
                    onmouseleave={hideMarkerTip}
                    onfocus={(event) => showMarkerTip(event, dividendLines)}
                    onblur={hideMarkerTip}
                    onclick={(event) => showMarkerTip(event, dividendLines)}>D</button
                  >{/if}</span
              ></td
            >
            <td>{row.dte}</td>
            <td>
              <div>{fmt2.format(row.strike)}</div>
              <div
                class="strike-requirement"
                title={row.side === 'P'
                  ? 'Cash secured if assigned: strike × 100 shares'
                  : 'Shares required if assigned: 100 per contract'}
              >
                {row.side === 'P' ? cashRequired(row.strike) : '100 sh'}
              </div>
            </td>
            <td>{priceText(row.price)}</td>
            <td
              class:good={row.change != null && row.change > 0}
              class:bad={row.change != null && row.change < 0}
            >
              {row.change == null ? '—' : signedPct(row.change)}
            </td>
            <td
              title={row.quoteInvalid
                ? 'Quote is crossed or invalid — yield, spread, and breakeven are unavailable'
                : undefined}>{row.quoteInvalid ? '—' : fmt2.format(row.bid)}</td
            >
            <td>{pct1(c.spread)}</td>
            <td>{pct1(c.yld)}</td>
            <td>{pct1(c.ann)}</td>
            <td>{pct1(c.otm)}</td>
            <td>{row.delta == null ? '—' : row.delta.toFixed(2)}</td>
            <td>{row.iv == null ? '—' : `${Math.round(row.iv * 100)}%`}</td>
            <td>{fmtK(row.volume)}</td>
            <td>{c.be == null ? '—' : fmt2.format(c.be)}</td>
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
  {#if items.length === 0}
    <div class="table-empty">
      {loading ? 'Scanning symbols…' : emptyReason || 'No contracts match the current filters.'}
    </div>
  {/if}
</div>

{#if tip}
  {@const tone = tip.change == null || tip.change === 0 ? '' : tip.change > 0 ? 'good' : 'bad'}
  <div
    id="ticker-tip"
    bind:this={tipElement}
    class="ticker-tip"
    role="tooltip"
    style:left={`${tip.x}px`}
    style:top={`${tip.y}px`}
  >
    <div class="tip-name">{tip.name}</div>
    <div class="tip-exchange">{tip.exchange}</div>
    <div class="tip-figures">
      <span class="tip-price" class:good={tone === 'good'} class:bad={tone === 'bad'}
        >{priceText(tip.price)}</span
      >
      <span class="tip-change" class:good={tone === 'good'} class:bad={tone === 'bad'}>
        {signedPts(tip.changePts)} ({signedPct(tip.change)})
      </span>
    </div>
    {#if tip.priceTime}
      <div class="tip-exchange">Price as of {tip.priceTime} · IEX</div>
    {/if}
    <div class="tip-contract">{tip.contract}</div>
    <div class="tip-hint">Click the ticker to copy the OCC symbol</div>
  </div>
{/if}

<span class="sr-only" role="status" aria-live="polite" aria-label="Copy status">{copyStatus}</span>

{#if markerTip}
  <div
    bind:this={markerTipElement}
    class="ticker-tip marker-tip"
    role="tooltip"
    style:left={`${markerTip.x}px`}
    style:top={`${markerTip.y}px`}
  >
    {#each markerTip.lines as line, index (index)}<div>{line}</div>{/each}
  </div>
{/if}
