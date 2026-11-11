import { test, expect } from './fixtures.js';
import { fresh, setPlayers } from './helpers.js';

const lang = (page, name) => page.getByRole('radio', { name });

test('мова: за замовчуванням українська; «Русский» перекладає інтерфейс і зберігається після перезавантаження', async ({ page }) => {
  await fresh(page);
  await expect(lang(page, 'Українська')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  await lang(page, 'Русский').click();
  await expect(page.getByRole('heading', { name: 'Кто есть кто' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Начать игру/ })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Кто есть кто' })).toBeVisible();
  await expect(lang(page, 'Русский')).toHaveAttribute('aria-checked', 'true');
  // назад
  await lang(page, 'Українська').click();
  await expect(page.getByRole('button', { name: /Почати гру/ })).toBeVisible();
});

test('мова змінюється й посеред гри: меню й підписи — російською', async ({ page }) => {
  await fresh(page);
  await setPlayers(page, ['Оля', 'Тарас']);
  await page.getByRole('button', { name: /Почати гру/ }).click();
  await page.getByRole('button', { name: /Граємо!/ }).click();
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Гравці й налаштування/ }).click();
  await lang(page, 'Русский').click();
  await page.getByRole('button', { name: /Вернуться к игре/ }).click();
  await expect(page.getByRole('heading', { name: 'Выбери категорию' })).toBeVisible();
  await expect(page.getByText('Сейчас ходит')).toBeVisible();
});
