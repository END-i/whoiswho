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
