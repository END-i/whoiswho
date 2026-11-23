import { test, expect } from './fixtures.js';
import { TOKENS, CATEGORY_COLORS, contrast } from '../../src/lib/theme.js';
import { startGame, openQuestion, fresh, setDesign, look } from './helpers.js';
import { DESIGNS } from '../../src/lib/designs.js';

// будь-який CSS-колір (rgb, color(srgb…), color-mix) → #rrggbb через canvas
const toHex = (page, sel, prop) => page.locator(sel).first().evaluate((el, prop) => {
  const v = getComputedStyle(el)[prop];
  const m = v.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/); // так браузер повертає результат color-mix
  if (m) return '#' + m.slice(1, 4).map((x) => Math.round(+x * 255).toString(16).padStart(2, '0')).join('');
  const g = document.createElement('canvas').getContext('2d');
  g.fillStyle = v;
  return g.fillStyle;
}, prop);
const cssVar = (page, name) => page.evaluate((name) => {
  const g = document.createElement('canvas').getContext('2d');
  g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return g.fillStyle.toUpperCase();
}, name);

for (const scheme of ['light', 'dark']) {
  test(`CSS-кольори збігаються з перевіреною палітрою (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await fresh(page);
    for (const [k, v] of Object.entries(TOKENS[scheme])) expect(await cssVar(page, `--${k}`), k).toBe(v.toUpperCase());
  });
}

test('плитки категорій: колір тексту такий, як у перевіреній палітрі', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас']);
  for (const [id, title] of [['who', 'Хто з нас?'], ['guess', 'Вгадай'], ['ifwhat', 'Якби…']]) {
    const hex = await page.locator('.cat', { hasText: title }).locator('.title').evaluate((el) => {
      const g = document.createElement('canvas').getContext('2d'); g.fillStyle = getComputedStyle(el).color; return g.fillStyle.toUpperCase();
    });
    expect(hex, id).toBe(CATEGORY_COLORS[id][2].toUpperCase());
  }
});

// Кожен дизайн картки (23.11) — у світлій і темній темі: текст читається (≥ 4,5; великий жирний — ≥ 3)
const readable = (c, l) => expect(contrast(c.fg, c.bg), `${l}: ${c.fg} на ${c.bg}`).toBeGreaterThanOrEqual(c.size >= 18.66 && c.weight >= 700 ? 3 : 4.5);
for (const design of DESIGNS) for (const scheme of ['light', 'dark']) {
  test(`картка «${design}» (${scheme}): бали, назва категорії, підписи людей і кнопки читаються; кнопки — великий жирний текст`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await startGame(page, ['Оля', 'Тарас']);
    await setDesign(page, design);
    for (const [title, cat, qid] of [['Хто з нас?', 'who', 'wh-01'], ['Вгадай', 'guess', 'gs-01']]) {
      await openQuestion(page, title, cat, qid);
      const card = page.getByRole('dialog');
      for (const sel of ['.pts', '.ctitle', '.who small', '.who em', '.q', '.check']) {
        for (const el of await card.locator(sel).all()) if (await el.isVisible()) readable(await look(el), `${cat} ${sel}`);
      }
      if (cat === 'who') await card.locator('.chip', { hasText: 'Тарас' }).click(); // спершу прогноз
      else for (const name of ['Вгадано', 'Не вгадано']) {
        const b = card.getByRole('button', { name, exact: true });
        const c = await look(b.locator('.lb'));
        readable(c, name);
        expect(c.size, name).toBeGreaterThanOrEqual(16); expect(c.weight, name).toBeGreaterThanOrEqual(700);
      }
      await card.getByRole('button', { name: 'Пропустити' }).click();
    }
  });
}

test('клавіатура: гру можна пройти Tab/Enter, фокус видно', async ({ page, browserName }) => {
  await startGame(page, ['Оля', 'Тарас']);
  // Safari за замовчуванням не переводить Tab на кнопки (налаштування браузера), тож фокусуємо явно,
  // а клавіша дає «клавіатурний» режим, у якому має бути видно :focus-visible
  await page.locator('.cat', { hasText: 'Відкрийся' }).focus();
  await page.keyboard.press('Shift');
  if (browserName === 'chromium') {
    // у Safari клавіатурна навігація вмикається в налаштуваннях системи; WebKit тут не вмикає :focus-visible
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    expect(outline).not.toBe('none');
  }
  await page.keyboard.press('Enter');
  await expect(page.getByRole('group', { name: /Карти категорії/ })).toBeVisible();
  await page.getByRole('button', { name: 'Карта 1', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('у всіх кнопок і полів є доступна назва', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас']);
  for (const screen of ['categories', 'grid']) {
    if (screen === 'grid') await page.locator('.cat').first().click();
    const unnamed = await page.evaluate(() => [...document.querySelectorAll('button, input, [role=switch], [role=radio]')]
      .filter((el) => !(el.getAttribute('aria-label') || el.textContent.trim() || el.labels?.length)).map((el) => el.outerHTML.slice(0, 80)));
    expect(unnamed, screen).toEqual([]);
  }
});
