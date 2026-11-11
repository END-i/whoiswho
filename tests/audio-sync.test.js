// Озвучка в репозиторії відповідає поточним текстам питань: якщо текст змінили, а файл ні — тест падає
// і підказує, що перезаписати (npm run audio -- --engine gemini --only …).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { listAudioIds, staleAudio, MANIFEST } from '../scripts/audio-lib.mjs';

const read = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));

test('озвучка public/audio не застаріла: кожен файл записаний з поточного тексту питання', () => {
  const dir = new URL('../public/audio/', import.meta.url).pathname;
  const stale = staleAudio(read('../src/data/questions.json').questions, listAudioIds(dir, fs), read(`../public/audio/${MANIFEST}`), read('../src/data/pronunciation.json').words);
  assert.deepEqual(stale, [], `Перезапиши: npm run audio -- --engine gemini --force --only ${stale.map((s) => s.id).join(',')}`);
});
