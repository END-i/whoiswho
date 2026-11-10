import { test, expect } from '@playwright/test';
import { startGame, category, openCard, openQuestion, QUESTIONS } from './helpers.js';

const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const scheme of ['light', 'dark']) {
  test(`екран 320 px, тема ${scheme}: без горизонтальної прокрутки на всіх екранах`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.emulateMedia({ colorScheme: scheme });
    await startGame(page, ['Олександра', 'Тарас', 'Мама', 'Тато', 'Бабуся', 'Дідусь', 'Софійка', 'Максимко'], { scoring: true });
    expect(await noHorizontalScroll(page)).toBe(true);
    await openQuestion(page, 'Що про тебе знають', 'aboutme', 'am-02');
    expect(await noHorizontalScroll(page)).toBe(true);
    // кнопки дії видно й можна натиснути без прокрутки сторінки за межі
    await expect(page.getByRole('button', { name: /Правильно/ })).toBeInViewport({ ratio: 0.5 });
  });
}

test('найдовше питання вміщується на 320 px без обрізання', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await startGame(page, ['Оля', 'Тарас']);
  const longest = QUESTIONS.questions.reduce((a, b) => (a.text.length > b.text.length ? a : b));
  const cat = QUESTIONS.categories.find((c) => c.id === longest.category);
  await category(page, cat.title).click();
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('whoiswho.v2')));
  await openCard(page, s.game.deck[cat.id].indexOf(longest.id) + 1);
  const q = page.locator('.q');
  await expect(q).toHaveText(longest.text);
  expect(await q.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('шрифт Nunito з кирилицею завантажується', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас']);
  const ok = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('900 20px Nunito', 'Їжак'); });
  expect(ok).toBe(true);
});

test('з анімаціями (без reduced motion) карта перевертається й відкривається', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await startGame(page, ['Оля', 'Тарас']);
  await category(page, 'Відкрийся').click();
  await page.getByRole('button', { name: 'Карта 4', exact: true }).click();
  await expect(page.locator('.card.flip')).toHaveCount(1);
  await expect(page.getByRole('dialog', { name: 'Картка 4' })).toBeVisible();
  // поки перевертається, інші карти натиснути не можна
  await expect(page.locator('.card.flip')).toHaveCount(0);
});

test('кнопки «Правильно» і «Ні» кольорові, текст на них видно', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас'], { scoring: true });
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01');
  const look = (name) => page.getByRole('button', { name }).evaluate((el) => {
    const cs = getComputedStyle(el), rgb = (c) => c.match(/\d+/g).slice(0, 3).map(Number);
    return { bg: rgb(cs.backgroundColor), fg: rgb(cs.color) };
  });
  const ok = await look(/Правильно/), no = await look('❌ Неправильно');
  expect(ok.bg[1]).toBeGreaterThan(ok.bg[0]); // зелена
  expect(no.bg[0]).toBeGreaterThan(no.bg[1] + 80); // червона
  for (const b of [ok, no]) expect(b.fg).toEqual([255, 255, 255]); // білий текст
});
