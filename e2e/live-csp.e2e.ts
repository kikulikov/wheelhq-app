import process from 'node:process';
import { expect, test } from '@playwright/test';

test('production CSP allows the main interactions', async ({ page }) => {
  test.skip(process.env.LIVE !== '1', 'set LIVE=1 to check the deployed site');

  // Cloudflare only accepts the registered hostname, so check the canonical domain
  // rather than the onrender.com preview host.
  const site = process.env.LIVE_URL ?? 'https://wheelhq.xyz/';

  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(site);
  await expect(page.getByRole('heading', { name: 'WheelHQ', exact: true })).toBeVisible();
  await expect(
    page.locator('script[src="https://static.cloudflareinsights.com/beacon.min.js"]'),
  ).toHaveCount(0);
  await expect(page.locator('img[data-wheelhq-analytics]')).toHaveAttribute(
    'src',
    'https://wheelhq.goatcounter.com/count?p=%2F',
  );
  await expect(page.getByRole('link', { name: 'Buy me a coffee' })).toHaveAttribute(
    'href',
    'https://buymeacoffee.com/wheelhq',
  );
  await expect(page.locator('iframe')).toHaveCount(0);

  await page.getByRole('button', { name: 'Add Alpaca key' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.locator('button[title="Toggle light/dark"]').click();

  await page.goto(`${site}about/`);
  await expect(page.locator('img[src="/about/bmc-qr.png"]')).toBeVisible();
  await expect(page.locator('img[data-wheelhq-analytics]')).toHaveAttribute(
    'src',
    'https://wheelhq.goatcounter.com/count?p=%2Fabout%2F',
  );
  expect(errors.filter((text) => /Content Security Policy|Refused to/i.test(text))).toEqual([]);
});
