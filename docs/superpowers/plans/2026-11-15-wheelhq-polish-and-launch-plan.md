# WheelHQ polish and launch plan

Status: steps 0–6 and 8 implemented on branch `ux-polish`; step 7 (making the repository public) is deferred pending explicit consent. Written 2026-11-15 against `wheelhq-app` at `ba38384` plus the current uncommitted MarketBar/ListsDialog work, then updated with the follow-up universe-bar, filter-panel and readout refinements.

## Steps

- [x] 0. Protect current work and lock the open decisions
- [x] 1. About page: contact, no-account story, Alpaca usage, no-dataset copy
- [x] 2. Buy me a coffee: official widget iframe, top strip, About link and QR
- [x] 3. Keys: first-run prompt, clearer dialog, visible status, safe removal
- [x] 4. Universe bar: saved-list separator, global-search scope, list names
- [x] 5. Filter panel: preset chips, info tips, prominent price note, collapsible fine-tune, one reset
- [x] 6. Readouts: clearer results count and combined status/timestamp
- [ ] 7. Public repo: audit, scrub, flip visibility, add GitHub links — **deferred, gated by D3**
- [x] 8. Verify, update docs, close out

## Decisions needed before starting

- **D1 — Buy me a coffee URL.** Confirmed: `https://buymeacoffee.com/wheelhq`.
- **D2 — BMC placement on the main screen.** Proposed: a slim strip above the header, text-only, low contrast. Alternative: a button in the existing header toolbar. A big banner is not recommended.
- **D3 — Public repo.** Proposed: make `wheelhq-app` public after the cleanup in step 7, keep `wheelhq-datasets` private, and only then add GitHub links. Alternative: keep private for now.
- **D4 — “no profile web page” interpretation.** Read as “No account, no profile, no sign-up” on the About page. If this meant a personal maker profile instead, say so.
- **D5 — Key scope.** Proposed: full first-run prompt + rewritten dialog + visible status. Alternative: rewrite the dialog copy only.
- **D6 — Expiry chip.** Proposed: preset expiry chips are read-only (no ×); only a custom DTE range stays removable because it is a fine-tune. Confirm whether the risk-profile chip should also be fully read-only, or keep today’s “removable when not Balanced”.
- **D7 — Favourites grouping.** Proposed: Favourites stays with the predefined universes; only user-created lists go after the separator. If you consider Favourites a custom list, move it after the divider.
- **D8 — Shared lists.** Proposed: keep the shared list visually separate from saved lists, with a `Shared` badge and its own separator. It should never look like another universe.
- **D9 — Info tips.** Proposed: show on hover and keyboard focus, with a native `title` fallback and an accessible `aria-label`. No click-to-open panel.
- **D10 — BMC rendering.** Chosen: use the official `cdnjs.buymeacoffee.com` widget script with `data-slug="wheelhq"`, loaded inside a tiny sandboxed same-origin `/bmc.html` iframe. The global CSP allowlists `cdnjs.buymeacoffee.com` (script), `fonts.googleapis.com` (style), `fonts.gstatic.com` (font) and `'unsafe-inline'` for the widget’s generated `<style>`. The iframe sandbox, not a separate origin, keeps the script away from the Alpaca key. `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN` allow the same-origin iframe. Raw inline script in the app remains the fallback only if you explicitly want it; the iframe is the safer shape.
- **D11 — About order.** Proposed: BMC button/link at the top of the About page, QR code at the bottom in the Support section. The reverse is a one-block markup swap. The QR asset has been copied to `static/about/bmc-qr.png` (700×700).

## Context found in the code

- The About page is standalone HTML at `static/about/index.html`, styled by `static/about/about.css`. It already has good SEO metadata and a “Data and privacy” section, but no account/profile promise, no contact email, no BMC, and no GitHub link.
- The main screen’s key affordance is hidden inside the **Data and API status** dropdown (`src/components/DataStatus.svelte`). With no key, `refresh()` throws a long error string that becomes the alert. The dialog (`src/components/KeyDialog.svelte`) explains session storage, but not why a key is needed, paper vs live, or what a data-only key can do.
- The list note lives in `src/App.svelte` (`listNote`) and is rendered by `src/components/MarketBar.svelte`. Market universes show a count; custom lists and Favourites show only a count too. `MarketBar` builds one flat `universes` array, so saved lists currently look exactly like predefined universes.
- Global ticker search is a separate scope in state (`symbolQuery` / `activeSearch`) but its badge is just a ghost chip with “Outside {universeLabel}”, visually close to a universe chip.
- `filterChips()` in `src/lib/filtersSummary.ts` marks the expiry chip removable whenever it differs from the default; `removeFilterChip()` resets it to `DEFAULT_EXPIRY`. Risk profile uses the same pattern.
- `FiltersPanel.svelte` keeps Fine-tune permanently expanded and renders the price-bucket note at `text-[0.6875rem] text-base-content/60` — visually close to a disabled-control tooltip.
- Two controls do the same reset: `Clear filters` in the active-filter strip (`src/App.svelte`) and `Reset filters` at the bottom of `FiltersPanel.svelte`; both call `resetFilters()`.
- `tableNote` in `src/App.svelte` currently combines `${visible.count} contracts` with `${visible.strategyRows} CSP in chains`; the second number is not the number of symbols scanned.
- `DataStatus.svelte` renders the status badge and `as of 15:03:34` as separate elements, and hides the timestamp on narrow screens.
- The repo is private (`kikulikov/wheelhq-app`), MIT-licensed, with CI in `.github/workflows/check.yml`, a security policy, and no secrets in history beyond an old empty `.env.example` and the public Cloudflare beacon token.
- There are uncommitted user changes in `README.md`, `SPEC.md`, `e2e/happy-paths.e2e.ts`, `src/components/ListsDialog.svelte`, and `src/components/MarketBar.svelte` (uppercase list input, ⌘K search). Treat them as in-progress work; do not revert them.

## Detail

### Step 0 — Protect current work and lock decisions

- Run `git status` in `wheelhq-app`. Commit or stash the five modified files listed above before starting. The plan must not overwrite the ⌘K search or uppercase-symbol changes.
- Confirm D1–D9 in the plan review. Where you have no preference, I will use the proposed option and mark it as a call in the implementation notes.
- Create one branch, e.g. `ux-polish-launch`, and keep each step as its own commit.

### Step 1 — About page

**Files:** `static/about/index.html`, `static/about/about.css`, new `test/aboutPage.test.ts`.

Copy structure:

1. **H1 + tagline** — “Covered call and cash-secured put screener for S&P 500 and Nasdaq-100 stocks. Runs in your browser. No account, no profile.”
2. **What WheelHQ does** — keep the current explanation of CSP/CC screening and filters.
3. **How the screen works** — rewrite around Alpaca usage:
   - WheelHQ asks Alpaca for stock snapshots, then option chains for the chosen expiry, delta and strike window.
   - Candidates are ordered by dollar volume; the browser filters the returned chains.
   - Free Alpaca keys get delayed `indicative` data; `opra` needs an options data subscription.
   - A scan can stop early at Alpaca’s rate limit; custom lists screen their own names.
   - Do **not** mention static datasets, bundled snapshots, the dataset service, `indexes.json`, `earnings.json`, or any internal pipeline.
4. **Your Alpaca key** — why a key is needed, paper key recommended, live key warning, key scopes, session-only default, “Remember on this device” opt-in, remove anytime, direct browser-to-Alpaca requests, WheelHQ never sees the key.
5. **No account, no server** — no sign-up, no profile page, no user database, no server-side storage, no trades.
6. **Data and privacy** — Alpaca as the market-data source; cookieless analytics; key never in the URL, logs, or analytics.
7. **Support WheelHQ** — BMC button/link at the top of the page and the QR code at the bottom; proposed order link-top / QR-bottom (D11). QR asset: `/about/bmc-qr.png`, 700×700, displayed around 160×160 with a quiet zone, `loading="lazy"`, alt text “QR code for the WheelHQ Buy Me a Coffee page”, and the caption “Scan to open the Buy Me a Coffee page.”
8. **Contact** — `mailto:hello@wheelhq.xyz` in a contact section and in the footer.
9. **Source** — GitHub link only after step 7 makes the repo public.

Metadata: update the meta/OG/Twitter descriptions and JSON-LD description to match the new copy. Keep the canonical URL and robots behavior unchanged.

CSS: add `.contact`, `.support`, `.source`, and a text-button style. Do not add remote images; the site CSP allows only `img-src 'self' data:`.

Test `test/aboutPage.test.ts` reads the built HTML source file and asserts:
- contains `mailto:hello@wheelhq.xyz`;
- contains the BMC URL;
- contains “Alpaca” and “No account” / “profile”;
- contains `/about/bmc-qr.png` and a non-empty `alt`;
- does not match `/dataset|bundled snapshot|wheelhq-datasets|indexes\.json|earnings\.json/i`;
- after step 7, contains the GitHub URL.

Verify with `npx vitest run test/aboutPage.test.ts`, then open `/about/` in dev at desktop and 375 px, light and dark.

### Step 2 — Buy me a coffee

**Files:** new `static/bmc.html`, `index.html`, `static/about/index.html`, `static/about/about.css`, new `static/about/bmc-qr.png` (already copied from the project root), `src/app.css` (strip styling only), `render.yaml`, `vite.config.ts`, `test/csp.test.ts`, new `test/bmc.test.ts`, `e2e/live-csp.e2e.ts`, `src/lib/links.ts` (contact/GitHub only).

**Why an iframe.** The official script writes an inline `<style>` block with `document.writeln` and runs with full access to the host origin. Loading it directly in the app means (a) `style-src` must allow `'unsafe-inline'` or a brittle style hash, and (b) the third-party script can read `localStorage`, including a remembered Alpaca key. A sandboxed same-origin iframe keeps the official button and isolates the script from the app’s storage. No `allow-same-origin` in the sandbox.

**`static/bmc.html`.**

- A tiny standalone page with a transparent background, no analytics, no app scripts, and the official widget exactly as supplied:

```html
<script type="text/javascript"
  src="https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js"
  data-name="bmc-button"
  data-slug="wheelhq"
  data-color="#FFDD00"
  data-emoji=""
  data-font="Cookie"
  data-text="Buy me a coffee"
  data-outline-color="#000000"
  data-font-color="#000000"
  data-coffee-color="#ffffff"></script>
```

- Add a `<meta http-equiv="Content-Security-Policy">` in `bmc.html` that works on hosts that cannot set headers:
  `default-src 'none'; script-src https://cdnjs.buymeacoffee.com; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; base-uri 'none'; form-action 'none'`
- Add a small `<style>` in `bmc.html` for the transparent page and compact button override:
  `#bmc-strip .bmc-btn` or `.bmc-btn { height: 40px; min-width: 160px; font-size: 20px; border-radius: 10px; }` with `!important` where the widget’s generated style wins.
- The widget’s own inline `<style>` needs `'unsafe-inline'` in `style-src`. The app’s own compiled CSS does not rely on inline styles; the directive exists for the widget.

**`index.html`.**

- Put a slim strip above `#app`:

```html
<div id="bmc-strip">
  <iframe
    src="/bmc.html"
    title="Buy me a coffee"
    sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
    scrolling="no"
    loading="eager"
    width="220"
    height="48"
  ></iframe>
</div>
```

- Strip CSS goes in `src/app.css`, not an inline `style` attribute: the main app keeps its own styles external even though the widget forces `'unsafe-inline'`. Style `#bmc-strip` full width, right-aligned or centered, 4–6px vertical padding, a subtle `border-bottom` using theme tokens; style `#bmc-strip iframe` as `border:0;background:transparent;width:220px;height:48px`. The iframe is fixed-size, so no layout shift from the widget.
- Do not add `allow-same-origin` to the sandbox. That is what keeps the script away from `localStorage`.

**About page.**

- Top: add the same iframe in a slim support strip just below the tagline, with class `bmc-frame` (`width:220px;height:48px`, set in `about.css`) and the same sandbox attributes. No raw script on the About page either.
- Bottom: in the “Support WheelHQ” section above the disclaimer/footer, add `<img src="/about/bmc-qr.png" alt="QR code for the WheelHQ Buy Me a Coffee page" width="160" height="160" loading="lazy">` and the caption “Scan to open the Buy Me a Coffee page.” Style `.support-qr` with a white quiet-zone padding so the code scans in dark mode; do not invert or filter it.
- Proposed order is link-top / QR-bottom (D11). If you prefer QR-top / link-bottom, move the two blocks; keep the same assets and tests.
- `about.css` gets the support-section spacing, the `.bmc-frame` size, and the `.support-qr` presentation; do not use inline `style` attributes there either.
- The About page remains a static HTML file, so the QR is a local `<img>`; the main app CSP allows `img-src 'self' data:`, so no new host.

**CSP in `render.yaml` and `vite.config.ts`.**

- The same `/*` CSP covers the app and `/bmc.html`. Render cannot reliably subtract the catch-all `frame-ancestors 'none'` / `X-Frame-Options: DENY` for one path without risking intersecting policies, so the app CSP changes globally:
  - `script-src` adds `https://cdnjs.buymeacoffee.com`;
  - `style-src` adds `'unsafe-inline'` and `https://fonts.googleapis.com`;
  - `font-src 'self' https://fonts.gstatic.com` is added;
  - `frame-ancestors` becomes `'self'`, and `X-Frame-Options` becomes `SAMEORIGIN`.
- The iframe sandbox remains the isolation boundary: the script never runs in the app document and cannot read `localStorage`.
- `bmc.html` keeps its own `<meta>` CSP with the same hosts, so it still works on a host that cannot set headers. The main app CSP is injected into `index.html` by the existing `inject-seo` plugin.

**Tests.**

- `test/bmc.test.ts`: read `static/bmc.html` and assert the exact script URL, `data-slug="wheelhq"`, `data-color="#FFDD00"`, the CSP meta contains the three hosts plus `'unsafe-inline'`, and the file contains no app code or analytics. Also assert `static/about/bmc-qr.png` exists and the About HTML references `/about/bmc-qr.png` with a non-empty `alt`.
- `test/csp.test.ts`: keep the build/Render sync test; assert the main CSP contains the three BMC hosts and `'unsafe-inline'`; assert `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN`.
- `e2e/live-csp.e2e.ts`: assert the `iframe[title="Buy me a coffee"]` exists, the button inside is visible via `frameLocator`, its link is `https://buymeacoffee.com/wheelhq`, and no CSP/console errors appear. The existing error filter catches `Refused to`.

**Fallback.** If the third-party widget becomes a problem, replace the iframe content with a local inline-SVG button and remove the BMC hosts (and `'unsafe-inline'`) from the CSP. That is the tighter end state.

Verify `npm run check`, `npm run build`, and the live CSP smoke test.

### Step 3 — Keys: communication and workflow

**Files:** `src/components/KeyDialog.svelte`, `src/components/DataStatus.svelte`, new `src/components/KeyPrompt.svelte`, `src/App.svelte`, new `src/lib/keyStatus.ts`, new `test/keyStatus.test.ts`, `e2e/happy-paths.e2e.ts`, `README.md`, `SPEC.md`.

**First-run state.** When `keyPair` is null, show `KeyPrompt` in the main column above `MarketBar` (or directly above the table; pick the layout that keeps filters usable). Content:

- Headline: “Connect Alpaca to load option chains.”
- One line: “WheelHQ is a screener, not a broker. It reads market data with your key and never places trades.”
- Three numbered steps: create a free Alpaca account; create a paper-trading key or a market-data-only key; paste the Key ID and Secret.
- Primary button: “Add Alpaca key” → `openKeyDialog()`.
- Secondary link: “How keys work” → `/about/#keys`.
- Privacy line: session-only by default; “Remember on this device” is opt-in; requests go only to Alpaca.

The old long no-key error string should no longer be the user’s first explanation. Keep a short alert only if refresh fails for another reason.

**Dialog rewrite.** `KeyDialog.svelte` keeps the existing props/signature so `App.svelte` does not need a large refactor. Change the content:

- Title: “Connect Alpaca market data”.
- Intro: “WheelHQ needs your own Alpaca key to read option chains and stock prices. There is no WheelHQ account.”
- “Before you paste” block: prefer a paper key; a live key can place trades if it leaks; a market-data-only key is enough for screening; options data access decides `indicative` vs `opra`; assets access only affects names and the optionable filter.
- Fields stay labelled “Key ID” and “Secret” so existing tests and muscle memory still work.
- Remember checkbox label: “Keep this key on this device after I close the tab.” Helper: stored in this browser’s local storage; off means session-only.
- Buttons: “Test & save”, “Remove key” when a key exists, “Cancel”.
- Inline status: “Testing the key with Alpaca…” and the existing Alpaca rejection/rate-limit messages.
- Add a small “Where to create a key” link to `https://app.alpaca.markets/keys`.

**Visible status.** Extract `keyStatus.ts`:

- `keyStatusLabel({ hasKey, remembered }): 'No key' | 'Alpaca: session key' | 'Alpaca: saved key'`.
- `keyStatusTone(...)` if useful.
- `keyStatusDetail(...)` for “cleared when this tab closes” vs “kept on this device”.

Use it in `App.svelte` and `DataStatus.svelte`. Add a visible header chip when a key exists, e.g. `Alpaca: session` / `Alpaca: saved`, clickable to open the dialog. Keep the Data status menu as the detailed place (provider, feed, last update, auto-refresh, key row).

**Removal and errors.**

- `removeKey()` asks for confirmation: “Remove this key from this browser? Lists and filters stay; data needs a key to reload.” Use `window.confirm` for consistency with list deletion.
- After a successful save, show a dismissible notice: “Key works. Data is loading.” plus either “Session-only — cleared when this tab closes” or “Saved on this device.”
- When Alpaca returns 401/403, the alert gets a “Replace key” button that opens the dialog. Derive `keyRejected` from the refresh error/alerts rather than parsing prose in the template.
- Keep the existing “Remove” path in the dialog working.

**Tests.**

- `test/keyStatus.test.ts`: labels and detail for no key, session key, remembered key.
- Update `e2e/happy-paths.e2e.ts`:
  - no-key test: prompt is visible, has the three steps, “Add Alpaca key” opens the dialog;
  - dialog contains “paper” and “session-only” language;
  - save key: visible key chip/notice appears;
  - remove key: accept the confirm, prompt returns;
  - invalid key: inline Alpaca error still shows.
- Keep the existing “saves a key and screens a favourite put” flow green; update any changed exact text assertions.

**Docs.** Expand README “Alpaca key handling” with the workflow (create paper key → paste → test → session vs remembered → remove) and update the SPEC key section. Do not promise that a data-only key sees asset names; state that assets access only affects names and the optionable filter.

Verify `npm run check` and `npm run test:e2e`.

### Step 4 — Universe bar: saved lists, global search, list names

**Files:** `src/components/MarketBar.svelte`, `src/App.svelte`, new `src/lib/listSummary.ts`, new `test/listSummary.test.ts`, `e2e/happy-paths.e2e.ts`.

**Saved-list separator.** Split the flat `universes` array into three groups:

- predefined: US Options, S&P 500, Nasdaq-100, Favourites;
- saved: the user’s `lists`;
- shared: the frozen list from a share URL.

Render the predefined group in a `role="group" aria-label="Universes"`. When saved lists exist, put a subtle vertical rule before them (`<span class="h-5 w-px bg-base-300" role="separator" aria-orientation="vertical" aria-label="Saved lists"></span>`) and render the saved group in its own `role="group" aria-label="Saved lists"`. No divider when there are no saved lists. Favourites stays predefined (D7). The shared list, when present, gets its own separator and a `Shared` badge (D8), so it never reads as a saved list. Keep the chips’ existing size and tone; the separator is the distinction, not a new color.

**Global search scope.** When `searchSymbol` is active, render a dedicated scope pill, never a universe-style button:

- Primary label: `IBM · Global search` (or `Global search: IBM`).
- Use a search glyph, `badge badge-outline` or a thin bordered pill, and a separate clear × with `aria-label="Clear global search"`.
- Place it in a `Scope` group next to the search input (or on the row below the universe chips), visually separate from the universe group.
- If the ticker is outside the active universe, keep `Outside {universeLabel}` as secondary text or a tooltip, not as the primary label.
- Give the pill `aria-label="Global search scope: IBM"`.
- The active universe chip can stay selected; the scope pill explains that search overrides it. Do not add another universe chip for the ticker.

**List names.** Keep `listSummary`:

- `listSummary` takes `{ listId, symbols, marketCount, indexesReady }` and returns the note string.
- Market universes (`all`, `sp500`, `ndx`) keep today’s count-only behavior.
- Favourites, saved lists, and shared lists return `"<n> symbol(s) — <all symbols joined by ', '>"`. Example: `18 symbols — BTI, CVS, GIS, INTC, KO, NVDA, SBUX, T, UPS, VZ, WMT, XYZ, XOM, BAC, WFC, F, KHC, CL`.
- Singular: `1 symbol — AAPL`.
- Empty list keeps the current “This list has no symbols — use Manage lists to add some.”
- The note may wrap to two or three lines at 50 tickers; that is acceptable because the memo asks for every used name. Do not add a “+N more” cutoff. Keep the note full-width under the universe row (`MarketBar` already does this).

Tests:

- Unit tests for `listSummary`: market count, singular, plural, 50-name list, empty.
- E2E: seed two saved lists and assert the separator exists before the saved group; with no saved lists, no separator; activate a global search and assert the `IBM · Global search` pill appears and clearing it restores the universe; seed a saved list and assert the note shows every symbol after “symbols”.

Verify `npx vitest run test/listSummary.test.ts` and the happy-path e2e.

### Step 5 — Filter panel: chips, info tips, price note, collapsible Fine-tune, one reset

**Files:** `src/lib/filtersSummary.ts`, `src/components/FiltersPanel.svelte`, new `src/components/InfoTip.svelte`, `src/App.svelte`, `test/filtersSummary.test.ts`, `e2e/happy-paths.e2e.ts`.

**Expiry chip is a preset, not a removable filter.** In `filterChips()`:

- `expiry.removable` becomes `false` for every preset key (`0d`, `1-7`, `8-14`, `15-28`, `29-63`).
- Keep `true` only for `expiryKey === 'custom'`, because a custom DTE range is a fine-tune (D6).
- Remove the preset branch from `removeFilterChip('expiry')`; the panel is the place to change a preset. Keep the custom-DTE reset.
- Update `test/filtersSummary.test.ts`: `byKey.expiry.removable` is false for `15-28`; the custom DTE case remains removable.
- If D6 says the risk-profile chip should also be fully read-only, make the same change there and update the tests; otherwise leave its current “removable when not Balanced” behavior.

**Info tips next to every filter.** New `InfoTip.svelte`:

- Props: `label: string`, `text: string`.
- Renders a small circular `?` button: `type="button"`, `aria-label={`${label}: ${text}`}`, `title={text}`, DaisyUI `tooltip tooltip-top` with `data-tip={text}`, `h-4 w-4`, `text-[0.625rem]`, `cursor-help`.
- Works on hover and keyboard focus (D9); tapping shows it on mobile. Keep it inside the sidebar so the tooltip does not clip.
- Add it to every filter label, including each slider and checkbox. One-line copy:
  - Strategy — “CSP sells puts; CC sells calls against shares you own.”
  - Sector — “Limit the scan to one sector.”
  - Risk profile — “Preset delta, yield and spread ranges; fine-tune any value to override.”
  - Expiration — “Contracts expiring in this window; Today means 0DTE.”
  - Share price bucket — “Only stocks in this price range. Not applicable to saved lists.”
  - Fine-tune — “Narrow the active preset; the preset chip stays the baseline.”
  - Delta — “Absolute delta range; lower delta is further out of the money.”
  - DTE — “Days to expiration range.”
  - Max IV — “Hide contracts above this implied volatility; off means no limit.”
  - Min yield — “Minimum premium yield; off means no minimum.”
  - Annualised yield — “Minimum annualised return: yield × 365 ÷ DTE.”
  - Max spread — “Maximum bid-ask spread as a percent of mid.”
  - Avoid earnings — “Hide contracts whose expiry spans an earnings date.”
  - Avoid dividends — “Hide contracts whose expiry spans an ex-dividend date.”

**Make the price-bucket note more prominent.** Replace the current “Saved lists scan all prices; buckets apply to market-wide universes.” with the exact copy: “Not applicable to saved lists. All share prices are included.” Style it as normal helper text (`text-xs leading-snug text-base-content/80`), not `text-[0.6875rem] text-base-content/60`. Keep it visible only when `!priceEnabled`, directly under the bucket buttons. Add the same sentence to the bucket `InfoTip`.

**Collapsible Fine-tune.** Convert the Fine-tune block to `<details bind:open={fineTuneOpen}>` with a styled `<summary>`:

- Open by default.
- Remember only within the session: `store.getSession('fineTuneOpen', true)` and write with `store.setSession`; do not put it in the URL and do not use `localStorage`.
- Hide the native marker and add a small chevron that rotates with `[open]`.
- No reset button in the sidebar; the single reset control lives in the active-filter strip (below).
- The summary remains keyboard operable and announces expanded/collapsed.

**Unify “Clear filters” and “Reset filters”.** Today there are two controls with the same effect: `Clear filters` in the active-filter strip above the table (`src/App.svelte`) and `Reset filters` at the bottom of the sidebar (`src/components/FiltersPanel.svelte`). Keep one:

- Recommended: keep the control in the active-filter strip, beside the chips it resets, and remove the sidebar button. The strip is contextual and always near the results; the sidebar is long and now has a collapsible block above its bottom edge.
- Rename it to **Reset filters** everywhere. “Reset” is accurate: it restores the Balanced profile, Weekly expiry, default price bucket, All Sectors, default fine-tune values and clears exclusions. “Clear” suggests no filters remain.
- Show it only when `canClear` is true, as today. No removable chips means there is nothing to reset.
- Remove the `onReset` prop from `FiltersPanel.svelte` and the `onReset={resetFilters}` binding in `App.svelte`; the strip button calls `resetFilters` directly.
- Give it `aria-label="Reset all filters to defaults"` and keep the ghost button style so it does not compete with the chips.
- If you prefer the sidebar placement instead, keep the button at the top of the sidebar (next to the Filters heading) and remove the strip button; do not keep both.

**Tests.**

- Update `filtersSummary.test.ts` for the expiry chip.
- E2E: exactly one reset control exists; it resets risk, expiry, price, sector and exclusions; the sidebar has no reset button; it disappears when no chip is removable.
- E2E: each filter label exposes an `About …` info button; one hover/focus shows its text; the price note shows the exact copy on a saved list; Fine-tune is open by default, collapses, stays collapsed after reload in the same page context, and opens again.

Verify `npx vitest run test/filtersSummary.test.ts` and the happy-path e2e.

### Step 6 — Readouts: results count and status/timestamp

**Files:** `src/App.svelte`, `src/components/DataStatus.svelte`, new `src/lib/resultsSummary.ts`, new `test/resultsSummary.test.ts`, `e2e/happy-paths.e2e.ts`.

**Results count.** Replace `tableNote` with two clear lines:

- Primary: `13 matching contracts` (or `1 matching contract`).
- Secondary: `From 213 contracts scanned across 18 symbols` (or `across 1 symbol`).
- When the list is truncated: primary becomes `Showing first 500 of 1,234 matching contracts`; secondary stays the scanned totals.
- When nothing is scanned yet, omit the secondary line rather than saying “0 contracts”.
- Use the existing data: `visible.count` for matching; `rows.length` for scanned contracts; `new Set(rows.map((row) => row.underlying ?? row.symbol)).size` for scanned symbols.
- For a global search, the secondary can read `From 24 contracts scanned for IBM`; the symbol count is 1.
- Put the helper in `resultsSummary.ts` so the pluralization and truncation cases are testable.
- Render the primary at `text-xs font-medium text-base-content/80` and the secondary at `text-[0.6875rem] text-base-content/60`, with tight vertical spacing. Keep the existing `mb-2` above the table.

**Status and timestamp together.** Make the header status a single readout, e.g. `Delayed data  Updated 15:03:34`:

- In `App.svelte`, change `asOf` to `updatedAt` (time only, no “as of” prefix) and update `connectionStatus` to test `updatedAt`.
- In `DataStatus.svelte`, rename the prop to `updatedAt`; in `<summary>`, render the status badge and `Updated {updatedAt}` in one wrapping flex row, with `gap-1.5`. Remove `hidden sm:inline` so the timestamp is visible on mobile too; let the row wrap instead of hiding it.
- In the dropdown, rename “Last update” to “Updated” and show `updatedAt || 'Not yet'`; remove the `replace(/^as of /, '')`.
- Keep the timestamp hidden when there is no update yet.
- The status badge keeps its tone (`Delayed data` warning, `Live` success, etc.).

**Tests.**

- `test/resultsSummary.test.ts`: normal, singular, truncated, zero scanned, and global-search cases.
- E2E: assert `13 matching contracts` and `From … contracts scanned across … symbols`; assert the status summary contains both `Delayed data` and `Updated` with a time; update the old `Last update` assertion to `Updated`.

Verify `npx vitest run test/resultsSummary.test.ts` and the happy-path e2e.

### Step 7 — Public repo (gated by D3)

Do not flip visibility until all of this passes.

**Audit.**

- Scan history for secrets: `git log -p --all | grep -Ei '(api[_-]?key|secret|password|token|BEGIN .*PRIVATE)'`; inspect any hit.
- Confirm `.env*` is ignored and never committed with values.
- Run `npm run check`, `npm run build`, `npm run test:e2e` on `main`.
- Confirm LICENSE (MIT), CONTRIBUTING, SECURITY, and `.github/workflows/check.yml` are present and current.

**Scrub internal operations.** Keep `wheelhq-datasets` private. In `README.md` and `SPEC.md`, remove or generalize internal infrastructure details that are not needed by a contributor: dataset service hostnames, the bundled-snapshot fallback, and the data-refresh pipeline. It is fine for code to contain those hosts; the docs should not advertise the private pipeline. The About page must not mention datasets at all (step 1 guards this).

**GitHub settings.**

- Description: “Client-side covered-call and cash-secured-put screener on Alpaca market data.”
- Homepage: `https://wheelhq.xyz/`.
- Topics: `options`, `screener`, `wheel`, `alpaca`, `svelte`, `finance`.
- Enable private vulnerability reporting and Dependabot/Renovate.
- Protect `main`: require the `check` workflow and one review if you want review discipline.
- Optional: issue/PR templates.

**Flip visibility** in GitHub settings.

**Links.**

- Set `GITHUB_URL = 'https://github.com/kikulikov/wheelhq-app'` in `src/lib/links.ts`.
- Add a “Source” link in the main footer next to About, and a “Source code” section/link on About (footer and body).
- Add `rel="noopener noreferrer"` and `target="_blank"`.
- Add a README link/badge and update the About test to assert the GitHub URL.

**Risk note.** MIT already permits forking and commercial reuse. Public source reveals the app and the static fallback data, but no secrets or the private dataset pipeline. If the dataset pipeline is the moat, keep that repo private and make only the app public. If you are not ready for forks/support, keep the app private; the GitHub link task is then dropped.

### Step 8 — Verify and document

- Update README feature status and the “About page and SEO” section. Rename every “Clear filters” reference to the single **Reset filters** control.
- Update SPEC key handling, the active-filter-summary section, the About copy, and every `canClear` / “Clear filters” reference if it describes the old duplicate control.
- Run `npm run check`, `npm run build`, `npm run test:e2e`.
- Manual QA matrix: first run with no key; invalid key; valid paper key session-only; remembered key after reload; remove key; 401/403 state; saved-list separator with 0, 1, and 3 lists; global-search scope pill and clear; custom list note with 1, 18, and 50 symbols; expiry chip has no × for presets and does for custom DTE; every filter info tip on hover and focus; exact “Not applicable to saved lists. All share prices are included.” copy; Fine-tune open by default, collapsed after reload, open in a fresh tab; exactly one **Reset filters** control and it resets everything; BMC button at top and on About, compact on the main screen, official yellow style, iframe sandbox without `allow-same-origin`, no CSP errors, and the main CSP allows only the three BMC hosts plus `'unsafe-inline'` styles; About QR at 160 px in dark and light mode, scan it with a phone and confirm it opens `https://buymeacoffee.com/wheelhq`; two-line results count; combined status + `Updated` timestamp at 375 px and desktop; About at 375 px and desktop, light/dark; keyboard navigation through the prompt, dialog, support strip, info tips, reset, and footer links.
- Check `grep -RniE 'dataset|bundled snapshot' static/about` returns nothing.
- Check the main production CSP allows the intended hosts only: the existing Alpaca/Cloudflare/dataset origins plus `cdnjs.buymeacoffee.com`, `fonts.googleapis.com` and `fonts.gstatic.com`; no other new origins. GitHub is a link, not a request origin.
- Commit each step separately. Do not commit `docs/`, `test-results/`, or generated screenshots.

## Guardrails

- No account, profile, server, or database is added.
- No trade execution.
- No secret in the repo, URL, analytics, or logs.
- No dataset internals on the About page.
- No remote images on About or the main screen (CSP).
- Do not overwrite the uncommitted MarketBar/ListsDialog work.
- Keep the app client-side and static.