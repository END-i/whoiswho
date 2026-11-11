import { test, expect } from './fixtures.js';
import { startGame, openQuestion, fresh, setPlayers } from './helpers.js';

// Підставний Wake Lock: записує запити й звільнення у window.__wl
const fakeWakeLock = () => {
  window.__wl = { requests: 0, released: 0 };
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: {
    request: async () => { window.__wl.requests++; const h = {}; return {
      release() { window.__wl.released++; h.release?.(); }, addEventListener: (t, f) => (h[t] = f) }; },
  } });
};
const wl = (page) => page.evaluate(() => window.__wl);

test('Wake Lock: екран тримається на екранах гри й відпускається на підсумку', async ({ page }) => {
  await page.addInitScript(fakeWakeLock);
  await startGame(page, ['Оля', 'Тарас']);
  await expect.poll(async () => (await wl(page)).requests).toBe(1);
  await page.locator('.cat').first().click();
  expect((await wl(page)).requests).toBe(1); // перехід усередині гри не просить повторно
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Завершити гру/ }).click();
  await expect.poll(async () => (await wl(page)).released).toBe(1);
});

test('без Wake Lock — підказка вимкнути автоблокування', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined }));
  await fresh(page);
  await expect(page.getByText(/Вимкни автоблокування/)).toBeVisible();
});

// Підставний голос браузера з українським голосом
const fakeVoice = () => {
  window.__spoken = [];
  const voices = [{ lang: 'en-US', name: 'Alex' }, { lang: 'uk-UA', name: 'Lesya' }];
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => voices, speak: (u) => { window.__spoken.push({ text: u.text, lang: u.lang, voice: u.voice?.name }); setTimeout(() => u.onend?.(), 50); },
    cancel() {}, addEventListener() {}, removeEventListener() {},
  } });
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
};

test('голос браузера: перемикач доступний, кнопка 🔊 читає питання українським голосом', async ({ page }) => {
  await page.addInitScript(fakeVoice);
  await fresh(page);
  await setPlayers(page, ['Оля', 'Тарас']);
  const sw = page.getByRole('switch', { name: 'Голос браузера' });
  await expect(sw).toBeEnabled();
  await sw.check();
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await page.getByRole('button', { name: /Граємо!/ }).click();
  await openQuestion(page, 'Вгадай', 'guess', 'gs-04'); // для gs-04 записаної озвучки немає
  await page.getByRole('button', { name: 'Прослухати питання' }).click();
  const spoken = await page.evaluate(() => window.__spoken);
  expect(spoken).toEqual([{ text: 'Яку суперсилу обрав би гравець ліворуч?', lang: 'uk-UA', voice: 'Lesya' }]);
});

test('без українського голосу перемикач вимкнений, а кнопки 🔊 немає', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => [{ lang: 'en-US' }], speak() {}, cancel() {}, addEventListener() {}, removeEventListener() {} } }));
  await fresh(page);
  await expect(page.getByRole('switch', { name: 'Голос браузера' })).toBeDisabled();
  await expect(page.getByText('немає українського голосу')).toBeVisible();
  await setPlayers(page, ['Оля', 'Тарас']);
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await page.getByRole('button', { name: /Граємо!/ }).click();
  await openQuestion(page, 'Вгадай', 'guess', 'gs-04');
  await expect(page.getByRole('button', { name: 'Прослухати питання' })).toHaveCount(0);
});

test('голос вимкнений — кнопки 🔊 немає, навіть якщо голос є', async ({ page }) => {
  await page.addInitScript(fakeVoice);
  await startGame(page, ['Оля', 'Тарас']);
  await openQuestion(page, 'Вгадай', 'guess', 'gs-04');
  await expect(page.getByRole('button', { name: 'Прослухати питання' })).toHaveCount(0);
});

// Підставний AudioContext: рахує запущені ноти
const fakeAudio = () => {
  window.__notes = [];
  window.AudioContext = class {
    constructor() { this.currentTime = 0; this.destination = {}; }
    resume() {}
    createOscillator() { const o = { frequency: {}, connect() {}, stop() {}, start: () => window.__notes.push(o.frequency.value) }; return o; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  };
};
const notes = (page) => page.evaluate(() => window.__notes);

test('звук: «Правильно» — висхідна мелодія з трьох нот, «Ні» — одна; без балів і з вимкненими звуками — тиша', async ({ page }) => {
  await page.addInitScript(fakeAudio);
  await startGame(page, ['Оля', 'Тарас'], { scoring: true });
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01');
  await page.getByRole('button', { name: /Правильно/ }).click();
  await expect.poll(() => notes(page)).toEqual([784, 988, 1319]);
  await page.getByRole('button', { name: 'До категорій' }).click();
  await openQuestion(page, 'Вгадай', 'guess', 'gs-04');
  await page.getByRole('button', { name: /Неправильно/ }).click();
  await expect.poll(async () => (await notes(page)).length).toBe(4);
  // пропуск — без звуку
  await page.getByRole('button', { name: 'До категорій' }).click();
  await openQuestion(page, 'Вгадай', 'guess', 'gs-06');
  await page.getByRole('button', { name: 'Пропустити' }).click();
  // вимкнути звуки
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Гравці й налаштування/ }).click();
  await page.getByRole('switch', { name: 'Звуки' }).uncheck();
  await page.getByRole('button', { name: /Повернутися до гри/ }).click();
  await page.getByRole('button', { name: 'До категорій' }).click();
  await openQuestion(page, 'Вгадай', 'guess', 'gs-08');
  await page.getByRole('button', { name: /Правильно/ }).click();
  await page.waitForTimeout(200);
  expect((await notes(page)).length).toBe(4);
});
