import { test, expect } from './fixtures.js';
import { startGame, openQuestion, saved } from './helpers.js';

const menu = async (page, item) => { await page.getByRole('button', { name: 'Меню' }).click(); await page.getByRole('button', { name: item }).click(); };
const correct = (page) => page.getByRole('button', { name: 'Правильно', exact: true }).click();

test('нові екрани відкриваються згори, а не прокрученими донизу', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 600 });
  await startGame(page, ['Оля', 'Тарас', 'Мама', 'Тато', 'Бабуся'], { scoring: true }); // кнопка «Почати» внизу довгої сторінки
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.locator('.cat').last().click();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await menu(page, /Правила/);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('нулі в усіх — без п\'єдесталу й переможця', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас'], { scoring: true });
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01');
  await page.getByRole('button', { name: /Неправильно/ }).click();
  await menu(page, /Завершити гру/);
  await expect(page.getByText('Ніхто не набрав балів')).toBeVisible();
  await expect(page.getByLabel("П'єдестал")).toHaveCount(0);
  await expect(page.locator('.table li .place')).toHaveText(['1', '1']);
});

test('нічия на першому місці — обоє на першій сходинці', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас', 'Мама'], { scoring: true });
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01'); await correct(page);           // Оля +20
  await openQuestion(page, 'Вгадай', 'guess', 'gs-04'); await correct(page);           // Тарас +20
  await menu(page, /Завершити гру/);
  await expect(page.getByText(/Нічия! Перше місце ділять: Оля, Тарас/)).toBeVisible();
  await expect(page.locator('.step.s1 .avatar, .step.s1 .av')).toHaveCount(2);
  await expect(page.locator('.step.s2')).toHaveCount(0);
  await expect(page.locator('.step.s3')).toContainText('Мама');
});

test('історія: дві гри → загальний рахунок; незавершена гра теж зберігається; переживає перезавантаження', async ({ page }) => {
  // гра 1: Оля перемагає й гру завершено
  await startGame(page, ['Оля', 'Тарас'], { scoring: true });
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01'); await correct(page);
  await menu(page, /Завершити гру/);
  await page.getByRole('button', { name: /Нова гра/ }).click();
  await expect(page.getByRole('button', { name: /Історія ігор \(1\)/ })).toBeVisible();
  // гра 2: Тарас набирає 20, але гру кидають через «Нова гра»
  await page.getByRole('button', { name: /Почати гру/ }).click();
  for (const id of ['op-02', 'op-04']) {
    await page.locator('.cat', { hasText: 'Відкрийся' }).click();
    const s = await saved(page);
    const turn = s.game.order[s.game.turn];
    await page.getByRole('button', { name: `Карта ${s.game.deck.open.indexOf(id) + 1}`, exact: true }).click();
    await page.getByRole('button', { name: turn === s.game.order[1] ? '✅ Є відповідь · +20' : /Пропустити/ }).click();
  }
  await menu(page, /Нова гра/);
  await page.reload();
  await page.getByRole('button', { name: /Історія ігор \(2\)/ }).click();
  const board = page.getByLabel('Загальний рахунок').locator('li');
  await expect(board).toHaveCount(2);
  await expect(board.nth(0)).toContainText('Оля'); await expect(board.nth(0)).toContainText('1перемог');
  await expect(board.nth(1)).toContainText('Тарас');
  await expect(page.getByText('не завершена')).toHaveCount(1);
  await expect(page.getByText('Попереду: Тарас')).toBeVisible(); // незавершена — без переможця, але з лідером
  await page.getByRole('button', { name: /Очистити історію/ }).click();
  await expect(page.getByText(/Тут з'являться завершені ігри/)).toBeVisible();
  await page.getByRole('button', { name: 'Назад' }).click();
  await expect(page.getByRole('heading', { name: 'Хто є хто' })).toBeVisible();
});

test('нова гра без жодної картки не потрапляє в історію', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас']);
  await menu(page, /Нова гра/);
  expect((await saved(page)).history).toEqual([]);
});

test('підсумок: «📤 Поділитися» — картинка PNG з іменами через меню телефона, а без нього — завантаження', async ({ page }) => {
  await page.addInitScript(() => {
    window.__shared = [];
    navigator.canShare = () => true;
    navigator.share = async ({ files }) => { const f = files[0]; window.__shared.push({ name: f.name, type: f.type, size: f.size }); };
  });
  await startGame(page, ['Оля', 'Тарас'], { scoring: true });
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01'); await correct(page);
  await menu(page, /Завершити гру/);
  await page.getByRole('button', { name: '📤 Поділитися' }).click();
  await expect.poll(() => page.evaluate(() => window.__shared)).toHaveLength(1);
  const [f] = await page.evaluate(() => window.__shared);
  expect(f.name).toBe('whoiswho.png'); expect(f.type).toBe('image/png'); expect(f.size).toBeGreaterThan(10_000);
  // без меню «Поділитися» — файл завантажується
  await page.evaluate(() => { navigator.canShare = () => false; });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '📤 Поділитися' }).click();
  expect((await download).suggestedFilename()).toBe('whoiswho.png');
});
