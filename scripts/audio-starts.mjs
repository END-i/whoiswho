// Де в готових файлах озвучки починається голос: public/audio[/ru]/starts.json (id → секунди).
// Записи Gemini мають на початку 0,2–0,45 с тиші; плеєр гри стартує одразу з голосу.
// Декодує mp3 браузер (Playwright Chromium) — у Node немає декодера mp3. Запуск: node scripts/audio-starts.mjs [--lang ru]
// Нові файли генератор пише вже без тиші (trimLead), тож для них запис не потрібен.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { voiceStart, listAudioIds, STARTS, parseArgs } from './audio-lib.mjs';

const opts = parseArgs(process.argv.slice(2));
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public', 'audio', opts.lang && opts.lang !== 'uk' ? opts.lang : '');
const ids = listAudioIds(dir, fs);
const browser = await chromium.launch();
const page = await browser.newPage();
const starts = {};
for (let k = 0; k < ids.length; k += 50) {
  const part = ids.slice(k, k + 50);
  const files = part.map((id) => fs.readFileSync(path.join(dir, `${id}.mp3`)).toString('base64'));
  // у браузері — лише декодування й пошук першого гучного відліку; та сама функція, що в генераторі
  const found = await page.evaluate(async ({ files, src }) => {
    const voiceStart = eval(`(${src})`);
    const ctx = new OfflineAudioContext(1, 1, 24000);
    return Promise.all(files.map(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const buf = await ctx.decodeAudioData(bytes.buffer);
      return voiceStart(buf.getChannelData(0), buf.sampleRate, { full: 1 });
    }));
  }, { files, src: voiceStart.toString() });
  part.forEach((id, i) => { if (found[i] > 0) starts[id] = found[i]; });
  console.log(`${Math.min(k + 50, ids.length)} / ${ids.length}`);
}
await browser.close();
fs.writeFileSync(path.join(dir, STARTS), JSON.stringify(starts, null, 2) + '\n');
console.log(`${STARTS}: ${Object.keys(starts).length} файлів з тишею на початку`);
