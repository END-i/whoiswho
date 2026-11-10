#!/usr/bin/env node
// Одноразова генерація озвучки: public/audio/{id}.mp3 для кожного питання. Готові файли пропускає.
//
//   node scripts/generate-audio.mjs                                                   # edge-tts, голос Поліна (за замовчуванням)
//   node scripts/generate-audio.mjs --voice uk-UA-OstapNeural                         # той самий рушій, голос Остап
//   node scripts/generate-audio.mjs --engine piper --model ~/piper/uk_UA-ukrainian_tts-medium.onnx   # Piper, локально
//   node scripts/generate-audio.mjs --engine azure                                    # Azure F0, ключі в .env
//   node scripts/generate-audio.mjs --list                                            # що буде озвучено
//   ... --force (перегенерувати все), --only gs-01,gs-02
// Шлях до piper можна задати змінною PIPER_BIN. ffmpeg не потрібен: MP3 кодує lamejs.
//
// Уся логіка — у scripts/audio-lib.mjs (покрита тестами); тут лише файли й процеси.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listAudioIds, planJobs, piperEngine, azureEngine, edgeEngine, runJobs, parseArgs, parseEnv } from './audio-lib.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.join(root, 'public/audio');
const data = JSON.parse(fs.readFileSync(path.join(root, 'src/data/questions.json'), 'utf8'));
const opts = parseArgs(process.argv.slice(2));

const jobs = planJobs(data.questions, new Set(listAudioIds(outDir, fs)), opts);
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
const engine = opts.engine === 'edge'
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
const { done, failed } = await runJobs(jobs, engine, {
  outFile: (id) => path.join(outDir, `${id}.mp3`),
  cleanup: (f) => fs.rmSync(f, { force: true }),
  log: (m) => console.log(m),
});
console.log(`Готово: ${done.length}. Помилок: ${failed.length}.`);
process.exit(failed.length ? 1 : 0);
