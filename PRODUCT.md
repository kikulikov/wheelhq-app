# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Self-directed retail options sellers running the wheel: selling cash-secured puts, then covered calls after assignment. They already have, or will open, an Alpaca account, screen a few times a week for short-dated premium, and know the vocabulary (delta, IV, DTE, spread, OTM, annualised yield). The interface can assume that knowledge; the `?` tips explain filters but do not teach options from scratch.

## Product Purpose

WheelHQ is a browser-only screener for out-of-the-money options to sell on US equities: CSPs and covered calls across the S&P 500, Nasdaq-100, their union ("US Options"), favourites and custom lists of up to 50 tickers. It pulls chains and stock snapshots straight from Alpaca with the visitor's own key and filters them instantly in the browser.

Success means a wheel trader goes from opening the page to a short, trustworthy list of contracts worth selling, without an account, a subscription or handing data to a third party.

It is a lightweight, anonymous screening instrument, not a SaaS platform. Non-goals: order placement, position tracking, portfolio accounting, backtesting, user accounts and any server-side storage of keys, screens or presets.

## Positioning

What neighbouring screeners (Barchart, Market Chameleon, OptionStrat and similar) cannot truthfully claim together:

- **Private by construction.** No account, no profile, no backend: The Alpaca key stays in the browser (session-only unless the user opts in) and is sent only to `*.alpaca.markets`. Guiding line: "Your data. Your API key. Your browser. Your trades."
- **Free, on the user's own data access.** No WheelHQ subscription; data quality follows the user's Alpaca plan (indicative quotes on free keys, OPRA with an options subscription).
- **Focused on the wheel.** Only CSP and CC selling, with filtering and sorting that run locally against chains already in memory, so changes are instant.
- **Shareable screens.** A complete screening configuration fits in a URL; the recipient screens it with their own key. Links carry configuration, never results or credentials.

## Operating Context

- Used during or around US market hours; New York dates drive DTE, earnings and dividend windows. Auto-refresh (off, 1, 5 or 10 min) supports leaving the screen open.
- Typical loop: pick universe and strategy, set risk profile and expiration, tune delta/yield/spread/IV, sort, inspect a ticker (tooltip, TradingView link), exclude names, share or save a list.
- First run requires creating and pasting an Alpaca key (paper-trading or market-data-only recommended). Free plans hit Alpaca's rate limit on wide scans, so a scan can stop early and says so.
- Desktop is the primary surface; below the `lg` breakpoint filters collapse behind a **Filters** toggle with a **Results** jump link.
- Runtime datasets (`indexes.json`, `earnings.json`) come from the `wheelhq-datasets` service, with bundled snapshots as fallback.

## Capabilities and Constraints

- Existing Svelte 5 + Vite static app (DaisyUI 5, Tailwind 4, Bits UI), deployed to Render at <https://wheelhq.xyz/>. No server process; any static host works.
- Strict CSP: no third-party JavaScript, widgets or iframes; no `{@html}`. New work must not add external scripts, fonts or embeds. Analytics is a single cookieless GoatCounter pixel with a fixed path.
- Results table has 15 fixed columns; pagination is 100 rows per page with every match reachable. Calculations and assumptions are specified in `SPEC.md` section 7 (premium at the bid, 100 shares, cash-secured puts, simple annualisation).
- Terminology that must stay accurate: derived quotes are "indicative" (never just "delayed" without naming the feed); OPRA is real-time; stock prices come from IEX; "US Options" is the S&P 500 + Nasdaq-100 union, not every listed name; Ann % is an extrapolation, not a forecast.
- Event markers: **E** earnings and **D** ex-dividend before expiry; filled means announced, outlined means estimated.
- Requires modern browsers (Chrome/Edge 116+, Firefox 124+, Safari 17.4+).
- Roadmap, not built: local screening presets, table customisation (show/hide and reorder columns).

## Brand Commitments

- Name: **WheelHQ**. Contact `hello@wheelhq.xyz`. Funded only by a Buy Me a Coffee link (`buymeacoffee.com/wheelhq`), shown as a plain link, never a widget.
- Voice: plain, factual and specific; states limitations openly (rate limits, indicative quotes, estimated dates) rather than hiding them.
- Required disclaimer: "Market data may be delayed. Nothing on WheelHQ is investment advice." WheelHQ never places trades and must not imply it does.

## Evidence on Hand

- `README.md` and `SPEC.md`: full product and behaviour record.
- `static/about/`: About page copy and the Buy Me a Coffee QR code (`bmc-qr.png`).
- `static/og-image.png` and `docs/screenshot.png`: generated from mocked data by `e2e/screenshot.e2e.ts`, not real user screens.
- No testimonials, user counts, press, performance claims or case studies exist. Do not invent them. GoatCounter numbers are directional only.

## Product Principles

1. **The key and the screen never leave the browser.** Any feature that needs a server, account or third-party script is out unless the user explicitly changes this.
2. **Trust over flattery.** Show data provenance, staleness and scan coverage honestly; a shorter, accurate list beats a longer, impressive one.
3. **Built for people who already sell options.** Optimise for speed and density for experienced wheel traders; explain filters briefly, never patronise.
4. **Everything shareable lives in the URL.** New screening state should serialise to the share link, never with credentials.
5. **Instant by default.** Filtering and sorting stay local; only scope changes refetch.

## Accessibility & Inclusion

Target **WCAG 2.2 Level A** for new work; accessibility is not the main priority at the moment. Keep the existing practice in `SPEC.md` section 9.4 (keyboard-operable sliders and dialogs, `aria-sort`, focus-trapped dialogs, polite live regions, text not colour alone, `prefers-reduced-motion`, 24px touch targets) and do not regress it.
