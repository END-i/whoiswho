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

test('голос браузера: картка сама читає питання українським голосом, «Слухати» — ще раз', async ({ page }) => {
  await page.addInitScript(fakeVoice);
  await fresh(page);
  await setPlayers(page, ['Оля', 'Тарас']);
  const sw = page.getByRole('switch', { name: 'Голос браузера' });
  await expect(sw).toBeEnabled();
  await sw.check();
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await page.getByRole('button', { name: /Граємо!/ }).click();
  await openQuestion(page, 'Вгадай', 'guess', 'gs-04'); // для gs-04 записаної озвучки немає
  const one = { text: 'Яку суперсилу обрав би гравець ліворуч?', lang: 'uk-UA', voice: 'Lesya' };
  await expect.poll(() => page.evaluate(() => window.__spoken)).toEqual([one]);
  await page.getByRole('button', { name: 'Прослухати питання' }).click(); // дочитав — кнопка знову «Слухати»
  await expect.poll(() => page.evaluate(() => window.__spoken)).toEqual([one, one]);
});

test('автоозвучка: вимкнена в налаштуваннях — картка мовчить, доки не натиснуть «Слухати»', async ({ page }) => {
  await page.addInitScript(fakeVoice);
  await fresh(page);
  await setPlayers(page, ['Оля', 'Тарас']);
  await page.getByRole('switch', { name: 'Голос браузера' }).check();
  const auto = page.getByRole('switch', { name: 'Читати питання вголос' });
  await expect(auto).toBeChecked(); // за замовчуванням увімкнена
  await auto.uncheck();
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await page.getByRole('button', { name: /Граємо!/ }).click();
  await openQuestion(page, 'Вгадай', 'guess', 'gs-04');
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__spoken)).toEqual([]);
  await page.getByRole('button', { name: 'Прослухати питання' }).click();
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1);
});

test('автоозвучка: де треба вибрати гравця — питання читається лише після вибору; натиснули «Слухати» раніше — не повторює', async ({ page }) => {
  await page.addInitScript(fakeVoice);
  await fresh(page);
  await setPlayers(page, ['Оля', 'Тарас', 'Мама']);
  await page.getByRole('switch', { name: 'Голос браузера' }).check();
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await page.getByRole('button', { name: /Граємо!/ }).click();
  await openQuestion(page, 'Вгадай', 'guess', 'gs-05'); // «Вибери будь-кого…»
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__spoken)).toEqual([]);
  await page.locator('.chip', { hasText: 'Тарас' }).click();
  await page.getByRole('button', { name: 'Прослухати питання' }).click(); // одразу, до автоозвучки
  await page.waitForTimeout(1000);
  expect((await page.evaluate(() => window.__spoken)).length).toBe(1);
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

// Записує, які звуки гри грали через <audio> (у плеєра звуку є data-sfx)
const trackSfx = () => {
  window.__sfx = [];
  const play = HTMLMediaElement.prototype.play;
  window.__sfxEl = {};
  HTMLMediaElement.prototype.play = function (...args) {
    if (this.dataset.sfx) { window.__sfx.push(this.dataset.sfx); window.__sfxEl[this.dataset.sfx] = this; }
    return play.apply(this, args);
  };
};
const played = (page) => page.evaluate(() => window.__sfx);

test('звук: «Правильно» — мелодія, «Ні» — «ва-ва», пропуск — «шух»; усе через <audio> (грає й у беззвучному режимі iPhone); вимкнені звуки — тиша', async ({ page }) => {
  await page.addInitScript(trackSfx);
  await startGame(page, ['Оля', 'Тарас'], { scoring: true });
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01');
  await page.getByRole('button', { name: /Правильно/ }).click();
  await expect.poll(() => played(page)).toEqual(['point']);
  // браузер справді декодує наш WAV: тривалість мелодії ≈ 0,5 с
  const dur = await page.evaluate(() => new Promise((ok) => {
    const a = window.__sfxEl.point;
    if (a.readyState >= 1) ok(a.duration); else a.addEventListener('loadedmetadata', () => ok(a.duration), { once: true });
  }));
  expect(dur).toBeGreaterThan(0.45); expect(dur).toBeLessThan(0.55);
  await page.getByRole('button', { name: 'До категорій' }).click();
  await openQuestion(page, 'Вгадай', 'guess', 'gs-04');
  await page.getByRole('button', { name: /Неправильно/ }).click();
  await expect.poll(() => played(page)).toEqual(['point', 'miss']);
  await page.getByRole('button', { name: 'До категорій' }).click();
  await openQuestion(page, 'Вгадай', 'guess', 'gs-06');
  await page.getByRole('button', { name: 'Пропустити' }).click();
  await expect.poll(() => played(page)).toEqual(['point', 'miss', 'skip']);
  // вимкнути звуки
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Гравці й налаштування/ }).click();
  await page.getByRole('switch', { name: 'Звуки' }).uncheck();
  await page.getByRole('button', { name: /Повернутися до гри/ }).click();
  await page.getByRole('button', { name: 'До категорій' }).click();
  await openQuestion(page, 'Вгадай', 'guess', 'gs-08');
  await page.getByRole('button', { name: /Правильно/ }).click();
  await page.waitForTimeout(200);
  expect(await played(page)).toHaveLength(3);
});

