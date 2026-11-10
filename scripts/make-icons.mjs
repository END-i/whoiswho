// Одноразово генерує PNG-іконки з public/icons/icon.svg (Playwright уже є серед dev-залежностей).
// Запуск: node scripts/make-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const font = readFileSync(new URL('../public/fonts/nunito-latin.woff2', import.meta.url)).toString('base64');
// maskable: важливе має бути в центральних 80% — зменшуємо малюнок і заливаємо тло
const OUT = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'maskable-512.png', size: 512, pad: 0.12 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, pad } of OUT) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>@font-face{font-family:Nunito;src:url(data:font/woff2;base64,${font})}
    html,body{margin:0;background:linear-gradient(135deg,#FF9A3D,#E8467A)}
    .w{width:${size}px;height:${size}px;display:grid;place-items:center}
    svg{width:${size * (1 - pad * 2)}px;height:${size * (1 - pad * 2)}px;${pad ? 'border-radius:22%' : ''}}</style>
    <div class="w">${svg}</div>`);
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(new URL(`../public/icons/${file}`, import.meta.url), await page.screenshot({ type: 'png' }));
  console.log('✓', file);
}
await browser.close();
