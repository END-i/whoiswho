import { test, expect } from './fixtures.js';
import { fresh } from './helpers.js';

test('гра ще не встановлена: смужка «Встанови гру» веде до інструкції, свій телефон — першим і підсвічений', async ({ page }, info) => {
  await fresh(page);
  await page.getByRole('button', { name: /Встанови гру на телефон/ }).click();
  await expect(page.getByRole('heading', { name: /Встановити гру/ })).toBeVisible();
  const mine = info.project.name === 'iphone' ? 'iPhone та iPad' : 'Android';
  await expect(page.getByRole('region', { name: mine })).toHaveClass(/mine/);
  const firstOnScreen = await page.locator('.platforms section').evaluateAll((els) => els.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0].getAttribute('aria-label'));
  expect(firstOnScreen).toBe(mine);
  await expect(page.getByText('На початковий екран')).toBeVisible();
  await expect(page.getByText('Встановити застосунок')).toBeVisible();
  await page.getByRole('button', { name: 'Назад' }).click();
  await expect(page.getByRole('heading', { name: 'Хто є хто' })).toBeVisible();
});

test('Android: браузер дозволяє встановити — кнопка «Встановити» відкриває системне вікно', async ({ page }) => {
  await fresh(page);
  await page.evaluate(() => {
    window.__prompted = 0;
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = async () => { window.__prompted++; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await page.getByRole('button', { name: /Встанови гру на телефон/ }).click();
  await page.getByRole('button', { name: '📲 Встановити' }).click();
  await expect.poll(() => page.evaluate(() => window.__prompted)).toBe(1);
  await expect(page.getByRole('button', { name: '📲 Встановити' })).toHaveCount(0); // подію можна використати лише раз
});

test('у встановленій грі підказок про встановлення немає', async ({ page }) => {
  await page.addInitScript(() => {
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => (q.includes('display-mode: standalone') ? { matches: true, addEventListener() {}, removeEventListener() {} } : mm(q));
  });
  await fresh(page);
  await expect(page.getByRole('button', { name: /Встанови гру на телефон/ })).toHaveCount(0);
});

test('інструкцію видно й з меню під час гри', async ({ page }) => {
  await fresh(page);
  await page.locator('.players input').nth(0).fill('Оля'); await page.locator('.players input').nth(1).fill('Тарас');
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await page.getByRole('button', { name: /Граємо!/ }).click();
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Як встановити/ }).click();
  await expect(page.getByRole('heading', { name: /Встановити гру/ })).toBeVisible();
  await page.getByRole('button', { name: 'Назад' }).click();
  await expect(page.getByRole('heading', { name: 'Вибери категорію' })).toBeVisible();
});
