# WheelHQ

A covered-call / cash-secured-put screener on [Alpaca](https://alpaca.markets) market data
with instant client-side filtering. Static site, no accounts, no application backend.

Status: Svelte 5 + Vite app. DaisyUI emerald theme by default, night for dark mode. Node 22.
Documentation updated 2026-11-15.

Repository: `wheelhq-app`. Production: `https://wheelhq.xyz/`. Render dev:
`https://wheelhq-app.onrender.com/`.

- **Human guide:** this README — purpose, quick-start, operation, deployment, status.
- **Detailed specification:** [SPEC.md](SPEC.md) — API contract, formulas, state model,
  storage keys, accessibility and acceptance criteria.
- **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md).
- **Security policy:** [SECURITY.md](SECURITY.md).

## Goals

WheelHQ is a lightweight, anonymous options screening instrument, not a SaaS platform.

1. **Anonymous by default** — no accounts, profiles or registration.
2. **Browser-only** — screening, calculations and preferences happen in the browser.
3. **Your data access** — each visitor connects with their own Alpaca API key.
4. **Shareable by design** — a complete screening configuration fits in a URL.
5. **No server-side dependency** — no application backend, user database or cloud sync.
6. **Portable** — configurations and lists can be exported and imported (presets and
   list export are still on the roadmap; see [Feature status](#feature-status)).

The guiding principle:

> Your data. Your API key. Your browser. Your trades.

## Quickstart

```bash
npm install
npm run dev        # Vite dev server
```

Open the URL and use the first-run **Add Alpaca key** prompt, paste your Alpaca key ID +
secret, then **Test & save**. The table fills from live (or delayed) Alpaca data. A key control in the header shows whether
the key is session-only or saved on the device.

Browser support: the Alpaca client uses `AbortSignal.any`, so Chrome/Edge 116+,
Firefox 124+ or Safari 17.4+ are required. Older browsers cannot load market data.

Production builds with `npm run build` into `dist/` — see [Build and deployment](#build-and-deployment).

## What it does

WheelHQ screens out-of-the-money options to **sell**:

- **CSP — cash-secured put:** sell a put and reserve cash for assignment at the strike.
- **CC — covered call:** sell a call against 100 shares you already own.

Universes:

- **US Options** — the deduplicated S&P 500 + Nasdaq-100 union (518 names in the current
  snapshot).
- **S&P 500** and **Nasdaq-100** — index membership from `indexes.json`.
- **Favourites** — built-in list of 24 liquid names on first run.
- **Custom lists** — up to 50 tickers each, saved locally. Tickers are uppercased while
  typing and cleaned on save. Saved lists sit after a divider in the universe bar, and the
  note below prints every ticker in the selected list. Lists can be exported to and
  imported from a JSON file.

For every contract the table shows yield, annualised return, delta, IV, volume, spread,
OTM %, breakeven and the underlying price and daily move. Columns are sortable; filters
and sorting re-run locally against chains already in memory.

Screening controls live in the left panel: strategy, sector, risk profile, expiration,
share-price bucket, Delta/DTE ranges, Max IV, Min yield, Annualised yield, Max spread and
the earnings/dividend exclusions. Above the table, a filter-summary strip shows the active
configuration and offers the single **Reset filters** control. Every filter label has a
small **?** with a one-line explainer; Fine-tune is collapsible and remembers its state
for the session.

Other user-facing features:

- **Universe chips and global ticker search** — search any supported ticker, even one
  outside the selected universe. The universe itself is not changed; a scope badge explains
  the override. Clearing the search restores the universe results. **⌘K** (or **Ctrl+K**)
  focuses the search field.
- **Share** — copies a URL that restores the universe, search, filters, sort and
  exclusions. No API key is ever included.
- **Row exclusion** — the **−** action hides an underlying from the current results; an
  exclusion chip restores it. Exclusions are URL-only, not persisted.
- **Event markers** — **E** marks an earnings date before expiry and **D** an ex-dividend
  date. Filled means announced; outlined means estimated.
- **Data and API status** — a small detail menu: provider, a one-line note on derived
  quotes and the IEX stock feed, last refreshed time, and index/earnings data dates.
- **Auto-refresh** — the Refresh button splits into a manual refresh and an interval menu
  (Off, 1 min, 5 min, 10 min). The choice is remembered on the device; datasets reload at
  most hourly and asset metadata once a day.
- **Mobile layout** — below the desktop breakpoint the filter panel collapses behind a
  **Filters** toggle (with the active-filter count) and a **Results** link jumps straight to
  the table.
- **Buy Me a Coffee** — a static yellow (#FFDD00) link with a cup icon to the left of the
  connection-status and Alpaca key controls; the About page keeps a scannable QR code and
  the same link. No widget, iframe or third-party script.
- **Results count and pages** — two lines above the table: the current page range out of
  all matching contracts, then the contracts and symbols that were actually scanned. Every
  match is reachable through 100-row pages; navigation sits above and below the table.
- **Header icons** — Share and Refresh carry inline SVG icons beside their visible labels;
  the refresh icon spins while a scan runs unless the user prefers reduced motion.

Every detail of the screening model is in [SPEC.md](SPEC.md).

## Architecture

```
browser
  Svelte 5 · Vite · DaisyUI · Bits UI
  sessionStorage/localStorage ──► Alpaca key ──► fetch() directly to
                                                 data.alpaca.markets
                                                 paper/api.alpaca.markets
  ▲
  └── static files from any static host (Render)
```

- The Alpaca key is stored in the browser and sent only to `*.alpaca.markets`. The static
  host never sees it.
- Chains and stock snapshots land in memory, so ordinary filtering and sorting are local.
- A scan reads one share-price bucket, orders it by dollar volume, and fetches chains with
  ten requests in flight until Alpaca returns a persistent 429.
- Runtime datasets (`indexes.json`, `earnings.json`) come from the `wheelhq-datasets`
  service, with bundled snapshots as a fallback.
- A restricted Content-Security-Policy, frame protection and other headers are configured
  in `render.yaml`; production builds inject the same CSP into `index.html`. The BMC button
  is the one third-party widget: it runs in a sandboxed same-origin iframe, and the CSP
  allows only its script/font hosts plus inline widget styles.

See [SPEC.md](SPEC.md) for the API endpoints, scan budget, formulas, and fallback rules.

## Alpaca key handling

- **First run.** A prompt in the main column explains why a key is needed and walks through
  creating a free Alpaca account, making a paper-trading or market-data-only key, and
  pasting it. The same dialog is reachable from the key control once connected.
- **Session-only by default.** The key lives in `sessionStorage` and disappears when the
  tab closes. **Keep this key on this device after I close the tab** moves it to
  `localStorage`; this is an explicit opt-in. The dialog spells out both states.
- The key is attached as `APCA-API-KEY-ID` / `APCA-API-SECRET-KEY` headers only on requests
  to Alpaca. It is never written to the URL, logs, analytics or the static host.
- **Test & save** validates the key with one small bars request and shows Alpaca's
  rejection or rate-limit message inline. Removing a key asks for confirmation; lists and
  filters stay.
- Use a paper-trading key for testing — a live key can place trades. A market-data-scoped
  key is enough for screening, though free Alpaca plans have a limited request budget and a
  wide scan can reach it; the key dialog links to Alpaca’s plans. Options data access
  decides indicative (derived, not OPRA) vs OPRA quotes, and stock prices come from the IEX
  feed. Assets access only affects tooltip names and the optionable-membership filter.
- Browser storage is readable by scripts on the same origin. Mitigations: no third-party
  widget, iframe or analytics script is loaded; production analytics is a 1×1 image
  request; Svelte escaping; no `{@html}`; and a restricted CSP. Inline positioning styles
  on the table tooltips are the one reason `style-src` includes `'unsafe-inline'`.

## Known limitations

- **No full-market chain scan** — US Options scans one price bucket per refresh and stops
  at Alpaca's persistent 429; custom lists screen their own symbols.
- **US Options is the index union** — names outside the S&P 500 + Nasdaq-100 are reachable
  through Favourites or a custom list.
- **Indicative quotes on free keys** — derived quotes, not OPRA, unless the key has an
  options data subscription; the status menu explains derived quotes and the IEX source.
- **Asset metadata needs assets access** — tooltip names and the optionable-membership
  filter come from `/v2/assets`. Data-only keys fail open: every list symbol is scanned,
  and the failure is not surfaced in the UI. The map loads on manual refresh and at most
  once a day.
- **Earnings are indicative** — Nasdaq's calendar covers a short horizon; beyond it the app
  can only show a published estimate. A symbol without one gets no marker. The calendar is
  rebuilt once each weekday evening; if that build is late the app says so, offers a
  Refresh, and keeps showing the older dates until it updates.
- **Prior-session quotes are hidden** — a contract whose last option quote is older than
  the stock price date is excluded from results and counted above the table; refreshing
  will not make an illiquid quote current.
- **No IV rank** — absolute IV only.
- **No open interest** — Alpaca needs a separate end-of-day contracts call per underlying;
  it is deferred for request and payload cost, not access.
- **Cash-secured assumption** — no margin ROI view for puts.
- **No trade execution** — read-only screener.
- **0DTE annualised yield is extrapolated** — same-day contracts use one-day repeatability
  (`yield × 365`), so the figure is not a forecast.
- **No user-saved presets or column layouts**, no CSV export, no alerts.
- **No service worker** — the app must be served over HTTP(S).

## Local preview

Vite serves the Svelte app with hot reload. Every Alpaca request is still made by the
browser; there is no local API.

```bash
npm run dev       # Vite dev server
npm run build     # production build to dist/
npm run preview   # preview the built dist/
```

## Build and deployment

The site is built with Vite and deployed as static files from `dist/`.
[`render.yaml`](render.yaml) runs `npm ci --include=dev && npm run build` and publishes
`dist/`.

1. Push the repository to a Git remote.
2. In Render: **New → Blueprint**, select the repo, and apply.
   (Or **New → Static Site**, set **Build Command** to
   `npm ci --include=dev && npm run build` and **Publish Directory** to `dist`.)
3. Add a custom domain if wanted; HTTPS is automatic.

`render.yaml` also sets `NODE_VERSION=22`, a restricted Content-Security-Policy,
`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, a referrer policy, and a
minimal permissions policy. The production build injects the same CSP into `index.html`
for hosts that cannot set response headers. `SAMEORIGIN` blocks external framing.

Any static host works; relative asset paths also support a project subpath.

### Visitor analytics

The production build adds a 1×1 GoatCounter image pixel when `VITE_ANALYTICS=1` is set
(set in `render.yaml`); dev and Playwright builds emit nothing. No analytics JavaScript
runs in the page: the pixel is a plain image request. It sends only a fixed page name —
`p=/` on the screener and `p=/about/` on About — so the query string, tickers, lists and
filters never leave the browser. The tag sets `referrerpolicy="no-referrer"` and the CSP
allowlists exactly `https://wheelhq.goatcounter.com` in `img-src`.

GoatCounter is cookieless and needs no consent banner. A pixel reports pageviews and paths
plus coarse user-agent and country data; it cannot record the referrer, screen size or Core
Web Vitals, and bot requests are harder to filter, so treat the numbers as directional. Ad
blockers undercount traffic. The Alpaca key is never sent: the request carries a fixed path
and no page URL.

### About page and SEO

The static build includes a standalone About page at `/about/`, canonical and Open Graph
metadata, `robots.txt`, `sitemap.txt`, and non-production `noindex,nofollow` handling.
The page explains the no-account/browser-only model and the Alpaca key workflow, carries
a QR code and a plain link to Buy Me a Coffee, and lists `hello@wheelhq.xyz` for contact. The canonical URL is `https://wheelhq.xyz/`.

## Development

- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Refresh bundled datasets: `npm run sync:data`
- Preview build: `npm run preview`
- Lint: `npm run lint` (`npm run lint:fix` for safe auto-fixes)
- Format: `npm run format` (`npm run format:check` verifies without writing)
- Unit tests: `npm test` (Vitest)
- End-to-end tests: `npx playwright install chromium webkit` once, then `npm run test:e2e`
  (`npm run test:e2e:ui` for the interactive runner). Projects cover desktop Chromium,
  WebKit and a Pixel 5 mobile layout; CI also runs Firefox. The suite includes blocked
  storage, a cancelled-scope race and a New York midnight rollover.
- Production CSP smoke test:
  `LIVE=1 LIVE_URL=https://wheelhq.xyz/ npm run test:e2e -- e2e/live-csp.e2e.ts`
- Documentation screenshot:
  `mkdir -p docs && SCREENSHOT=1 npm run test:e2e -- e2e/screenshot.e2e.ts` writes
  `docs/screenshot.png` and `static/og-image.png` from mocked data. The image is not
  committed, and the README does not embed it.
- Full check: `npm run check` (Svelte/TypeScript, ESLint, Prettier, Vitest)

To test the key dialog without a real key, enter a bogus key — validation should return
"Alpaca didn't accept that key ID and secret."

## Project layout

```
src/App.svelte        screen orchestration, refresh, URL/storage, theme/strategy effects
src/components/       market bar, filters, table, pagination, icons, data status,
                      key prompt/dialog, dialogs, info tips, range sliders
src/lib/              Alpaca client, datasets, domain logic, URL, storage, selection,
                      pagination, filters/list/results summaries, coverage and status,
                      key status, theme, environment, SEO, analytics
src/lib/alpaca.ts     browser-direct Alpaca client and screen pipeline
src/lib/domain.ts     parsing, metrics, filtering, chain scope, TradingView URLs
src/lib/config.ts     price buckets, columns, presets, limits
static/               favicons, Open Graph image, theme-init, About page, datasets
static/about/bmc-qr.png  QR code for the Buy Me a Coffee page
static/data/          bundled indexes.json and earnings.json snapshots
scripts/sync-datasets.mjs  refreshes the bundled snapshots
test/                 Vitest coverage
e2e/                  Playwright happy paths, live CSP check, screenshot
render.yaml           Render Blueprint
```

## License

MIT — see [LICENSE](LICENSE).
