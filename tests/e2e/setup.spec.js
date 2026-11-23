import { test, expect } from './fixtures.js';
import { fresh, setPlayers, openQuestion, startGame, saved } from './helpers.js';

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
  await page.getByRole('button', { name: /Граємо!/ }).click();
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
  await page.getByRole('button', { name: 'Фото: Оля' }).click();
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
  await page.getByRole('button', { name: 'Фото: Оля' }).click();
  await page.getByRole('button', { name: 'Прибрати фото' }).click();
  await expect(page.locator('.preview img')).toHaveCount(0);
});

test('пошкоджений файл фото — зрозуміла помилка, гра не падає', async ({ page }) => {
  await setPlayers(page, ['Оля', 'Тарас']);
  await page.getByRole('button', { name: 'Фото: Оля' }).click();
  await page.locator('.sheet label', { hasText: 'Галерея' }).locator('input').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(page.getByText('Не вдалося прочитати фото')).toBeVisible();
});

test('пошкоджене сховище — гра відкривається з нуля', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('whoiswho.v2', '{broken'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Хто є хто' })).toBeVisible();
  await expect(page.locator('.players li')).toHaveCount(2);
});

const makePng = (page) => page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 400; c.height = 400;
  const g = c.getContext('2d'); g.fillStyle = '#55aaff'; g.fillRect(0, 0, 400, 400);
  return c.toDataURL('image/png').split(',')[1];
});

test('шаблон можна посунути пальцем; положення зберігається; повзунка розміру немає', async ({ page }) => {
  await setPlayers(page, ['Оля', 'Тарас']);
  await page.getByRole('button', { name: 'Фото: Оля' }).click();
  await page.locator('.tpl', { hasText: 'Корона' }).click();
  await expect(page.getByLabel('Розмір шаблону')).toHaveCount(0);
  const stage = page.locator('.stage');
  const box = await stage.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx + 34, cy + 17, { steps: 5 }); await page.mouse.up();
  const pos = () => page.evaluate(() => JSON.parse(localStorage.getItem('whoiswho.v2')).players[0].tplPos);
  // ~34×17 px на прев'ю 170 px — це ~20% × 10%; дробові пікселі на екранах 3× дають ±0.5
  const near = (p) => Math.abs(p.x - 20) <= 0.5 && Math.abs(p.y - 10) <= 0.5 && p.s === 1;
  await expect.poll(async () => near(await pos())).toBe(true);
  await expect(stage.locator('svg')).toHaveAttribute('style', /translate\(\d+(\.\d)?%, \d+(\.\d)?%\)/);
  const before = await pos();
  await page.reload();
  expect(await pos()).toEqual(before);
  await page.getByRole('button', { name: 'Фото: Оля' }).click();
  await page.getByRole('button', { name: /На місце/ }).click();
  await expect.poll(pos).toEqual({ x: 0, y: 0, s: 1 });
});

test('шаблон знімається: повторним натисканням і кнопкою «Прибрати шаблон», з будь-якої групи', async ({ page }) => {
  await setPlayers(page, ['Оля', 'Тарас']);
  await page.getByRole('button', { name: 'Фото: Оля' }).click();
  const tpl = () => page.evaluate(() => JSON.parse(localStorage.getItem('whoiswho.v2')).players[0].template);
  await page.locator('.tpl', { hasText: 'Віночок' }).click();
  await expect.poll(tpl).toBe('wreath');
  await page.locator('.tpl', { hasText: 'Віночок' }).click();       // повторно — знімає
  await expect.poll(tpl).toBe(null);
  await expect(page.locator('.stage svg')).toHaveCount(0);
  await page.locator('.tpl', { hasText: 'Зірка' }).click();
  await page.getByRole('button', { name: /Прибрати шаблон/ }).click();
  await expect.poll(tpl).toBe(null);
  await page.getByRole('button', { name: 'Закрити' }).click();
  await expect(page.locator('.players li').first().locator('svg')).toHaveCount(0);
});

test('збережений «Гравець тижня» після оновлення стає «Зіркою»', async ({ page }) => {
  await setPlayers(page, ['Оля', 'Тарас']);
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('whoiswho.v2')); s.players[0].template = 'week'; s.players[0].tplPos = { x: 0, y: 0, s: 1.5 }; localStorage.setItem('whoiswho.v2', JSON.stringify(s)); });
  await page.reload();
  const p0 = await page.evaluate(() => JSON.parse(localStorage.getItem('whoiswho.v2')).players[0]);
  expect(p0.template).toBe('star'); expect(p0.tplPos.s).toBe(1);
  await expect(page.locator('.players li').first().locator('svg')).toHaveCount(1);
});

test('«Видалити всі фото» стирає фото й шаблони всіх гравців', async ({ page }) => {
  await setPlayers(page, ['Оля', 'Тарас']);
  const png = Buffer.from(await makePng(page), 'base64');
  for (const name of ['Оля', 'Тарас']) {
    await page.getByRole('button', { name: `Фото: ${name}` }).click();
    await page.locator('.sheet label', { hasText: 'Галерея' }).locator('input').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('.preview img')).toBeVisible();
    await page.locator('.tpl', { hasText: 'Котик' }).click();
    await page.getByRole('button', { name: 'Закрити' }).click();
  }
  await expect(page.locator('.players img')).toHaveCount(2);
  await page.getByRole('button', { name: /Видалити всі фото/ }).click();
  await expect(page.locator('.players img')).toHaveCount(0);
  await expect(page.locator('.players svg')).toHaveCount(0);
  const players = await page.evaluate(() => JSON.parse(localStorage.getItem('whoiswho.v2')).players);
  expect(players.every((p) => !p.photo && !p.template)).toBe(true);
  await expect(page.getByRole('button', { name: /Видалити всі фото/ })).toHaveCount(0);
});

test('фото й шаблон видно на картці питання й у верхній панелі', async ({ page }) => {
  await setPlayers(page, ['Оля', 'Тарас']);
  await page.getByRole('button', { name: 'Фото: Оля' }).click();
  await page.locator('.sheet label', { hasText: 'Галерея' }).locator('input').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: Buffer.from(await makePng(page), 'base64') });
  await expect(page.locator('.preview img')).toBeVisible();
  await page.locator('.tpl', { hasText: 'Корона' }).click();
  await page.getByRole('button', { name: 'Закрити' }).click();
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await page.getByRole('button', { name: /Граємо!/ }).click();
  await expect(page.locator('.bar img')).toBeVisible();
  await page.locator('.cat', { hasText: 'Відкрийся' }).click();
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('whoiswho.v2')));
  await page.getByRole('button', { name: `Карта ${s.game.deck.open.indexOf('op-02') + 1}`, exact: true }).click();
  await expect(page.getByRole('dialog').locator('.who img')).toBeVisible();
  await expect(page.getByRole('dialog').locator('.who svg')).toBeVisible();
});

test('«Як грати» — одне речення й кнопка; «Граємо!» видно без прокрутки на маленькому iPhone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await setPlayers(page, ['Оля', 'Тарас']);
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await expect(page.getByRole('heading', { name: 'Як грати' })).toBeVisible();
  await expect(page.locator('.lead')).toHaveText(['Передавайте телефон по черзі й відповідайте на картки.']);
  await expect(page.getByText('Пояснення — під ⓘ на картці.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Граємо!/ })).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('стрілка на схемі кола — на внутрішньому колі (всередині кільця гравців) і закінчується наконечником', async ({ page }) => {
  const geo = await page.locator('.ring .arc').evaluate((el) => {
    const len = el.getTotalLength(), a = el.getPointAtLength(0), b = el.getPointAtLength(len), mid = el.getPointAtLength(len / 2);
    const r = (p) => Math.hypot(p.x - 50, p.y - 50);
    return { r: [r(a), r(mid), r(b)], marker: el.getAttribute('marker-end'), clockwise: Math.atan2(b.y - 50, b.x - 50) > Math.atan2(a.y - 50, a.x - 50) };
  });
  for (const r of geo.r) expect(Math.abs(r - 24)).toBeLessThan(0.5); // гравці — на r = 38
  expect(geo.marker).toContain('arrowhead');
  expect(geo.clockwise).toBe(true);
});

test('налаштування: без заголовка «🔊 Звук» і без «посеред гри»; «Голос браузера» є лише там, де бракує записаної озвучки', async ({ page }) => {
  await fresh(page);
  await expect(page.getByRole('heading', { name: '🔊 Звук' })).toHaveCount(0);
  await expect(page.getByText(/посеред гри/)).toHaveCount(0);
  const sound = page.locator('section', { has: page.getByRole('switch', { name: 'Звуки' }) });
  await expect(sound.getByRole('switch', { name: 'Читати питання вголос' })).toBeVisible();
  // у тестовій збірці записано лише 2 питання — голос браузера потрібен
  await expect(sound.getByText('🔈 Голос браузера')).toBeVisible();
});

test('налаштування: підписи перемикачів — у ⓘ (відкривається, закривається дотиком поза нею й Esc), екранний читач чує їх і так', async ({ page }) => {
  await fresh(page);
  const rows = [
    ['Автоматичний вибір питання', 'Категорію й карту вибирає гра — крутиш колесо.'],
    ['Звуки', 'Мелодія за бал'],
    ['Читати питання вголос', 'Картка сама читає питання'],
  ];
  await expect(page.getByText('🎡 Автоматичний вибір питання')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Навмання' })).toHaveCount(0);
  for (const [name, hint] of rows) {
    const sw = page.getByRole('switch', { name });
    await expect(sw).toHaveAccessibleDescription(new RegExp(hint.replace(/[.+]/g, '\\$&')));
    await expect(page.getByText(hint)).toBeHidden(); // підпису під перемикачем більше немає
    const info = page.getByRole('button', { name: `Що це: ${name}` });
    const was = await sw.isChecked();
    await info.click();
    await expect(info).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText(hint)).toBeVisible();
    expect(await sw.isChecked()).toBe(was); // ⓘ не перемикає перемикач
    await page.locator('h1').first().click(); // дотик поза ⓘ
    await expect(page.getByText(hint)).toBeHidden();
    await info.click();
    await page.keyboard.press('Escape');
    await expect(page.getByText(hint)).toBeHidden();
    await expect(info).toBeFocused();
  }
  // дотик по назві, як і раніше, перемикає
  const auto = page.getByRole('switch', { name: 'Автоматичний вибір питання' });
  await page.getByText('🎡 Автоматичний вибір питання').click();
  await expect(auto).toBeChecked();
});

test('коло гравців: стрілку «телефон іде сюди» не закривають аватари — від 2 до 8 гравців', async ({ page }) => {
  const names = ['Оля', 'Тарас', 'Мама', 'Тато', 'Іра', 'Марко', 'Бабуся', 'Дідусь'];
  for (let n = 2; n <= 8; n++) {
    await setPlayers(page, names.slice(0, n));
    await expect(page.locator('.circle .seat')).toHaveCount(n);
    await page.locator('.circle .seat').last().evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    await page.waitForTimeout(350); // місця на колі переїжджають (transition .3s)
    // початок, середина й кінець стрілки: згори має бути сама стрілка, а не аватар чи ім'я
    await page.locator('.circle').scrollIntoViewIfNeeded();
    const hidden = await page.locator('.circle .arc').evaluate((arc) => {
      const svg = arc.ownerSVGElement, len = arc.getTotalLength(), m = svg.getScreenCTM();
      return [0.02, 0.5, 0.98].map((f) => {
        const p = arc.getPointAtLength(len * f).matrixTransform(m);
        const top = document.elementFromPoint(p.x, p.y);
        return !top ? `${f}: поза екраном` : top.closest('.seat') ? `${f}: під аватаром` : null;
      }).filter(Boolean);
    });
    expect(hidden, `${n} гравців`).toEqual([]);
  }
});

test('«Уся родина / Лише діти» — без зайвого підпису «Хто грає», кнопки на всю ширину рядка', async ({ page }) => {
  await expect(page.getByRole('radiogroup', { name: 'Аудиторія' })).toBeVisible();
  await expect(page.getByText('Хто грає', { exact: true })).toHaveCount(0);
  const row = await page.locator('.opt.aud').boundingBox(), seg = await page.locator('.aud .seg').boundingBox();
  expect(seg.width).toBeGreaterThan(row.width * 0.85);
  await expect(page.getByRole('radio', { name: /Уся родина/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Лише діти/ })).toBeVisible();
});

test('вигляд картки: шість дизайнів, за замовчуванням «Блокнот»; вибір памʼятається й змінює картку', async ({ page }) => {
  await fresh(page);
  const group = page.getByRole('radiogroup', { name: '🎨 Вигляд картки' });
  await expect(group.getByRole('radio')).toHaveText(['Блокнот', 'Тихий', 'Телешоу', 'Профіль', 'Ігрова карта', 'Розмова']);
  await expect(group.getByRole('radio', { name: 'Блокнот' })).toHaveAttribute('aria-checked', 'true');
  await group.getByRole('radio', { name: 'Телешоу' }).click();
  await expect(group.getByRole('radio', { name: 'Телешоу' })).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Телешоу' })).toHaveAttribute('aria-checked', 'true');
  await setPlayers(page, ['Оля', 'Тарас']);
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await page.getByRole('button', { name: /Граємо!/ }).click();
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01');
  await expect(page.locator('.overlay')).toHaveClass(/\bd-h\b/);
  await expect(page.getByText('Тобі питання!')).toBeVisible();
});

test('картка: ⓘ біля балів пояснює бали й пропуск (відкривається, закривається Esc), не відкриваючи нічого зайвого', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас']);
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01');
  const info = page.getByRole('dialog').getByRole('button', { name: 'Що це: Бали' });
  const hint = page.getByText(/Вгадано — \+20\..*Будь-яку картку можна пропустити — тоді без балів\./);
  await expect(hint).toBeHidden();
  await info.click();
  await expect(hint).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(hint).toBeHidden();
  await expect(page.getByRole('dialog')).toBeVisible(); // Esc закриває лише підказку
  expect((await saved(page)).game.stats).toEqual({ answered: 0, skipped: 0 });
});
