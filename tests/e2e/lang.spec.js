import { test, expect } from './fixtures.js';
import { fresh, setPlayers, numberOf } from './helpers.js';

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

test('гра російською: категорії й питання російською, 🔊 грає файл з audio/ru, а де його немає — кнопки немає', async ({ page }) => {
  const hits = [];
  const MP3 = Buffer.from('ID3\u0003\u0000\u0000\u0000\u0000\u0000\u0000', 'binary');
  await page.route('**/audio/**/*.mp3', (r) => { hits.push(new URL(r.request().url()).pathname); r.fulfill({ status: 200, contentType: 'audio/mpeg', body: MP3 }); });
  await fresh(page);
  await lang(page, 'Русский').click();
  await setPlayers(page, ['Оля', 'Тарас']);
  await page.getByRole('button', { name: /Начать игру/ }).click();
  await expect(page.getByText('Сядьте в круг. Телефон передаём налево — по часовой стрелке.')).toBeVisible();
  await page.getByRole('button', { name: /Играем!/ }).click();
  await expect(page.locator('.cat .title').first()).toHaveText('Угадай');
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('whoiswho.v2')));
  await page.locator('.cat', { hasText: 'Угадай' }).first().click();
  await page.getByRole('button', { name: `Карта ${s.game.deck.guess.indexOf('gs-01') + 1}`, exact: true }).click();
  const card = page.getByRole('dialog');
  await expect(card.getByText('Что игрок слева любит есть больше всего?')).toBeVisible();
  await expect(card.locator('.who').nth(1)).toContainText('игрок слева');
  hits.length = 0;
  await card.getByRole('button', { name: 'Прослушать вопрос' }).click();
  await expect.poll(() => hits).toContain('/audio/ru/gs-01.mp3');
  expect(hits).not.toContain('/audio/gs-01.mp3');
  // am-02 озвучено лише українською (E2E_AUDIO_IDS_RU=gs-01) — російською кнопки немає
  await card.getByRole('button', { name: /Пропустить/ }).click();
  await page.locator('.cat', { hasText: 'Что о тебе знают' }).click();
  await page.getByRole('button', { name: `Карта ${s.game.deck.aboutme.indexOf('am-02') + 1}`, exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Что ты больше всего любишь делать в выходные?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Прослушать вопрос' })).toHaveCount(0);
});

test('історія російською: дата гри — російською, не українською', async ({ page }) => {
  await fresh(page);
  await lang(page, 'Русский').click();
  await setPlayers(page, ['Оля', 'Тарас']);
  await page.getByRole('button', { name: /Начать игру/ }).click();
  await page.getByRole('button', { name: /Играем!/ }).click();
  // порожню гру історія не записує — зіграємо одну карту (gs-01: відповідає той, чия черга)
  await page.locator('.cat').first().click();
  await page.getByRole('button', { name: `Карта ${await numberOf(page, 'guess', 'gs-01')}`, exact: true }).click();
  await page.getByRole('button', { name: /Правильно/ }).click();
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Завершить игру/ }).click();
  await page.getByRole('button', { name: /История/ }).click();
  const month = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  await expect(page.locator('.date').first()).toContainText(month);
});
