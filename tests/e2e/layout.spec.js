import { test, expect } from './fixtures.js';
import { startGame, category, openCard, openQuestion, QUESTIONS, fresh, setDesign } from './helpers.js';
import { DESIGNS } from '../../src/lib/designs.js';

const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const scheme of ['light', 'dark']) {
  test(`екран 320 px, тема ${scheme}: без горизонтальної прокрутки на всіх екранах`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.emulateMedia({ colorScheme: scheme });
    await startGame(page, ['Олександра', 'Тарас', 'Мама', 'Тато', 'Бабуся', 'Дідусь', 'Софійка', 'Максимко']);
    expect(await noHorizontalScroll(page)).toBe(true);
    await openQuestion(page, 'Що про тебе знають', 'aboutme', 'am-02');
    expect(await noHorizontalScroll(page)).toBe(true);
    // кнопки дії видно й можна натиснути без прокрутки сторінки за межі
    await expect(page.getByRole('button', { name: 'Вгадано', exact: true })).toBeInViewport({ ratio: 0.5 });
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

// кожен дизайн картки (23.11): «Вгадано» й «Не вгадано» — кожна в один рядок, не вилазять за картку; шапка — в один рядок
const sizes = (d) => (d === 'k' ? [320, 375, 390, 430] : [320]);
for (const design of DESIGNS) for (const width of sizes(design)) {
  test(`картка «${design}», ${width} px: кнопки в один рядок і в межах картки, «Слухати» видно`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await startGame(page, ['Олександра-Марія', 'Бабуся Ганнуся']);
    await setDesign(page, design);
    await openQuestion(page, 'Вгадай', 'guess', 'gs-01'); // з озвучкою — є кнопка «Слухати»
    await expect(page.locator('.listen')).toBeVisible();
    // картка з'являється з анімацією (зменшена й повернута) — міряємо, коли вона вже на місці
    await page.locator('[role=dialog] .card').evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
    expect(await noHorizontalScroll(page)).toBe(true);
    for (const name of ['Вгадано', 'Не вгадано']) {
      const b = page.getByRole('button', { name, exact: true });
      const lines = await b.locator('.lb').evaluate((el) => {
        const r = document.createRange(); r.selectNodeContents(el);
        return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
      });
      expect(lines, name).toBe(1);
      const r = await b.evaluate((el) => ({ button: el.getBoundingClientRect().right, card: el.closest('.card').getBoundingClientRect().right, text: el.scrollWidth, box: el.clientWidth }));
      expect(r.text, JSON.stringify(r)).toBeLessThanOrEqual(r.box);
      expect(r.button, JSON.stringify(r)).toBeLessThanOrEqual(r.card - 8);
    }
    // довгі імена обрізаються «…», а не розсувають картку
    for (const b of await page.locator('[role=dialog] .who b').all()) expect(await b.evaluate((el) => el.getBoundingClientRect().right <= el.closest('.card').getBoundingClientRect().right)).toBe(true);
  });
}

for (const [lang, turn] of [['Українська', 'Зараз хід'], ['Русский', 'Сейчас ходит']]) {
  test(`320 px, ${lang}: у верхній панелі ім'я й «${turn}» вміщаються, нічого не залазить під кнопки`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await startGame(page, ['Оля', 'Тарас']);
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
  test(`320 px, ${lang}: налаштування — перемикачі мови й «Уся родина / Лише діти» не вилазять за картку`, async ({ page }) => {
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

// одна людина на картці («Цікаві факти»): не наїжджає на шапку з категорією й балами (J мав таку ваду 24.11)
for (const design of DESIGNS) {
  test(`картка «${design}» з однією людиною: людина під шапкою, не на ній`, async ({ page }) => {
    await startGame(page, ['Оля', 'Тарас']);
    await setDesign(page, design);
    await openQuestion(page, 'Цікаві факти', 'facts', 'fc-01');
    const card = page.locator('[role=dialog] .card');
    await card.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
    const r = await card.evaluate((el) => ({ top: el.querySelector('.top').getBoundingClientRect().bottom, who: el.querySelector('.who').getBoundingClientRect().top }));
    // обідок аватара — тінь (6 px) поза межами блоку: між шапкою й людиною має бути хоча б стільки
    expect(r.who - r.top, JSON.stringify(r)).toBeGreaterThanOrEqual(6);
  });
}
