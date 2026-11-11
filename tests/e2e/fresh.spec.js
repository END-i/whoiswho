import { test, expect } from './fixtures.js';
import { startGame, openQuestion, saved, category } from './helpers.js';

const menu = async (page, item) => { await page.getByRole('button', { name: 'Меню' }).click(); await page.getByRole('button', { name: item }).click(); };
const nextGame = async (page) => {
  await menu(page, /Нова гра/);
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await expect(page.getByRole('heading', { name: 'Вибери категорію' })).toBeVisible();
};

test('нова гра спершу роздає незіграні питання — навіть після перезавантаження', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас']);
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01');
  await page.getByRole('button', { name: 'Пропустити' }).click();
  await page.getByRole('button', { name: 'До категорій' }).click();
  await openQuestion(page, 'Вгадай', 'guess', 'gs-04');
  await page.getByRole('button', { name: /Далі/ }).click();
  await page.reload();
  await nextGame(page);
  await expect(category(page, 'Вгадай')).toContainText('23 з 23');
  const deck = (await saved(page)).game.deck.guess;
  expect(deck).not.toContain('gs-01'); expect(deck).not.toContain('gs-04');
  await expect(category(page, 'Хто з нас?')).toContainText('25 з 25');
  await expect(page.locator('.again')).toHaveCount(0);
});

test('коли в категорії майже все зіграно — вона йде по колу, і гра про це каже', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас']);
  // 23 з 25 питань «Вгадай» уже були в минулих іграх
  await page.evaluate(() => {
    const k = 'whoiswho.v2', s = JSON.parse(localStorage.getItem(k));
    s.seen = { family: Array.from({ length: 23 }, (_, i) => `gs-${String(i + 1).padStart(2, '0')}`) };
    localStorage.setItem(k, JSON.stringify(s));
  });
  await page.reload();
  await nextGame(page);
  await expect(category(page, 'Вгадай')).toContainText('25 з 25');
  await expect(page.locator('.again')).toHaveText(/«Вгадай»: усі питання вже були в минулих іграх — граємо їх по колу знову/);
  expect((await saved(page)).seen.family.filter((id) => id.startsWith('gs-'))).toEqual([]);
  // повідомлення лишається до кінця гри, навіть після перезавантаження
  await page.reload();
  await expect(page.locator('.again')).toBeVisible();
});
