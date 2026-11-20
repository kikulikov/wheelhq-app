import { expect, test } from '@playwright/test';
import { SYMBOL, installAlpacaMocks, seedState } from './mocks';

test('collapses filters on a narrow screen and jumps to results', async ({ page }) => {
  await installAlpacaMocks(page);
  await seedState(page, { key: true, watchlist: [SYMBOL] });
  await page.goto('/?list=favourites');

  const toggle = page.getByRole('button', { name: /^Filters/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#filters-panel')).toBeHidden();

  const summary = page.getByText('1 matching contract', { exact: true });
  await expect(summary).toBeVisible();
  const box = await summary.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.y).toBeLessThan(viewport.height);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#filters-panel')).toBeVisible();

  await page.getByRole('link', { name: /Results/ }).click();
  await expect(page).toHaveURL(/#results$/);
});
