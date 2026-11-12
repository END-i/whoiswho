import { test, expect } from './fixtures.js';
import { fresh, setPlayers, saved, category, openCard } from './helpers.js';

const pick = (page, title) => page.getByRole('radiogroup', { name: 'Набір питань' }).getByRole('radio', { name: new RegExp(title) });

test('за замовчуванням — сімейний набір; фільтр «Лише діти» є лише в ньому', async ({ page }) => {
  await fresh(page);
  await expect(pick(page, 'Сімейний')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: /Лише діти/ })).toBeVisible();
  await pick(page, 'Для пар').click();
  await expect(page.getByRole('radio', { name: /Лише діти/ })).toHaveCount(0);
});

test('«Для пар»: рівно двоє; з трьома — пояснення й старт недоступний; категорії й підписи — для пар', async ({ page }) => {
  await fresh(page);
  await setPlayers(page, ['Оля', 'Тарас', 'Мама']);
  await pick(page, 'Для пар').click();
  await expect(page.getByRole('status')).toHaveText('У наборі «Для пар» грають рівно 2 гравці. Прибери зайвих.');
  await expect(page.getByRole('button', { name: /Почати гру/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Додати гравця/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Прибрати гравця 3' }).click();
  await expect(page.getByRole('button', { name: /Почати гру/ })).toBeEnabled();
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await expect(page.getByText('Грають двоє. Телефон передаєте одне одному по черзі.')).toBeVisible();
  await page.getByRole('button', { name: /Граємо!/ }).click();
  await expect(category(page, 'Вгадай мене')).toBeVisible();
  await expect(category(page, 'Хто з нас двох?')).toBeVisible();
  await expect(category(page, 'Цікаві факти')).toHaveCount(0);
  const s = await saved(page);
  expect(s.game.pack).toBe('couples');
  // підпис ролі — «твоя половинка», а не «гравець ліворуч»
  await category(page, 'Вгадай мене').click();
  await openCard(page, s.game.deck.cguess.indexOf('cg-01') + 1);
  await expect(page.getByRole('dialog').locator('.who').nth(1)).toContainText('твоя половинка');
  await expect(page.getByRole('dialog').locator('.who').nth(1)).toContainText('Тарас');
});

test('набір не змінити посеред гри; правила кожного набору — один раз; історія підписує набір', async ({ page }) => {
  await fresh(page);
  await setPlayers(page, ['Оля', 'Тарас']);
  await pick(page, 'Для пар').click();
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await page.getByRole('button', { name: /Граємо!/ }).click();
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Гравці й налаштування/ }).click();
  await expect(pick(page, 'Сімейний')).toBeDisabled();
  await expect(page.getByText('Набір можна змінити лише в новій грі.')).toBeVisible();
  expect((await saved(page)).rulesSeen).toEqual(['couples']);
  // зіграти картку й завершити гру — в історії видно, з якого вона набору
  await page.getByRole('button', { name: /Повернутися до гри/ }).click();
  await category(page, 'Хто з нас двох?').click();
  await openCard(page, 1);
  await page.getByRole('button', { name: /Пропустити/ }).click();
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Завершити гру/ }).click();
  await page.getByRole('button', { name: /Історія/ }).first().click();
  await expect(page.locator('.games li').first()).toContainText('💞 Для пар');
});

test('18+: без підтвердження «усім є 18» набір не вибрати й гру не почати; з підтвердженням — пікантні категорії', async ({ page }) => {
  const answers = [];
  const asked = [];
  page.on('dialog', (d) => { asked.push(d.message()); return answers.shift() ? d.accept() : d.dismiss(); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Хто є хто' })).toBeVisible();
  await setPlayers(page, ['Оля', 'Тарас']);
  answers.push(false);
  await pick(page, '18\\+').click();
  await expect(pick(page, 'Сімейний')).toHaveAttribute('aria-checked', 'true');
  expect(asked.at(-1)).toBe('Набір 18+ — лише для дорослих. Усім гравцям уже є 18 років?');
  answers.push(true);
  await pick(page, '18\\+').click();
  await expect(pick(page, '18\\+')).toHaveAttribute('aria-checked', 'true');
  // перед грою — ще раз: телефон міг перейти до дітей
  answers.push(false);
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await expect(page.getByRole('button', { name: /Почати гру/ })).toBeVisible();
  expect(asked).toHaveLength(3);
  answers.push(true);
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await expect(page.getByText('Будь-яку картку можна пропустити без пояснень. Вгадав — +20, відповів — +10, на сміливе — +20.')).toBeVisible();
  await page.getByRole('button', { name: /Граємо!/ }).click();
  await expect(page.locator('.cat .title')).toHaveText(['Зізнання', 'Побачення', 'Флірт', 'Хто з нас?', 'Вгадай', 'Бажання', 'Сміливо']);
  expect((await saved(page)).game.pack).toBe('adults');
});

test('«Для друзів»: 7 своїх категорій; гравців до 8', async ({ page }) => {
  await fresh(page);
  await setPlayers(page, ['Оля', 'Тарас', 'Ліна']);
  await pick(page, 'Для друзів').click();
  await expect(page.getByRole('button', { name: /Додати гравця/ })).toContainText('3 з 8');
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await page.getByRole('button', { name: /Граємо!/ }).click();
  await expect(page.locator('.cat .title')).toHaveText(['Хто з нас?', 'Вгадай', 'Історії', 'Виклик', 'А що, якби…', 'Чесно', 'Сміх']);
});
