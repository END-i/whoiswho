import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

export const KEY = 'whoiswho.v2';
export const QUESTIONS = JSON.parse(readFileSync(new URL('../../src/data/questions.json', import.meta.url)));
export const byId = new Map(QUESTIONS.questions.map((q) => [q.id, q]));
const confirmAll = (page) => page.on('dialog', (d) => d.accept());

/** Чистий старт: порожнє сховище, підтвердження діалогів. */
export async function fresh(page) {
  confirmAll(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Хто є хто' })).toBeVisible();
}

/** Записати імена гравців (додає рядки за потреби). */
export async function setPlayers(page, names) {
  const inputs = page.locator('.players input');
  for (let k = 0; k < names.length; k++) {
    if (k >= (await inputs.count())) {
      await page.getByRole('button', { name: /Додати гравця/ }).click();
      // гра ставить курсор у новий рядок наступним кадром — чекаємо, щоб не друкувати в чужий рядок
      await expect(inputs.nth(k)).toBeFocused();
    }
    await inputs.nth(k).fill(names[k]);
    await expect(inputs.nth(k)).toHaveValue(names[k]);
  }
}

/** Від чистого старту до екрана категорій. */
export async function startGame(page, names = ['Оля', 'Тарас', 'Мама', 'Тато'], { scoring = false, kids = false } = {}) {
  await fresh(page);
  await setPlayers(page, names);
  if (scoring) await page.getByRole('switch').first().check();
  if (kids) await page.getByRole('radio', { name: /Лише діти/ }).click();
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await page.getByRole('button', { name: /Зрозуміло, граємо/ }).click();
  await expect(page.getByRole('heading', { name: 'Вибери категорію' })).toBeVisible();
}

export const saved = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);

/** Номер карти, під яким у поточній грі лежить питання з таким id. */
export async function numberOf(page, cat, qid) {
  const s = await saved(page);
  return s.game.deck[cat].indexOf(qid) + 1;
}

export const category = (page, title) => page.locator('.cat', { hasText: title });

/** Відкрити карту з номером у вже вибраній категорії і дочекатися великої картки. */
export async function openCard(page, n) {
  await page.getByRole('button', { name: `Карта ${n}`, exact: true }).click();
  await expect(page.getByRole('dialog', { name: `Картка ${n}` })).toBeVisible();
}

/** Відкрити конкретне питання: категорія → його номер. */
export async function openQuestion(page, catTitle, catId, qid) {
  await category(page, catTitle).click();
  const n = await numberOf(page, catId, qid);
  await openCard(page, n);
  return n;
}

export const turnName = (page) => page.locator('.bar .txt b').innerText();
