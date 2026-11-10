import { test, expect } from '@playwright/test';
import { fresh, setPlayers } from './helpers.js';

test.beforeEach(async ({ page }) => { await fresh(page); });

test('почати не можна, доки не заповнені всі імена', async ({ page }) => {
  const start = page.getByRole('button', { name: /Почати гру/ });
  await expect(start).toBeDisabled();
  await expect(page.getByText('Заповни всі імена')).toBeVisible();
  await setPlayers(page, ['Оля', 'Тарас']);
  await expect(start).toBeEnabled();
});

test('2–8 гравців: додавання до восьми, видалення не нижче двох', async ({ page }) => {
  await setPlayers(page, ['1', '2', '3', '4', '5', '6', '7', '8']);
  await expect(page.locator('.players li')).toHaveCount(8);
  await expect(page.getByRole('button', { name: /Додати гравця/ })).toHaveCount(0);
  for (let k = 0; k < 6; k++) await page.getByRole('button', { name: /Прибрати гравця/ }).first().click();
  await expect(page.locator('.players li')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Прибрати гравця/ }).first()).toBeDisabled();
});

test('перестановка змінює порядок у списку й на схемі кола', async ({ page }) => {
  await setPlayers(page, ['Оля', 'Тарас', 'Мама']);
  await page.getByRole('button', { name: 'Перемістити нижче' }).first().click();
  await expect(page.locator('.players input').nth(0)).toHaveValue('Тарас');
  await expect(page.locator('.players input').nth(1)).toHaveValue('Оля');
  await expect(page.locator('.seat b').first()).toHaveText('Тарас');
  await expect(page.getByRole('button', { name: 'Перемістити вище' }).first()).toBeDisabled();
});

test('однакові імена — попередження, але грати можна', async ({ page }) => {
  await setPlayers(page, ['Оля', 'оля']);
  await expect(page.getByText(/Однакові імена/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Почати гру/ })).toBeEnabled();
});

test('правила показуються лише перед першою грою', async ({ page }) => {
  await setPlayers(page, ['Оля', 'Тарас']);
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await expect(page.getByRole('heading', { name: 'Як грати' })).toBeVisible();
  await page.getByRole('button', { name: /Зрозуміло, граємо/ }).click();
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Нова гра/ }).click();
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await expect(page.getByRole('heading', { name: 'Вибери категорію' })).toBeVisible();
  // з меню правила відкриваються й повертають назад
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Правила/ }).click();
  await page.getByRole('button', { name: /Назад до гри/ }).click();
  await expect(page.getByRole('heading', { name: 'Вибери категорію' })).toBeVisible();
});

test('фото з галереї стискається до квадрата 320×320 і переживає перезавантаження', async ({ page }) => {
  await setPlayers(page, ['Оля', 'Тарас']);
  // тестова картинка 600×400, зроблена в самому браузері
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400;
    const g = c.getContext('2d'); g.fillStyle = '#ff9900'; g.fillRect(0, 0, 600, 400); g.fillStyle = '#3300ff'; g.fillRect(250, 150, 100, 100);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button', { name: 'Фото для Оля' }).click();
  await page.locator('.sheet label', { hasText: 'Галерея' }).locator('input').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  const img = page.locator('.preview img');
  await expect(img).toBeVisible();
  const info = await img.evaluate((el) => new Promise((res) => {
    const done = () => res({ w: el.naturalWidth, h: el.naturalHeight, jpeg: el.src.startsWith('data:image/jpeg') });
    el.complete ? done() : el.addEventListener('load', done);
  }));
  expect(info).toEqual({ w: 320, h: 320, jpeg: true });
  await page.locator('.tpl', { hasText: 'Корона' }).click();
  await page.getByRole('button', { name: 'Закрити' }).click();
  await expect(page.locator('.players li').first().locator('img')).toBeVisible();
  await expect(page.locator('.players li').first().locator('svg')).toBeVisible();
  await page.reload();
  await expect(page.locator('.players li').first().locator('img')).toBeVisible();
  // прибрати фото
  await page.getByRole('button', { name: 'Фото для Оля' }).click();
  await page.getByRole('button', { name: 'Прибрати фото' }).click();
  await expect(page.locator('.preview img')).toHaveCount(0);
});

test('пошкоджений файл фото — зрозуміла помилка, гра не падає', async ({ page }) => {
  await setPlayers(page, ['Оля', 'Тарас']);
  await page.getByRole('button', { name: 'Фото для Оля' }).click();
  await page.locator('.sheet label', { hasText: 'Галерея' }).locator('input').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(page.getByText('Не вдалося прочитати фото')).toBeVisible();
});

test('пошкоджене сховище — гра відкривається з нуля', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('whoiswho.v2', '{broken'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Хто є хто' })).toBeVisible();
  await expect(page.locator('.players li')).toHaveCount(2);
});

const makePng = (page) => page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 400; c.height = 400;
  const g = c.getContext('2d'); g.fillStyle = '#55aaff'; g.fillRect(0, 0, 400, 400);
  return c.toDataURL('image/png').split(',')[1];
});

test('шаблон можна посунути пальцем і змінити розмір; положення зберігається', async ({ page }) => {
  await setPlayers(page, ['Оля', 'Тарас']);
  await page.getByRole('button', { name: 'Фото для Оля' }).click();
  await page.locator('.tpl', { hasText: 'Корона' }).click();
  const stage = page.locator('.stage');
  const box = await stage.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx + 34, cy + 17, { steps: 5 }); await page.mouse.up();
  await page.getByLabel('Розмір шаблону').fill('1.3');
  const pos = () => page.evaluate(() => JSON.parse(localStorage.getItem('whoiswho.v2')).players[0].tplPos);
  // ~34×17 px на прев'ю 170 px — це ~20% × 10%; дробові пікселі на екранах 3× дають ±0.5
  const near = (p) => Math.abs(p.x - 20) <= 0.5 && Math.abs(p.y - 10) <= 0.5 && p.s === 1.3;
  await expect.poll(async () => near(await pos())).toBe(true);
  await expect(stage.locator('svg')).toHaveAttribute('style', /translate\(\d+(\.\d)?%, \d+(\.\d)?%\) scale\(1\.3\)/);
  const before = await pos();
  await page.reload();
  expect(await pos()).toEqual(before);
  await page.getByRole('button', { name: 'Фото для Оля' }).click();
  await page.getByRole('button', { name: /Скинути/ }).click();
  await expect.poll(pos).toEqual({ x: 0, y: 0, s: 1 });
  // новий шаблон починає з центру
  await page.locator('.tpl', { hasText: 'Вуса' }).click();
  await expect(page.locator('.tpl', { hasText: 'Вуса' })).toHaveAttribute('aria-pressed', 'true');
});

test('«Видалити всі фото» стирає фото й шаблони всіх гравців', async ({ page }) => {
  await setPlayers(page, ['Оля', 'Тарас']);
  const png = Buffer.from(await makePng(page), 'base64');
  for (const name of ['Оля', 'Тарас']) {
    await page.getByRole('button', { name: `Фото для ${name}` }).click();
    await page.locator('.sheet label', { hasText: 'Галерея' }).locator('input').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('.preview img')).toBeVisible();
    await page.locator('.tpl', { hasText: 'Котик' }).click();
    await page.getByRole('button', { name: 'Закрити' }).click();
  }
  await expect(page.locator('.players img')).toHaveCount(2);
  await page.getByRole('button', { name: /Видалити всі фото/ }).click();
  await expect(page.locator('.players img')).toHaveCount(0);
  await expect(page.locator('.players svg')).toHaveCount(0);
  const players = await page.evaluate(() => JSON.parse(localStorage.getItem('whoiswho.v2')).players);
  expect(players.every((p) => !p.photo && !p.template)).toBe(true);
  await expect(page.getByRole('button', { name: /Видалити всі фото/ })).toHaveCount(0);
});

test('фото й шаблон видно на картці питання й у верхній панелі', async ({ page }) => {
  await setPlayers(page, ['Оля', 'Тарас']);
  await page.getByRole('button', { name: 'Фото для Оля' }).click();
  await page.locator('.sheet label', { hasText: 'Галерея' }).locator('input').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: Buffer.from(await makePng(page), 'base64') });
  await expect(page.locator('.preview img')).toBeVisible();
  await page.locator('.tpl', { hasText: 'Корона' }).click();
  await page.getByRole('button', { name: 'Закрити' }).click();
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await page.getByRole('button', { name: /Зрозуміло, граємо/ }).click();
  await expect(page.locator('.bar img')).toBeVisible();
  await page.locator('.cat', { hasText: 'Відкрийся' }).click();
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('whoiswho.v2')));
  await page.getByRole('button', { name: `Карта ${s.game.deck.open.indexOf('op-02') + 1}`, exact: true }).click();
  await expect(page.getByRole('dialog').locator('.who img')).toBeVisible();
  await expect(page.getByRole('dialog').locator('.who svg')).toBeVisible();
});
