// Ядро генерації аудіо (без побічних ефектів на рівні модуля — тестується в Node).
// Рушії: Piper (локально, безкоштовно) і Azure F0 (безкоштовний рівень, ключ у .env).

import { speechText } from '../src/lib/speech.js';

export const MP3_ARGS = ['-ac', '1', '-ar', '22050', '-b:a', '32k']; // моно, 32 кбіт/с — для мови досить

/** Список файлів .mp3 у теці → множина id. fs передається параметром. */
export function listAudioIds(dir, fs) {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).sort();
  } catch {
    return []; // теки ще немає — озвучки немає
  }
}

/**
 * Які питання озвучити. existing — Set уже готових id.
 * force — перегенерувати все; only — лише ці id.
 */
export function planJobs(questions, existing, { force = false, only = null } = {}) {
  const want = only ? new Set(only) : null;
  return questions
    .filter((q) => !want || want.has(q.id))
    .filter((q) => force || !existing.has(q.id))
    .map((q) => ({ id: q.id, text: speechText(q.text) }));
}

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** SSML для Azure. Трохи повільніше за звичайне — щоб діти встигали. */
export function ssml(text, voice = 'uk-UA-PolinaNeural', rate = '-8%') {
  return `<speak version="1.0" xml:lang="uk-UA"><voice name="${voice}"><prosody rate="${rate}">${xml(text)}</prosody></voice></speak>`;
}

/**
 * Piper → WAV → ffmpeg → MP3. run(cmd, args, stdin) — обгортка над spawn, повертає Promise.
 */
export function piperEngine({ model, run, tmpWav }) {
  if (!model) throw new Error('Вкажи модель Piper: --model шлях/uk_UA-ukrainian_tts-medium.onnx');
  return async (job, outFile) => {
    const wav = tmpWav(job.id);
    await run('piper', ['--model', model, '--output_file', wav], job.text);
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, ...MP3_ARGS, outFile]);
    return wav; // хай викликач прибере тимчасовий файл
  };
}

/** Azure Speech REST. fetch і запис файлу передаються параметрами. */
export function azureEngine({ key, region, voice, fetch, writeFile }) {
  if (!key || !region) throw new Error('Для Azure потрібні AZURE_SPEECH_KEY і AZURE_SPEECH_REGION у .env');
  return async (job, outFile) => {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'whoiswho-audio',
      },
      body: ssml(job.text, voice),
    });
    if (!res.ok) throw new Error(`Azure відповів ${res.status}: ${(await res.text()).slice(0, 200)}`);
    writeFile(outFile, Buffer.from(await res.arrayBuffer()));
    return null;
  };
}

/** Виконати завдання по черзі. Помилка одного питання не зупиняє решту. */
export async function runJobs(jobs, engine, { outFile, cleanup = () => {}, log = () => {} }) {
  const done = [], failed = [];
  for (const [k, job] of jobs.entries()) {
    try {
      const tmp = await engine(job, outFile(job.id));
      if (tmp) cleanup(tmp);
      done.push(job.id);
      log(`✓ ${k + 1}/${jobs.length} ${job.id}`);
    } catch (e) {
      failed.push({ id: job.id, error: e.message });
      log(`✗ ${job.id}: ${e.message}`);
    }
  }
  return { done, failed };
}

/** Аргументи командного рядка: --engine piper|azure --model шлях --force --only a,b --list */
export function parseArgs(argv) {
  const o = { engine: 'piper', model: null, force: false, only: null, list: false };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    if (a === '--engine') o.engine = argv[++k];
    else if (a === '--model') o.model = argv[++k];
    else if (a === '--force') o.force = true;
    else if (a === '--list') o.list = true;
    else if (a === '--only') o.only = String(argv[++k] || '').split(',').filter(Boolean);
    else throw new Error(`Невідомий аргумент: ${a}`);
  }
  if (!['piper', 'azure'].includes(o.engine)) throw new Error(`Невідомий рушій: ${o.engine} (є piper і azure)`);
  return o;
}

/** Найпростіший розбір .env: KEY=value, # коментарі, лапки. */
export function parseEnv(text) {
  const env = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}
