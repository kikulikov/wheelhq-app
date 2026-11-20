<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import MarketBar from './components/MarketBar.svelte';
  import FiltersPanel from './components/FiltersPanel.svelte';
  import ResultsTable from './components/ResultsTable.svelte';
  import KeyDialog from './components/KeyDialog.svelte';
  import KeyPrompt from './components/KeyPrompt.svelte';
  import ListsDialog from './components/ListsDialog.svelte';
  import ShareDialog from './components/ShareDialog.svelte';
  import DataStatus from './components/DataStatus.svelte';
  import Pagination from './components/Pagination.svelte';
  import RefreshControl from './components/RefreshControl.svelte';
  import Icon from './components/Icon.svelte';
  import {
    BUILTIN_LIST_IDS,
    BUILTIN_LISTS,
    COLUMNS,
    DEFAULT_EXPIRY,
    DEFAULT_FILTERS,
    DEFAULT_LIST,
    EXPIRATIONS,
    MARKET_LIST_IDS,
    PRICE_MAX,
    RISK_PROFILES,
    STRATEGIES,
  } from './lib/config';
  import {
    applyFilterPatch,
    chainScopeFor,
    chainScopeCovers,
    cleanListSymbols,
    cleanSymbols,
    computedFor,
    inPriceBucket,
    pass,
  } from './lib/domain';
  import { resolveInitialScreenState } from './lib/initialState';
  import { importLists, removeList, upsertList } from './lib/lists';
  import {
    activeSymbols,
    candidateCount,
    exactTicker,
    searchSymbols,
    sortValue,
    symbolAllowed,
  } from './lib/selection';
  import { clearDatasetCache, loadEarnings, loadIndexes } from './lib/datasets';
  import { nextEarnings } from './lib/earnings';
  import { SECTOR_ALL, sectorMatches, sectorOptions as sectorOptionsFor } from './lib/sectors';
  import {
    feedFor,
    fetchAssetMeta,
    fetchCashDividends,
    fetchStockSnapshots,
    screenSymbol,
    testKey,
  } from './lib/alpaca';
  import { fullDate, nyMinutes, todayYmd } from './lib/date';
  import { latestExpectedEarningsDate } from './lib/freshness';
  import { DIVIDEND_CACHE_VERSION, mergeDividendCache } from './lib/dividends';
  import type { DividendCache } from './lib/dividends';
  import { alertsFor } from './lib/alerts';
  import { coverageWarnings } from './lib/coverage';
  import type { DividendStatus } from './lib/coverage';
  import { connectionStatus as connectionStatusFor } from './lib/status';
  import { filterChips } from './lib/filtersSummary';
  import { keyStatus } from './lib/keyStatus';
  import { listSummary } from './lib/listSummary';
  import { paginate } from './lib/pagination';
  import { resultsSummary } from './lib/resultsSummary';
  import { rankByLiquidity } from './lib/ranking';
  import { scanSymbols } from './lib/scan';
  import {
    autoRefreshMs,
    forceInputReload,
    sanitizeAutoRefresh,
    shouldReloadAssets,
    shouldReloadAux,
  } from './lib/refresh';
  import type { AutoRefreshMinutes, RefreshReason } from './lib/refresh';
  import { buildUrl } from './lib/url';
  import {
    getKey,
    loadDividendCache,
    loadFilters,
    loadLists,
    loadWatchlist,
    onStorageFailure,
    removeKey as clearKey,
    saveDividendCache,
    saveKey as persistKey,
    saveTheme,
    store,
    uniqueListName,
  } from './lib/storage';
  import { applyTheme, nextTheme, resolveThemeChoice, type Theme } from './lib/theme';
  import type {
    AssetInfo,
    ChainScope,
    Computed,
    EarningsData,
    EarningsEvent,
    Filters,
    IndexesData,
    KeyPair,
    Row,
    SharedList,
    SortState,
    StrategyKey,
    UserList,
  } from './lib/types';

  const initialLists = loadLists();
  const {
    parsedUrl,
    filters: initialFilters,
    strategy: initialStrategy,
    risk: initialRisk,
    expiry: initialExpiry,
    list: initialList,
    sharedList: initialShared,
    sort: initialSort,
  } = resolveInitialScreenState({
    search: location.search,
    lists: initialLists,
    storedFilters: loadFilters(),
    storedStrategy: store.get<string>('strategy', 'csp'),
    storedRisk: store.get<string>('risk', ''),
    storedExpiry: store.get<string>('expiry', ''),
    storedActiveList: store.get<string>('activeList', DEFAULT_LIST),
  });

  let watchlist = $state<string[]>(loadWatchlist());
  let lists = $state<UserList[]>(initialLists);
  let activeListId = $state(initialList);
  let sharedList = $state<SharedList | null>(initialShared);
  let symbolFilter = $state(parsedUrl.q);
  let symbolQuery = $state(parsedUrl.q);
  let strategy = $state<StrategyKey>(initialStrategy);
  let riskKey = $state(initialRisk);
  let expiryKey = $state(initialExpiry);
  let filters = $state<Filters>(initialFilters);
  let excludedSymbols = $state<string[]>(parsedUrl.exclude);
  let sort = $state<SortState>(initialSort);
  let shareOpen = $state(false);
  let shareLink = $state('');
  let refreshError = $state('');

  let today = $state(todayYmd());
  let expectedEarningsDate = $state(latestExpectedEarningsDate(new Date()));
  let rows = $state<Row[]>([]);
  let scannedSymbolCount = $state(0);
  let assetBySymbol = $state.raw<Record<string, AssetInfo>>({});
  let assetByRoot = $state.raw<Record<string, AssetInfo>>({});
  let alerts = $state<string[]>([]);
  let page = $state(1);
  let scanSymbolCount = $state(0);
  let updatedAt = $state('');
  let delayed = $state(false);
  let scannedCount = $state(0);
  let succeededCount = $state(0);
  let emptyReason = $state('');
  let loading = $state(false);
  let autoMinutes = $state<AutoRefreshMinutes>(sanitizeAutoRefresh(store.get('autoRefresh', 0)));
  let lastAuxLoadAt = 0;
  let assetMetaDate = '';
  const storedTheme = store.getRaw('theme');
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const themeChoice = resolveThemeChoice(storedTheme, prefersDark);
  if (storedTheme !== null && !themeChoice.explicit) store.set('theme', null);
  let theme = $state<Theme>(themeChoice.theme);
  let followsSystem = $state(!themeChoice.explicit);
  let keyPair = $state<KeyPair | null>(getKey());
  let keyRemember = $state(!!store.get('alpacaKey', null) && !store.getSession('alpacaKey', null));
  let keyDialogOpen = $state(false);
  let keyMessage = $state('');
  let keyNotice = $state('');
  let storageWarning = $state(false);
  let filtersOpen = $state(false);
  let keyBusy = $state(false);
  let keyRequest = 0;
  onStorageFailure(() => {
    storageWarning = true;
  });
  let listsDialogOpen = $state(false);
  let listsInitialId = $state('favourites');

  let indexes = $state<IndexesData | null>(null);
  let indexesSource = $state<'remote' | 'bundled' | null>(null);
  let indexesError = $state('');
  let earnings = $state<EarningsData | null>(null);
  let earningsStatus = $state<'loading' | 'ready' | 'failed'>('loading');
  let dividendCache = $state.raw<DividendCache | null>(loadDividendCache());
  let dividendStatus = $state<DividendStatus>('loading');
  // Not read reactively; a plain Set is enough.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const dividendInFlight = new Set<string>();
  let dividendAbort: AbortController | null = null;
  let assetMetaError = $state('');
  let assetMetaKeyId: string | null = null;
  let assetMetaRetryAt = 0;
  let assetMetaRequest = 0;

  let refreshGen = 0;
  let refreshInFlight = false;
  let refreshAbort: AbortController | null = null;
  let chainScope: ChainScope | null = null;
  let chainScopeTimer: ReturnType<typeof setTimeout> | null = null;
  let stateWriteTimer: ReturnType<typeof setTimeout> | null = null;
  let stateWritePersist = false;
  let symbolFilterTimer: ReturnType<typeof setTimeout> | null = null;
  let autoTimer: ReturnType<typeof setTimeout> | null = null;

  const FILTER_DEBOUNCE_MS = 200;

  const activeList = $derived.by((): UserList | SharedList | null => {
    if (activeListId === 'all') return null;
    if (activeListId === 'favourites') {
      return { id: 'favourites', name: 'Favourites', symbols: watchlist };
    }
    if (activeListId === 'shared') return sharedList;
    return lists.find((list) => list.id === activeListId) ?? null;
  });

  const side = $derived(STRATEGIES[strategy].side);

  const universeSymbols = $derived(activeSymbols(activeListId, activeList, indexes));
  const searchPool = $derived(searchSymbols(indexes));
  const activeSearch = $derived(exactTicker(symbolQuery, searchPool));
  const searchOutsideUniverse = $derived(
    activeSearch != null && !universeSymbols.includes(activeSearch),
  );
  const universeLabel = $derived.by(() => {
    if (activeListId === 'all') return 'US Options';
    if (activeListId === 'favourites') return 'Favourites';
    if (activeListId === 'sp500') return BUILTIN_LISTS.sp500.name;
    if (activeListId === 'ndx') return BUILTIN_LISTS.ndx.name;
    return activeList?.name ?? 'US Options';
  });
  const sectorMap = $derived(indexes?.sectors ?? {});
  const earningsBySymbol = $derived(earnings?.earnings ?? {});
  const earningsContext = $derived({
    events: earningsBySymbol,
    today,
  });
  const dividendBySymbol = $derived(dividendCache?.date === today ? dividendCache.bySymbol : {});
  const dividendContext = $derived({ bySymbol: dividendBySymbol, today });
  const sectorOptions = $derived(sectorOptionsFor());
  const excludedSet = $derived(new Set(excludedSymbols));
  const usesPriceBucket = $derived(MARKET_LIST_IDS.has(activeListId));
  const effectiveFilters = $derived(
    usesPriceBucket ? filters : { ...filters, minPrice: 0, maxPrice: PRICE_MAX },
  );
  const chips = $derived(
    filterChips(filters, riskKey, expiryKey, excludedSymbols).filter(
      (chip) => usesPriceBucket || chip.key !== 'price',
    ),
  );
  const canClear = $derived(chips.some((chip) => chip.removable) || expiryKey !== DEFAULT_EXPIRY);

  const marketVisibleCount = $derived(
    candidateCount(universeSymbols, assetBySymbol, sectorMap, filters.sector),
  );

  const visible = $derived.by(() => {
    const query = symbolQuery.trim().toUpperCase();
    const output: { row: Row; c: Computed; earning: EarningsEvent | null }[] = [];
    for (const row of rows) {
      if (excludedSet.has((row.underlying ?? row.symbol).toUpperCase())) continue;
      const symbols = `${row.underlying || ''} ${row.symbol}`.toUpperCase();
      if (query && !symbols.includes(query)) continue;
      const c = computedFor(row);
      if (!pass(row, c, side, effectiveFilters, earningsContext, dividendContext)) continue;
      output.push({
        row,
        c,
        earning: nextEarnings(
          earningsContext.events,
          today,
          row.expiry,
          row.underlying ?? row.symbol,
        ),
      });
    }
    output.sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sort.dir;
      return String(av).localeCompare(String(bv)) * sort.dir;
    });
    return {
      items: output,
      count: output.length,
    };
  });

  const paged = $derived(paginate(visible.items, page));
  const hiddenStale = $derived(rows.filter((row) => row.quoteStale).length);
  const results = $derived(
    resultsSummary({
      matching: visible.count,
      page: paged.page,
      pageCount: paged.pageCount,
      start: paged.start,
      end: paged.end,
      scannedContracts: rows.length,
      scannedSymbols: scannedSymbolCount,
      scopeLabel: activeSearch,
    }),
  );

  const screenSignature = $derived(
    JSON.stringify({ filters, sort, activeListId, symbolQuery, excludedSymbols, strategy }),
  );
  let pageSignature: string | null = null;
  $effect(() => {
    const next = screenSignature;
    if (pageSignature === null) {
      pageSignature = next;
      return;
    }
    if (pageSignature === next) return;
    pageSignature = next;
    page = 1;
  });

  const liveMessage = $derived(
    loading
      ? scanSymbolCount > 0
        ? `Scanning ${scanSymbolCount} symbols`
        : 'Scanning'
      : `${results.primary}. ${results.secondary ?? ''}`,
  );

  const listNote = $derived.by(() => {
    if (activeSearch) return '';
    return listSummary({
      listId: activeListId,
      symbols: universeSymbols,
      marketCount: marketVisibleCount,
      indexesReady: !!indexes?.effectiveDate,
    });
  });

  const dataNote = $derived(
    indexes?.effectiveDate
      ? `${fullDate(indexes.effectiveDate)}${indexesSource === 'bundled' ? ' (bundled)' : ''}`
      : indexesError,
  );

  const keyInfo = $derived(keyStatus(keyPair, keyRemember));
  const keyRejected = $derived(
    /Alpaca rejected|HTTP (401|403)/i.test(refreshError) ||
      alerts.some((alert) => /Alpaca rejected|HTTP (401|403)/i.test(alert)),
  );

  const connectionStatus = $derived(
    connectionStatusFor({
      hasKey: !!keyPair,
      error: refreshError,
      loading,
      delayed,
      scanned: scannedCount,
      succeeded: succeededCount,
      updatedAt,
    }),
  );
  const coverage = $derived([
    ...coverageWarnings({
      avoidEarnings: filters.avoidEarnings,
      avoidDividends: filters.avoidDividends,
      earnings: {
        status: earningsStatus,
        effectiveDate: earnings?.effectiveDate ?? '',
        expectedDate: expectedEarningsDate,
      },
      dividends: { status: dividendStatus, date: dividendCache?.date ?? '' },
    }),
    ...(earnings?.rejected
      ? [
          `${earnings.rejected} earnings ${earnings.rejected === 1 ? 'entry was' : 'entries were'} invalid and ignored.`,
        ]
      : []),
  ]);

  function currentChainScope(): ChainScope {
    return chainScopeFor(strategy, filters);
  }

  function scheduleChainScopeRefresh() {
    if (chainScopeTimer) clearTimeout(chainScopeTimer);
    chainScopeTimer = setTimeout(() => {
      chainScopeTimer = null;
      if (!chainScopeCovers(chainScope, currentChainScope())) void refresh();
    }, 300);
  }

  function screenUrl({ freezeList = false }: { freezeList?: boolean } = {}): string {
    const list = activeList;
    const frozen = freezeList && list != null && !MARKET_LIST_IDS.has(activeListId);
    return buildUrl({
      list: frozen ? 'shared' : activeListId,
      listName: frozen ? list.name : list?.name,
      symbols: frozen
        ? list.symbols
        : list && activeListId !== 'favourites'
          ? list.symbols
          : undefined,
      q: symbolFilter,
      strategy,
      risk: riskKey,
      expiry: expiryKey,
      sortKey: sort.key,
      sortDir: sort.dir,
      filters,
      exclude: excludedSymbols,
    });
  }

  function writeURL() {
    const query = screenUrl();
    try {
      history.replaceState(null, '', query);
    } catch {
      /* history can be restricted */
    }
  }

  function openShareDialog() {
    const url = new URL(screenUrl({ freezeList: true }), window.location.href);
    shareLink = `${window.location.origin}${window.location.pathname}${url.search}`;
    shareOpen = true;
  }

  function scheduleStateWrite({ persist = false }: { persist?: boolean } = {}) {
    stateWritePersist = stateWritePersist || persist;
    if (stateWriteTimer) clearTimeout(stateWriteTimer);
    stateWriteTimer = setTimeout(() => {
      stateWriteTimer = null;
      const shouldPersist = stateWritePersist;
      stateWritePersist = false;
      if (shouldPersist) store.set('filters', filters);
      writeURL();
    }, 200);
  }

  function updateSymbolFilter(value: string) {
    symbolFilter = value;
    if (symbolFilterTimer) clearTimeout(symbolFilterTimer);
    symbolFilterTimer = setTimeout(() => {
      symbolFilterTimer = null;
      const previousSearch = activeSearch;
      symbolQuery = symbolFilter;
      writeURL();
      if (exactTicker(symbolFilter, searchPool) !== previousSearch) void refresh();
    }, FILTER_DEBOUNCE_MS);
  }

  function clearSearch() {
    if (symbolFilterTimer) {
      clearTimeout(symbolFilterTimer);
      symbolFilterTimer = null;
    }
    symbolFilter = '';
    symbolQuery = '';
    writeURL();
    void refresh();
  }

  function cancelDividends() {
    dividendAbort?.abort();
    dividendAbort = null;
  }

  async function ensureDividends(symbols: string[], key: KeyPair) {
    const cacheDate = today;
    const base: DividendCache =
      dividendCache?.date === cacheDate
        ? dividendCache
        : { version: DIVIDEND_CACHE_VERSION, date: cacheDate, bySymbol: {} };
    if (dividendCache?.date !== cacheDate) dividendCache = base;

    const missing = cleanSymbols(symbols).filter(
      (symbol) => base.bySymbol[symbol] === undefined && !dividendInFlight.has(symbol),
    );
    if (!missing.length) {
      dividendStatus = 'ready';
      return;
    }

    const controller = new AbortController();
    cancelDividends();
    dividendAbort = controller;
    dividendStatus = 'loading';
    for (const symbol of missing) dividendInFlight.add(symbol);
    try {
      const fresh = await fetchCashDividends(missing, key, controller.signal, cacheDate);
      if (controller.signal.aborted || !Object.keys(fresh.bySymbol).length) return;
      const current = dividendCache?.date === cacheDate ? dividendCache : base;
      dividendCache = mergeDividendCache(current, fresh.bySymbol);
      saveDividendCache(dividendCache);
      dividendStatus = fresh.failed.length ? 'partial' : 'ready';
    } catch {
      if (controller.signal.aborted) return;
      // Dividends are indicative only; a failure hides the badges but never
      // blocks or fails the chain screen.
      dividendStatus = 'failed';
    } finally {
      for (const symbol of missing) dividendInFlight.delete(symbol);
      if (dividendAbort === controller) dividendAbort = null;
    }
  }

  async function ensureAssetMeta(key: KeyPair | null, signal: AbortSignal | null, force = false) {
    if (!key) {
      assetMetaRequest++;
      assetMetaKeyId = null;
      assetBySymbol = {};
      assetByRoot = {};
      assetMetaError = '';
      return;
    }
    if (assetMetaKeyId !== key.keyId) {
      assetMetaKeyId = key.keyId;
      assetBySymbol = {};
      assetByRoot = {};
      assetMetaError = '';
      assetMetaRetryAt = 0;
    }
    if (!force && Object.keys(assetBySymbol).length) return;
    if (!force && assetMetaError && Date.now() < assetMetaRetryAt) return;
    const request = ++assetMetaRequest;
    try {
      const meta = await fetchAssetMeta(key, signal);
      if (assetMetaKeyId !== key.keyId || request !== assetMetaRequest) return;
      assetBySymbol = meta.bySymbol;
      assetByRoot = meta.byRoot;
      assetMetaError = '';
      assetMetaRetryAt = 0;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (assetMetaKeyId !== key.keyId || request !== assetMetaRequest) return;
      assetMetaError =
        'Asset metadata needs Alpaca assets access; list membership will not be filtered.';
      assetMetaRetryAt = Date.now() + 60_000;
    }
  }

  async function ensureIndexes(signal: AbortSignal | null, force = false) {
    if (!force && indexes && indexes.effectiveDate >= today) return;
    if (force || indexes) clearDatasetCache();
    try {
      const dataset = await loadIndexes({ signal: signal ?? undefined });
      if (signal?.aborted) return;
      indexes = dataset.data;
      indexesSource = dataset.source;
      indexesError = dataset.data.effectiveDate ? '' : 'Index data unavailable, try again later.';
    } catch (error) {
      if (signal?.aborted) throw error;
      indexesError = 'Index data unavailable, try again later.';
    }
  }

  async function ensureEarnings(signal: AbortSignal | null, force = false) {
    if (!force && earnings && earnings.effectiveDate >= today) {
      earningsStatus = 'ready';
      return;
    }
    if (force || earnings) clearDatasetCache();
    earningsStatus = 'loading';
    try {
      const dataset = await loadEarnings({ signal: signal ?? undefined });
      if (signal?.aborted) return;
      earnings = dataset.data;
      earningsStatus = dataset.data.effectiveDate ? 'ready' : 'failed';
    } catch (error) {
      if (signal?.aborted) throw error;
      /* Markers stay hidden; the coverage warning names the inactive filter. */
      earningsStatus = 'failed';
    }
  }

  async function refresh({ reason = 'scope' }: { reason?: RefreshReason } = {}) {
    const isAuto = reason === 'auto';
    if (isAuto && refreshInFlight) return;
    if (refreshAbort) refreshAbort.abort();
    const controller = new AbortController();
    refreshAbort = controller;
    const gen = ++refreshGen;
    refreshInFlight = true;
    loading = true;
    refreshError = '';
    cancelDividends();
    const scope = currentChainScope();
    if (chainScopeTimer) {
      clearTimeout(chainScopeTimer);
      chainScopeTimer = null;
    }

    today = todayYmd();
    expectedEarningsDate = latestExpectedEarningsDate(new Date());
    try {
      // Only an explicit refresh forces fresh inputs. Scope changes and auto
      // ticks reuse them under the hourly/daily cadence. The three loads are
      // independent, so start them together.
      const now = Date.now();
      const force = forceInputReload(reason);
      const reloadAux = shouldReloadAux({
        manual: force,
        lastLoadAt: lastAuxLoadAt,
        now,
      });
      const reloadAssets = shouldReloadAssets({
        manual: force,
        loadedOn: assetMetaDate,
        today,
      });
      const loads: Promise<void>[] = [];
      if (reloadAux) {
        loads.push(ensureIndexes(controller.signal, true), ensureEarnings(controller.signal, true));
      }
      if (reloadAssets) {
        loads.push(ensureAssetMeta(keyPair, controller.signal, true));
      }
      if (loads.length) {
        await Promise.all(loads);
        if (gen !== refreshGen) return;
        if (reloadAux) lastAuxLoadAt = Date.now();
        if (reloadAssets && keyPair) assetMetaDate = today;
      }

      const loaded = activeSearch
        ? [activeSearch]
        : activeSymbols(activeListId, activeList, indexes);
      const matching = loaded
        .filter((symbol) => symbolAllowed(symbol, assetBySymbol))
        .filter((symbol) => sectorMatches(symbol, sectorMap, filters.sector));

      if (!matching.length) {
        const sectorFiltered = filters.sector !== SECTOR_ALL;
        chainScope = null;
        rows = [];
        emptyReason = activeSearch
          ? sectorFiltered
            ? `No ${activeSearch} contracts in the selected sector — choose All Sectors to reset.`
            : `No option contracts for ${activeSearch}.`
          : loaded.length
            ? sectorFiltered
              ? 'No symbols in the selected sector — choose All Sectors to reset.'
              : 'No list symbols have optionable US listings.'
            : ['all', 'sp500', 'ndx'].includes(activeListId)
              ? 'Index data unavailable, try again later.'
              : 'This list has no symbols — use Manage lists to add some.';
        scannedSymbolCount = 0;
        scannedCount = 0;
        succeededCount = 0;
        scanSymbolCount = 0;
        updatedAt = '';
        delayed = false;
        alerts = [];
        return;
      }

      if (!keyPair) {
        rows = [];
        scannedSymbolCount = 0;
        scannedCount = 0;
        succeededCount = 0;
        scanSymbolCount = 0;
        emptyReason = 'Connect your Alpaca key to load option chains.';
        updatedAt = '';
        delayed = false;
        alerts = [];
        refreshError = '';
        return;
      }
      const key = keyPair;

      const snapshots = await fetchStockSnapshots(matching, key, controller.signal, {
        today,
        minutes: nyMinutes(),
      });
      if (gen !== refreshGen) return;

      const candidates = rankByLiquidity(
        matching.filter((symbol) =>
          inPriceBucket(snapshots.bySymbol[symbol]?.price ?? null, effectiveFilters),
        ),
        snapshots.bySymbol,
      );
      const scanList = candidates;
      scanSymbolCount = scanList.length;
      const keep = new Set(scanList);
      rows = rows.filter((row) => keep.has(row.underlying ?? row.symbol));

      let halted = false;
      let errorsAll: Record<string, string> = {};
      let missingAll: string[] = [];
      let truncatedAll: string[] = [];
      let delayedAll = false;
      let chainPages = 0;
      let generatedAt = new Date().toISOString();
      scannedCount = 0;
      succeededCount = 0;
      // eslint-disable-next-line svelte/prefer-svelte-reactivity
      const missingSet = new Set<string>(snapshots.failed);
      for (const symbol of matching) {
        if (!snapshots.bySymbol[symbol]?.present) missingSet.add(symbol);
      }
      const priceError =
        matching.length > 0 && snapshots.failed.length === matching.length
          ? 'Alpaca returned no stock snapshots'
          : '';
      const feed = feedFor(key);
      emptyReason = '';
      updatedAt = '';
      delayed = false;

      const scan = await scanSymbols(
        scanList,
        10,
        (symbol) =>
          screenSymbol(
            symbol,
            key,
            scope,
            controller.signal,
            snapshots.bySymbol[symbol] ?? null,
            feed,
          ),
        (symbol, data) => {
          if (gen !== refreshGen) return;
          scannedCount++;
          if (data.rateLimited) halted = true;
          if (data.missingPrice) missingSet.add(symbol);
          delayedAll = delayedAll || data.delayed;
          generatedAt = new Date().toISOString();
          rows = [...rows.filter((row) => (row.underlying ?? row.symbol) !== symbol), ...data.rows];
          if (!data.error) {
            succeededCount++;
            updatedAt = new Date(generatedAt).toLocaleTimeString();
          }
          delayed = delayedAll;
        },
        {
          signal: controller.signal,
          canContinue: () => !halted,
        },
      );
      if (gen !== refreshGen) return;

      scannedSymbolCount = scan.scanned.length;
      scannedCount = scan.scanned.length;
      errorsAll = scan.errors;
      missingAll = [...missingSet];
      truncatedAll = scan.truncated;
      chainPages = scan.pages;
      const skippedSet = new Set(scan.skipped);
      rows = rows.filter((row) => !skippedSet.has(row.underlying ?? row.symbol));

      if (!candidates.length) {
        emptyReason = usesPriceBucket
          ? 'No symbols in this price bucket.'
          : 'No symbols with usable stock prices.';
      } else if (scan.scanned.length === 0 && scan.skipped.length > 0) {
        emptyReason = 'Alpaca rate limit reached — try again in a minute.';
      } else if (!rows.length && filters.minDte === 0 && filters.maxDte === 0) {
        emptyReason = 'No contracts expire today.';
      }
      if (!chainScopeCovers(scope, currentChainScope())) {
        void refresh();
        return;
      }

      void ensureDividends(scan.scanned, key);
      chainScope = Object.keys(errorsAll).length < scan.scanned.length ? scope : null;
      alerts = alertsFor(
        {
          generatedAt,
          delayed: delayedAll,
          errors: errorsAll,
          priceError,
          missingPrices: missingAll,
          truncatedChains: truncatedAll,
          chainPages,
          rows,
        },
        scan.skipped.length > 0,
      );
      if (scan.skipped.length) {
        alerts = [
          ...alerts,
          `Scanned ${scan.scanned.length} of ${candidates.length} names; ${scan.skipped.length} not scanned (Alpaca rate limit). Try again in a minute.`,
        ];
      }
    } catch (error) {
      if (gen !== refreshGen) return;
      if ((error as Error).name === 'AbortError') return;
      const message = /HTTP (401|403)\b/i.test((error as Error).message)
        ? 'Alpaca rejected the saved key. Replace it or remove it.'
        : (error as Error).message;
      refreshError = message;
      chainScope = null;
      rows = [];
      scannedSymbolCount = 0;
      scannedCount = 0;
      succeededCount = 0;
      scanSymbolCount = 0;
      emptyReason = '';
      updatedAt = '';
      delayed = false;
      alerts = [message];
    } finally {
      if (gen === refreshGen) {
        refreshAbort = null;
        refreshInFlight = false;
        loading = false;
        scheduleAuto();
      }
    }
  }

  function updateFilters(patch: Partial<Filters>) {
    const sectorChanged = patch.sector !== undefined && patch.sector !== filters.sector;
    const priceChanged =
      (patch.minPrice !== undefined && patch.minPrice !== filters.minPrice) ||
      (patch.maxPrice !== undefined && patch.maxPrice !== filters.maxPrice);
    filters = applyFilterPatch(filters, patch);
    if (priceChanged || sectorChanged) void refresh();
    else if (!chainScopeCovers(chainScope, currentChainScope())) scheduleChainScopeRefresh();
    scheduleStateWrite({ persist: true });
  }

  function applyRisk(next: string) {
    const profile = RISK_PROFILES[next as keyof typeof RISK_PROFILES];
    if (!profile) return;
    riskKey = next;
    filters = applyFilterPatch(filters, profile.filters);
    store.set('risk', next);
    scheduleStateWrite({ persist: true });
    writeURL();
  }

  function applyExpiry(next: string) {
    if (next !== 'custom' && !EXPIRATIONS[next as keyof typeof EXPIRATIONS]) return;
    expiryKey = next;
    if (next !== 'custom') {
      const [min, max] = EXPIRATIONS[next as keyof typeof EXPIRATIONS].dte;
      filters = { ...filters, minDte: min, maxDte: max };
    }
    store.set('expiry', next);
    scheduleStateWrite({ persist: true });
    writeURL();
    scheduleChainScopeRefresh();
  }

  function resetFilters() {
    const hadSector = filters.sector !== SECTOR_ALL;
    const priceChanged =
      filters.minPrice !== DEFAULT_FILTERS.minPrice ||
      filters.maxPrice !== DEFAULT_FILTERS.maxPrice;
    filters = { ...DEFAULT_FILTERS };
    riskKey = 'balanced';
    expiryKey = DEFAULT_EXPIRY;
    excludedSymbols = [];
    store.set('filters', filters);
    store.set('risk', riskKey);
    store.set('expiry', expiryKey);
    writeURL();
    if (hadSector || priceChanged) void refresh();
    else scheduleChainScopeRefresh();
  }

  function excludeSymbol(symbol: string) {
    const ticker = symbol.trim().toUpperCase();
    if (!ticker || excludedSymbols.includes(ticker)) return;
    excludedSymbols = [...excludedSymbols, ticker];
    scheduleStateWrite({ persist: true });
  }

  function presetValue(field: 'minDelta' | 'maxDelta' | 'minAnn' | 'maxSpread'): number {
    return (
      RISK_PROFILES[riskKey as keyof typeof RISK_PROFILES]?.filters[field] ?? DEFAULT_FILTERS[field]
    );
  }

  function removeFilterChip(key: string) {
    if (key.startsWith('exclude:')) {
      const ticker = key.slice('exclude:'.length);
      excludedSymbols = excludedSymbols.filter((symbol) => symbol !== ticker);
      scheduleStateWrite({ persist: true });
      return;
    }
    switch (key) {
      case 'risk':
        applyRisk('balanced');
        break;
      case 'expiry':
        applyExpiry(DEFAULT_EXPIRY);
        break;
      case 'price':
        updateFilters({
          minPrice: DEFAULT_FILTERS.minPrice,
          maxPrice: DEFAULT_FILTERS.maxPrice,
        });
        break;
      case 'sector':
        updateFilters({ sector: SECTOR_ALL });
        break;
      case 'delta':
        updateFilters({
          minDelta: presetValue('minDelta'),
          maxDelta: presetValue('maxDelta'),
        });
        break;
      case 'iv':
        updateFilters({ maxIv: 0 });
        break;
      case 'yield':
        updateFilters({ minYield: 0 });
        break;
      case 'ann':
        updateFilters({ minAnn: presetValue('minAnn') });
        break;
      case 'spread':
        updateFilters({ maxSpread: presetValue('maxSpread') });
        break;
      case 'avoidEarnings':
        updateFilters({ avoidEarnings: false });
        break;
      case 'avoidDividends':
        updateFilters({ avoidDividends: false });
        break;
    }
  }

  function setActiveList(id: string) {
    if (id !== 'shared' && !BUILTIN_LIST_IDS.has(id) && !lists.some((list) => list.id === id))
      return;
    if (id === 'shared' && !sharedList) return;
    if (id === activeListId) return;
    activeListId = id;
    if (id !== 'shared') store.set('activeList', id);
    writeURL();
    void refresh();
  }

  function changeList(id: string) {
    if (id === '__manage') {
      openListsDialog(listsDialogStart());
      return;
    }
    setActiveList(id);
  }

  function openListsDialog(id: string) {
    listsInitialId = id;
    listsDialogOpen = true;
  }

  function listsDialogStart(): string {
    return activeListId === 'shared' || BUILTIN_LIST_IDS.has(activeListId)
      ? 'favourites'
      : activeListId;
  }

  function openKeyDialog() {
    keyMessage = '';
    keyNotice = '';
    keyRemember = !!store.get('alpacaKey', null) && !store.getSession('alpacaKey', null);
    keyDialogOpen = true;
  }

  function closeKeyDialog() {
    keyRequest++;
    keyBusy = false;
    keyDialogOpen = false;
  }

  async function saveKey(keyId: string, secret: string, remember: boolean) {
    if (keyBusy) return;
    if (!keyId || !secret) {
      keyMessage = 'Paste both the key ID and the secret.';
      return;
    }
    const request = ++keyRequest;
    keyBusy = true;
    keyMessage = 'Testing the key with Alpaca…';
    try {
      const error = await testKey(keyId, secret);
      if (request !== keyRequest || !keyDialogOpen) return;
      if (error) {
        keyMessage = error;
        return;
      }
      const pair = { keyId, secret };
      const storage = persistKey(pair, remember);
      keyPair = pair;
      keyRemember = storage === 'durable';
      keyMessage = '';
      keyNotice =
        storage === 'durable'
          ? 'Key works. Saved on this device.'
          : storage === 'session'
            ? 'Key works. Session-only — cleared when this tab closes.'
            : 'Key works for this session, but this browser blocked storage; it will be gone after a reload.';
      keyDialogOpen = false;
      void refresh();
    } finally {
      if (request === keyRequest) keyBusy = false;
    }
  }

  function removeKey() {
    if (
      !window.confirm(
        'Remove this key from this browser? Lists and filters stay; data needs a key to reload.',
      )
    )
      return;
    clearKey();
    keyPair = null;
    keyRemember = false;
    keyNotice = '';
    closeKeyDialog();
    cancelDividends();
    void refresh();
  }

  function makeListId(): string {
    return `list-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function saveList(list: { id: string | null; name: string; symbols: string[] }): string | null {
    if (list.id === 'favourites') {
      const symbols = cleanListSymbols(list.symbols);
      if (!symbols.length) return null;
      watchlist = symbols;
      store.set('watchlist', watchlist);
      if (activeListId === 'favourites') {
        writeURL();
        void refresh();
      }
      return 'favourites';
    }
    const result = upsertList(lists, list, makeListId);
    if (!result.id) return null;
    lists = result.lists;
    store.set('lists', lists);
    if (activeListId === result.id) {
      writeURL();
      void refresh();
    }
    return result.id;
  }

  function importListFile(incoming: { name: string; symbols: string[] }[]) {
    const result = importLists(watchlist, lists, incoming, makeListId);
    if (result.watchlist.join('\u0000') !== watchlist.join('\u0000')) {
      watchlist = result.watchlist;
      store.set('watchlist', watchlist);
      if (activeListId === 'favourites') {
        writeURL();
        void refresh();
      }
    }
    lists = result.lists;
    store.set('lists', lists);
    return result;
  }

  function deleteList(id: string) {
    lists = removeList(lists, id);
    store.set('lists', lists);
    if (activeListId === id) {
      activeListId = DEFAULT_LIST;
      store.set('activeList', DEFAULT_LIST);
      writeURL();
      void refresh();
    }
  }

  function useList(id: string) {
    listsDialogOpen = false;
    if (id === activeListId) {
      writeURL();
      return;
    }
    setActiveList(id);
  }

  function saveShared() {
    if (!sharedList) return;
    const id = makeListId();
    lists = [
      ...lists,
      { id, name: uniqueListName(sharedList.name, lists), symbols: [...sharedList.symbols] },
    ];
    store.set('lists', lists);
    sharedList = null;
    activeListId = id;
    store.set('activeList', id);
    writeURL();
    void refresh();
  }

  function handleRefresh() {
    void refresh({ reason: 'manual' });
  }

  function toggleSort(key: string) {
    if (sort.key === key) sort = { ...sort, dir: sort.dir > 0 ? -1 : 1 };
    else sort = { key, dir: key === 'symbol' ? 1 : -1 };
    writeURL();
  }

  function toggleTheme() {
    theme = nextTheme(theme);
    followsSystem = false;
    saveTheme(theme);
  }

  $effect(() => {
    applyTheme(theme);
  });

  $effect(() => {
    document.documentElement.dataset.strategy = strategy;
  });

  function scheduleAuto() {
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    if (!autoMinutes) return;
    autoTimer = setTimeout(() => {
      autoTimer = null;
      if (refreshInFlight) {
        scheduleAuto();
        return;
      }
      void refresh({ reason: 'auto' });
    }, autoRefreshMs(autoMinutes));
  }

  $effect(() => {
    if (autoMinutes) scheduleAuto();
    else if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    return () => {
      if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = null;
      }
    };
  });

  onMount(() => {
    store.set('risk', riskKey);
    store.set('expiry', expiryKey);
    store.set('filters', filters);
    store.set('strategy', strategy);
    store.set('activeList', activeListId === 'shared' ? DEFAULT_LIST : activeListId);
    writeURL();
    void refresh({ reason: 'initial' });
  });

  onMount(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    const onChange = (event: MediaQueryListEvent) => {
      if (followsSystem) theme = event.matches ? 'night' : 'emerald';
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  });

  onDestroy(() => {
    if (symbolFilterTimer) clearTimeout(symbolFilterTimer);
    if (chainScopeTimer) clearTimeout(chainScopeTimer);
    if (stateWriteTimer) clearTimeout(stateWriteTimer);
    cancelDividends();
    refreshAbort?.abort();
  });
</script>

<header class="border-b border-base-300 bg-base-100 px-4 py-3">
  <div class="flex flex-wrap items-center gap-3">
    <div class="min-w-0">
      <h1 class="text-xl font-bold tracking-tight">WheelHQ</h1>
      <p class="text-xs leading-snug text-base-content/70">
        Covered call and cash-secured put screener
      </p>
    </div>
    <div class="ml-auto flex flex-wrap items-center gap-2">
      <a
        class="btn gap-1.5 border-none bg-[#FFDD00] text-black shadow-none btn-sm hover:bg-[#F2D200]"
        href="https://buymeacoffee.com/wheelhq"
        target="_blank"
        rel="noopener noreferrer"
        title="Support WheelHQ on Buy Me a Coffee"
      >
        <Icon name="cup" />
        <span>Buy me a coffee</span>
      </a>
      <DataStatus
        status={connectionStatus.label}
        statusTone={connectionStatus.tone}
        provider="Alpaca"
        {updatedAt}
        indexNote={dataNote}
        earningsNote={earnings?.effectiveDate
          ? fullDate(earnings.effectiveDate)
          : earningsStatus === 'failed'
            ? 'Unavailable'
            : 'Loading'}
        error={refreshError}
      />
      {#if keyPair}
        <button
          type="button"
          class="btn gap-1.5 btn-ghost btn-sm"
          title={keyInfo.detail}
          data-key-state={keyRejected ? 'error' : 'ok'}
          onclick={openKeyDialog}
        >
          {#if keyRejected}
            <Icon name="alert" size="sm" class="text-error" />
          {:else}
            <span class="size-2 rounded-full bg-success" aria-hidden="true"></span>
          {/if}
          <span class="text-xs font-medium">{keyInfo.label}</span>
        </button>
      {/if}
      <button
        type="button"
        class="inline-flex min-h-8 items-center gap-1.5 rounded-md px-1.5 text-sm font-medium text-base-content/80 transition-colors hover:text-base-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        title="Share this screening configuration"
        onclick={openShareDialog}
      >
        <Icon name="share" />
        <span>Share</span>
      </button>
      <RefreshControl
        {loading}
        minutes={autoMinutes}
        onRefresh={handleRefresh}
        onChange={(next) => {
          autoMinutes = next;
          store.set('autoRefresh', next);
        }}
      />
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        aria-label={theme === 'night' ? 'Switch to light theme' : 'Switch to dark theme'}
        onclick={toggleTheme}>◐</button
      >
      <a
        class="btn btn-ghost btn-sm"
        href="https://github.com/kikulikov/wheelhq-app"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WheelHQ source on GitHub"
        title="WheelHQ source on GitHub"><Icon name="github" /></a
      >
    </div>
  </div>
</header>

<div class="grid grid-cols-1 lg:grid-cols-[21.25rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
  <div class="lg:col-start-2 lg:row-start-1">
    {#if storageWarning}
      <div class="px-4 pt-3">
        <div class="alert border border-warning alert-warning shadow-sm" role="alert">
          <span class="text-sm"
            >This browser is blocking storage. Changes stay in this tab and are lost when it closes.</span
          >
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            aria-label="Dismiss storage warning"
            onclick={() => (storageWarning = false)}>×</button
          >
        </div>
      </div>
    {/if}
    {#if keyNotice}
      <div class="px-4 pt-3">
        <div class="alert alert-success shadow-sm" role="status">
          <span class="text-sm">{keyNotice}</span>
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            aria-label="Dismiss key notice"
            onclick={() => (keyNotice = '')}>×</button
          >
        </div>
      </div>
    {/if}
    {#if !keyPair}
      <div class="px-4 pt-3">
        <KeyPrompt onAddKey={openKeyDialog} />
      </div>
    {/if}
    <MarketBar
      {lists}
      {activeListId}
      {sharedList}
      {symbolFilter}
      {listNote}
      searchSymbol={activeSearch}
      searchOutside={searchOutsideUniverse}
      {universeLabel}
      onListChange={changeList}
      onFilterInput={updateSymbolFilter}
      onClearSearch={clearSearch}
      onManageLists={() => openListsDialog(listsDialogStart())}
      onSaveShared={saveShared}
    />

    <div class="flex items-center justify-between gap-2 px-4 pt-3 lg:hidden">
      <button
        type="button"
        class="btn gap-1.5 btn-ghost btn-sm"
        aria-expanded={filtersOpen}
        aria-controls="filters-panel"
        onclick={() => (filtersOpen = !filtersOpen)}
      >
        <Icon name="filter" />
        <span>Filters</span>
        {#if chips.length}<span class="badge badge-xs text-[0.6875rem]">{chips.length}</span>{/if}
      </button>
      <a class="btn btn-ghost btn-sm" href="#results">Results ↓</a>
    </div>

    {#if alerts.length || (rows.length > 0 && coverage.length)}
      {@const messages = rows.length > 0 ? [...coverage, ...alerts] : alerts}
      <div class="px-4 pt-3">
        <div class="alert border border-warning alert-warning shadow-sm" role="alert">
          <div class="flex w-full flex-wrap items-center justify-between gap-2">
            <div class="flex flex-col gap-1 text-sm font-semibold">
              {#each messages as alert, index (index)}<span>⚠ {alert}</span>{/each}
            </div>
            <div class="flex flex-wrap items-center gap-2">
              {#if coverage.length}
                <button
                  type="button"
                  class="btn btn-sm"
                  aria-label="Refresh data"
                  disabled={loading}
                  onclick={handleRefresh}>{loading ? 'Refreshing…' : 'Refresh'}</button
                >
              {/if}
              {#if keyRejected}
                <button type="button" class="btn btn-sm" onclick={openKeyDialog}>Replace key</button
                >
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <div
    id="filters-panel"
    class="{filtersOpen ? 'block' : 'hidden'} lg:col-start-1 lg:row-span-2 lg:block"
  >
    <FiltersPanel
      {strategy}
      {riskKey}
      {expiryKey}
      {filters}
      {sectorOptions}
      priceEnabled={usesPriceBucket}
      onStrategyChange={(next) => {
        strategy = next;
        store.set('strategy', next);
        writeURL();
        scheduleChainScopeRefresh();
      }}
      onRiskChange={applyRisk}
      onExpiryChange={applyExpiry}
      onUpdate={updateFilters}
      onDteChange={(min, max) => {
        filters = { ...filters, minDte: min, maxDte: max };
        expiryKey = 'custom';
        store.set('expiry', 'custom');
        scheduleStateWrite({ persist: true });
      }}
      onDteCommit={scheduleChainScopeRefresh}
      onDeltaChange={(min, max) => {
        filters = { ...filters, minDelta: min, maxDelta: max };
        scheduleStateWrite({ persist: true });
      }}
    />
  </div>

  <main id="results" class="min-w-0 scroll-mt-4 lg:col-start-2 lg:row-start-2">
    <div class="px-4 pt-3">
      {#if chips.length}
        <div class="mb-2 flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {#each chips as chip (chip.key)}
            <span
              class={`badge gap-1 border badge-ghost border-base-300 badge-sm ${
                chip.removable ? '' : 'text-base-content/70'
              }`}
            >
              {chip.label}
              {#if chip.removable}
                <button
                  type="button"
                  class="text-sm leading-none text-base-content/60 hover:text-base-content"
                  aria-label={`Remove ${chip.label} filter`}
                  onclick={() => removeFilterChip(chip.key)}>×</button
                >
              {/if}
            </span>
          {/each}
          {#if canClear}
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              aria-label="Reset all filters to defaults"
              onclick={resetFilters}>Reset filters</button
            >
          {/if}
        </div>
      {/if}
      <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
      <div class="mb-2 space-y-0.5">
        <div class="text-xs font-medium text-base-content/80">{results.primary}</div>
        {#if results.secondary}
          <div class="text-[0.6875rem] text-base-content/60">{results.secondary}</div>
        {/if}
        {#if hiddenStale}
          <div class="text-[0.6875rem] text-base-content/60" data-stale-hidden>
            {hiddenStale} contract{hiddenStale === 1 ? '' : 's'} hidden — quotes are from an earlier session.
          </div>
        {/if}
        {#if strategy === 'cc'}
          <div class="text-[0.6875rem] text-base-content/60" data-holdings-note>
            This list is not your holdings.
          </div>
        {/if}
        {#if loading && scanSymbolCount > 0}
          <div class="text-[0.6875rem] text-base-content/60">
            Scanned {scannedCount.toLocaleString('en-US')} of {scanSymbolCount.toLocaleString(
              'en-US',
            )} symbols{#if scannedCount < scanSymbolCount}, {(
                scanSymbolCount - scannedCount
              ).toLocaleString('en-US')} remaining{/if}…
          </div>
        {/if}
      </div>
      <Pagination page={paged.page} pageCount={paged.pageCount} onPage={(next) => (page = next)} />
      <ResultsTable
        items={paged.items}
        columns={COLUMNS}
        {sort}
        {emptyReason}
        {loading}
        {assetBySymbol}
        {assetByRoot}
        {dividendBySymbol}
        {today}
        onSort={toggleSort}
        onExclude={excludeSymbol}
      />
      <Pagination
        page={paged.page}
        pageCount={paged.pageCount}
        label="Results pages (bottom)"
        onPage={(next) => (page = next)}
      />
      <p class="mt-2 text-xs leading-relaxed text-base-content/70">
        Yield % = bid ÷ spot for covered calls, bid ÷ strike for cash-secured puts — premium only,
        not a total return. Ann % = simple extrapolation, yield × 365 ÷ DTE (one-day floor for
        0DTE); not compounded and not a forecast. Equity = underlying price from the IEX feed; Today
        % = change vs previous close. Breakeven: calls → spot − bid, a reference for a new buy-write
        and not an owned-share cost basis; puts → strike − bid. Option quotes are OPRA when your key
        has access, otherwise indicative derived quotes — not OPRA. E = earnings, D = ex-dividend
        before expiry; outlined = estimated date. − removes a symbol from the results; the chip
        above the table restores it.
      </p>
    </div>
  </main>
</div>

<footer
  class="flex flex-1 flex-col items-center justify-center gap-1.5 border-t border-base-300 px-4 py-5 text-center text-xs text-base-content/70"
>
  <p class="max-w-[60ch] leading-relaxed text-base-content/75">
    Market data may be delayed. Nothing on WheelHQ is investment advice.
  </p>
  <div class="flex flex-wrap items-center justify-center gap-4">
    <span>© 2026 WheelHQ</span>
    <a class="link link-hover" href="/about/">About</a>
  </div>
</footer>

<KeyDialog
  open={keyDialogOpen}
  hasKey={!!keyPair}
  remember={keyRemember}
  busy={keyBusy}
  message={keyMessage}
  onClose={closeKeyDialog}
  onSave={saveKey}
  onRemove={removeKey}
/>

<ShareDialog open={shareOpen} url={shareLink} onClose={() => (shareOpen = false)} />

<ListsDialog
  open={listsDialogOpen}
  {lists}
  {watchlist}
  initialId={listsInitialId}
  onClose={() => (listsDialogOpen = false)}
  onSave={saveList}
  onDelete={deleteList}
  onUse={useList}
  onImport={importListFile}
/>
