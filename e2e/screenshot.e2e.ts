import process from 'node:process';
import { test } from '@playwright/test';
import { SYMBOL, installAlpacaMocks, seedState } from './mocks';

test('captures the README screenshot', async ({ page }) => {
  test.skip(!process.env.SCREENSHOT, 'set SCREENSHOT=1 to regenerate docs/screenshot.png');

  await page.setViewportSize({ width: 1280, height: 800 });
  await installAlpacaMocks(page);
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');
  await page.locator('tbody tr').filter({ hasText: SYMBOL }).waitFor();
  await page.screenshot({ path: 'docs/screenshot.png', fullPage: true });

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.screenshot({ path: 'static/og-image.png' });
});
