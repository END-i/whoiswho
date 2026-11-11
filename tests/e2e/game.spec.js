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

test('карта: відкривається, після «Далі» затемнюється, хід переходить далі, лічильник зменшується', async ({ page }) => {
  await startGame(page);
  const all = count('open');
  // конкретне питання без вибору гравця — номер карти щоразу інший через перемішування
  const n = await openQuestion(page, 'Відкрийся', 'open', 'op-04');
  await expect(page.locator('.q')).toHaveText(byId.get('op-04').text);
  await page.getByRole('button', { name: /Далі/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Карта ${n}, вже була` })).toBeDisabled();
  expect(await turnName(page)).toBe('Тарас');
  await expect(page.locator('header p')).toContainText(`${all - 1} з ${all}`);
  await page.getByRole('button', { name: 'До категорій' }).click();
  await expect(category(page, 'Відкрийся')).toContainText(`${all - 1} з ${all}`);
});

test('пропуск теж робить номер використаним і передає хід', async ({ page }) => {
  await startGame(page);
  const n = await openQuestion(page, 'Якби…', 'ifwhat', 'if-02');
  await page.getByRole('button', { name: 'Пропустити' }).click();
  await expect(page.getByRole('button', { name: `Карта ${n}, вже була` })).toBeDisabled();
  expect(await turnName(page)).toBe('Тарас');
});

test('картку з вибором гравця можна пропустити ще до вибору', async ({ page }) => {
  await startGame(page);
  const n = await openQuestion(page, 'Відкрийся', 'open', 'op-12'); // answerer: pick
  await expect(page.getByText('Хто відповідатиме?')).toBeVisible();
  await page.getByRole('button', { name: 'Пропустити' }).click();
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

test('бали: «Правильно» дає бал тому, хто відповідав; «Ні» — нікому; підсумок з п\'єдесталом', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас', 'Мама'], { scoring: true });
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01');
  await expect(page.getByText('⭐ +1 бал')).toBeVisible();
  await page.getByRole('button', { name: /Правильно/ }).click();
  await expect(page.getByRole('status')).toContainText('+1 бал — Оля');
  expect((await saved(page)).game.scores[(await saved(page)).game.order[0]]).toBe(1);
  // Тарас вгадує й помиляється
  await openCard(page, await numberOf(page, 'guess', 'gs-04'));
  await page.getByRole('button', { name: '❌ Неправильно' }).click();
  await page.getByRole('button', { name: 'Бали', exact: true }).click();
  await expect(page.locator('.scores li').first()).toContainText('Оля');
  await expect(page.locator('.scores li').first()).toContainText('1');
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
  await expect(page.getByText(/зарахувати відповідь/)).toBeVisible();
  await page.getByRole('button', { name: /Зараховано/ }).click();
  await expect(pts(page, 0)).toHaveText('1');
  await expect(board(page).locator('.pl').nth(1)).toHaveClass(/now/);
  await board(page).click();
  await expect(page.getByRole('dialog', { name: 'Бали' })).toBeVisible();
  await expect(page.locator('.scores li').first()).toContainText('Оля');
});

test('«Відкрийся» з балами: «Ні» — без бала, хід далі', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас'], { scoring: true });
  await openQuestion(page, 'Відкрийся', 'open', 'op-02');
  await page.getByRole('button', { name: '❌ Ні' }).click();
  await expect(pts(page, 0)).toHaveText('0');
  expect(await turnName(page)).toBe('Тарас');
});

test('«Хто з нас?» з балами: бал тому, на кого показала більшість; нічия — нікому', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас', 'Мама'], { scoring: true });
  await openQuestion(page, 'Хто з нас?', 'who', 'wh-01');
  await page.getByRole('button', { name: /хто переміг/ }).click();
  await page.locator('.chip', { hasText: 'Мама' }).click();
  await expect(pts(page, 2)).toHaveText('1');
  await expect(pts(page, 0)).toHaveText('0');
  await page.getByRole('button', { name: 'До категорій' }).click();
  await openQuestion(page, 'Хто з нас?', 'who', 'wh-02');
  await page.getByRole('button', { name: /хто переміг/ }).click();
  await page.getByRole('button', { name: /Нічия/ }).click();
  const s = await saved(page);
  expect(Object.values(s.game.scores).reduce((a, b) => a + b, 0)).toBe(1);
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
