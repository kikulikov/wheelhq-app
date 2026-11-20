import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  KEY,
  OTHER_SYMBOL,
  SITE_URL,
  SYMBOL,
  dateOffset,
  installAlpacaMocks,
  installEarningsMock,
  seedState,
} from './mocks';

test('loads without a key and opens the key dialog', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'WheelHQ', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Connect Alpaca to load option chains' }),
  ).toBeVisible();
  const donate = page.getByRole('link', { name: 'Buy me a coffee' });
  await expect(donate).toHaveAttribute('href', 'https://buymeacoffee.com/wheelhq');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('img[data-wheelhq-analytics]')).toHaveCount(0);
  await expect(page.getByText('Create a free Alpaca account.')).toBeVisible();
  await expect(
    page.getByText('Create a paper-trading key or a market-data-only key.'),
  ).toBeVisible();
  await expect(page.getByText('Paste the Key ID and Secret here.')).toBeVisible();
  await expect(
    page.getByText('Market data may be delayed. Nothing on WheelHQ is investment advice.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'WheelHQ source on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/kikulikov/wheelhq-app',
  );

  await page.getByRole('button', { name: 'Add Alpaca key' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Connect Alpaca market data' })).toBeVisible();
  await expect(dialog).toContainText('paper-trading key');
  await expect(dialog).toContainText('session-only');
  await expect(dialog).toContainText('limited request budget');
  await expect(dialog.getByRole('link', { name: /Alpaca.s data plans/ })).toHaveAttribute(
    'href',
    'https://alpaca.markets/data',
  );

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('saves a key and screens a favourite put', async ({ page }) => {
  await installAlpacaMocks(page);
  await seedState(page, { watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  await page.getByRole('button', { name: 'Add Alpaca key' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Key ID').fill(KEY.keyId);
  await dialog.getByLabel('Secret').fill(KEY.secret);
  await dialog.getByRole('button', { name: 'Test & save' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Key works', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /Alpaca: session key/ })).toBeVisible();
  await expect(page.locator('[data-key-state="ok"]')).toContainText('Alpaca: session key');
  const donate = page.getByRole('link', { name: 'Buy me a coffee' });
  await expect(donate).toHaveCSS('background-color', 'rgb(255, 221, 0)');
  await expect(page.locator('a[href="https://buymeacoffee.com/wheelhq"] + details')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '$150–300', exact: true })).toBeDisabled();
  await expect(
    page.locator('[aria-label="Active filters"]').getByText('$75–150', { exact: true }),
  ).toHaveCount(0);

  const row = page.locator('tbody tr').filter({ hasText: SYMBOL });
  await expect(row).toBeVisible();
  await expect(row.getByText('Put', { exact: true })).toBeVisible();
  await expect(row).toContainText('190.00');
  await expect(row.getByRole('link', { name: `Open ${SYMBOL} on TradingView` })).toHaveAttribute(
    'href',
    /NASDAQ-AAPL/,
  );

  const marker = row.getByRole('button', { name: /Ex-dividend/ });
  await expect(marker).toBeVisible();
  await marker.focus();
  await expect(page.getByRole('tooltip')).toContainText(
    'Calls are cheaper and puts dearer by about the dividend.',
  );
});

test('removes a session key after confirmation and keeps lists', async ({ page }) => {
  await installAlpacaMocks(page);
  await seedState(page, {
    key: true,
    watchlist: [SYMBOL],
    lists: [{ id: 'list-main', name: 'Main', symbols: [SYMBOL] }],
  });
  await page.goto('/?list=list-main');

  const chip = page.getByRole('button', { name: /Alpaca: session key/ });
  await expect(chip).toBeVisible();
  await chip.click();

  let confirmed = false;
  page.once('dialog', (dialog) => {
    confirmed = true;
    void dialog.accept();
  });
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  expect(confirmed).toBe(true);

  await expect(
    page.getByRole('heading', { name: 'Connect Alpaca to load option chains' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Connect Alpaca to load option chains' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Main', exact: true })).toBeVisible();
});

test('labels a remembered key as saved on this device', async ({ page }) => {
  await installAlpacaMocks(page);
  await seedState(page, { key: true, rememberKey: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  const chip = page.getByRole('button', { name: /Alpaca: saved key/ });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute('title', /Kept on this device/);
});

test('keeps the key dialog open when Alpaca rejects the key', async ({ page }) => {
  await installAlpacaMocks(page, { bars401: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Add Alpaca key' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Key ID').fill('BADKEY');
  await dialog.getByLabel('Secret').fill('BADSECRET');
  await dialog.getByRole('button', { name: 'Test & save' }).click();

  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/accept that key ID and secret/);
  await expect(dialog.locator('[role="status"][aria-live="polite"]')).toContainText(
    /accept that key ID and secret/,
  );
});

test('shows a friendly message when the snapshot request is rejected', async ({ page }) => {
  await installAlpacaMocks(page, { snapshots401: true });
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  await expect(page.getByRole('alert')).toContainText('Alpaca rejected the saved key');
  await expect(page.getByRole('alert')).not.toContainText('HTTP 401');
  await expect(page.getByRole('button', { name: 'Replace key' })).toBeVisible();
});

test('halts the scan and clears rows when the chain returns a persistent 429', async ({ page }) => {
  await installAlpacaMocks(page, { chains429: true });
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  await expect(page.getByRole('alert')).toContainText(/rate limit/i);
  await expect(page.getByRole('button', { name: /Data and API status/ })).toContainText('No data');
  await expect(
    page.getByRole('button', { name: /Data and API status/ }).locator('[data-tone="error"]'),
  ).toContainText('No data');
  // The table keeps its header and shows the empty state below it.
  await expect(page.locator('tbody tr').filter({ hasText: SYMBOL })).toHaveCount(0);
  await expect(page.locator('.table-empty')).toBeVisible();
});

test('keeps a crossed quote visible but withholds its metrics', async ({ page }) => {
  await installAlpacaMocks(page, { crossed: true });
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites&ann=0&spread=0');

  const row = page.locator('tbody tr').filter({ hasText: '185.00' });
  await expect(row).toBeVisible();
  const cells = row.locator('td');
  await expect(cells.nth(6)).toHaveText('—');
  await expect(cells.nth(7)).toHaveText('—');
  await expect(cells.nth(8)).toHaveText('—');
  await expect(cells.nth(14)).toHaveText('—');
});

test('keeps working when browser storage is blocked', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      (Storage.prototype as unknown as Record<string, unknown>)[method] = () => {
        throw new DOMException('blocked', 'SecurityError');
      };
    }
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'WheelHQ', exact: true })).toBeVisible();
  await expect(page.getByText('This browser is blocking storage')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Alpaca key' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('ignores a chain response that arrives after a scope change', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await installAlpacaMocks(page, { slowPutMs: 900 });
  await seedState(page, { key: true, watchlist: [SYMBOL] });

  const putRequest = page.waitForRequest(
    (request) =>
      request.url().includes('/v1beta1/options/snapshots/') && request.url().includes('type=put'),
  );
  await page.goto('/?list=favourites');
  await putRequest;

  await page.getByRole('button', { name: /^CC:/ }).click();
  await page.waitForTimeout(1400);

  const row = page.locator('tbody tr').filter({ hasText: SYMBOL });
  await expect(row.getByText('Call', { exact: true })).toBeVisible();
  await expect(row.getByText('Put', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('rolls the trading date over New York midnight', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T04:55:00Z') }); // 23:55 ET, Nov 16
  // Pin the expiry to the fixed clock: 6 days out, inside the Weekly bucket.
  await installAlpacaMocks(page, { expiry: '2026-11-22' });
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  const row = page.locator('tbody tr').filter({ hasText: SYMBOL });
  await expect(row).toBeVisible();
  const dteCell = row.locator('td').nth(2);
  const before = Number(await dteCell.textContent());

  await page.clock.fastForward('00:10:00'); // 00:05 ET, Nov 17
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(dteCell).toHaveText(String(before - 1));
});

test('hides contracts whose option quote is from an earlier session', async ({ page }) => {
  await installAlpacaMocks(page, { staleQuote: true });
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites&ann=0&spread=0');

  await expect(page.locator('tbody tr').filter({ hasText: SYMBOL })).toHaveCount(0);
  await expect(page.getByText('0 matching contracts', { exact: true })).toBeVisible();
  await expect(page.locator('[data-stale-hidden]')).toContainText('1 contract hidden');
});

test('shows an unknown option volume as a dash, not zero', async ({ page }) => {
  await installAlpacaMocks(page, { noVolume: true });
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  const row = page.locator('tbody tr').filter({ hasText: SYMBOL });
  await expect(row).toBeVisible();
  await expect(row.locator('td').nth(13)).toHaveText('—');
});

test('pages through every match instead of capping the table', async ({ page }) => {
  await installAlpacaMocks(page, { contracts: 120 });
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  await expect(
    page.getByText('Showing 1–100 of 120 matching contracts', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(100);
  await expect(page.getByText('Page 1 of 2').first()).toBeVisible();
  expect(
    await page.evaluate(() => getComputedStyle(document.querySelector('.table-wrap')!).maxHeight),
  ).toBe('none');

  await page.getByRole('button', { name: 'Next page' }).first().click();
  await expect(
    page.getByText('Showing 101–120 of 120 matching contracts', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(20);
  await expect(page.getByRole('button', { name: 'Next page' }).first()).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Previous page' }).first()).toBeEnabled();

  await page.getByRole('button', { name: 'Ann %', exact: true }).click();
  await expect(
    page.getByText('Showing 1–100 of 120 matching contracts', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous page' }).first()).toBeDisabled();
});

test('announces result counts politely', async ({ page }) => {
  await installAlpacaMocks(page);
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  await expect(page.locator('[role="status"][aria-live="polite"]').first()).toContainText(
    '1 matching contract',
  );
});

test('enlarges event markers and dismisses their tooltip with Escape', async ({ page }) => {
  await installAlpacaMocks(page);
  await installEarningsMock(page, dateOffset(3));
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  const row = page.locator('tbody tr').filter({ hasText: SYMBOL });
  const marker = row.getByRole('button', { name: /Earnings/ });
  const markerBox = await marker.boundingBox();
  expect(markerBox!.width).toBeGreaterThanOrEqual(24);
  expect(markerBox!.height).toBeGreaterThanOrEqual(24);

  await marker.focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  const excludeBox = await row.getByRole('button', { name: /Exclude/ }).boundingBox();
  expect(excludeBox!.width).toBeLessThanOrEqual(20);
  expect(excludeBox!.height).toBeLessThanOrEqual(20);
});

test('switches CSP to CC and filters by ticker', async ({ page }) => {
  await installAlpacaMocks(page);
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  const row = page.locator('tbody tr').filter({ hasText: SYMBOL });
  await expect(row.getByText('Put', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^CC:/ }).click();
  await expect(row.getByText('Call', { exact: true })).toBeVisible();
  await expect(row).toContainText('210.00');
  await expect(page.getByText('This list is not your holdings.')).toBeVisible();

  const filter = page.getByLabel('Global ticker search');
  await filter.fill('ZZZ');
  await expect(page.locator('tbody tr').filter({ hasText: SYMBOL })).toHaveCount(0);
  await expect(page.locator('.table-empty')).toContainText('No contracts match');

  await filter.fill(SYMBOL);
  await expect(page.locator('tbody tr').filter({ hasText: SYMBOL })).toHaveCount(1);
});

test('shows the cash a contract secures and copies its OCC symbol', async ({
  page,
  context,
}, testInfo) => {
  // Firefox exposes no clipboard permission; WebKit only to read. The write still
  // runs from the click, which is a user gesture in every engine.
  const permissions =
    testInfo.project.name === 'chromium'
      ? ['clipboard-read', 'clipboard-write']
      : ['clipboard-read'];
  await context.grantPermissions(permissions).catch(() => {});
  await installAlpacaMocks(page);
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  const row = page.locator('tbody tr').filter({ hasText: SYMBOL });
  await expect(row).toContainText('$19,000');

  const contract = `${SYMBOL}${dateOffset(5).slice(2).replaceAll('-', '')}P00190000`;
  const ticker = row.locator(`button.ticker[data-symbol="${SYMBOL}"]`);
  await ticker.hover();
  await expect(page.getByRole('tooltip')).toContainText(contract);

  await ticker.click();
  if (testInfo.project.name !== 'firefox') {
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(contract);
  }
  const copyStatus = page.locator('[role="status"][aria-label="Copy status"]');
  await expect(copyStatus).toHaveText(`Copied ${contract}`);
});

test('shows a scanning state instead of an empty result while chains load', async ({ page }) => {
  await installAlpacaMocks(page, { slowPutMs: 1500 });
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  const empty = page.locator('.table-empty');
  await expect(empty).toContainText('Scanning symbols');
  await expect(empty).not.toContainText('No contracts match');
  await expect(page.locator('tbody tr').filter({ hasText: SYMBOL })).toBeVisible({ timeout: 5000 });
  await expect(empty).toHaveCount(0);
});

test('excludes a symbol from the results and restores it', async ({ page }) => {
  await installAlpacaMocks(page);
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  const row = page.locator('tbody tr').filter({ hasText: SYMBOL });
  await expect(row).toBeVisible();

  await page
    .getByRole('button', { name: `Exclude ${SYMBOL} from results` })
    .first()
    .click();
  await expect(row).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`exclude=${SYMBOL}`));

  const chip = page.getByRole('button', { name: `Remove Exclude ${SYMBOL} filter` });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(row).toBeVisible();
  await expect(page).not.toHaveURL(/exclude=/);
});

test('summarises every active filter and has one reset control', async ({ page }) => {
  await seedState(page, { key: true });
  await page.goto('/?list=sp500&sector=tech');

  const summary = page.locator('[aria-label="Active filters"]');
  await expect(summary.getByText('Weekly', { exact: true })).toBeVisible();
  await expect(summary.getByText('$75–150', { exact: true })).toBeVisible();
  await expect(summary.getByText('Earnings: allowed', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Weekly filter' })).toHaveCount(0);
  await expect(page.locator('aside').getByRole('button', { name: /reset filters/i })).toHaveCount(
    0,
  );

  const chip = page.getByRole('button', { name: 'Remove Technology filter' });
  await expect(chip).toBeVisible();
  await page.getByRole('button', { name: 'Reset all filters to defaults' }).click();
  await expect(chip).toHaveCount(0);
  await expect(summary.getByText('All Sectors', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset all filters to defaults' })).toHaveCount(0);
  await expect(page).toHaveURL(/list=sp500/);
  await expect(page).toHaveURL(/sector=all/);
});

test('keeps preset expiry chips read-only', async ({ page }) => {
  await seedState(page, { key: true });
  await page.goto('/?list=sp500');

  await page.getByRole('button', { name: '2–4 weeks out' }).click();
  await expect(page.getByRole('button', { name: 'Remove 2–4 weeks out filter' })).toHaveCount(0);
  await expect(
    page.locator('[aria-label="Active filters"]').getByText('2–4 weeks out', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset all filters to defaults' })).toBeVisible();
});

test('reset filters restores every default and clears exclusions', async ({ page }) => {
  await installAlpacaMocks(page);
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto(
    '/?list=sp500&sector=tech&risk=aggressive&expiry=15-28&price=under75&avoid=1&exclude=AAPL',
  );

  const summary = page.locator('[aria-label="Active filters"]');
  await expect(page.getByRole('button', { name: 'Aggressive', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Remove Avoid earnings filter' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Exclude AAPL filter' })).toBeVisible();

  await page.getByRole('button', { name: 'Reset all filters to defaults' }).click();

  await expect(page.getByRole('button', { name: 'Balanced', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Weekly', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: '$75–150', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(summary.getByText('All Sectors', { exact: true })).toBeVisible();
  await expect(summary.getByText('Earnings: allowed', { exact: true })).toBeVisible();
  await expect(summary.getByText('Δ 0.15–0.35', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Exclude AAPL filter' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reset all filters to defaults' })).toHaveCount(0);
});

test('removing the price chip returns to the default bucket', async ({ page }) => {
  await seedState(page, { key: true });
  await page.goto('/?list=ndx&price=under75');

  const summary = page.locator('[aria-label="Active filters"]');
  const chip = page.getByRole('button', { name: 'Remove < $75 filter' });
  await expect(chip).toBeVisible();
  await chip.click();

  await expect(page).toHaveURL(/price=75-150/);
  await expect(summary.getByText('$75–150', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove $75–150 filter' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reset all filters to defaults' })).toHaveCount(0);
});

test('shares the current screen without credentials', async ({ page }) => {
  await seedState(page, { key: true });
  await page.goto('/?list=ndx&sector=tech&price=150-300');
  await page.getByRole('button', { name: 'Share', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('never your Alpaca key');
  const url = await dialog.getByLabel('Shareable screen URL').inputValue();
  expect(url).toContain('list=ndx');
  expect(url).toContain('sector=tech');
  expect(url).toContain('price=150-300');
  expect(url).toContain('strategy=csp');
  expect(url).not.toMatch(/alpaca|secret|keyId/i);

  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
});

test('shows matching contracts and scanned totals', async ({ page }) => {
  await installAlpacaMocks(page);
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  await expect(page.getByText('1 matching contract', { exact: true })).toBeVisible();
  await expect(
    page.getByText('From 1 contract scanned across 1 symbol', { exact: true }),
  ).toBeVisible();
});

test('consolidates data and API status in one menu', async ({ page }) => {
  await installAlpacaMocks(page);
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');
  await expect(page.locator('tbody tr').filter({ hasText: SYMBOL })).toBeVisible();

  const statusButton = page.getByRole('button', { name: /Data and API status/ });
  await expect(statusButton.locator('[data-tone="warning"]')).toContainText('Indicative quotes');
  await expect(statusButton).toContainText(/Last refreshed \d{1,2}:\d{2}:\d{2}/);
  const summaryText = await statusButton.evaluate((element) =>
    (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
  expect(summaryText.indexOf('Last refreshed')).toBeLessThan(
    summaryText.indexOf('Indicative quotes'),
  );
  await statusButton.click();
  const menu = page.locator('.dropdown-content');
  await expect(menu.getByText('Provider')).toBeVisible();
  await expect(menu.getByText('Alpaca', { exact: true })).toBeVisible();
  await expect(
    menu.getByText(
      'Option quotes are derived unless your API key has OPRA access. Stock prices use IEX, not the consolidated tape.',
    ),
  ).toBeVisible();
  await expect(menu.getByText('Last refreshed', { exact: true })).toBeVisible();
  await expect(menu.getByText('Index data')).toBeVisible();
  await expect(menu.getByText(/\d{1,2} \w{3} \d{4}/).first()).toBeVisible();
  await expect(menu.getByText('Earnings data', { exact: true })).toBeVisible();
  await expect(menu.getByRole('button')).toHaveCount(0);
  await expect(menu.getByText(/Auto-refresh/)).toHaveCount(0);
});

test('marks earnings before expiry and can avoid them', async ({ page }) => {
  await installAlpacaMocks(page);
  await installEarningsMock(page, dateOffset(3));
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  const row = page.locator('tbody tr').filter({ hasText: SYMBOL });
  await expect(row).toBeVisible();

  const marker = row.getByRole('button', { name: /Earnings/ });
  await expect(marker).toBeVisible();
  expect(await marker.getAttribute('class')).toContain('earn');
  await marker.focus();
  await expect(page.getByRole('tooltip')).toContainText(
    'Volatility is usually inflated before earnings and drops after.',
  );

  const avoid = page.getByRole('checkbox', { name: /Avoid earnings/ });
  await expect(avoid).not.toBeChecked();
  await avoid.check();
  await expect(row).toHaveCount(0);
  await expect(page).toHaveURL(/avoid=1/);

  await avoid.uncheck();
  await expect(row).toBeVisible();
});

test('warns only when the daily earnings build is missing', async ({ page }) => {
  await installAlpacaMocks(page);
  await installEarningsMock(page, dateOffset(3), { effectiveDate: dateOffset(-6) });
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites&avoid=1');

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('daily build is missing');
  await expect(alert).toContainText('Refresh to retry');
  await expect(alert.getByRole('button', { name: 'Refresh data' })).toBeVisible();
});

test('screens the default Nasdaq-100 universe', async ({ page }) => {
  await installAlpacaMocks(page);
  await seedState(page, { key: true });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Nasdaq-100', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '$150–300', exact: true }).click();

  const row = page.locator('tbody tr').filter({ hasText: SYMBOL });
  await expect(row).toBeVisible();
  await expect(row.getByText('Put', { exact: true })).toBeVisible();
  await expect(page.getByText(/\d+ symbols/)).toBeVisible();
});

test('applies a saved night theme and exposes SEO metadata', async ({ page }) => {
  await seedState(page, { theme: 'night' });
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await expect(page).toHaveTitle('WheelHQ - Options Screener');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /Screen cash-secured puts/,
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /sector/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /earnings/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', SITE_URL);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', SITE_URL);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    `${SITE_URL}og-image.png`,
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  await expect(page.getByRole('heading', { level: 1, name: 'WheelHQ' })).toBeVisible();
  await expect(
    page.locator('header').getByText('Covered call and cash-secured put screener'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'About', exact: true })).toHaveAttribute(
    'href',
    '/about/',
  );
  await expect(page.getByText('© 2026 WheelHQ', { exact: true })).toBeVisible();

  const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
  const data = JSON.parse(jsonLd ?? '{}');
  expect(data['@type']).toBe('WebApplication');
  expect(data.url).toBe(SITE_URL);
  expect(data.sameAs).toBeUndefined();
});

test('offers the built-in universes and retires the exchange switch', async ({ page }) => {
  await page.goto('/?market=nyse&list=sp500');

  const universes = page.getByRole('group', { name: 'Universe', exact: true });
  await expect(universes.getByRole('button', { name: 'S&P 500', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(universes.getByRole('button', { name: 'US Options', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('button', { name: 'NYSE', exact: true })).toHaveCount(0);
  await expect(page.getByRole('separator', { name: 'Saved lists' })).toHaveCount(0);
  await page.getByRole('button', { name: /Data and API status/ }).click();
  await expect(
    page
      .locator('.dropdown-content')
      .getByText(/\d{1,2} \w{3} \d{4}/)
      .first(),
  ).toBeVisible();
});

test('shows saved lists as universe chips', async ({ page }) => {
  await seedState(page, {
    key: true,
    lists: [
      { id: 'list-main', name: 'Main', symbols: [SYMBOL] },
      { id: 'list-tech', name: 'Tech', symbols: [SYMBOL, OTHER_SYMBOL] },
    ],
  });
  await page.goto('/?list=list-main');

  const main = page.getByRole('button', { name: 'Main', exact: true });
  await expect(main).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Custom lists')).toHaveCount(0);
  await expect(page.getByRole('separator', { name: 'Saved lists' })).toBeVisible();
  const saved = page.getByRole('group', { name: 'Saved lists' });
  await expect(saved.getByRole('button')).toHaveText(['Main', 'Tech']);
  await expect(page.getByText('1 symbol — AAPL', { exact: true })).toBeVisible();

  const usOptions = page.getByRole('button', { name: 'US Options', exact: true });
  await usOptions.click();
  await expect(usOptions).toHaveAttribute('aria-pressed', 'true');
  await expect(main).toHaveAttribute('aria-pressed', 'false');
});

test('exports and imports custom lists as JSON files', async ({ page }) => {
  await seedState(page, {
    key: true,
    watchlist: [SYMBOL],
    lists: [{ id: 'list-alpha', name: 'Alpha', symbols: [SYMBOL] }],
  });
  await page.goto('/?list=favourites');
  await page.getByRole('button', { name: 'Manage lists' }).click();

  const dialog = page.getByRole('dialog');
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export lists' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const exported = JSON.parse(await fs.readFile(path!, 'utf8'));

  expect(exported.version).toBe(1);
  expect(exported.lists).toEqual([
    { name: 'Favourites', symbols: [SYMBOL] },
    { name: 'Alpha', symbols: [SYMBOL] },
  ]);

  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'lists.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        lists: [
          { name: 'Alpha', symbols: [OTHER_SYMBOL] },
          { name: 'Gamma', symbols: ['NVDA'] },
        ],
      }),
    ),
  });

  await expect(dialog.getByText(/Imported 2 lists/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Gamma/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Alpha_1/ })).toBeVisible();
});

test('uppercases list symbols as typed and cleans them on save', async ({ page }) => {
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');
  await page.getByRole('button', { name: 'Manage lists' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'New list', exact: true }).click();
  await dialog.getByLabel('Name').fill('My List');
  const symbols = dialog.getByLabel('Symbols');
  await symbols.fill('aapl, msft!!');

  await expect(symbols).toHaveValue('AAPL, MSFT!!');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(symbols).toHaveValue('AAPL, MSFT');
  await expect(dialog.getByText('2 symbols saved.')).toBeVisible();
});

test('rejects a list over the 50-symbol cap', async ({ page }) => {
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');
  await page.getByRole('button', { name: 'Manage lists' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'New list', exact: true }).click();
  await dialog.getByLabel('Name').fill('Too big');
  const tickers = Array.from(
    { length: 51 },
    (_, index) =>
      `T${String.fromCharCode(65 + (index % 26))}${String.fromCharCode(
        65 + Math.floor(index / 26),
      )}`,
  );
  await dialog.getByLabel('Symbols').fill(tickers.join(' '));
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(dialog.getByText(/Lists are limited to 50 symbols/)).toBeVisible();
  await expect(dialog.getByText('Too big', { exact: true })).toHaveCount(0);
});

test('places the global search on the right and focuses it with the shortcut', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const search = page.getByLabel('Global ticker search');
  await expect(search).toHaveAttribute('placeholder', /Search \(/);
  const box = await search.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeGreaterThan(1280 - 40);

  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })),
  );
  await expect(search).toBeFocused();
});

test('draws the search icon above the input instead of behind it', async ({ page }) => {
  await page.goto('/');

  const unobstructed = await page.evaluate(() => {
    const input = document.querySelector('input[aria-label="Global ticker search"]');
    const icon = input?.previousElementSibling;
    if (!(icon instanceof SVGElement)) return false;
    // The icon passes clicks through by design, so re-enable hit testing to see
    // which element actually paints on top at its centre.
    icon.style.pointerEvents = 'auto';
    const rect = icon.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return hit === icon || hit?.closest('svg') === icon;
  });

  expect(unobstructed).toBe(true);
});

test('reuses datasets on a scope change and reloads them on manual refresh', async ({ page }) => {
  const counts = { indexes: 0, earnings: 0, assets: 0 };
  page.on('request', (request) => {
    if (request.method() !== 'GET') return;
    const url = request.url();
    if (url.includes('/data/indexes.json')) counts.indexes++;
    else if (url.includes('/data/earnings.json')) counts.earnings++;
    else if (url.includes('/v2/assets')) counts.assets++;
  });

  await installAlpacaMocks(page);
  await seedState(page, {
    key: true,
    watchlist: [SYMBOL],
    lists: [{ id: 'list-main', name: 'Main', symbols: [OTHER_SYMBOL] }],
  });
  await page.goto('/?list=favourites');
  await expect(page.locator('tbody tr').filter({ hasText: SYMBOL })).toBeVisible();
  expect(counts).toEqual({ indexes: 1, earnings: 1, assets: 1 });

  await page.getByRole('button', { name: 'Main', exact: true }).click();
  await expect(page.locator('tbody tr').filter({ hasText: OTHER_SYMBOL })).toBeVisible();
  expect(counts).toEqual({ indexes: 1, earnings: 1, assets: 1 });

  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('tbody tr').filter({ hasText: OTHER_SYMBOL })).toBeVisible();
  await expect.poll(() => counts.indexes).toBe(2);
  await expect.poll(() => counts.earnings).toBe(2);
  await expect.poll(() => counts.assets).toBe(2);
});

test('selects and remembers the auto-refresh interval', async ({ page }) => {
  await installAlpacaMocks(page);
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  const trigger = page.getByRole('button', { name: /Auto-refresh:/ });
  await expect(trigger).toHaveAccessibleName('Auto-refresh: Off');

  await trigger.click();
  const menu = page.getByRole('menu', { name: 'Auto-refresh interval' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitemradio', { name: 'Off' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await menu.getByRole('menuitemradio', { name: '5 min' }).click();
  await expect(trigger).toHaveAccessibleName('Auto-refresh: 5 min');

  await page.reload();
  await expect(page.getByRole('button', { name: /Auto-refresh:/ })).toHaveAccessibleName(
    'Auto-refresh: 5 min',
  );
});

test('keeps header icon buttons named and their icons decorative', async ({ page }) => {
  await page.goto('/');

  const share = page.getByRole('button', { name: 'Share', exact: true });
  const refresh = page.getByRole('button', { name: 'Refresh', exact: true });
  for (const button of [share, refresh]) {
    await expect(button.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  }
  await expect(share).not.toHaveClass(/btn-/);
  await expect(share).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(refresh).toHaveClass(/btn-neutral/);
});

test('freezes saved lists in shared links', async ({ page }) => {
  await seedState(page, {
    key: true,
    lists: [{ id: 'list-main', name: 'Main', symbols: [SYMBOL] }],
  });
  await page.goto('/?list=list-main');
  await page.getByRole('button', { name: 'Share', exact: true }).click();

  const shared = new URL(
    await page.getByRole('dialog').getByLabel('Shareable screen URL').inputValue(),
  );
  expect(shared.searchParams.get('list')).toBe('shared');
  expect(shared.searchParams.get('symbols')).toBe(SYMBOL);
  expect(shared.searchParams.get('listName')).toBe('Main');

  const live = new URL(page.url());
  expect(live.searchParams.get('list')).toBe('list-main');
});

test('filters by sector from the dropdown', async ({ page }) => {
  await page.goto('/?list=sp500');

  const sector = page.getByLabel('Sector', { exact: true });
  await expect(sector).toHaveValue('all');
  const labels = await sector.evaluate((element) =>
    Array.from((element as HTMLSelectElement).options, (option) => option.textContent ?? ''),
  );
  for (const label of [
    'All Sectors',
    'Basic Materials',
    'Communication Services',
    'Consumer Cyclical',
    'Consumer Defensive',
    'Energy',
    'Financial Services',
    'Healthcare',
    'Industrials',
    'Real Estate',
    'Technology',
    'Utilities',
    'Other',
  ]) {
    expect(labels).toContain(label);
  }

  await sector.selectOption('tech');
  await expect(page).toHaveURL(/sector=tech/);

  await sector.selectOption('all');
  await expect(page).toHaveURL(/sector=all/);
});

test('falls back to Nasdaq-100 for removed list ids', async ({ page }) => {
  for (const id of ['funds', 'leveraged']) {
    await page.goto(`/?list=${id}`);
    await expect(page.getByRole('button', { name: 'Nasdaq-100', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
});

test('searches a ticker outside the selected universe', async ({ page }) => {
  await installAlpacaMocks(page);
  await seedState(page, { key: true });
  await page.goto('/?list=ndx');
  await page.getByRole('button', { name: '$150–300', exact: true }).click();

  const ndx = page.getByRole('button', { name: 'Nasdaq-100', exact: true });
  await expect(ndx).toHaveAttribute('aria-pressed', 'true');

  const search = page.getByLabel('Global ticker search');
  await search.fill(OTHER_SYMBOL);

  const row = page.locator('tbody tr').filter({ hasText: OTHER_SYMBOL });
  await expect(row).toBeVisible();
  await expect(page.getByLabel(`Global search scope: ${OTHER_SYMBOL}`)).toBeVisible();
  await expect(page.getByText(new RegExp(`${OTHER_SYMBOL} · Global search`))).toBeVisible();
  await expect(page.getByText(/Outside Nasdaq-100/)).toBeVisible();
  await expect(ndx).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(new RegExp(`q=${OTHER_SYMBOL}`));

  await page.getByRole('button', { name: 'Clear ticker search' }).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByText(/Outside Nasdaq-100/)).toHaveCount(0);
  await expect(page.getByLabel(`Global search scope: ${OTHER_SYMBOL}`)).toHaveCount(0);
  await expect(ndx).toHaveAttribute('aria-pressed', 'true');
  await expect(page).not.toHaveURL(/q=/);
});

test('selects a share-price bucket', async ({ page }) => {
  await page.goto('/');

  const defaultBucket = page.getByRole('button', { name: '$75–150', exact: true });
  await expect(defaultBucket).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Max Share Price')).toHaveCount(0);

  const higherBucket = page.getByRole('button', { name: '$150–300', exact: true });
  await higherBucket.click();
  await expect(page).toHaveURL(/price=150-300/);
  await expect(higherBucket).toHaveAttribute('aria-pressed', 'true');
  await expect(defaultBucket).toHaveAttribute('aria-pressed', 'false');

  const underBucket = page.getByRole('button', { name: '< $75', exact: true });
  await underBucket.click();
  await expect(page).toHaveURL(/price=under75/);
  await expect(underBucket).toHaveAttribute('aria-pressed', 'true');
});

test('explains filters and keeps Fine-tune collapsed within the session', async ({ page }) => {
  await installAlpacaMocks(page);
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  // Explanations live in the ? tips, not as permanent copy in the panel.
  await expect(
    page.getByText('Not applicable to saved lists. All share prices are included.', {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Hide contracts whose expiry spans an expected or estimated earnings date.'),
  ).toHaveCount(0);
  await expect(
    page.getByText('Hide contracts whose expiry spans an expected or estimated ex-dividend date.'),
  ).toHaveCount(0);

  await expect(
    page.getByRole('button', {
      name: /^(Strategy|Sector|Risk profile|Expiration|Share price bucket|Fine-tune|Delta|DTE range|Max IV %|Min yield %|Annualised yield|Max spread %|Avoid earnings|Avoid dividends):/,
    }),
  ).toHaveCount(14);

  const strategyTip = page.getByRole('button', { name: /^Strategy:/ });
  await strategyTip.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('CSP sells puts');
  const sidebar = await page.locator('aside').boundingBox();
  const tooltipBox = await tooltip.boundingBox();
  expect(sidebar).not.toBeNull();
  expect(tooltipBox).not.toBeNull();
  expect(tooltipBox!.x).toBeGreaterThanOrEqual(sidebar!.x);
  expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(sidebar!.x + sidebar!.width + 1);

  await page.getByRole('button', { name: /^Share price bucket:/ }).hover();
  await expect(tooltip).toContainText(
    'Not applicable to saved lists; all share prices are included.',
  );
  await page.getByRole('button', { name: /^Avoid earnings:/ }).hover();
  await expect(tooltip).toContainText('an expected or estimated earnings date');
  await page.getByRole('button', { name: /^Avoid dividends:/ }).hover();
  await expect(tooltip).toContainText('an expected or estimated ex-dividend date');

  const details = page.locator('details').filter({ hasText: 'Fine-tune' }).first();
  const summary = page.getByText('Fine-tune', { exact: true });
  await expect(details).toHaveAttribute('open', '');
  await page.getByRole('button', { name: /^Fine-tune:/ }).click();
  await expect(details).toHaveAttribute('open', '');
  await summary.click();
  await expect(details).not.toHaveAttribute('open', '');
  await page.reload();
  await expect(details).not.toHaveAttribute('open', '');
  await summary.click();
  await expect(details).toHaveAttribute('open', '');
});

test('places the event-exclusion hints beside their labels', async ({ page }) => {
  await page.goto('/');

  for (const name of ['earnings', 'dividends']) {
    const label = page.locator(`label[for="avoid-${name}"]`);
    await expect(label).toBeVisible();
    await expect(
      page.locator(`label[for="avoid-${name}"] + span button[aria-label^="Avoid ${name}:"]`),
    ).toHaveCount(1);
  }

  const checkbox = page.locator('#avoid-earnings');
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await expect(checkbox).toBeChecked();
});

test('spreads the risk-profile toggles across the filter column', async ({ page }) => {
  await page.goto('/');

  const sidebar = await page.locator('aside').boundingBox();
  const buttons = [
    page.getByRole('button', { name: 'Conservative', exact: true }),
    page.getByRole('button', { name: 'Balanced', exact: true }),
    page.getByRole('button', { name: 'Aggressive', exact: true }),
  ];
  let used = 0;
  for (const button of buttons) {
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    used += box?.width ?? 0;
  }
  expect(sidebar).not.toBeNull();
  expect(used).toBeGreaterThan(sidebar!.width - 64);
});

test('places the universe bar beside the filter column', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const sidebar = page.locator('aside');
  const universes = page.getByRole('group', { name: 'Universe', exact: true });
  await expect(sidebar).toBeVisible();
  await expect(universes).toBeVisible();

  const sidebarBox = await sidebar.boundingBox();
  const universeBox = await universes.boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(universeBox).not.toBeNull();
  expect(sidebarBox!.x + sidebarBox!.width).toBeLessThanOrEqual(universeBox!.x);
  expect(sidebarBox!.y).toBeLessThanOrEqual(universeBox!.y + 1);
});

test('serves the About page', async ({ page }) => {
  await page.goto('/about/');

  await expect(page).toHaveTitle('About WheelHQ - Options Screener');
  await expect(page.getByRole('heading', { level: 1, name: 'About WheelHQ' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What WheelHQ does' })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://wheelhq.xyz/about/',
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Alpaca/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /profile|account/,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  await expect(page.locator('img[src="/about/bmc-qr.png"]')).toBeVisible();
  await expect(page.getByRole('link', { name: /buymeacoffee/i })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'hello@wheelhq.xyz', exact: true }).first(),
  ).toHaveAttribute('href', 'mailto:hello@wheelhq.xyz');
  await expect(page.getByRole('link', { name: /Back to the screener/ }).first()).toHaveAttribute(
    'href',
    '/',
  );
  await expect(page.getByText('© 2026 WheelHQ', { exact: true })).toBeVisible();
});

test.describe('theme preference', () => {
  test.use({ colorScheme: 'dark' });

  test('follows the system theme until the user chooses one', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    expect(await page.evaluate(() => localStorage.getItem('wheelhq.theme'))).toBeNull();

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'emerald');

    const toggle = page.getByRole('button', { name: /Switch to (light|dark) theme/ });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    expect(await page.evaluate(() => localStorage.getItem('wheelhq.theme'))).toBe('night');

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  });

  test('keeps a saved theme when the system disagrees', async ({ page }) => {
    await seedState(page, { theme: 'emerald' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'emerald');
  });

  test('treats an old auto-saved system theme as automatic again', async ({ page }) => {
    await seedState(page, { theme: 'night' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'emerald');
  });
});
