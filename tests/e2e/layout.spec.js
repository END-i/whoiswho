import { test, expect } from './fixtures.js';
import { startGame, category, openCard, openQuestion, QUESTIONS, fresh } from './helpers.js';

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
  const ok = await look(/Правильно/), no = await look('Неправильно');
  expect(ok.bg[1]).toBeGreaterThan(ok.bg[0]); // зелена
  expect(no.bg[0]).toBeGreaterThan(no.bg[1] + 80); // червона
  for (const b of [ok, no]) expect(b.fg).toEqual([255, 255, 255]); // білий текст
});

for (const width of [320, 375, 390, 430]) {
  test(`${width} px: «Правильно» і «Неправильно» — кожна в один рядок, великим шрифтом, не вилазять за картку`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await startGame(page, ['Оля', 'Тарас'], { scoring: true });
    await openQuestion(page, 'Вгадай', 'guess', 'gs-01'); // з озвучкою — є кнопка «Слухати»
    await expect(page.locator('.listen')).toBeVisible();
    // картка з'являється з анімацією (зменшена й повернута) — міряємо, коли вона вже на місці
    await page.locator('[role=dialog] .card').evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
    for (const name of [/Правильно/, /Неправильно/]) {
      const b = page.getByRole('button', { name }).first();
      const lines = await b.evaluate((el) => {
        const r = document.createRange(); r.selectNodeContents(el);
        return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
      });
      expect(lines, String(name)).toBe(1);
      expect(await b.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18.67);
      expect(await b.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      // і сама кнопка не вилазить за картку
      const r = await b.evaluate((el) => ({ button: el.getBoundingClientRect().right, card: el.closest('.card').getBoundingClientRect().right, text: el.scrollWidth, box: el.clientWidth }));
      expect(r.button, JSON.stringify(r)).toBeLessThanOrEqual(r.card - 8);
    }
    // значки над питанням — кожен в один рядок (поруч кнопка «Слухати»)
    for (const badge of await page.locator('.badge').all()) expect(await badge.evaluate((el) => el.scrollHeight <= 30)).toBe(true);
  });
}

for (const [lang, turn] of [['Українська', 'Зараз хід'], ['Русский', 'Сейчас ходит']]) {
  test(`320 px, ${lang}: у верхній панелі ім'я й «${turn}» вміщаються, нічого не залазить під кнопки`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await startGame(page, ['Оля', 'Тарас'], { scoring: true });
    await page.getByRole('button', { name: 'Меню' }).click();
    await page.getByRole('button', { name: /Гравці й налаштування/ }).click();
    await page.getByRole('radio', { name: lang }).click();
    await page.getByRole('button', { name: /Повернутися до гри|Вернуться к игре/ }).click();
    await page.locator('.cat').first().click(); // з кнопкою «Назад» місця найменше
    const fits = (sel) => page.locator(`.bar ${sel}`).evaluate((el) => el.scrollWidth <= el.clientWidth);
    // шапка щойно стала звичайною (на екрані категорій вона велика) — чекаємо, поки розкладка встановиться
    await expect.poll(() => fits('.txt b')).toBe(true);
    await expect.poll(() => fits('.txt small')).toBe(true);
    const txt = await page.locator('.bar .txt').boundingBox();
    const menuIcon = await page.locator('.bar > .icon').last().boundingBox(); // ☰
    expect(txt.x + txt.width).toBeLessThanOrEqual(menuIcon.x);
    // бали відкриваються й без 🏆 — тапом по таблиці
    await page.locator('.board').click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}

for (const lang of ['Українська', 'Русский']) {
  test(`320 px, ${lang}: налаштування — перемикачі мови й «Хто грає» не вилазять за картку`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await fresh(page);
    await page.getByRole('radio', { name: lang }).click();
    expect(await noHorizontalScroll(page)).toBe(true);
    const outside = await page.evaluate(() => [...document.querySelectorAll('section *')].filter((el) => {
      const r = el.getBoundingClientRect(), box = el.closest('section').getBoundingClientRect();
      return r.width && (r.left < box.left - 1 || r.right > box.right + 1);
    }).map((el) => el.textContent.trim().slice(0, 30)));
    expect(outside).toEqual([]);
  });
}
