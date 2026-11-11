import { test, expect } from './fixtures.js';
import { startGame, category, openCard, openQuestion, numberOf, saved, turnName } from './helpers.js';

test('перезавантаження посеред гри: той самий екран, хід, використані карти й відкрита картка', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас', 'Мама'], { scoring: true });
  const a = await openQuestion(page, 'Відкрийся', 'open', 'op-02');
  await page.getByRole('button', { name: /Зараховано/ }).click();
  const b = await numberOf(page, 'open', 'op-03');
  await openCard(page, b);
  const text = await page.locator('.q').innerText();
  await page.reload();
  await expect(page.getByRole('dialog', { name: `Картка ${b}` })).toBeVisible();
  await expect(page.locator('.q')).toHaveText(text);
  expect(await turnName(page)).toBe('Тарас');
  await page.getByRole('button', { name: 'Пропустити' }).click();
  await expect(page.getByRole('button', { name: `Карта ${a}, вже була` })).toBeDisabled();
  await expect(page.getByRole('button', { name: `Карта ${b}, вже була` })).toBeDisabled();
});

test('нова гра: жодне питання не отримує свій номер з минулої гри', async ({ page }) => {
  await startGame(page);
  const first = (await saved(page)).game.deck;
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Нова гра/ }).click();
  await page.getByRole('button', { name: /Почати гру/ }).click();
  const second = (await saved(page)).game.deck;
  for (const [cat, ids] of Object.entries(second)) {
    const clashes = ids.filter((id, k) => first[cat]?.[k] === id);
    expect(clashes, cat).toEqual([]);
  }
});

test('гравця прибрали посеред гри: хід переходить далі, а його бали лишаються в підсумку', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас', 'Мама'], { scoring: true });
  // Олі нараховуємо бал і передаємо хід Тарасові
  await openQuestion(page, 'Вгадай', 'guess', 'gs-01');
  await page.getByRole('button', { name: /Правильно/ }).click();
  expect(await turnName(page)).toBe('Тарас');
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Гравці й налаштування/ }).click();
  await page.getByRole('button', { name: 'Прибрати гравця 2' }).click(); // Тарас
  await page.getByRole('button', { name: /Повернутися до гри/ }).click();
  expect(await turnName(page)).toBe('Мама');
  // і прибираємо Олю, у якої є бал
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Гравці й налаштування/ }).click();
  await page.locator('.players input').nth(1).fill('Мамуся');
  await page.getByRole('button', { name: /Додати гравця/ }).click();
  await page.locator('.players input').nth(2).fill('Тато');
  await page.getByRole('button', { name: 'Прибрати гравця 1' }).click();
  await page.getByRole('button', { name: /Повернутися до гри/ }).click();
  expect(await turnName(page)).toBe('Мамуся');
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Завершити гру/ }).click();
  const table = page.locator('.table');
  await expect(table).toContainText('Оля');
  await expect(table).toContainText('вийшов з гри');
  await expect(table.locator('li').first()).toContainText('1');
});

test('аудиторію під час гри змінити не можна', async ({ page }) => {
  await startGame(page);
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Гравці й налаштування/ }).click();
  await expect(page.getByRole('radio', { name: /Лише діти/ })).toBeDisabled();
  await expect(page.getByText('Аудиторію можна змінити лише в новій грі')).toBeVisible();
});
