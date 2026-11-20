# WheelHQ — Product & Technical Specification

Status: implemented Svelte 5 + Vite app. Last updated: 2026-11-15.

This is the consolidated specification for the current implementation. It records the
product behavior, the Alpaca API contract, the screening model, the state model, and the
non-functional constraints. The [README](README.md) is the quick-start and operator guide.

---

## 1. Purpose

WheelHQ is a browser-only screener for two option-selling strategies on US equities:

- **CSP** — cash-secured puts: sell a put and reserve cash for assignment at the strike.
- **CC** — covered calls: sell a call against 100 shares already owned.

The screener scans a universe of optionable underlyings, pulls option chains and stock
snapshots from Alpaca, and filters contracts locally. The user supplies their own Alpaca
API key; there is no backend, no server-side database, and no trade execution.

### Non-goals

- No order placement, position tracking, or portfolio accounting.
- No full-market scan of every option chain (rate-limit bound). **US Options** is the
  S&P 500 + Nasdaq-100 union, not the full US listing universe.
- No crypto options yet.
- No historical backtesting, IV rank, or open-interest ranking.
- No user accounts, server-side presets, saved-screen sync, or server-side key storage.
- No user-saved screening presets or customisable table columns yet.

---

## 2. Definitions

| Term | Meaning |
|---|---|
| Underlying / symbol | The equity or ETF whose options are screened. |
| Contract | One OCC option symbol, e.g. `AAPL261120C00240000`. |
| DTE | Calendar days from the current New York date to expiry. |
| Spot / Equity | Latest underlying price from the stock snapshot. |
| Bid premium | The price used for yield; premium is assumed collected at the bid. |
| CSP | Cash-secured put. |
| CC | Covered call. |
| All | The deduplicated union of the S&P 500 and Nasdaq-100 membership lists. |
| Candidate pool | Index members or list symbols, after the sector and share-price bucket filters. |
| Liquidity score | Last completed session dollar volume (`v × c`) used to order the scan; ties on trade count. |
| Screened set | The price-bucket symbols scanned before Alpaca returns a persistent 429. |

---

## 3. Product summary

The page contains:

1. Header: product title, **Data and API status** menu (provider, feed note, last
   refreshed time, dataset dates), **Share**, split **Refresh** control with the
   auto-refresh interval, theme toggle, a GitHub source link at the top-right corner, and
   a key-status control with a small dot once connected.
2. Market bar: predefined universe chips, a divider and saved-list chips, a global-search
   scope indicator, symbol note, **Manage lists**. The two-line results count sits above
   the table.
3. Filter sidebar: strategy, sector, risk profile, expiration, share-price bucket,
   collapsible fine-tune sliders, event exclusions, and a **?** explainer on every filter.
4. Active filter summary and the single **Reset filters** control above the results table.
5. Results table: 15 columns, sortable headers, row exclusion action, up to 500 rendered
   rows.
6. Dialogs: Alpaca key, Manage lists, Share.
7. Ticker tooltip: company name, exchange, price, daily move, and the full OCC symbol;
   clicking the ticker copies that symbol.
8. Footer: the required market-data disclaimer — **Market data may be delayed. Nothing on
   WheelHQ is investment advice.** — above the copyright and About link.

The app is a single static page. Everything that changes is driven by a small amount of
module-level state in `src/App.svelte` and `src/lib/`.

---

## 4. User flows

### 4.1 First run

1. Page loads with **1–7d** expiration, **Balanced** risk, and the **Nasdaq-100** universe.
2. With no key, the table is empty and an alert explains how to add one.
3. The user opens the **Add Alpaca key** prompt, enters Key ID and Secret, and submits.
4. The app validates the key with one small Alpaca bars request, stores it in
   `sessionStorage` (or `localStorage` when “Keep this key on this device” is checked), and
   refreshes.
5. If the key has options data access, chains load; otherwise the delayed/indicative feed
   or an explanatory alert is shown.

### 4.2 Screen a preset universe

1. Pick **US Options**, **S&P 500**, **Nasdaq-100**, **Favourites**, or a saved list from
   the universe chips in the top bar.
2. Pick a sector from the **Sector** dropdown in the filter panel if needed.
3. Search any supported ticker; an exact match loads it even when it sits outside the
   selected universe.
4. Adjust strategy, risk profile, expiration, share-price bucket, and sliders.
5. Sort by a column; the match count updates immediately because filtering is local.

### 4.3 Manage lists

1. Click **Manage lists**.
2. Select Favourites or an existing custom list, or click **New list**.
3. Edit the name and comma/space/newline-separated symbols.
4. Save, optionally **Use this list**, or delete a custom list.
5. Favourites is built in and cannot be deleted; its name is read-only.
6. **Export lists** downloads every list (Favourites first) as versioned JSON;
   **Import lists** loads a JSON file and merges it into the local lists.

### 4.4 Inspect a ticker

Hover or keyboard-focus a ticker in the table. A tooltip shows the full company name,
exchange, latest price coloured by direction, and the daily change in points and percent.
The tooltip hides on mouse-out, blur, scroll, resize, or re-render.

### 4.5 Share a screen

1. Configure the universe and filters.
2. Click **Share** in the header.
3. The dialog shows the canonical URL and a **Copy link** action. If the clipboard is
   blocked, the URL is selected for manual copy.
4. The recipient opens the URL and gets the same configuration, screened against their own
   Alpaca key and market data.

Saved lists are frozen into the shared URL (`list=shared`, `symbols`, `listName`); the
owner's address bar keeps the live local list id.

### 4.6 Exclude a ticker

1. Click the round **−** button beside a ticker tag.
2. Every row for that underlying disappears from the rendered results.
3. An `Exclude <symbol>` chip appears in the active filter summary and the URL gains
   `exclude=`.
4. Remove the chip to bring the symbol back.

Exclusions are local and URL-only: they are not persisted in browser storage and do not
change the scanned candidate pool.

---

## 5. Functional requirements

### 5.1 Key management

- Key ID and Secret are stored as JSON under `wheelhq.alpacaKey` in `sessionStorage` by
  default (cleared when the tab closes).
- With no key, a first-run **Connect Alpaca to load option chains** prompt sits above the
  universe bar and offers **Add Alpaca key**. After a key is connected, a header control
  with a small success dot (`Alpaca: session key` or `Alpaca: saved key`) opens the same
  dialog; a rejected key swaps the dot for an error alert icon.
- The Key dialog has a **Keep this key on this device after I close the tab** opt-in; when
  checked, the key is stored in `localStorage` instead.
- Before a key is entered, the dialog warns that free Alpaca plans have a limited request
  budget, that a wide scan can reach it, and links to Alpaca’s data plans for comparison.
  It does not enumerate plan or feed details.
- Validation calls `GET /v2/stocks/bars?symbols=SPY&timeframe=1Day&limit=1&feed=iex&start=…&end=…`
  with a seven-day window ending now.
- Validation surfaces 401, 403, 429, and other statuses with distinct messages.
- On save the app refreshes automatically and shows a session/saved notice. **Remove**
  asks for confirmation, then deletes both stored copies; lists and filters stay.
- The dialog recommends a paper-trading key and warns that a live key can place trades. It
  explains that a market-data-only key is enough, that options data access decides
  `indicative` vs `opra`, and that assets access only affects names and the optionable
  filter.
- The key is sent only to `*.alpaca.markets`, using
  `APCA-API-KEY-ID` and `APCA-API-SECRET-KEY` headers.
- The static host never receives the key.

### 5.2 Universes, dataset data, and the sector selector

The Market selector has been removed. The exchange remains visible only in the ticker
tooltip and TradingView link.

Built-in universes (visible as chips in the top bar):

1. **US Options** — the deduplicated S&P 500 + Nasdaq-100 union (5.4).
2. **S&P 500** — `indexes.sp500` from `indexes.json`.
3. **Nasdaq-100 (default)** — `indexes.ndx` from `indexes.json`.

Rules:

- The selected list is stored in `wheelhq.activeList`. Built-in universe ids are stable;
  built-in lists have no `wheelhq.lists` entry.
- US Options, S&P 500, and Nasdaq-100 use the same mandatory share-price bucket and
  dollar-volume scan order. There is no 50-symbol cap; each scan runs until Alpaca
  returns a persistent 429.
- Index membership comes from `indexes.json`, reloaded on every manual/initial refresh
  (section 6.1).
- A **Sector** dropdown in the filter column starts on **All Sectors**. It lists Basic
  Materials, Communication Services, Consumer Cyclical, Consumer Defensive, Energy,
  Financial Services, Healthcare, Industrials, Real Estate, Technology, Utilities, and
  **Other**.
- Choosing one sector filters the candidate pool before the share-price bucket and scan
  order and triggers a refresh. **All Sectors** resets.
- Keys are `materials`, `media`, `retail`, `staples`, `energy`, `finance`, `health`,
  `industrial`, `realestate`, `tech`, `utilities`, `other`.
- Labels follow the screener convention (Basic Materials, Communication Services,
  Consumer Cyclical, Consumer Defensive, Technology, etc.) and map to official GICS
  sectors. Symbols without a sector land in **Other**, never disappear.
- The published `indexes.json` contains all 11 GICS sectors; the datasets check asserts
  S&P 500 coverage, and Nasdaq-100 names outside it may fall to Other.
- The `indexes.json` effective date appears as **Index data** in the Data and API status
  menu (`Data <date>` for the runtime file, `Bundled <date>` for the build-time fallback),
  separate from the last refresh time.
- The old `market` URL parameter and `wheelhq.marketMode` key are ignored/removed.

### 5.3 Lists and universes

The top bar shows the predefined universes **US Options**, **S&P 500**, **Nasdaq-100**,
**Favourites**, then a subtle divider and every saved custom list. There is no list
dropdown; new lists are added to the bar immediately. A shared list appears in its own
group after another divider, with a `Shared` badge.

- **US Options** — the S&P 500 + Nasdaq-100 union. The stored/URL id remains `all`.
- **S&P 500** — `indexes.sp500`.
- **Nasdaq-100 (default)** — `indexes.ndx`; used when no list is stored or supplied.
- **Favourites** — built-in list stored in `wheelhq.watchlist`; defaults to 24 liquid
  names on first run. It stays with the predefined universes.
- Each custom list, stored in `wheelhq.lists` as `{id, name, symbols}`, is a chip in the
  saved-list group and the active one is pressed.
- A shared list loaded from a URL appears in the shared group, not among saved lists.
- **Manage lists** — opens the editor.

Rules:

- The selected list is stored in `wheelhq.activeList`. Values are `"all"`,
  `"favourites"`, a built-in universe id, or a custom list id. An ephemeral shared list
  is not persisted.
- Favourites and custom lists screen exactly their own symbols.
- Lists are capped at 50 symbols (`MAX_LIST_SYMBOLS`). The editor refuses to save a
  larger list, stored lists are truncated on load, and shared links keep the first 50.
- The lists editor accepts pasted comma/space/newline-separated symbols. The symbol field
  uppercases input as it is typed; saving strips separators and ineligible characters,
  deduplicates symbols, writes the canonical comma-separated form back to the field, and
  refuses a list above the 50-symbol cap with an inline error.
- **Export lists** downloads `{version: 1, lists: [{name, symbols}]}` as a pretty-printed
  JSON file named `wheelhq-lists-YYYY-MM-DD.json`. Favourites is exported first, followed
  by every custom list in display order.
- **Import lists** reads that file, validates the version, list names and symbol arrays,
  normalizes symbols, rejects a list with more than 50 symbols, and appends the imports as
  custom lists. Identical name + symbol sets are skipped. A name conflict with different
  contents gets `_1`, `_2`, … suffixes; an imported Favourites list that differs from the
  local one therefore becomes `Favourites_1` rather than overwriting local Favourites.
  Import never modifies or deletes an existing list.
- The global ticker search is debounced by 200 ms and updates `q` when it fires. It sits at
  the right of the market bar with a magnifier icon and **⌘K**/**Ctrl+K** focuses it.
- An exact ticker in the S&P 500 + Nasdaq-100 union overrides the universe for the scan,
  so `Nasdaq-100` + `IBM` loads IBM even though it is outside that index. The universe
  selection is unchanged, and an `IBM · Global search · Outside Nasdaq-100 ×` pill names
  the scope and clears the search; it is not styled as a universe chip.
- Partial or unknown queries do not refetch; they remain a case-insensitive substring
  filter over the rendered rows. Clearing the search removes `q`, restores the selected
  universe and keeps every screening criterion.
- The note above the results table has two lines: `13 matching contracts` and
  `From 213 contracts scanned across 18 symbols`, formatted with thousands separators. The
  first counts filtered option rows; the second names the scan totals, or `for IBM` during
  a global search.
- Empty lists produce an explanatory row; a sector selection that removes every symbol
  produces an explanatory row asking the user to choose **All Sectors**.
- Custom and shared lists include `symbols` and `listName` in the URL. If the list id is
  not present locally, the app creates an ephemeral shared list from the URL symbols so
  the link still works for another user.
- While a shared list is active, **Save as list** copies its symbols into a new custom
  list with a unique name.

### 5.4 US Options universe and candidate ranking

- **US Options** is the deduplicated union of `indexes.sp500` and `indexes.ndx`. The
  `has_options` asset map is only a membership filter; it no longer defines the universe.
- The same union is the pool for the global ticker search, independent of which universe
  is selected.
- Fetch one stock snapshot per 200-symbol batch for the whole list (3 calls for 518
  names). Apply the sector filter, then keep only names whose price falls in the
  mandatory share-price bucket.
- Order the bucket by last completed session dollar volume (`v × c`), then trade count,
  then symbol. Favourites, custom lists, and the three built-in universes all use this
  order. There is no volatility score, HV lookup, rank cache, or 50-symbol cap.
- Scan the ordered bucket with at most 10 chains in flight, calling Alpaca until a
  persistent 429. Names not reached at that point are skipped and reported; they are not
  queued. Skipped names' old rows are removed.
- Each symbol's chain replaces that symbol's old rows as soon as it arrives. There are no
  waves and no early passing-row stop.
- Auto-refresh re-runs prices and chains at the selected interval. It reloads the two
  dataset files at most once an hour and the asset map once per New York day; manual and
  initial refreshes reload everything.

The list bar reports `<n> symbols` for market and index universes after the sector and
asset-membership filters; the price bucket and Alpaca's rate limit can narrow the scanned
set further. For Favourites and saved lists it prints `<n> symbols — every ticker`, so the
user can see exactly which names are in play.

### 5.5 Strategies

- **CSP** is the default on a fresh install; **CC** can be selected at any time.
- Strategy determines which contract side is shown: `P` for CSP, `C` for CC.
- Strategy switch rescopes the chain request (puts vs calls) and refetches after a short
  debounce; it does **not** reset shared filters.
- Each strategy button exposes its one-line description as a hover tooltip (`title`) and
  an accessible name (`aria-label`) on keyboard focus, instead of a permanently visible
  paragraph.
- Yield is strategy-aware:
  - CSP: `bid ÷ strike`.
  - CC: `bid ÷ price`.

### 5.6 Filters and presets

Default filters:

| Filter | Default | Control |
|---|---|---|
| DTE | 1–7 (Weekly) | Expiration bucket or dual-thumb slider, 0–63 |
| Delta (absolute) | 0.15–0.35 | dual-thumb slider, 0–0.5, step 0.01 |
| Annualised yield | 10 | Fine-tune slider, 0–200, step 1 |
| Min yield % | 0 (off) | Fine-tune slider, 0–50, step 0.5 |
| Max spread % | 0 (off) | Fine-tune slider, 0–100, step 1; `0` disables the filter |
| Max IV % | 0 (off) | Fine-tune slider, 0–150, step 5 |
| Share price bucket | $75–150 | four buckets for market-wide universes; saved lists scan every price |
| Avoid earnings | off | hides contracts spanning an earnings date |
| Avoid dividends | off | hides contracts spanning an ex-dividend date |

Risk profiles:

| Profile | Delta | Min ann % | Max spread % |
|---|---|---|---|
| Conservative | 0.10–0.25 | 8 | 0 (off) |
| Balanced (default) | 0.15–0.35 | 10 | 0 (off) |
| Aggressive | 0.30–0.50 | 20 | 0 (off) |

Expirations:

| Bucket | DTE |
|---|---|
| Today | 0 |
| Weekly (default) | 1–7 |
| 1–2 weeks out | 8–14 |
| 2–4 weeks out | 15–28 |
| 1–2 months out | 29–63 |

Rules:

- Weekly is the default on a fresh load.
- A saved bucket or a saved custom DTE range is preserved across reloads.
- Legacy `weekly` / `monthly` / `15-29` / `30plus` values are not presets: a saved DTE
  range becomes Custom; otherwise the default applies.
- Today sets `minDte = maxDte = 0`, so the chain request covers today's expiries only.
  An empty result shows "No contracts expire today." rather than a bare table.
- An explicit URL containing `expiry`, `dteMin`, or `dteMax` wins over the saved settings.
- **Reset** restores 1–7d and Balanced.
- Risk profile and Expiration are independent groups; their filters combine with any
  fine-tune adjustments.
- Risk profile and Expiration are both full-width segmented controls built from a
  `join` + `grid`: three columns for risk and five for expiration. Expiration labels use
  `white-space: nowrap`, so a range label never wraps onto a second line.
  Both match the Strategy control's height so the filter sidebar reads as one consistent
  stack.
- The desktop sidebar is 20 rem wide (`lg:w-80`).
- DTE uses a dual-thumb slider over the 0–63-day DTE range on a **logarithmic** scale,
  so short-dated ranges get most of the track. The thumb values are calendar days, and
  each Arrow key press moves one day (Shift+Arrow moves seven; Page Up/Down moves ten;
  Home/End jump to the edge). Screen readers receive `aria-valuetext` such as
  “7 days” rather than the raw slider position.
- Delta uses a dual-thumb slider. Thumbs self-clamp: min cannot pass max and max cannot
  pass min.
- Max IV, Max spread, Min yield, and Annualised yield are single-thumb sliders under
  Fine-tune. A value of 0 shows `off` and disables that filter.
- There is no collapsed More filters block.
- Moving a DTE thumb marks expiration as Custom; choosing a bucket restores its range.
- The share-price row offers **< $75**, **$75–150**, **$150–300**, and **$300+** for
  market-wide universes. A bucket is always selected there; the default is **$75–150**.
  Bounds are half-open (`min ≤ price < max`). Contracts with no underlying price are
  dropped. A bucket change starts a new scan.
- Favourites, custom lists and shared lists bypass the bucket: the toggles are disabled,
  every price is scanned, and the price chip is omitted from the active filter summary.
  The stored bucket survives a switch back to a market-wide universe.
- Restored and URL-supplied filters are validated on load: an unknown share-price pair
  snaps to the default bucket, DTE is clamped to 0–63 with
  `minDte <= maxDte`, delta is clamped to 0–0.5 with `minDelta <= maxDelta`, Max IV, Min
  yield, Annualised yield, and Max spread are clamped to their slider ranges.
- All numeric Fine-tune filters are sliders; there are no text inputs in Fine-tune.
- Opening a shared URL applies its filters and, on load, writes the resolved state
  (including filters) together with the other saved state, so the risk button and stored
  filters stay consistent. Later edits are debounced.

### 5.7 Results table

Column order is fixed:

| # | Column | Notes |
|---|---|---|
| 1 | Ticker | Company ticker plus Call/Put tag and TradingView link; hover/focus opens the tooltip (company, exchange, price, OCC symbol); click copies the OCC symbol |
| 2 | Expiry | Month and day, with a short year when it is not the current year (`Jan 15 '27`) |
| 3 | DTE | Calendar days |
| 4 | Strike | 2 decimals; beneath it the position requirement — cash secured for puts (strike × 100), `100 sh` for calls |
| 5 | Equity | Underlying price from the IEX feed, labelled with its source timestamp in the ticker tooltip |
| 6 | Today % | Signed daily percent change |
| 7 | Bid | Option bid premium; `—` when the quote is crossed or otherwise invalid |
| 8 | Spread % | `(ask − bid) ÷ mid × 100`; `—` when the ask is missing or the quote is invalid |
| 9 | Yield % | Strategy-aware premium yield; premium only, not a total return |
| 10 | Ann % | Simple annualisation of the premium yield; `—` when unavailable |
| 11 | OTM % | Out-of-the-money percentage; negative means ITM |
| 12 | Delta | Signed Alpaca delta; puts are negative |
| 13 | IV % | Implied volatility × 100 |
| 14 | Vol | Contract volume; `—` when the provider omits it (never shown as zero) |
| 15 | Breakeven | Calls: spot − bid (new buy-write reference); puts: strike − bid |

Rules:

- **Spread % is column 8.** It is computed from the quote and also drives the Max spread filter.
- A crossed quote (bid above ask) or a non-numeric quote side is kept as a row but marked
  invalid: bid, spread, yield, annualised yield and breakeven render `—` and no metric is
  derived from it. An invalid or missing metric fails a numeric filter only when that filter
  has a positive threshold.
- Headers are clickable. First click sorts descending except Ticker, which sorts ascending;
  clicking the active header toggles direction. Default sort is DTE ascending.
- Rows with no value for the active sort column (for example a missing Spread %) always
  sort last, in both directions.
- Numeric cells use tabular numerals.
- The last column reserves extra right padding (`pr-6`) so an overlay scrollbar cannot
  cover its digits.
- Results paginate client-side in 100-row pages. Every match stays reachable — there is
  no display cap — and there is no nested vertical scrolling: the page scrolls, while the
  table keeps horizontal scrolling only.
- The primary note shows the page range out of all matches (`Showing 101–200 of 1,234
  matching contracts`), or the match count when one page suffices. The secondary note
  keeps the scan totals (`From X contracts scanned across Y symbols`), so page range and
  scan completeness are never conflated.
- Page navigation sits above and below the table and appears only when there is more than
  one page. Every filter, sort, universe, strategy or search change resets to page 1; a
  refresh that shrinks the result set clamps the page instead of showing an empty one.
- **Dividend marker:** an orange `D` appears after the expiry date when the next
  ex-dividend date is after today and on or before that row's expiry. A filled circle is
  an announced date; an outlined circle is estimated from the median interval between
  regular dividends. Hover, focus, or tap shows the date, amount, the dividend-risk line,
  and—for an in-the-money covered call whose time value is below the dividend—an
  early-assignment line. The marker never hides or reorders rows.
- Dividend history is cached per New York date in `wheelhq.dividends`; only symbols
  without a cache entry are requested, and a successful batch writes `[]` for symbols with
  no rows. Failed batches stay unchecked and are retried on the next refresh.

### 5.8 Ticker tooltip and actions

Content:

- Full company name from the assets metadata.
- Exchange from the assets metadata.
- Latest price, prefixed with `$`, coloured green when Today % > 0 and red when < 0.
- Daily change in points and percent, e.g. `+5.00 (+5.0%)`, using the same colour rule.

Behavior:

- Opens on `mouseover` and `focusin`; closes on `mouseout`, `focusout`, scroll, resize, and
  render.
- Positioned above the ticker, flipping below when there is no room, and clamped to the
  viewport.
- Missing metadata degrades gracefully: the ticker is shown as the name and the exchange
  reads “Exchange unavailable”; price/change still render if available.
- Dotted equity symbols are resolved through a normalized option-root alias map, so
  `BRK.B` (`BRKB` in the option symbol) still shows its company name.
- No tooltip library or external dependency.

Ticker cell actions:

- A small round TradingView icon link sits beside the Call/Put tag and opens the
  underlying's TradingView instrument page in a new tab (`target="_blank"`,
  `rel="noopener noreferrer"`).
- A small, low-contrast circular **−** button beside the tag excludes the underlying from
  the rendered results. The action is local (no refetch), appears immediately as an
  `Exclude <symbol>` chip in the active filter summary and as `exclude=` in the URL, and is
  reversed by removing that chip.
- URL prefixes: NASDAQ→`NASDAQ`, NYSE→`NYSE`, AMEX/ARCA/NYSEARCA→`AMEX`, BATS→`CBOE`.
- The link uses the equity symbol, so `BRKB` resolves to `NYSE-BRK.B`.
- If the exchange is missing or unknown, the link falls back to
  `https://www.tradingview.com/symbols/<symbol>/` (TradingView's symbol resolver).
- The link is keyboard-focusable and does not open the ticker tooltip.

### 5.9 URL state

The URL mirrors the shareable view:

| Parameter | Meaning |
|---|---|
| `list` | `all`, `favourites`, a built-in universe id, or a custom list id |
| `q` | Ticker search; an exact ticker overrides the universe scope |
| `strategy` | `csp` or `cc` |
| `risk` | `conservative`, `balanced`, `aggressive` |
| `expiry` | `0d`, `1-7`, `8-14`, `15-28`, `29-63`, `custom` |
| `sort` | Column key, `-` prefix for descending |
| `dteMin`, `dteMax` | DTE range |
| `deltaMin`, `deltaMax` | Absolute delta range |
| `ann` | Min annualized % |
| `yield` | Min yield % |
| `spread` | Max spread % |
| `iv` | Max IV % |
| `price` | Share-price bucket: `under75`, `75-150`, `150-300`, `300plus`; ignored for saved lists |
| `sector` | `all` or one sector key (for example `tech`) |
| `avoid` | `1` hides contracts spanning an earnings date; `0` keeps them |
| `avoidDiv` | `1` hides contracts spanning an ex-dividend date; `0` keeps them |
| `exclude` | Comma-separated symbols removed from the rendered results |
| `symbols` | Symbols for a custom or shared list |
| `listName` | Display name for a shared list |

An absent `price` leaves the saved bucket alone; an unknown value is ignored. Old
`priceMax` and `priceMin` parameters are retired. Other absent parameters likewise fall
back to saved/default values; only the parameters present in the URL override state.

### 5.9a Shareable screens

- **Share** in the top bar opens a dialog with the canonical URL for the current screen
  and a **Copy link** action.
- The URL serialises the universe, ticker search, strategy, risk profile, expiration,
  price bucket, every Fine-tune value, sector, avoid flags and exclusions.
- Favourites and custom lists are frozen for the shared link: `list=shared` plus the
  current `symbols` and `listName`. The owner therefore opens the same snapshot as any
  recipient instead of the live local list. The address bar keeps the live local list id.
- No credential, key ID or secret is ever written to the URL. The share dialog states this
  and explains that each recipient screens with their own key.
- The clipboard API is used when available; on failure the URL is selected for manual copy.
- Shared links are configurations, not result snapshots.

### 5.9b Active filter summary

- Chips above the results table show every active screening selection, including defaults:
  risk profile, expiration or custom DTE, price bucket, sector, Delta range, IV, yield,
  annualised yield, spread and avoid flags. The price chip is omitted for saved lists,
  which scan every price.
- A filter that is switched off is not shown: there is no `IV off`, `Yield off` or
  `Spread off` chip. Every other active value keeps its chip even when it matches the
  preset or the default — duplicating the sidebar is deliberate, because the strip is the
  end user's at-a-glance statement of the whole configuration, not a list of changes.
- The strip is the current configuration, not a list of deviations. A chip whose value
  differs from the active preset shows a remove control; a default chip is read-only.
  Preset expiration chips are always read-only; only a custom DTE range is removable.
- The active risk profile is the baseline for the Delta, annualised-yield and spread chips.
  A Conservative profile shows `Δ 0.10–0.25` and `Ann ≥ 8%` as read-only (spread stays off);
  tweaking one makes its chip removable and removal restores the profile value.
- **Reset filters** is shown only while at least one criterion is removable. It resets all
  criteria and exclusions but keeps the universe and ticker search. It is the only reset
  control; the sidebar has no duplicate.
- Chips derive from the same state that writes the URL, so they stay synchronised with it.

### 5.9c Data and API status

- The top-bar **Data and API status** menu reports only what is not already in the header:
  the provider, one line explaining derived quotes and the IEX stock feed, the last
  refreshed time, and the index and earnings data dates (day-month-year, with `bundled`
  marked when the snapshot is local). The summary shows `Last refreshed 15:03:34` and the
  status dot or chip, in that order, including on narrow screens.
- Connection states are `Live`, `Indicative quotes`, `Connection error`, `Loading…`,
  `No data`, `No key` and `Idle`. A refresh failure sets `Connection error`; a feed without
  OPRA access is `Indicative quotes`, never merely "delayed", and stays distinct from an
  error. `Live` requires at least one successful chain response and a success-derived
  updated time; an all-failed scan sets `No data` even when the header previously said Live.
- The menu never duplicates controls: refresh lives on the header split button, and key
  management is the header key control (or the first-run prompt).
- Visual hierarchy: the dark `neutral` split Refresh control is the primary action; the Buy
  Me a Coffee link is the only fixed brand colour (`#FFDD00`); Share and the key control are
  plain actions with no background or border. Status is a dot plus label for success and
  neutral states, and a soft `warning`/`error` tinted chip with an alert icon for states
  that need attention. Both use the active theme's tokens and stay legible in emerald and
  night.
- The header's **Refresh** button is a split control: the main part refreshes, and the
  attached interval menu offers `Off`, `1 min`, `5 min` and `10 min` (default off). The
  choice is stored on the device.
- The header carries a static Buy Me a Coffee link (cup icon, visible text, the standard
  `#FFDD00` background with dark text) immediately left of the connection-status and Alpaca
  key controls, plus inline SVG icons on **Share** and **Refresh**. Icons
  are `aria-hidden`, inherit `currentColor` for both themes, and never replace the visible
  labels; the refresh icon spins only while loading and honours `prefers-reduced-motion`.
- A connected key shows a header control (`Alpaca: session key` or `Alpaca: saved key`), a
  small success dot beside the label, that
  opens the key dialog. With no key, a first-run prompt explains the three-step setup and
  links to the About key section. Keys stay browser-only; session storage is the default.

### 5.10 Persistence

| Key | Content |
|---|---|
| `wheelhq.alpacaKey` | `{keyId, secret}` in `sessionStorage`, or `localStorage` when remembered |
| `wheelhq.watchlist` | Favourites symbol array |
| `wheelhq.lists` | Custom lists |
| `wheelhq.activeList` | Selected list id (shared lists are not persisted) |
| `wheelhq.strategy` | `csp` or `cc` |
| `wheelhq.risk` | Risk profile key |
| `wheelhq.expiry` | `0d`, `1-7`, `8-14`, `15-28`, `29-63`, or `custom` |
| `wheelhq.filters` | Shared filter object (including `minPrice`, `maxPrice`, and `avoidEarnings`) |
| `wheelhq.theme` | `emerald` or `night` (raw string, not JSON) |
| `wheelhq.fineTuneOpen` | Boolean in `sessionStorage`; Fine-tune open/closed for this tab only |
| `wheelhq.dividends` | Daily dividend cache: `{version, date, bySymbol}` where each symbol maps to `{ex, rate, special}[]` |

Excluded symbols are not stored separately: exclusions live in `exclude=` in the URL and
last for the current view. A reload without that parameter restores the excluded rows.

Writes report success. A failed `localStorage`/`sessionStorage` write raises a dismissible
storage banner, and the key notice reports what actually persisted: durable, session-only,
or memory-only. A cached dividend row that fails validation is dropped with its symbol, so
that symbol is fetched again instead of crashing event lookup.

The default is DaisyUI `emerald`, but with no stored theme the app follows the OS
`prefers-color-scheme` preference (`night` for dark). A tiny self-hosted
`theme-init.js` applies the stored/system theme before first paint; the toggle switches
and writes `data-theme` on `<html>`. Stored legacy theme names (`corporate`, `light`,
`bumblebee`, `winter`, and `dark`) migrate to `emerald` or `night`.

Filter state is written to `wheelhq.filters` on load (including URL overrides) and after
each edit. State writes are debounced (200 ms), and the URL is rewritten at the same time.
Legacy `turnwise.` keys are read once and migrated to `wheelhq.`; removals delete both
prefixes.

Strategy colour system:

- `CSP` uses DaisyUI `primary`; `CC` uses DaisyUI `secondary`.
- `<html data-strategy="csp|cc">` sets `--filter-accent`, which drives the strategy
  buttons, active risk/expiration buttons, price-bucket checkboxes, and the DTE, delta,
  and every Fine-tune slider fill and thumb (Max IV, Min yield, Annualised yield, Max
  spread).
  The header **Refresh** button and active dropdown/button states use DaisyUI `neutral`.
- The colours come from the active DaisyUI theme, so they stay legible in both
  `emerald` and `night`. No custom primary/secondary overrides are applied; the theme
  defaults are used (emerald primary is green, secondary is blue).

DaisyUI semantic colour names available to components:

| Name | Pair | Current use |
|---|---|---|
| `primary` | `primary-content` | CSP strategy/accent, Put badges, default primary buttons |
| `secondary` | `secondary-content` | CC strategy/accent, Call badges |
| `accent` | `accent-content` | available, not currently used |
| `neutral` | `neutral-content` | Refresh button, active dropdown/button states |
| `base-100/200/300` | `base-content` | page, panel, and border surfaces; body text |
| `info` | `info-content` | available, not currently used |
| `success` | `success-content` | positive daily changes |
| `warning` | `warning-content` | alert banner and the indicative-quotes chip |
| `error` | `error-content` | negative daily changes and form errors |

Each name also has component utilities such as `bg-*`, `text-*`, `border-*`, `btn-*`,
`badge-*`, `alert-*`, `checkbox-*`, `toggle-*`, `range-*`, `input-*`, `select-*`, and
`link-*`.

### 5.11 Refresh and auto-refresh

The full refresh pipeline, in order:

1. On a manual/initial refresh, load `indexes.json`, `earnings.json` and the Alpaca
   asset map. Auto ticks reuse the data already in memory.
2. Build the universe: All = the S&P 500 + Nasdaq-100 union; S&P 500/Nasdaq-100 use their
   membership arrays; Favourites/custom lists use their own symbols.
3. Apply the sector filter and the `has_options` membership filter.
4. Fetch one stock snapshot per 200-symbol batch for the whole universe (3 calls for 518
   names).
5. Keep symbols whose price falls in the mandatory share-price bucket; order by dollar
   volume, then trade count, then symbol.
6. Start chains for the ordered bucket with at most 10 in flight, calling Alpaca until a
   persistent 429. Symbols not reached are skipped and reported; in-flight chains finish.
7. Screen each symbol's chain; replace that symbol's rows as the chain arrives. Attach
   stock price and daily change from the snapshot.
8. Fetch dividends for the scanned symbols after the chains, so markers appear when the
   corporate-action request returns.
9. Set the chain scope and alerts; a scope change during the scan starts a new scan.

Refresh behavior:

- Only the first load and an explicit **Refresh** force fresh datasets. Auto ticks and
  scope changes (list, sector, price bucket, strategy, DTE) reuse the loaded inputs under
  the same hourly/daily cadence. When inputs do reload, indexes and earnings load in
  parallel with the asset map.
- Auto-refresh runs at the chosen 1/5/10-minute interval (or not at all), restarts the
  timer after every scan, and reloads the datasets at most hourly and the asset map once
  per New York day. The interval persists across reloads; it is not part of the share URL.
- Dividend requests own an abort controller: a new refresh, key removal, or unmount cancels
  them. Unmount also clears the scope, state-write and search timers.
- Every refresh has a generation token; results from an older refresh cannot replace a
  newer list, key, or filter.
- A newer refresh aborts the previous scan with an `AbortController`.
- Ordinary filtering and sorting do not refetch; they operate on in-memory chains.
- Changing the list, sector, share-price bucket, strategy, or expiration/DTE starts a new
  scan (after a short debounce for slider movement). Delta, yield, annualised yield,
  spread, IV, avoid-earnings, and avoid-dividends only re-filter rows on screen.
- There is no liquidity score cache; a manual Refresh always re-fetches prices and chains.
- A full page reload clears everything held in memory.

### 5.12 Error and empty states

- No key: first-run **Connect Alpaca to load option chains** prompt above the universe bar;
  the table stays empty and makes no chain request.
- Empty and loading results render below the table header as a wrapping block, not as a
  cell inside the wide scroll row: "Scanning symbols…" while chains load, otherwise the
  specific empty reason.
- Per-symbol chain errors: one alert line per failed symbol.
- Delayed feed: `Indicative quotes` chip when the indicative feed is used; the copy never
  calls derived quotes "delayed" without naming the feed.
- An active event filter with no data to filter on shows a warning instead of silently
  passing rows: earnings loading or unavailable, earnings older than the latest expected
  weekday build (23:00 UTC plus a 30-minute grace), and dividends loading/unavailable/
  missing for some scanned symbols, or from an earlier day. The earnings warning carries a
  **Refresh** action, and both dataset dates are always visible in the Data and API status
  menu.
- Rate limits and transient 5xx: retried with backoff; `Retry-After` is optional because
  cross-origin responses may not expose it, so exponential backoff is the fallback. A
  persistent 429 halts new scheduling; per-symbol `HTTP 429` lines are collapsed into one
  alert instead of one line per symbol.
- Rejected key (`401`/`403` from Alpaca, including the stock-snapshot request): one clear
  alert — `Alpaca rejected the saved key. Replace it or remove it.` — with a **Replace key**
  button. Raw per-symbol `HTTP 401` lines are collapsed and not shown. When no key is
  present at all, the key prompt is shown instead and no chain request is made.
- Chain truncation: alert naming the affected symbols.
- Missing stock snapshot: alert explaining that price-based metrics are hidden. A failed
  snapshot batch marks only its own symbols missing; other batches keep their prices.
- Request timeout: a `Request timed out after 20s` error is surfaced; a superseded refresh
  still aborts silently.
- Empty list after sector filtering: explanatory empty row asking for **All Sectors**.
- Empty price bucket: "No symbols in this price bucket."
- Empty Today scan: "No contracts expire today."
- Rate-limited scan: "Scanned X of Y names; Z not scanned (Alpaca rate limit). Try again
  in a minute." Shown instead of the per-symbol 429 lines when the scan halts; skipped
  symbols' old rows are removed.
- Assets metadata unavailable: membership check fails open and every list symbol is
  scanned; the failure is silent in the UI and the request is retried after 60 seconds.
- Dataset fetch failure: fall back to the bundled snapshots and keep screening; the Data
  and API status menu shows the date with `(bundled)` as **Index data**. If both sources fail, index
  universes show an explanatory row and earnings markers are omitted.
- Key validation failures: inline message in the Key dialog.

---

## 6. Data sources and API contract

All requests are browser-direct with:

```
APCA-API-KEY-ID: <key id>
APCA-API-SECRET-KEY: <secret>
```

Alpaca returns `Access-Control-Allow-Origin: *` for the data and brokerage hosts used here.

### 6.1 Endpoints

| Purpose | Endpoint | Parameters | Fields used |
|---|---|---|---|
| Option chains | `GET https://data.alpaca.markets/v1beta1/options/snapshots/{symbol}` | `feed=opra` for `AK` keys, `feed=indicative` for paper/non-AK keys; `type=call|put`, `limit=1000`, `expiration_date_gte=ymdPlus(minDte)`, `expiration_date_lte=ymdPlus(maxDte)`, `strike_price_lte=spot` for puts or `strike_price_gte=spot` for calls, `page_token` | `latestQuote.bp`, `latestQuote.ap`, `latestQuote.t`, `greeks.delta`, `impliedVolatility`, `dailyBar.v` |
| Stock snapshots | `GET https://data.alpaca.markets/v2/stocks/snapshots` | `symbols=A,B,…` in batches of ≤200 (`SNAPSHOT_BATCH_SIZE`), `feed=iex` | `latestTrade.p`, `latestTrade.t`, `dailyBar.t/c`, `prevDailyBar.c` |
| Cash dividends | `GET https://data.alpaca.markets/v1/corporate-actions` | `types=cash_dividend`, `symbols` (up to 200 per batch), `start=today−13 months`, `end=today+3 months`, `limit=1000`, `page_token` | `corporate_actions.cash_dividends[].symbol`, `ex_date`, `rate`, `special` |
| Assets | `GET https://paper-api.alpaca.markets/v2/assets` (fallback to live) | `status=active`, `asset_class=us_equity`, `attributes=has_options` | `symbol`, `name`, `exchange` |
| Key test | `GET https://data.alpaca.markets/v2/stocks/bars` | `symbols=SPY`, `timeframe=1Day`, `limit=1`, `feed=iex`, `start`, `end` (seven-day window) | HTTP status only |

Runtime datasets are served by the `wheelhq-datasets` service, not Alpaca:

| File | Purpose | Fields |
|---|---|---|
| `indexes.json` | index membership, sectors, data date | `schemaVersion`, `effectiveDate` (oldest constituent source date), `generatedAt`, `sources.{sp500,sectors,ndx,qqq}`, `indexes.sp500`, `indexes.ndx`, `sectors` |
| `earnings.json` | next report per symbol | `schemaVersion`, `effectiveDate`, `generatedAt`, `horizonEnd`, `currency`, `earnings.{symbol}.{date,session,status,name,marketCap}` |

Host selection: `wheelhq.xyz`/`www` use `https://datasets.wheelhq.xyz`; a `-app.` host
replaces that label with `-datasets.`; localhost and other hosts use `static/data/`.
Manual/initial refresh clears the dataset cache and re-fetches with an 8-second timeout;
auto ticks reuse the loaded copy. Invalid JSON, a wrong `schemaVersion`, an HTTP error, or
a timeout falls back to the bundled snapshot.

### 6.2 Alpaca behavior learned during implementation

- `/v2/assets` lives on the **trading** hosts (`paper-api` or `api`), not
  `data.alpaca.markets`.
- `attributes=has_options` is applied on every assets request. `status=active` and
  `asset_class=us_equity` are also applied. The request does **not** send `exchange`, so
  assets from every exchange are returned.
- Assets metadata requires trading/asset access. Data-only keys receive 401/403; the app
  fails open for the optionable-membership check.
- `most-actives` supports `top` from 1 to 100. It returns only `symbol`, `volume`, and
  `trade_count`, not company names or exchanges. The app no longer calls these endpoints;
  All is the index union.
- Stock snapshots use the **newest** of `latestTrade.p` and `dailyBar.c` by provider
  timestamp, and `prevDailyBar.c` for the previous close. A trade without a timestamp
  cannot be shown to be newer than a timestamped close, so the close wins; when neither is
  timestamped the trade keeps its historical preference. Daily points are
  `price − previous`; daily percent is `(price − previous) ÷ previous × 100`.
- The chosen price observation keeps its provider timestamp (`priceTime`); each option row
  keeps `latestQuote.t` (`quoteTime`). The tooltip shows the price time and its IEX source.
  A row whose quote date is earlier than the stock price date is marked `quoteStale` and
  excluded from results: a prior-session premium cannot satisfy a screening filter. The
  results summary reports how many contracts were hidden for this reason.
- The snapshot carries the two most recent daily bars. The liquidity score uses the last
  **completed** session: while today's `dailyBar` exists and New York time is before 16:15,
  use `prevDailyBar`; otherwise use `dailyBar`. If the chosen bar has `v <= 0`, use the
  other bar. Dollar volume is `v × c`; trade count is `n`.
- Snapshot requests are batched at 200 symbols (`SNAPSHOT_BATCH_SIZE`). The
  Favourites/custom price path uses the same helper, so a capped 50-symbol list costs one
  price request.
- Batch failures are isolated: if one batch fails with a non-auth/non-rate-limit error
  (for example one bad symbol returns 422), only that batch's symbols are marked absent
  and the successful batches' prices are kept. `401`/`403`, persistent `429`, and caller
  aborts still fail the whole request so the error UI is not hidden.
- A stock snapshot entry that is `null` or absent is treated as absent (`present: false`),
  scores zero, and is named in the missing-price alert.
- Option snapshots provide the quote, greeks, IV, and daily volume. Suppressed/zero bids
  are dropped. A `null` option snapshot entry is skipped like a zero bid and does not fail
  the rest of that symbol's chain. A crossed quote or a non-numeric side keeps the row but
  marks it invalid, so no yield or spread is derived from it; a missing `dailyBar.v`
  stays `null` (rendered `—`), never `0`.
- `PK`-prefixed keys usually belong to paper and `AK`-prefixed keys to live. This orders
  broker-host attempts and selects the initial options feed; the other host is retried on
  401/403.
- The free options feed is `indicative` — derived quotes, not OPRA; `opra` requires an
  options data subscription. `AK` keys try `opra` first; paper/non-AK keys start on `indicative`. A
  401/403 on `opra` switches the rest of that refresh to `indicative`; symbol-specific
  404/422 responses do not. 429 and transient 5xx responses are retried with exponential
  backoff. `Retry-After` is used when exposed; otherwise the exponential delay is the
  fallback.
- Stock prices use the free `iex` feed.

### 6.3 Chain window and pagination

- Window: the active **minimum DTE** through the active **maximum DTE**, both clamped to
  0–63 days (`MAX_DTE`). The defaults are 1–7 days.
- Requests include only the selected strategy's option type: `put` for CSP, `call` for CC.
- Requests are narrowed server-side to the **out-of-the-money strike side**:
  `strike_price_lte=spot` for puts and `strike_price_gte=spot` for calls. This drops deep
  in-the-money contracts and cuts both the page count and the payload.
  - Spot comes from the `iex` stock snapshot. If the price is missing or non-positive, the
    cutoff is omitted and the full chain is fetched.
  - A deep-ITM view is outside the current wheel use case; it would need the cutoff removed
    or made configurable.
- Strategy or DTE-range changes trigger a scoped refetch; the 300 ms debounce prevents one
  request per slider tick.
- Up to **5 pages × 1000 snapshots** per symbol (`PAGE_CAP`).
- Pagination uses `next_page_token`; a chain that is still truncated is named in the
  alert so the user can narrow the DTE range and refetch.
- Contracts with `bid <= 0` are excluded. A missing ask (`ask <= 0`) produces no spread;
  the max-spread filter rejects it when enabled.

### 6.4 Rate-limit budget

- Alpaca free tier: roughly 200 requests/minute.
- There is no client-side request budget: the scan calls Alpaca until a persistent 429,
  retries with `Retry-After`/exponential backoff, then halts and reports
  "Scanned X of Y names; Z not scanned (Alpaca rate limit)".
- Chain fetches use 10 concurrent workers; each symbol is one request plus any pages.
- One full-bucket scan: 3 snapshot calls for the 518-name union plus at most ~140 chain
  calls. Chains already in flight when the halt arrives finish; symbols not reached are
  skipped, reported in the scan alert, and never queued. Their old rows are removed.
- Manual/initial refresh also fetches the asset map and two dataset files. Auto ticks
  reload the datasets at most once an hour and the asset map once per New York day.
- Dividends add at most one corporate-actions request per 200 uncached symbols per New York
  date; failed batches are retried rather than cached as empty.
- Asset metadata is one request per manual/initial refresh, plus at most one per New York
  day from auto ticks. Failures fail open and do not block screening.
- Every request has a 20-second deadline (`REQUEST_TIMEOUT_MS`). A stalled request fails
  with a visible timeout error instead of leaving the refresh running forever; a caller
  abort still surfaces as an abort, not a timeout.
- 429 responses retry up to three times with exponential backoff; 5xx responses retry
  once. Auto-refresh ticks do not overlap an active refresh. Stale results are ignored,
  and a newer refresh aborts the previous scan.

---

## 7. Calculations

Given a parsed contract and its stock snapshot:

```
spot        = newest of latestTrade.p and dailyBar.c by provider timestamp
              (an untimestamped trade loses to a timestamped close; ties go to the trade)
spotTime    = the timestamp of that observation, when present
previous    = prevDailyBar.c
changePct   = (spot - previous) / previous * 100
changePts   = spot - previous

quoteOk     = bid >= 0 && ask >= 0 && !(ask > 0 && bid > ask) && both finite
yieldPct    = !quoteOk ? null : side === 'C' ? bid / spot * 100 : bid / strike * 100
annualized  = yieldPct * 365 / max(dte, 1)          // simple extrapolation
otmPct      = side === 'C'
                ? (strike - spot) / spot * 100
                : (spot - strike) / spot * 100
spreadPct   = quoteOk && ask > 0 && mid > 0 ? (ask - bid) / mid * 100 : null
breakeven   = !quoteOk ? null : side === 'C' ? spot - bid : strike - bid
```

`spreadPct` is null when the ask is missing in an otherwise usable quote. A crossed or
non-numeric quote marks the row invalid (see 5.7) rather than producing a negative spread.
Calls with no spot have a null breakeven; the table renders `—`.

Assumptions:

- 100 shares per contract.
- Premium is collected at the bid.
- Puts are cash-secured against the full strike value.
- Annualisation is a plain premium-rate extrapolation: not compounded, not a forecast,
   and a 0DTE yield is annualised over a one-day floor. A high `Ann %` is not evidence of a
  better trade.
- The call breakeven is a reference for a new buy-write from spot, not an owned-share cost
  basis; premium yield and called-away return are different measures.
- No commissions, assignment fees, dividend-adjusted yield, or taxes.

OCC symbol parsing:

```
^([A-Z]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$
```

Example: `AAPL261120C00240000` → root `AAPL`, expiry `2026-11-20`, side `C`, strike 240.

---

## 8. State model

| State | Purpose |
|---|---|
| `watchlist` | Favourites symbols |
| `lists` | Custom lists |
| `activeListId` | `all`, `favourites`, a built-in universe id, or a custom list id |
| `sharedList` | Ephemeral list parsed from a share URL |
| `symbolFilter` | Immediately typed ticker filter value |
| `symbolQuery` | Debounced ticker query applied to rows |
| `indexes`, `indexesSource`, `indexesError` | Index membership/sectors dataset and its origin |
| `earnings` | Earnings calendar dataset (markers and avoid filter) |
| `assetBySymbol`, `assetByRoot` | Cached asset metadata maps for tooltips and optionable-membership filtering |
| `assetMetaError`, `assetMetaKeyId`, `assetMetaRetryAt` | Assets-request state, key guard, and retry time |
| `chainScope` | Loaded `{type, minDte, maxDte}` chain scope |
| `refreshGen`, `refreshInFlight`, `refreshAbort`, `refreshError` | Generation guard, in-flight flag, current AbortController, last fatal error |
| `rows` | Flattened contract rows with price/change |
| `excludedSymbols` | Underlyings removed from the rendered results; mirrored to `exclude=` |
| `strategy` | `csp` or `cc` |
| `riskKey` | Risk profile |
| `expiryKey` | Expiration preset or `custom` |
| `filters` | Shared numeric/boolean filters, price bucket, sector, avoid flags |
| `sort` | Table sort key and direction |
| `autoMinutes` | Auto-refresh interval: `0` (off), `1`, `5` or `10` minutes |
| `theme`, `followsSystem` | `emerald` or `night`, and whether the OS preference still wins |
| `keyPair`, `keyMessage`, `keyNotice`, `keyBusy`, `keyRequest` | Active Alpaca key, dialog status message, post-save notice, in-flight guard, and validation generation |
| `keyRemember` | Whether the key is stored in `localStorage` instead of `sessionStorage` |
| `shareOpen`, `shareLink` | Share dialog state and the frozen canonical URL |
| `alerts`, `updatedAt`, `delayed`, `emptyReason`, `loading` | Result banners, updated time, and table state |
| `chainScopeTimer` | 300 ms debounce for strategy/DTE rescoping |
| `stateWriteTimer`, `stateWritePersist` | 200 ms debounced URL/storage write and persistence intent |
| `symbolFilterTimer` | 200 ms debounce for the ticker filter |
| `autoTimer` | Auto-refresh timer for the selected interval |
| `dividendInFlight` | Symbols with a dividend request in flight |

Derived helpers:

- `activeList()` resolves the selected list (Favourites is synthesized from `watchlist`).
- `side` is the Alpaca option type for the current strategy.
- `visible` applies the debounced ticker query, `computedFor()`, `pass()` and sorting; it
  exposes the total match count and the ordered matches. `paged` slices that list into a
  clamped 100-row page for the table; `page` resets on any filter, sort, universe or search
  change.
- `resultsSummary`, `listSummary`, `keyInfo`, `connectionStatus` and `dataNote` feed the
  two-line results count, market bar, header and Data and API status menu.
- `activeSymbols()` returns the deduplicated S&P 500 + Nasdaq-100 union for All, index
  membership for S&P 500/Nasdaq-100, otherwise the selected list.
- `searchSymbols()` exposes the same dataset union to the global ticker search;
  `exactTicker()` resolves an exact match and `searchOutsideUniverse` marks one outside
  the selected universe.
- `effectiveFilters` drops the price bucket for Favourites and custom lists.
- `chips` is built by `filterChips(filters, riskKey, expiryKey, excludedSymbols)` and
  omits the price chip for saved lists; `canClear` drives **Reset filters**. Preset
  expiration chips are read-only; only a custom DTE chip is removable.
- `symbolAllowed(symbol)` applies the optionable-membership check and fails open without
  metadata.
- `sectorFor()`/`chipFor()` map a symbol to a sector; `sectorOptions()` feeds the dropdown;
  the selected sector is applied before the price bucket and scan order.
- `nextEarnings()` and `earningsInWindow()` drive the `E` marker and the avoid-earnings
  rule; `nextDividend()` drives the `D` marker and the avoid-dividends rule.
- `cleanListSymbols()` normalizes, dedupes, and caps list symbols at `MAX_LIST_SYMBOLS`.
- `chainScopeFor()` and `chainScopeCovers()` derive the `{type, minDte, maxDte}` request
  scope and decide when a filter edit requires a new chain request.
- `scanSymbols()` runs one symbol's chain at a time with 10 in flight and stops taking
  new symbols once the caller halts the scan on a 429;
  `screenSymbol()` fetches and decorates one symbol's chain.
- `rankByLiquidity()` orders the price bucket before the scan; there is no 50-symbol slice.
- `computed(row)` calculates yield, annualized, OTM, spread, and breakeven.
- `pass(row, computed)` applies strategy, price bucket, delta, yield, spread, IV, and the
  avoid-earnings/avoid-dividends filters.
- `currentChainScope()`, `scheduleChainScopeRefresh()`, `writeURL()`, and
  `scheduleStateWrite()` manage the scoped refetch, URL, and debounced persistence.
  `updateFilters()` starts a scan when the price bucket, list, sector, strategy, or DTE
  changes; other filters only re-filter rows on screen.
- `refresh()` aborts the previous scan, bumps the generation, fetches the input datasets
  and assets on a manual/initial refresh, takes one snapshot per 200-symbol batch, filters
  the price bucket, orders by dollar volume, scans with 10 in flight until Alpaca returns
  a persistent 429, and ignores results from stale generations.

---

## 9. Non-functional requirements

### 9.1 Architecture

- Svelte 5 single-page app built with plain Vite; no SvelteKit routing.
- DaisyUI 5 + Tailwind 4 provide presentation; Bits UI provides behavior such as the
  multi-thumb DTE and delta sliders.
- Domain logic lives in `src/lib/` and is independent of Svelte: Alpaca client, contract
  parsing, metrics, filters, URL state, storage, and TradingView URLs.
- Components are thin and bind state to DaisyUI/Bits UI primitives.
- Production builds external JS/CSS into `dist/`; the app itself uses no inline scripts.
  The table tooltips set inline `left`/`top` positions, which is why `style-src` includes
  `'unsafe-inline'`. The `inject-seo` Vite plugin adds the CSP meta tag only to production
  builds, while Render supplies the same policy as a response header.
- Tailwind's Lightning CSS optimization step is disabled because DaisyUI's `@scope`
  selectors trigger “Invalid empty selector” warnings there. Vite minifies the final CSS
  with esbuild instead, so the build is quiet and still minified.
- Logic is covered by 31 Vitest files (314 tests as of 2026-11-17): domain, Alpaca
  requests/batching/timeouts, datasets, URL, storage, initial state, lists, filter
  summary, selection/ranking, scan, refresh, date/DST, dividends, earnings, sectors,
  theme, environment, SEO and analytics. Svelte/TypeScript checks for `src/` and `test/`
  run through `svelte-check`.
  Playwright covers happy paths in `e2e/happy-paths.e2e.ts` with mocked Alpaca traffic
  (`npm run test:e2e`), plus a Pixel 5 mobile project in `e2e/mobile.e2e.ts`, blocked
  storage, a cancelled-scope race, a New York midnight rollover with the browser clock, and
  an input-cadence test (a scope change reuses datasets, an explicit refresh reloads them).
  Desktop Chromium and WebKit run locally; CI also runs Firefox.
  `e2e/live-csp.e2e.ts` and `e2e/screenshot.e2e.ts` are opt-in checks for the deployed CSP
  and documentation screenshot.
- ESLint 9 (flat config in `eslint.config.js`) lints TypeScript, tests, and Svelte
  components with `@typescript-eslint` and `eslint-plugin-svelte`; Prettier enforces
  formatting with `prettier-plugin-svelte` and sorts Tailwind utility classes with
  `prettier-plugin-tailwindcss` (using `src/app.css` as the Tailwind v4 stylesheet).
  `npm run lint`, `npm run lint:fix`,
  `npm run format`, and `npm run format:check` are the standalone entry points.
- `npm run check` runs `svelte-check`, `eslint .`, `prettier --check .`, and `vitest run`;
  `npm run build` produces the static bundle.
- `.github/workflows/check.yml` runs `npm ci`, `npm run check`, `npm run build`, installs
  Chromium, Firefox and WebKit, and runs the Playwright projects on pushes to `main` and on
  pull requests.
- `render.yaml` builds with `npm ci --include=dev && npm run build` and publishes `dist/`.
- Canonical and Open Graph URLs, `robots.txt`, and `sitemap.txt` use
  `https://wheelhq.xyz/`. The dev service is `https://wheelhq-app.onrender.com/`.

### 9.2 Security

- The Alpaca key lives in `sessionStorage` by default and `localStorage` only when the
  user opts in to remembering it. It is read only by the app. The first-run prompt and Key
  dialog explain both states; removing a key asks for confirmation.
- A restricted Content-Security-Policy and frame protection are configured in
  `render.yaml`; the production build injects the same CSP as a meta tag into `index.html`
  for hosts that cannot set response headers. `X-Frame-Options` is `SAMEORIGIN`, which
  blocks external framing.
- The Key dialog recommends a paper-trading key and warns that a live key can place trades.
  It also explains that a market-data-only key is enough for screening, that options data
  access decides `indicative` vs `opra`, and that assets access only affects names and the
  optionable filter.
- Svelte escapes text by default; the app contains no `{@html}` or bespoke HTML-injection
  helper.
- No third-party JavaScript runs in the page. Production builds add a 1×1 GoatCounter
  image pixel (`VITE_ANALYTICS=1`), with a fixed `p=/` or `p=/about/` path, no query string
  and `referrerpolicy="no-referrer"`; the CSP allowlists only the GoatCounter host in
  `img-src`. The former Buy Me a Coffee widget, its iframe, `static/bmc.html`, path-scoped
  CSP and Google Fonts hosts are gone; the header and About page link to
  `https://buymeacoffee.com/wheelhq` directly. Inline positioning styles on the table
  tooltips are why `style-src` includes `'unsafe-inline'`.
- The key is sent only to `*.alpaca.markets`.
- A production deployment should use a key scoped to market data if trading permissions
  are not needed.
- Dependency audit: production dependencies are clean (`npm audit --omit=dev`). The only
  remaining dev advisory is `deepmerge` through `@sveltejs/vite-plugin-svelte`, which has
  no fixed release (2 low-severity findings).

### 9.3 Performance

- Chains are fetched in parallel with bounded concurrency.
- Filtering and sorting are local; only strategy or DTE-range changes rescope the chain
  request.
- Stock snapshots are batched at 200 symbols per request; hashed build assets are cached
  immutably while HTML is always revalidated.
- The ticker filter is debounced by 200 ms before filtering/sorting, so typing does not
  trigger the whole result pipeline on every keystroke.
- Per-row metrics are memoized in a `WeakMap` keyed by the row object, so filtering and
  sorting do not recompute yield/spread/breakeven. Refreshed rows are new objects, so
  their cache entries are reclaimed.
- Only the current 100-row page is rendered; filtering and sorting still cover every
  loaded match.
- Domain helpers are unit-tested; UI behavior is checked manually.
- Auto-refresh is opt-in (off by default), runs at 1, 5 or 10 minutes, and the choice
  persists in `localStorage`.

### 9.4 Accessibility and UX

- Tickers are keyboard-focusable and show the tooltip on focus; the tooltip hides on
  mouse-out, blur, scroll, resize, or when its rows disappear.
- Tooltip content is text, not colour-only; colour duplicates the signed values.
- Market buttons expose `aria-pressed`.
- Table headers contain a real `<button>` (so Enter/Space work natively), communicate the
  active sort with an arrow and `aria-sort` on the `<th>`, and retain text alignment.
- The ticker tooltip is linked to its trigger with `aria-describedby` while visible, and
  the sort arrow is `aria-hidden` because `aria-sort` already conveys direction.
- Dialogs expose `role="dialog"`/`aria-modal`, are named with `aria-labelledby`, close on
  Escape, trap focus, and return focus to the opener. The Key dialog focuses the Key ID
  input and the Lists dialog focuses the name input after opening.
- The DTE thumbs are keyboard-operable in calendar days: arrows move one day,
  Shift+Arrow seven, Page Up/Down ten, and Home/End jump to the range edge.
- Each single-thumb Fine-tune slider exposes its visible label as its accessible name
  and is keyboard-operable with Arrows, Page Up/Down, and Home/End.
- Event markers are 24px circles. Row actions keep the compact 16px help-button look; the
  exclude control carries a 24px invisible hit area so touch targets stay usable.
- Tooltips dismiss on Escape as well as mouse-out, blur, scroll, resize or row changes.
- Result counts and page changes are announced through a polite live region; scan progress
  is visible as `Scanned X of Y symbols, Z remaining…` instead of being inferred from rows
  appearing. Key-dialog and list-import messages are live-region status text.
- The layout is responsive; the market bar wraps on narrow screens. Below the `lg`
  breakpoint the filter panel is collapsed behind a **Filters** toggle showing the active
  filter count, and a **Results** link jumps to the table.

---

## 10. Deployment

Target: Render static site.

- `render.yaml` builds the app and publishes `dist/`.
- Build command: `npm ci --include=dev && npm run build`.
- Publish path: `./dist`.
- Build runtime: `NODE_VERSION=22` (Vite 8 requires Node 20.19+ or 22.12+).
- Deploy after CI checks pass (`autoDeployTrigger: checksPass`); the workflow runs
  `npm run check` and `npm run build`.
- Response headers: restricted CSP, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options:
  nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a minimal
  `Permissions-Policy`. `Cache-Control` is `no-cache` for HTML and
  `public, max-age=31536000, immutable` for `/assets/*` (fingerprinted by Vite).
- `dist/` is git-ignored; Render always builds it from the lockfile.
- No server process, runtime environment variable, or secret is required.
- Any static host works; the relative asset paths also support a project subpath.
- HTTPS is provided by the host.

---

## 11. Acceptance criteria

A build is acceptable when all of the following hold:

1. A normal load starts on **1–7d**, **Balanced**, and **Nasdaq-100**.
2. An explicit URL `expiry=8-14` or DTE range overrides the 1–7d default.
3. A previously saved bucket or custom DTE range is preserved.
4. US Options scans the whole dollar-volume-ordered price bucket, without a 50-name cap,
   and stops only at Alpaca's persistent 429.
5. S&P 500 and Nasdaq-100 use `indexes.json`; US Options is their deduplicated union. The
   `has_options` asset map filters membership only; it does not define the universe.
6. The Sector dropdown filters before ranking, includes all 11 sectors plus **Other**,
   and maps unknown names to **Other**.
7. Asset-membership and sector filtering are applied before the price bucket and scan
   order.
8. Asset-metadata failure fails the membership check open; a dataset failure falls back to
   the bundled snapshots without emptying the table.
9. The table has 15 columns in the specified order, including Spread % as column 8.
10. Today % is signed and coloured by direction.
11. Ticker hover/focus shows company name, exchange, coloured price, points, percent,
    and the OCC symbol; clicking the ticker copies the OCC symbol.
12. Favourites and custom lists persist across reloads, and shared-list URLs carry symbols.
13. A missing ask does not pass the max-spread filter.
14. Chain truncation and missing stock prices produce visible warnings.
15. Stale refreshes cannot replace a newer list's results.
16. The Alpaca key is session-only unless the user opts in to remembering it.
17. CSP and frame-protection headers are configured for the deployed site.
18. Each row shows the position requirement under the strike: cash secured for a put and
    100 shares for a call.
19. An expiry outside the current year carries a short year.
20. CC mode states that the screened list is not the user's holdings.
18. The key never leaves the browser except in requests to Alpaca.
19. `npm run check` passes and the page loads without console errors.
20. Desktop and narrow mobile layouts both keep the controls usable.
21. Chain requests are scoped to the selected strategy's option type and the active
    minimum/maximum DTE; strategy or DTE-range changes refetch after a 300 ms debounce.
22. Rapid successive filter changes preserve every pending persistence request.
23. Reloading with 15–28 selected and no URL override restores 15–28.
24. Lowercase symbols in a shared-list URL are parsed correctly.
25. A superseded refresh aborts its in-flight requests and retries.
26. Keyboard focus remains on the sorted column header after re-render.
27. Retry backoff works when `Retry-After` is not exposed cross-origin.
28. A shared list can be saved as a custom list.
29. The key control distinguishes session and saved keys.
30. ARCA and NYSEARCA listings link to TradingView's `AMEX` page; the BATS→`CBOE`
    mapping exists, but BATS assets are not fetched, so it is not currently reachable.
31. Setting max spread to 0 disables the spread filter.
32. The DTE slider is logarithmic on screen but Arrow keys move whole calendar days and
    `aria-valuetext` reports days.
33. The selected strategy colour propagates to every filter accent; Refresh and active
    dropdown/button states stay `neutral`.
34. The production build completes without CSS optimizer warnings.
35. A shared URL carries the `price` bucket, and opening it writes the resolved filters
    with the rest of the saved state.
36. The US Options pool is ordered by last completed session dollar volume before the scan;
    ties resolve on trade count, then symbol, and unscored symbols rank last.
37. Sector exclusions apply to the candidate pool before the price bucket and scan order,
    and a sector change refreshes the scanned set.
38. There is no liquidity score cache; a manual refresh re-fetches prices and chains.
39. A symbol with no snapshot is excluded by the price bucket and still raises the
    missing-price alert.
40. Max spread is off (`0`) in every risk profile; any cap is a manual fine-tune, and
    `0` disables it; Max IV, Min yield, Annualised yield, and Max spread stay within their
    documented slider ranges.
41. Strategy descriptions are available as a hover tooltip and an accessible name on
    keyboard focus.
42. Out-of-range URL or persisted filter values are clamped on load rather than displayed
    raw; an unknown share-price pair snaps to the default `$75–150` bucket.
43. Lists, including shared links, are capped at 50 symbols, and the editor refuses to
    save a larger list.
44. A stalled request fails with a clear timeout message after 20 seconds instead of
    hanging the refresh, while a caller abort still behaves as an abort.
45. `.github/workflows/check.yml` runs `npm ci`, `npm run check`, `npm run build`, and the
    Chromium, Firefox, WebKit and mobile Playwright projects on pushes and pull requests.
46. `eslint .` reports no errors for `src/`, `test/`, and Svelte components, and linting
    runs as part of `npm run check`.
47. `prettier --check .` passes and formatting runs as part of `npm run check`.
48. Overlapping market-scan/assets requests cannot clear the loading state of a newer
    request, and per-row metrics are reused across filter/sort passes.
49. Ticker filtering is debounced by 200 ms, so a burst of keystrokes runs the result
    pipeline once and updates the URL when it settles.
50. A failed stock-snapshot batch marks only that batch's symbols as missing; other
    batches keep their prices, while auth/rate-limit failures still surface globally.
51. `npm run test:e2e` passes the Playwright happy paths: no-key load and key dialog, key
    save and Favourites screening, CSP→CC switch and ticker filter, 429 halt, exclusions,
    filter summary, share dialog, data status menu, earnings markers/avoid toggle,
    built-in universes, saved-list chips and frozen share links, the sector dropdown,
    global search outside the universe, share-price buckets, and saved themes.
52. The production build serves `/robots.txt` and `/sitemap.txt`, and `index.html` carries
    canonical, `og:url`, and robots metadata.
53. A dividend between today and expiry shows a `D` marker (filled when announced, outlined
    when estimated), its tooltip explains the dividend risk, and an in-the-money covered
    call whose time value is below the dividend shows the early-assignment line.
54. The dataset client uses the production/dev/derived host mapping, caches one request per
    page, and falls back to `static/data/` on HTTP error, bad schema, or an 8-second
    timeout.
55. A symbol with no sector is selectable as **Other**; there is no separate fund or
    leveraged universe.
56. An earnings date after today and on or before expiry shows `.event-mark.earn` before
    `D`; the marker is filled for expected and outlined for estimated.
57. Avoid earnings (default off) hides rows spanning an expected/estimated date from today
    through expiry, including an after-close report on the expiry day itself (assignment
    can follow that close); past and beyond-horizon dates keep the row.
58. Avoid dividends (default off) hides only rows whose expiry spans an announced or
    estimated ex-dividend date; rows with no dividend history keep showing.
59. Universe chips expose US Options, S&P 500, Nasdaq-100 and Favourites, then a divider
    and every saved list, without a dropdown; a shared list has its own group and `Shared`
    badge. Nasdaq-100 is the default, and an active universe stays visibly pressed.
60. Sector is a filter-panel control; the top bar contains no Sector dropdown.
61. An exact ticker outside the selected universe loads, shows the `IBM · Global search`
    pill with the Outside note, and leaves the universe selected; clearing the search
    removes `q` and restores it.
62. Saved lists scan every price with disabled bucket toggles, while market-wide universes
    keep a mandatory bucket.
63. Share copies a URL that restores the screen and contains no key material.
64. Active filter chips show every selected value including defaults; changed values
    expose a remove control except preset expiration chips, which stay read-only. Reset
    filters is the only reset control, keeps the universe and ticker search, and is also
    shown when only the expiration preset changed. Saved lists omit the price chip.
65. Excluding a symbol removes its rows, adds an Exclude chip and `exclude=` to the URL,
    and removing the chip restores the rows.
66. The Data and API status menu shows the provider, last refreshed time and dataset dates;
    the status dot or chip beside it distinguishes live, indicative, error and no-key states.
    Key
    management is the header badge (or the first-run prompt), and auto-refresh lives on the
    split Refresh control.
67. Sharing Favourites or a saved list freezes the current symbols into
    `list=shared&symbols=…&listName=…`; the address bar keeps the live local list id.
68. Lists export as versioned JSON (Favourites first); import merges new lists, skips
    identical ones, and renames conflicting names with `_1`, `_2` suffixes.
69. The Index data effective date is shown in the Data and API status menu, separate from
    the last refresh time.
70. User-saved screening presets and column visibility/order customisation are not part
    of this release.
71. List symbol input uppercases as typed; save strips invalid characters and separators,
    deduplicates, writes the canonical comma-separated form back, and blocks more than 50
    symbols with an inline error.
72. The global search sits at the right of the market bar with a magnifier icon and
    shortcut hint; **⌘K**/**Ctrl+K** focuses it.

---

## 12. Known limitations

- No full-market chain scan. US Options is the S&P 500 + Nasdaq-100 union, scans one
  share-price bucket per refresh, and stops at Alpaca's persistent 429.
- Names outside the index union are reachable through Favourites or a custom list, not
  through US Options.
- Ranking volume is IEX-only, not the consolidated tape.
- Early-close sessions (for example 13:00 New York time) keep the previous session's bar
  until 16:15.
- Indicative quote data on free keys: derived quotes, not OPRA, and disclosed as such.
- Asset metadata needs assets access. The optionable-membership check fails open and the
  failure is not shown in the UI; the request is retried after 60 seconds.
- 0DTE annualised yield uses one-day repeatability (`yield × 365`), so it is an
  extrapolation rather than a forecast.
- Earnings are indicative and horizon-limited. There is no IV rank, dividend-adjusted
  covered-call yield, margin-ROI view, or open-interest ranking.
- No user-saved screening presets, table column customisation, CSV export, or alerting.
- No trade execution.
- Requests are aborted when superseded; stale refreshes are ignored and auto-refresh
  skips while a refresh is running.
- No service worker; the app must be served over HTTP(S).

---

## 13. Implemented decisions and fixes

Current design decisions (the history below records only behavior that still ships):

- Static, anonymous app with browser-direct Alpaca calls; no application backend, user
  accounts, or server-side key storage.
- The Alpaca key is session-scoped by default and moves to `localStorage` only when the
  user opts in to **Keep this key on this device after I close the tab**.
- CSP and CC strategies share every filter; yield is strategy-aware, and the selected
  strategy colours all filter accents.
- Risk profiles and expiration buckets are independent filter presets. Five DTE buckets
  cover 0–63 days, the DTE slider is logarithmic on screen, and keyboard stepping is in
  calendar days with `aria-valuetext`.
- Four half-open share-price buckets (`< $75`, `$75–150`, `$150–300`, `$300+`) apply to
  market-wide universes. Favourites and custom lists scan every price.
- US Options is the deduplicated S&P 500 + Nasdaq-100 union. Index membership and GICS
  sectors come from `indexes.json`, with a bundled fallback and a derived dataset host.
- Universe selection, global ticker search, and screening criteria are separate state
  dimensions. Universe chips replace the list dropdown; an exact search outside the
  selected universe loads that symbol and shows an Outside badge without changing the
  universe.
- The scan applies the asset-membership and sector filters, then the share-price bucket,
  orders the bucket by last completed session dollar volume, and runs ten chains in flight
  until a persistent 429. There is no volatility rank or score cache.
- Chain requests are scoped to the strategy's option side and the active DTE range, and
  are narrowed to the out-of-the-money strike side (puts at or below spot, calls at or
  above spot). A missing spot omits the cutoff.
- Refresh generations, `AbortController`, a 20-second request deadline, isolated snapshot
  batch failures, and the auto-refresh in-flight guard keep stale or stalled work from
  replacing newer results.
- Earnings and ex-dividend markers, `avoid`/`avoidDiv` filters, tooltips, and the daily
  dividend cache are local and indicative.
- Share links serialise the complete screening configuration and never credentials.
  Favourites and saved lists are frozen as an ephemeral `list=shared` list.
- The active filter summary shows the whole configuration, including defaults; only
  changed values are removable. **Reset filters** resets criteria and exclusions but keeps
  the universe and ticker search.
- Row exclusion is local and URL-only; it does not persist or change the scanned pool.
- Lists export to and import from a versioned JSON file. Import is additive: identical
  lists are skipped, name conflicts get `_1`/`_2` suffixes, and local lists are never
  overwritten or deleted.
- The Data and API status menu reports provider, last refreshed time and dataset dates;
  refresh, auto-refresh and key management live in the header.
- Theme follows the OS until the user picks one; `theme-init.js` paints the stored/system
  theme before first paint.
- SEO metadata, canonical/Open Graph URLs, `robots.txt`, `sitemap.txt`, a standalone About
  page, and non-production `noindex` handling are part of the static build. The About page
  explains the no-account/browser-only model and Alpaca key workflow, carries a QR code
  and a plain link to Buy Me a Coffee, and lists `hello@wheelhq.xyz` for contact.
- Analytics is a production-only GoatCounter pixel with a fixed page path; it sends no
  keys, page URL, filter values or tickers, and runs no script. The donation link is
  static.
- ESLint 9, Prettier, `svelte-check`, and Vitest run in `npm run check`; CI also builds the
  app and runs the Playwright happy paths. The production CSP smoke test is opt-in
  (`LIVE=1`).

Superseded earlier designs (kept here so old notes are not mistaken for current behavior):

- Weekly/Monthly expiration presets and a 90-day cap → five buckets within 0–63 days.
- Exchange switch, top-100 ranking, curated liquid symbols, volatility ranking, a 50-name
  cap, and a score cache → index-union universes with a full-bucket dollar-volume scan.
- ±30 % strike band and covered-call cost basis in the chain scope → out-of-the-money
  strike-side cutoff only.
- Index funds and Leveraged & Volatility universes → removed.
- Maximum-share-price toggles/slider (`priceMax`) → four share-price buckets.
- 150-symbol list cap → 50 (`MAX_LIST_SYMBOLS`).
- The old `market` URL parameter and `wheelhq.marketMode` key are ignored.

---

## 14. File map

```
index.html            Vite entry; SEO metadata and production CSP meta are injected at build time
vite.config.ts        Vite/Svelte/Tailwind/DaisyUI, CSP/SEO injection, About dev route
svelte.config.js      Svelte preprocessing
eslint.config.js      ESLint flat config (TypeScript + Svelte)
.prettierrc           Prettier config (Svelte + Tailwind plugins, single quotes, 100 columns)
.prettierignore       Generated code, lockfile, Markdown, and harness scratch
tsconfig.json         TypeScript/Svelte configuration (src + test)
src/main.ts           mounts the Svelte app and applies the host robots policy
src/App.svelte        screen orchestration, refresh, URL/storage, theme/strategy effects
src/components/       market bar, filters, table, data status, key/lists/share dialogs, sliders
src/app.css           Tailwind + DaisyUI + app styles, theme and strategy accents
src/lib/config.ts     price buckets, columns, presets, and limits
src/lib/datasets.ts   dataset fetch, validation, host selection, bundled fallback
src/lib/domain.ts     parsing, metrics, filter sanitization, chain scope, log DTE mapping, TradingView URLs
src/lib/alpaca.ts     browser-direct Alpaca client, batching, timeouts, and screen pipeline
src/lib/date.ts       New York date and clock-time helpers
src/lib/format.ts     number and percent formatting
src/lib/ranking.ts    session-bar selection and liquidity ordering
src/lib/selection.ts  universe lookup, global ticker search, candidate count, sort values
src/lib/filtersSummary.ts  active filter chips and removable values
src/lib/listSummary.ts     universe-bar count and saved-list ticker names
src/lib/resultsSummary.ts  two-line matching/scanned results count
src/lib/keyStatus.ts       key control labels and session/saved detail
src/lib/initialState.ts    URL + saved-state resolution for the first render
src/lib/lists.ts      custom-list CRUD, JSON export/validation, and merge import helpers
src/lib/scan.ts       bounded per-symbol scan runner with a halt hook
src/lib/refresh.ts    manual/auto refresh policy
src/lib/dividends.ts  dividend parsing, estimates, markers, and tooltips
src/lib/earnings.ts   earnings windows, states, tooltips, avoid rule
src/lib/sectors.ts    GICS mapping and dropdown labels/options
src/lib/storage.ts    browser storage, keys, lists, theme, dividend cache
src/lib/theme.ts      emerald/night resolution and migration
src/lib/environment.ts     production host and dataset-origin helpers
src/lib/seo.ts        non-production robots policy
src/lib/analytics.ts  GoatCounter pixel tag builder and injector
src/lib/freshness.ts  latest expected earnings build date (23:00 UTC weekdays + grace)
src/lib/url.ts        URL parse/build helpers
src/lib/types.ts      shared domain types
static/               favicons, Open Graph image, theme-init script
static/about/         standalone About page (HTML/CSS/robots helper) and bmc-qr.png
static/data/          bundled indexes.json and earnings.json snapshots
scripts/sync-datasets.mjs  refresh the bundled snapshots
test/                 Vitest coverage for domain, Alpaca, datasets, URL/storage, initial
                      state, lists, filter/list/results summaries, pagination, coverage,
                      freshness and status, key status, donation/About content,
                      selection/ranking, scan/refresh, date, dividends, earnings, sectors,
                      theme, environment, SEO and analytics
e2e/happy-paths.e2e.ts     mocked Alpaca happy paths
e2e/live-csp.e2e.ts        opt-in production CSP/console check (LIVE=1)
e2e/screenshot.e2e.ts      opt-in documentation screenshot (SCREENSHOT=1)
e2e/mocks.ts               deterministic Alpaca mocks and seeded browser state
playwright.config.ts  Playwright configuration and dev-server bootstrap
.github/workflows/    CI: npm ci + npm run check + npm run build + Playwright
render.yaml           Render Blueprint — builds/publishes dist/ with security and cache headers
package.json          scripts: dev, build, preview, test, lint, format, check, test:e2e, sync:data
LICENSE               MIT
README.md             human guide: purpose, quick-start, deployment, status and roadmap
SPEC.md               this specification
CONTRIBUTING.md       setup and pull-request checks
SECURITY.md           vulnerability reporting and key-handling policy
```
