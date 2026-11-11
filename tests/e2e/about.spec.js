import { test, expect } from './fixtures.js';
import { readFileSync } from 'node:fs';
import { fresh } from './helpers.js';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url)));

test('«Про гру»: версія з package.json, дата збірки, «Що нового» з CHANGELOG', async ({ page }) => {
  await fresh(page);
  await expect(page.getByRole('button', { name: `ℹ️ Про гру · версія ${pkg.version}` })).toBeVisible();
  await page.getByRole('button', { name: /Про гру/ }).click();
  await expect(page.getByTestId('version')).toContainText(`Версія ${pkg.version} · `);
  await expect(page.getByTestId('version')).toHaveText(/\d{2}\.\d{2}\.\d{4}/);
  await expect(page.locator('.news').first()).toContainText(pkg.version);
  await expect(page.getByText(/Nunito/)).toBeVisible();
  await page.getByRole('button', { name: 'Назад' }).click();
  await expect(page.getByRole('heading', { name: 'Хто є хто' })).toBeVisible();
});

test('нова версія: з\'являється «Оновити», натискання застосовує оновлення', async ({ page }) => {
  await fresh(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.evaluate(() => { window.__applied = 0; window.__applyUpdate = () => window.__applied++; window.dispatchEvent(new CustomEvent('whoiswho:update')); });
  await expect(page.getByRole('alert')).toContainText('Є нова версія');
  await page.getByRole('button', { name: 'Оновити' }).click();
  expect(await page.evaluate(() => window.__applied)).toBe(1);
});

test('«Перевірити оновлення» питає service worker; без нього — пояснення', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: /Про гру/ }).click();
  await page.evaluate(() => { window.__checkUpdate = undefined; });
  await page.getByRole('button', { name: /Перевірити оновлення/ }).click();
  await expect(page.getByText(/коли гра встановлена/)).toBeVisible();
  await page.evaluate(() => { window.__checks = 0; window.__checkUpdate = async () => { window.__checks++; }; });
  await page.getByRole('button', { name: /Перевірити оновлення/ }).click();
  await expect(page.getByText(/унизу з'явиться кнопка/)).toBeVisible();
  expect(await page.evaluate(() => window.__checks)).toBe(1);
  await page.evaluate(() => { window.__checkUpdate = async () => { throw new Error('offline'); }; });
  await page.getByRole('button', { name: /Перевірити оновлення/ }).click();
  await expect(page.getByText(/Не вдалося перевірити/)).toBeVisible();
});
