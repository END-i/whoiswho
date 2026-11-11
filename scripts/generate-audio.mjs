#!/usr/bin/env node
// Одноразова генерація озвучки: public/audio/{id}.mp3 для кожного питання. Готові файли пропускає.
//
//   node scripts/generate-audio.mjs                                                   # edge-tts, голос Поліна (за замовчуванням)
//   node scripts/generate-audio.mjs --voice uk-UA-OstapNeural                         # той самий рушій, голос Остап
//   node scripts/generate-audio.mjs --engine piper --model ~/piper/uk_UA-ukrainian_tts-medium.onnx   # Piper, локально
//   node scripts/generate-audio.mjs --engine azure                                    # Azure F0, ключі в .env
//   node scripts/generate-audio.mjs --engine gemini --voice Leda --model gemini-3.8-flash-tts   # Gemini, ключ у .env
//   node scripts/generate-audio.mjs --engine gemini --batch --force             # Gemini пакетом: усі питання одним завданням, удвічі дешевше
//   node scripts/generate-audio.mjs --list                                            # що буде озвучено
//   ... --force (перегенерувати все), --only gs-01,gs-02, --stressed (лише питання зі словами зі словника вимови)
// Шлях до piper можна задати змінною PIPER_BIN. ffmpeg не потрібен: MP3 кодує lamejs.
//
// Уся логіка — у scripts/audio-lib.mjs (покрита тестами); тут лише файли й процеси.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GEMINI_STYLES, listAudioIds, planJobs, checkPronunciation, geminiBatch, updateManifest, MANIFEST, piperEngine, azureEngine, edgeEngine, geminiEngine, runJobs, parseArgs, parseEnv } from './audio-lib.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// усі набори питань: озвучка спільна, id питань між наборами не повторюються
// --lang ru: тексти з src/data/packs/ru, файли в public/audio/ru
const opts = parseArgs(process.argv.slice(2));
const packDir = path.join(root, 'src/data/packs', opts.lang === 'uk' ? '' : opts.lang);
const data = { questions: fs.readdirSync(packDir).filter((f) => f.endsWith('.json')).sort()
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(packDir, f), 'utf8')).questions) };
const outDir = opts.out ? path.resolve(opts.out) : path.join(root, 'public/audio', opts.lang === 'uk' ? '' : opts.lang);
const style = GEMINI_STYLES[opts.lang];

// словник вимови: слова, які голос наголошує неправильно (див. README, «Озвучка»)
// словник наголосів — лише для українських текстів
const dict = opts.lang === 'uk' ? JSON.parse(fs.readFileSync(path.join(root, 'src/data/pronunciation.json'), 'utf8')).words : {};
const dictErrors = checkPronunciation(dict);
if (dictErrors.length) { console.error(`Помилки у src/data/pronunciation.json:\n${dictErrors.join('\n')}`); process.exit(1); }
const jobs = planJobs(data.questions, new Set(listAudioIds(outDir, fs)), { ...opts, dict });
if (opts.list || !jobs.length) {
  console.log(jobs.length ? jobs.map((j) => `${j.id}: ${j.text}`).join('\n') : 'Усе вже озвучено. Нових питань немає.');
  process.exit(0);
}

function run(cmd, args, stdin) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => reject(e.code === 'ENOENT' ? new Error(`Не знайдено «${cmd}». Встанови його (див. README, розділ «Озвучка»).`) : e));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} завершився з кодом ${code}: ${err.slice(-300)}`))));
    if (stdin != null) p.stdin.end(stdin); else p.stdin.end();
  });
}

const env = { ...parseEnv(fs.existsSync(path.join(root, '.env')) ? fs.readFileSync(path.join(root, '.env'), 'utf8') : ''), ...process.env };
const engine = opts.engine === 'gemini'
  ? geminiEngine({ key: env.GEMINI_API_KEY, style, voice: opts.voice || undefined, model: opts.model || env.GEMINI_MODEL || undefined, fetch, writeFile: fs.writeFileSync, log: (m) => console.log(m) })
  : opts.engine === 'edge'
  ? edgeEngine({ run, voice: opts.voice || undefined, bin: env.EDGE_TTS_BIN || 'edge-tts' })
  : opts.engine === 'azure'
  ? azureEngine({ key: env.AZURE_SPEECH_KEY, region: env.AZURE_SPEECH_REGION, voice: opts.voice || env.AZURE_SPEECH_VOICE, fetch, writeFile: fs.writeFileSync })
  : piperEngine({
    model: opts.model, run, fs, speaker: opts.speaker, bin: env.PIPER_BIN || 'piper',
    tmpWav: (id) => path.join(os.tmpdir(), `whoiswho-${id}.wav`),
    // символи, які знає модель (з її .onnx.json) — щоб текст не губив літер
    symbols: (() => { try { return new Set(Object.keys(JSON.parse(fs.readFileSync(opts.model + '.json', 'utf8')).phoneme_id_map)); } catch { return null; } })(),
  });

fs.mkdirSync(outDir, { recursive: true });
console.log(`Озвучую ${jobs.length} питань (${opts.engine})…`);
const outFile = (id) => path.join(outDir, `${id}.mp3`);
const { done, failed, stopped } = opts.batch
  ? await geminiBatch(jobs, { key: env.GEMINI_API_KEY, style, voice: opts.voice || undefined, model: opts.model || env.GEMINI_MODEL || undefined, fetch, writeFile: fs.writeFileSync, outFile, log: (m) => console.log(m) })
  : await runJobs(jobs, engine, {
  outFile,
  cleanup: (f) => fs.rmSync(f, { force: true }),
  log: (m) => console.log(m),
});
// маніфест: які файли з якого тексту записані (тест tests/audio-sync.test.js ловить застарілу озвучку)
const manifestFile = path.join(outDir, MANIFEST);
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
fs.writeFileSync(manifestFile, JSON.stringify(updateManifest(manifest, jobs, done), null, 2) + '\n');
console.log(`Готово: ${done.length}. Помилок: ${failed.length}.${stopped.length ? ` Зупинено, не озвучено ще ${stopped.length}.` : ''}`);
process.exit(failed.length ? 1 : 0);
