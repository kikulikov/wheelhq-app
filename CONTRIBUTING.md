# Contributing

## Setup

- Node.js 22.
- `npm install`
- `npm run dev` starts the Vite dev server.

## Checks

Run these before opening a pull request:

```bash
npm run check       # svelte-check + ESLint + Prettier + Vitest
npm run build       # production build
npm run test:e2e    # Playwright happy paths (install Chromium once)
```

Tests live in `test/` and use Vitest. Add or update a test with every behaviour change.
`e2e/happy-paths.e2e.ts` covers the main UI flows with deterministic Alpaca mocks;
`e2e/live-csp.e2e.ts` (LIVE=1) and `e2e/screenshot.e2e.ts` (SCREENSHOT=1) are opt-in.

## Guidelines

- Never commit an Alpaca key or any other secret.
- Keep the app client-side and do not add hosts to either Content-Security-Policy without
  a security review.
- Follow the existing Prettier and ESLint configuration (`npm run format`, `npm run lint`).
- Keep changes focused; use one branch and pull request per feature or fix.
