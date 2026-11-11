import { test, expect } from './fixtures.js';
import { fresh, confirmAll, startGame, openQuestion, setPlayers } from './helpers.js';

// Запис трасування Playwright у WebKit ламає Cache Storage (put «вдається», але нічого не зберігається) —
// це особливість інструмента, не гри: без трасування WebKit кешує нормально. Тому тут трасування вимкнене.
test.use({ trace: 'off' });

// У тестовій збірці (E2E_AUDIO_IDS=gs-01,am-02) гра вважає, що для цих питань є озвучка;
// самі mp3 віддає Playwright, бо справжніх файлів у репозиторії може не бути.
const MP3 = Buffer.from('ID3\u0003\u0000\u0000\u0000\u0000\u0000\u0000', 'binary');
async function serveAudio(page) {
  const hits = [];
  await page.route('**/audio/*.mp3', (r) => { hits.push(new URL(r.request().url()).pathname); r.fulfill({ status: 200, contentType: 'audio/mpeg', body: MP3 }); });
  return hits;
}

test('маніфест і іконки: назва, standalone, усі іконки доступні', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const m = await (await request.get(href)).json();
  expect(m).toMatchObject({ short_name: 'Хто є хто', lang: 'uk', display: 'standalone', start_url: '/' });
  expect(m.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  for (const i of m.icons) expect((await request.get(i.src)).status(), i.src).toBe(200);
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await request.get(apple)).headers()['content-type']).toContain('image/png');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
});

test.describe('офлайн', () => {
  test.use({ serviceWorkers: 'allow' });
  test('після першого відкриття гра працює без інтернету', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Playwright керує service worker повноцінно лише в Chromium; на iPhone перевіряємо руками');
    await page.goto('/');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload(); // тепер сторінкою керує service worker
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Хто є хто' })).toBeVisible();
    await setPlayers(page, ['Оля', 'Тарас']);
    await page.getByRole('button', { name: /Почати гру/ }).click();
    await page.getByRole('button', { name: /Граємо!/ }).click();
    await page.locator('.cat').first().click();
    await expect(page.getByRole('group', { name: /Карти категорії/ })).toBeVisible();
    // шрифт теж із кешу
    expect(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('900 20px Nunito', 'Їжак'); })).toBe(true);
    await context.setOffline(false);
  });
});

test('кнопка 🔊 є лише там, де є файл озвучки, і грає саме його', async ({ page }) => {
  const hits = await serveAudio(page);
  await startGame(page, ['Оля', 'Тарас']);
  await openQuestion(page, 'Вгадай', 'guess', 'gs-04');
  await expect(page.getByRole('button', { name: 'Прослухати питання' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Пропустити' }).click();
  await page.getByRole('button', { name: 'До категорій' }).click();
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01');
  hits.length = 0;
  await page.getByRole('button', { name: 'Прослухати питання' }).click();
  await expect.poll(() => hits).toContain('/audio/gs-01.mp3');
});

test('озвучка для офлайну: качається у фоні, видаляється й качається знову', async ({ page }) => {
  await serveAudio(page);
  // A single open, no fresh(): its reload interrupts the first cache.put in flight,
  // and WebKit on Linux keeps that entry broken (match() misses it). The context is clean anyway.
  confirmAll(page);
  await page.goto('/');
  await expect(page.getByText('Готово: 2 з 2')).toBeVisible();
  // перевіряємо через match — так гра й service worker читають файли (keys() у WebKit буває порожнім)
  const cached = () => page.evaluate(async () => {
    const c = await caches.open('whoiswho-audio');
    return Promise.all(['/audio/am-02.mp3', '/audio/gs-01.mp3', '/audio/gs-04.mp3'].map(async (u) => !!(await c.match(u))));
  });
  expect(await cached()).toEqual([true, true, false]);
  await page.getByRole('button', { name: 'Видалити', exact: true }).click();
  await expect(page.getByText('Завантажено 0 з 2')).toBeVisible();
  expect(await page.evaluate(() => caches.has('whoiswho-audio'))).toBe(false);
  await page.getByRole('button', { name: 'Завантажити' }).click();
  await expect(page.getByText('Готово: 2 з 2')).toBeVisible();
});

test('озвучка: обрив мережі — частина завантажена, решту можна докачати', async ({ page }) => {
  let fail = true;
  await page.route('**/audio/*.mp3', (r) => (fail && r.request().url().includes('gs-01') ? r.abort('internetdisconnected') : r.fulfill({ status: 200, contentType: 'audio/mpeg', body: MP3 })));
  await fresh(page);
  await expect(page.getByText('Завантажено 1 з 2')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Завантажити' }).click();
  await expect(page.getByText('Готово: 2 з 2')).toBeVisible();
});
