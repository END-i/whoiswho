import { test, expect } from './fixtures.js';
import { startGame, category, openCard, openQuestion, numberOf, saved, turnName, fresh, QUESTIONS, byId } from './helpers.js';

const count = (cat, kids = false) => QUESTIONS.questions.filter((q) => q.category === cat && (kids || (q.audience ?? 'all') === 'all')).length;

test('категорії: усі 8 з лічильниками за фільтром «Уся родина»', async ({ page }) => {
  await startGame(page);
  await expect(page.locator('.cat')).toHaveCount(QUESTIONS.categories.length);
  await expect(category(page, 'Якби…')).toContainText(`${count('ifwhat')} з ${count('ifwhat')}`);
});

test('фільтр «Лише діти» додає дитячі питання', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас'], { kids: true });
  await expect(category(page, 'Якби…')).toContainText(`${count('ifwhat', true)} з ${count('ifwhat', true)}`);
});

test('карта: відкривається, після «Далі» — хід наступному, він бачить категорії згори; карта затемнена, лічильник менший', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 600 });
  await startGame(page);
  const all = count('open');
  // конкретне питання без вибору гравця — номер карти щоразу інший через перемішування
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  const n = await openQuestion(page, 'Відкрийся', 'open', 'op-04');
  await expect(page.locator('.q')).toHaveText(byId.get('op-04').text);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.getByRole('button', { name: /Далі/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Вибери категорію' })).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(await turnName(page)).toBe('Тарас');
  await expect(category(page, 'Відкрийся')).toContainText(`${all - 1} з ${all}`);
  await category(page, 'Відкрийся').click();
  await expect(page.getByRole('button', { name: `Карта ${n}, вже була` })).toBeDisabled();
  await expect(page.locator('header p')).toContainText(`${all - 1} з ${all}`);
});

test('пропуск теж робить номер використаним і передає хід', async ({ page }) => {
  await startGame(page);
  const n = await openQuestion(page, 'Якби…', 'ifwhat', 'if-02');
  await page.getByRole('button', { name: 'Пропустити' }).click();
  await category(page, 'Якби…').click();
  await expect(page.getByRole('button', { name: `Карта ${n}, вже була` })).toBeDisabled();
  expect(await turnName(page)).toBe('Тарас');
});

test('картку з вибором гравця можна пропустити ще до вибору', async ({ page }) => {
  await startGame(page);
  const n = await openQuestion(page, 'Відкрийся', 'open', 'op-12'); // answerer: pick
  await expect(page.getByText('Хто відповідатиме?')).toBeVisible();
  await page.getByRole('button', { name: 'Пропустити' }).click();
  await category(page, 'Відкрийся').click();
  await expect(page.getByRole('button', { name: `Карта ${n}, вже була` })).toBeDisabled();
  expect((await saved(page)).game.stats).toEqual({ answered: 0, skipped: 1 });
});

test('«Вгадай»: підпис називає, хто відповідає і про кого (гравець ліворуч)', async ({ page }) => {
  await startGame(page);
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01');
  const card = page.getByRole('dialog');
  await expect(card.locator('.who').nth(0)).toContainText('Оля');
  await expect(card.locator('.who').nth(0)).toContainText('твоя черга');
  await expect(card.locator('.who').nth(1)).toContainText('Тарас');
  await expect(card.locator('.who').nth(1)).toContainText('гравець ліворуч');
});

test('«Що про тебе знають»: питання на «ти», сусід відповідає замість того, чия черга', async ({ page }) => {
  await startGame(page);
  await openQuestion(page, 'Що про тебе знають', 'aboutme', 'am-17'); // answerer: left
  const card = page.getByRole('dialog');
  await expect(card.getByText('Чим ти займаєшся, коли нудно?')).toBeVisible();
  await expect(card.locator('.who').nth(0)).toContainText('Відповідає');
  await expect(card.locator('.who').nth(0)).toContainText('Тарас');
  await expect(card.locator('.who').nth(1)).toContainText('Замість кого');
  await expect(card.locator('.who').nth(1)).toContainText('Оля');
  await expect(card.locator('.who').nth(1)).toContainText('твоя черга');
  await expect(card.locator('.instead')).toHaveText('Відповідай так, ніби ти — Оля. Оля каже, чи влучно.');
});

test('звичайне «Вгадай» — підпис «Про кого», без підказки «замість»', async ({ page }) => {
  await startGame(page);
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01');
  const card = page.getByRole('dialog');
  await expect(card.locator('.who').nth(1)).toContainText('Про кого');
  await expect(card.locator('.instead')).toHaveCount(0);
});

test('«на твій вибір»: спершу вибір гравця (без себе), потім питання', async ({ page }) => {
  await startGame(page);
  await openQuestion(page, 'Вгадай', 'guess', 'gs-05'); // about: pick
  await expect(page.getByText('Про кого буде питання?')).toBeVisible();
  const chips = page.locator('.chip');
  await expect(page.locator('.chip > span:last-child')).toHaveText(['Тарас', 'Мама', 'Тато']);
  await chips.filter({ hasText: 'Мама' }).click();
  await expect(page.locator('.q')).toBeVisible();
  await expect(page.getByRole('dialog').locator('.who').nth(1)).toContainText('Мама');
});

test('удвох вибору немає — другий гравець підставляється сам', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас']);
  await openQuestion(page, 'Вгадай', 'guess', 'gs-05');
  await expect(page.locator('.chip')).toHaveCount(0);
  await expect(page.getByRole('dialog').locator('.who').nth(1)).toContainText('Тарас');
});

test('«Хто з нас?» без балів: без ролей, кнопка «Далі»', async ({ page }) => {
  await startGame(page);
  await openQuestion(page, 'Хто з нас?', 'who', 'wh-02');
  await expect(page.getByText(/Усі разом/)).toBeVisible();
  await expect(page.getByRole('dialog').locator('.who')).toHaveCount(0);
  await page.getByRole('button', { name: /Далі/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('підказка для дорослих розгортається', async ({ page }) => {
  await startGame(page);
  await openQuestion(page, 'Вгадай', 'guess', 'gs-02');
  const tip = page.getByRole('button', { name: /Підказка для дорослих/ });
  await expect(tip).toHaveAttribute('aria-expanded', 'false');
  await tip.click();
  await expect(page.getByText(byId.get('gs-02').tip)).toBeVisible();
});

test('бали: «Правильно» дає +20 тому, хто відповідав; «Неправильно» — нікому; підсумок з п\'єдесталом', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас', 'Мама'], { scoring: true });
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01');
  await expect(page.getByText('⭐ +20')).toBeVisible();
  await page.getByRole('button', { name: /Правильно/ }).click();
  await expect(page.getByRole('status')).toContainText('+20 — Оля');
  expect((await saved(page)).game.scores[(await saved(page)).game.order[0]]).toBe(20);
  // Тарас вгадує й помиляється
  await openQuestion(page, 'Вгадай', 'guess', 'gs-04');
  await page.getByRole('button', { name: 'Неправильно' }).click();
  await page.getByRole('button', { name: 'Бали', exact: true }).click();
  await expect(page.locator('.scores li').first()).toContainText('Оля');
  await expect(page.locator('.scores li').first()).toContainText('20');
  await page.getByRole('button', { name: 'Закрити' }).click();
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Завершити гру/ }).click();
  await expect(page.getByRole('heading', { name: 'Гра завершена!' })).toBeVisible();
  await expect(page.getByLabel("П'єдестал")).toContainText('Оля');
  await expect(page.locator('.stats')).toContainText('2');
});

test('без режиму балів кнопок «Правильно» немає і підсумок без переможців', async ({ page }) => {
  await startGame(page);
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01');
  await expect(page.getByRole('button', { name: /Правильно/ })).toHaveCount(0);
  await expect(page.locator('.board')).toHaveCount(0);
  await page.getByRole('button', { name: /Далі/ }).click();
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Завершити гру/ }).click();
  await expect(page.getByText('Тут немає переможців')).toBeVisible();
  // завершену гру продовжити не можна — лише історія або нова гра
  await expect(page.getByRole('button', { name: /Продовжити/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Гра завершена!' })).toBeVisible();
});

test('вичерпана категорія стає «пройдено» і не відкривається', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас']);
  // закриваємо всі картки категорії «Покажи!», крім однієї, через збереження — і останню руками
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('whoiswho.v2'));
    const n = s.game.deck.show.length;
    s.game.used.show = Array.from({ length: n - 1 }, (_, k) => k + 2);
    localStorage.setItem('whoiswho.v2', JSON.stringify(s));
  });
  await page.reload();
  await category(page, 'Покажи!').click();
  await openCard(page, 1);
  // остання карта може бути з вибором гравця — «Пропустити» є на обох кроках
  await page.getByRole('button', { name: 'Пропустити' }).click();
  await expect(category(page, 'Покажи!')).toBeDisabled();
  await expect(category(page, 'Покажи!')).toContainText('пройдено');
});

test('режим з балами увімкнений за замовчуванням', async ({ page }) => {
  await fresh(page);
  await expect(page.getByRole('switch').first()).toBeChecked();
});

const board = (page) => page.locator('.board');
const pts = (page, k) => board(page).locator('.pl').nth(k).locator('.pts');

test('таблиця балів видна під час гри й оновлюється одразу; тап відкриває повну', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас', 'Мама'], { scoring: true });
  await expect(board(page).locator('.pl')).toHaveCount(3);
  await expect(board(page).locator('.pl.now')).toHaveCount(1);
  await openQuestion(page, 'Відкрийся', 'open', 'op-02');
  await page.getByRole('button', { name: 'Вау, +50' }).click();
  await expect(pts(page, 0)).toHaveText('50');
  await expect(board(page).locator('.pl').nth(1)).toHaveClass(/now/);
  await board(page).click();
  await expect(page.getByRole('dialog', { name: 'Бали' })).toBeVisible();
  await expect(page.locator('.scores li').first()).toContainText('Оля');
});

test('відкрите питання з балами: компанія оцінює 👍 +10 · 😂 +20 · 🤩 +50, «Правильно/Ні» немає; пропуск — 0', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас'], { scoring: true });
  await openQuestion(page, 'Якби…', 'ifwhat', 'if-13'); // «Вигадай нове свято…»
  const card = page.getByRole('dialog');
  await expect(card.getByText('⭐ до +50')).toBeVisible();
  await expect(card.locator('.check')).toHaveText('Оля — як вам відповідь? Оцінюють усі разом.');
  await expect(card.getByRole('button', { name: /Правильно/ })).toHaveCount(0);
  await expect(card.locator('.rate')).toHaveText(['👍+10', '😂+20', '🤩+50']);
  await card.getByRole('button', { name: 'Смішно чи цікаво, +20' }).click();
  await expect(page.getByRole('status')).toContainText('+20 — Оля');
  await expect(pts(page, 0)).toHaveText('20');
  expect(await turnName(page)).toBe('Тарас');
  await openQuestion(page, 'Відкрийся', 'open', 'op-02');
  await page.getByRole('button', { name: /Пропустити/ }).click();
  await expect(pts(page, 1)).toHaveText('0');
});

test('удвох у відкритому питанні з вибором гравця: «Питає Оля → Відповідає Тарас», бали Тарасу', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас'], { scoring: true });
  await openQuestion(page, 'Відкрийся', 'open', 'op-25'); // «Чим ти найбільше пишаєшся цього року?», answerer: pick
  const card = page.getByRole('dialog');
  await expect(card.locator('.who').nth(0)).toContainText('Питає');
  await expect(card.locator('.who').nth(0)).toContainText('Оля');
  await expect(card.locator('.who').nth(1)).toContainText('Відповідає');
  await expect(card.locator('.who').nth(1)).toContainText('Тарас');
  await expect(card.locator('.instead')).toHaveText('Тарас відповідає про себе — бали теж йому.');
  await card.getByRole('button', { name: 'Добре, +10' }).click();
  await expect(pts(page, 1)).toHaveText('10');
  await expect(pts(page, 0)).toHaveText('0');
});

test('«Хто з нас?» з балами: +20 тому, на кого показала більшість; нічия — нікому', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас', 'Мама'], { scoring: true });
  await openQuestion(page, 'Хто з нас?', 'who', 'wh-01');
  await page.getByRole('button', { name: /хто переміг/ }).click();
  await page.locator('.chip', { hasText: 'Мама' }).click();
  await expect(pts(page, 2)).toHaveText('20');
  await expect(pts(page, 0)).toHaveText('0');
  await openQuestion(page, 'Хто з нас?', 'who', 'wh-02');
  await page.getByRole('button', { name: /хто переміг/ }).click();
  await page.getByRole('button', { name: /Нічия/ }).click();
  const s = await saved(page);
  expect(Object.values(s.game.scores).reduce((a, b) => a + b, 0)).toBe(20);
  expect(s.game.stats.answered).toBe(2);
});

test('режим з балами можна ввімкнути посеред гри', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас'], { scoring: false });
  await expect(board(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Гравці й налаштування/ }).click();
  await page.getByRole('switch').first().check();
  await page.getByRole('button', { name: /Повернутися до гри/ }).click();
  await expect(board(page)).toBeVisible();
});

test('«Цікаві факти»: відповідь схована до «Показати відповідь», далі «Правильно» — бал тому, чия черга', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас'], { scoring: true });
  await openQuestion(page, 'Цікаві факти', 'facts', 'fc-01');
  const card = page.getByRole('dialog');
  await expect(card.getByText('Чи справді страус ховає голову в пісок, коли боїться?')).toBeVisible();
  await expect(card.locator('.who').nth(0)).toContainText('Оля');
  await expect(card.getByText(/це міф/)).toHaveCount(0);
  await expect(card.getByRole('button', { name: /Правильно/ })).toHaveCount(0);
  await card.getByRole('button', { name: /Показати відповідь/ }).click();
  await expect(card.getByRole('status')).toContainText('Ні, це міф. Страус лягає');
  await expect(card.locator('.check')).toHaveText('Оля — відповідь збіглася з правильною?');
  await card.getByRole('button', { name: 'Правильно', exact: true }).click();
  expect((await saved(page)).game.scores[(await saved(page)).game.order[0]]).toBe(20);
});

test('«Цікаві факти» без балів: після відповіді — «Далі»; пропустити можна й до відповіді', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас']);
  await openQuestion(page, 'Цікаві факти', 'facts', 'fc-03');
  await page.getByRole('button', { name: /Показати відповідь/ }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText(/Вісім/);
  await page.getByRole('button', { name: /Далі/ }).click();
  await openQuestion(page, 'Цікаві факти', 'facts', 'fc-07');
  await page.getByRole('button', { name: /Пропустити/ }).click();
  expect((await saved(page)).game.stats).toEqual({ answered: 1, skipped: 1 });
});

test('«↩ Скасувати»: натиснули не ту кнопку — бал, хід і картка повертаються, картка знову відкрита', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас'], { scoring: true });
  const n = await openQuestion(page, 'Вгадай', 'guess', 'gs-01');
  await page.getByRole('button', { name: 'Правильно', exact: true }).click();
  await expect(pts(page, 0)).toHaveText('20');
  expect(await turnName(page)).toBe('Тарас');
  await page.getByRole('button', { name: '↩ Скасувати' }).click();
  await expect(page.getByRole('dialog', { name: `Картка ${n}` })).toBeVisible();
  await expect(pts(page, 0)).toHaveText('0');
  expect(await turnName(page)).toBe('Оля');
  await page.getByRole('button', { name: 'Неправильно' }).click();
  await expect(page.getByRole('status')).toContainText('Без балів — Оля');
  await expect(pts(page, 0)).toHaveText('0');
  const s = await saved(page);
  expect(s.game.stats).toEqual({ answered: 1, skipped: 0 });
  expect(s.game.used.guess).toEqual([n]);
  // скасувати можна лише кілька секунд
  await expect(page.getByRole('button', { name: '↩ Скасувати' })).toHaveCount(0, { timeout: 7000 });
});

test('«↩ Скасувати» після пропуску теж є; після зміни гравців — зникає', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас']);
  await openQuestion(page, 'Відкрийся', 'open', 'op-02');
  await page.getByRole('button', { name: /Пропустити/ }).click();
  await expect(page.getByRole('status')).toContainText('Пропущено');
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Гравці й налаштування/ }).click();
  await page.getByRole('button', { name: /Повернутися до гри/ }).click();
  await expect(page.getByRole('button', { name: '↩ Скасувати' })).toHaveCount(0);
});

test('❤️ улюблені: позначка на картці зберігається; «Лише улюблені» — нова гра лише з них', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас']);
  await openQuestion(page, 'Відкрийся', 'open', 'op-02');
  const like = page.getByRole('button', { name: 'Сподобалось' });
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Далі/ }).click();
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01');
  await page.getByRole('button', { name: 'Сподобалось' }).click();
  await page.getByRole('button', { name: /Далі/ }).click();
  await page.reload();
  expect((await saved(page)).favorites).toEqual(['op-02', 'gs-01']);
  // нова гра лише з улюблених
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Нова гра/ }).click();
  await page.getByRole('switch', { name: 'Лише улюблені' }).check();
  await expect(page.getByText('❤️ Лише улюблені (2)')).toBeVisible();
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await expect(page.locator('.cat .title')).toHaveText(['Вгадай', 'Відкрийся']);
  const deck = (await saved(page)).game.deck;
  expect(Object.values(deck).flat().sort()).toEqual(['gs-01', 'op-02']);
});
