// Озвучка в репозиторії відповідає поточним текстам питань: якщо текст змінили, а файл ні — тест падає
// і підказує, що перезаписати (npm run audio -- --engine gemini --only …).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { listAudioIds, staleAudio, withAnswers, MANIFEST } from '../scripts/audio-lib.mjs';
import { allQuestions, allRuQuestions } from './packs.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));

test('озвучка public/audio не застаріла: кожен файл записаний з поточного тексту питання', () => {
  const dir = new URL('../public/audio/', import.meta.url).pathname;
  const stale = staleAudio(withAnswers(allQuestions), listAudioIds(dir, fs), read(`../public/audio/${MANIFEST}`), read('../src/data/pronunciation.json').words);
  assert.deepEqual(stale, [], `Перезапиши: npm run audio -- --engine gemini --force --only ${stale.map((s) => s.id).join(',')}`);
});

test('російська озвучка public/audio/ru не застаріла', () => {
  const dir = new URL('../public/audio/ru/', import.meta.url).pathname;
  const ids = listAudioIds(dir, fs);
  if (!ids.length) return;
  const stale = staleAudio(withAnswers(allRuQuestions), ids, read(`../public/audio/ru/${MANIFEST}`));
  assert.deepEqual(stale, [], `Перезапиши: npm run audio -- --engine gemini --lang ru --force --only ${stale.map((s) => s.id).join(',')}`);
});
