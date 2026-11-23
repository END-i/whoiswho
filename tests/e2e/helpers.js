import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { bravePoints } from '../../src/lib/state.js';

export const KEY = 'whoiswho.v2';
export const QUESTIONS = JSON.parse(readFileSync(new URL('../../src/data/packs/family.json', import.meta.url)));
export const byId = new Map(QUESTIONS.questions.map((q) => [q.id, q]));
export const confirmAll = (page) => page.on('dialog', (d) => d.accept());

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
// бали — завжди (1.11.0), перемикача немає
export async function startGame(page, names = ['Оля', 'Тарас', 'Мама', 'Тато'], { kids = false } = {}) {
  await fresh(page);
  await setPlayers(page, names);
  if (kids) await page.getByRole('radio', { name: /Лише діти/ }).click();
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await page.getByRole('button', { name: /Граємо!/ }).click();
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

/** Бали сміливого питання в поточній грі (30, 40 чи 50 — від зерна гри). */
export const braveOf = async (page, qid) => bravePoints((await saved(page)).game.seed, qid);

/** Перевести дизайн картки (lib/designs.js) через збереження й перезавантажити сторінку. */
export async function setDesign(page, design) {
  const s = await saved(page); s.settings.design = design;
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, s]);
  await page.reload();
}

/** Колір тексту, фон під ним (перший непрозорий предок) — #rrggbb — і розмір/жирність шрифту. */
export const look = (loc) => loc.evaluate((el) => {
  const g = document.createElement('canvas').getContext('2d');
  const hex = (v) => {
    const m = v.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/); // так браузер повертає color-mix
    if (m) return '#' + m.slice(1, 4).map((x) => Math.round(+x * 255).toString(16).padStart(2, '0')).join('');
    g.fillStyle = '#000'; g.fillStyle = v; return g.fillStyle;
  };
  // напівпрозорий фон (плашка rgba(…, .25)) не рахуємо — дивимось далі вгору, на справжній
  const opaque = (v) => /^rgb\(/.test(v) || (/^color\(srgb/.test(v) && !/ \/ /.test(v));
  let b = el; while (b && !opaque(getComputedStyle(b).backgroundColor)) b = b.parentElement;
  const cs = getComputedStyle(el);
  return { fg: hex(cs.color), bg: hex(b ? getComputedStyle(b).backgroundColor : '#ffffff'), size: parseFloat(cs.fontSize), weight: +cs.fontWeight };
});
