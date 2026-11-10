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
  await page.getByRole('button', { name: 'Прибрати', exact: true }).click();
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
