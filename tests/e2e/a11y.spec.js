import { test, expect } from './fixtures.js';
import { TOKENS, CATEGORY_COLORS, contrast } from '../../src/lib/theme.js';
import { startGame, openQuestion, fresh } from './helpers.js';

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

for (const scheme of ['light', 'dark']) {
  test(`картка питання: підписи ролей читаються (≥ 4.5), кнопки — великий жирний текст (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await startGame(page, ['Оля', 'Тарас'], { scoring: true });
    for (const [title, cat, qid] of [['Хто з нас?', 'who', 'wh-01'], ['Вгадай', 'guess', 'gs-01']]) {
      await openQuestion(page, title, cat, qid);
      const bg = await toHex(page, '[role=dialog] .card', 'backgroundColor');
      for (const sel of ['.badge', '.who em']) {
        if (!(await page.locator(sel).count())) continue;
        const fg = await toHex(page, sel, 'color');
        expect(contrast(fg, bg), `${cat} ${sel}: ${fg} на ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      const btn = page.locator('.chunky').first();
      const { size, weight } = await btn.evaluate((el) => ({ size: parseFloat(getComputedStyle(el).fontSize), weight: +getComputedStyle(el).fontWeight }));
      expect(size).toBeGreaterThanOrEqual(18.67); expect(weight).toBeGreaterThanOrEqual(700);
      await page.getByRole('button', { name: 'Пропустити' }).click();
      await page.getByRole('button', { name: 'До категорій' }).click();
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
