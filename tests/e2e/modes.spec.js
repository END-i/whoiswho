import { test, expect } from '@playwright/test';
import { startGame, saved, KEY, QUESTIONS } from './helpers.js';

const title = (id) => QUESTIONS.categories.find((c) => c.id === id).title;

test('плитки: усі категорії й «🎲 Випадкове» видно без прокрутки на телефоні; чий хід — крупно', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await startGame(page, ['Оля', 'Тарас']);
  await expect(page.locator('.cat')).toHaveCount(QUESTIONS.categories.length);
  await page.locator('.cat').last().evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  for (const el of [page.locator('.cat').last(), page.getByRole('button', { name: '🎲 Випадкове питання' })]) {
    const box = await el.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(664);
  }
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(664 + 40); // хіба нижній відступ
  await expect(page.locator('.bar.big')).toBeVisible();
  await expect(page.locator('.bar.big .txt b')).toHaveText('Оля');
  // у сітці шапка звичайна, а в шапці категорії — її опис
  await page.locator('.cat', { hasText: 'Вгадай' }).click();
  await expect(page.locator('.bar.big')).toHaveCount(0);
  await expect(page.locator('header .about')).toHaveText(QUESTIONS.categories[0].description);
});

test('«🎲 Випадкове»: одним дотиком відкривається ще не відкрита карта (лишилась одна — саме вона)', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас']);
  // лишаємо одну-єдину карту в одній категорії: випадкове мусить узяти саме її
  const s = await saved(page);
  for (const [cat, ids] of Object.entries(s.game.deck)) s.game.used[cat] = ids.map((_, k) => k + 1);
  s.game.used.remember = s.game.used.remember.filter((n) => n !== 5);
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, s]);
  await page.reload();
  await page.getByRole('button', { name: '🎲 Випадкове питання' }).click();
  await expect(page.getByRole('dialog', { name: 'Картка 5' })).toBeVisible();
  await expect(page.getByRole('heading', { name: title('remember') })).toBeVisible();
  await page.getByRole('button', { name: 'Пропустити' }).click();
  // це була остання карта — гра закінчилась
  await expect(page.getByRole('heading', { name: 'Гра завершена!' })).toBeVisible();
});

test('колесо: перемикач на екрані категорій, вибір памʼятається й видно в налаштуваннях', async ({ page }) => {
  await startGame(page, ['Оля', 'Тарас']);
  await page.getByRole('radio', { name: '🎡 Колесо' }).click();
  await expect(page.getByRole('heading', { name: 'Крути колесо!' })).toBeVisible();
  await expect(page.locator('.cat')).toHaveCount(0);
  expect((await saved(page)).settings.mode).toBe('wheel');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Крути колесо!' })).toBeVisible();
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.getByRole('button', { name: /Гравці й налаштування/ }).click();
  await expect(page.getByRole('radio', { name: '🎡 Колесо' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: '🧩 Плитки' }).click();
  await page.getByRole('button', { name: /Повернутися до гри/ }).click();
  await expect(page.getByRole('heading', { name: 'Вибери категорію' })).toBeVisible();
});

test('колесо: відкривається карта саме тієї категорії, на яку показує стрілка; закінчена категорія зникає з колеса', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startGame(page, ['Оля', 'Тарас']);
  // «Вгадай» уже пройдена
  const s = await saved(page);
  s.game.used.guess = s.game.deck.guess.map((_, k) => k + 1);
  s.settings.mode = 'wheel';
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, s]);
  await page.reload();
  const wheel = page.locator('.wheel');
  const label = await wheel.getAttribute('aria-label');
  const titles = label.replace(/^[^:]+:\s*/, '').split(', ');
  expect(titles).not.toContain(title('guess'));
  expect(titles).toHaveLength(QUESTIONS.categories.length - 1);

  for (let round = 0; round < 3; round++) {
    // кут колеса в мить зупинки (далі колесо зникає — відкривається сітка)
    await page.evaluate(() => {
      window.__angle = null;
      const o = new MutationObserver(() => {
        if (document.querySelector('.landed')?.textContent.trim()) { window.__angle = document.querySelector('.wheel').dataset.angle; o.disconnect(); }
      });
      o.observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    await page.getByRole('button', { name: '🌀 Крутити' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // сектор під стрілкою (зверху) — за кутом, на якому колесо зупинилось
    const angle = Number(await page.evaluate(() => window.__angle));
    expect(Number.isFinite(angle) && angle !== 0).toBe(true);
    const step = 360 / titles.length;
    const under = titles[Math.floor(((((-angle) % 360) + 360) % 360) / step)];
    await expect(page.locator('header h1')).toHaveText(under);
    await page.getByRole('button', { name: 'Пропустити' }).click();
    await expect(page.getByRole('heading', { name: 'Крути колесо!' })).toBeVisible();
  }
});
