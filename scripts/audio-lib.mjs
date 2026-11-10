// Ядро генерації аудіо (без побічних ефектів на рівні модуля — тестується в Node).
// Рушії: Piper (локально, безкоштовно) і Azure F0 (безкоштовний рівень, ключ у .env).

import { speechText } from '../src/lib/speech.js';
import { Mp3Encoder } from '@breezystack/lamejs';

export const MP3_KBPS = 32; // моно, 32 кбіт/с — для мови досить (~25 КБ на питання)

// ---------- текст для Piper ----------
// Українська модель Piper читає текст посимвольно й знає лише малі літери, простий апостроф і базову пунктуацію.
const ONES = ['нуль', 'один', 'два', 'три', 'чотири', "п'ять", 'шість', 'сім', 'вісім', "дев'ять"];
const TEENS = ['десять', 'одинадцять', 'дванадцять', 'тринадцять', 'чотирнадцять', "п'ятнадцять", 'шістнадцять', 'сімнадцять', 'вісімнадцять', "дев'ятнадцять"];
const TENS = ['', '', 'двадцять', 'тридцять', 'сорок', "п'ятдесят", 'шістдесят', 'сімдесят', 'вісімдесят', "дев'яносто"];
/** Число 0–999 словами (для «10 секунд», «15 секунд»). Більші — цифрами по одній. */
export function numberWords(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Непідтримуване число: ${n}`);
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000) {
    const H = ['', 'сто', 'двісті', 'триста', 'чотириста', "п'ятсот", 'шістсот', 'сімсот', 'вісімсот', "дев'ятсот"];
    return H[Math.floor(n / 100)] + (n % 100 ? ' ' + numberWords(n % 100) : '');
  }
  return String(n).split('').map((d) => ONES[+d]).join(' ');
}
/**
 * Текст, який модель зможе прочитати: малі літери, числа словами, ’ʼ → ', без лапок і невідомих символів.
 * symbols — набір символів моделі (з .onnx.json); без нього — лише перетворення.
 */
export function piperText(text, symbols = null) {
  let t = speechText(text)
    .replace(/[’ʼ`]/g, "'")
    .replace(/[«»“”„"]/g, '')
    .replace(/…/g, '...')
    .replace(/\d+/g, (d) => numberWords(+d))
    .toLowerCase();
  if (symbols) t = [...t].filter((ch) => symbols.has(ch)).join('');
  return t.replace(/\s+/g, ' ').trim();
}

// ---------- WAV → MP3 ----------
/** Розбір WAV (PCM 16 біт): { sampleRate, channels, samples: Int16Array }. */
export function parseWav(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Це не WAV-файл');
  let off = 12, fmt = null, data = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4), body = off + 8;
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(body), channels: b.readUInt16LE(body + 2), sampleRate: b.readUInt32LE(body + 4), bits: b.readUInt16LE(body + 14) };
    if (id === 'data') data = b.subarray(body, body + size);
    off = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('У WAV немає fmt або data');
  if (fmt.format !== 1 || fmt.bits !== 16) throw new Error('Потрібен WAV PCM 16 біт');
  const samples = new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length - (data.length % 2)));
  return { sampleRate: fmt.sampleRate, channels: fmt.channels, samples };
}
/** WAV → MP3 (моно). Стерео зводиться в моно. */
export function wavToMp3(wav, kbps = MP3_KBPS) {
  const { sampleRate, channels, samples } = parseWav(wav);
  let mono = samples;
  if (channels > 1) {
    mono = new Int16Array(Math.floor(samples.length / channels));
    for (let i = 0; i < mono.length; i++) { let sum = 0; for (let c = 0; c < channels; c++) sum += samples[i * channels + c]; mono[i] = Math.round(sum / channels); }
  }
  const enc = new Mp3Encoder(1, sampleRate, kbps), out = [];
  for (let i = 0; i < mono.length; i += 1152) { const chunk = enc.encodeBuffer(mono.subarray(i, i + 1152)); if (chunk.length) out.push(Buffer.from(chunk)); }
  const end = enc.flush(); if (end.length) out.push(Buffer.from(end));
  return Buffer.concat(out);
}

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
 * Piper → WAV → MP3 (lamejs, без ffmpeg). run(cmd, args, stdin) — обгортка над spawn; fs — readFileSync/writeFileSync.
 * symbols — символи моделі (текст нормалізується під них); speaker — номер голосу (у моделі uk_UA їх три).
 */
export function piperEngine({ model, run, tmpWav, fs, symbols = null, speaker = null, bin = 'piper' }) {
  if (!model) throw new Error('Вкажи модель Piper: --model шлях/uk_UA-ukrainian_tts-medium.onnx');
  return async (job, outFile) => {
    const wav = tmpWav(job.id);
    const args = ['--model', model, '--output_file', wav, ...(speaker != null ? ['--speaker', String(speaker)] : [])];
    await run(bin, args, piperText(job.text, symbols));
    fs.writeFileSync(outFile, wavToMp3(fs.readFileSync(wav)));
    return wav; // хай викликач прибере тимчасовий файл
  };
}

/**
 * Нейронні голоси Microsoft через edge-tts (pip install edge-tts): безкоштовно, без ключа, MP3 одразу.
 * Голоси: uk-UA-PolinaNeural (жіночий), uk-UA-OstapNeural (чоловічий).
 */
export function edgeEngine({ run, voice = 'uk-UA-PolinaNeural', rate = '-5%', bin = 'edge-tts' }) {
  return async (job, outFile) => {
    await run(bin, ['--voice', voice, `--rate=${rate}`, '--text', job.text, '--write-media', outFile]);
    return null;
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

/** Аргументи: --engine edge|azure|piper --voice назва --model шлях --speaker N --force --only a,b --list */
export function parseArgs(argv) {
  const o = { engine: 'edge', voice: null, model: null, speaker: null, force: false, only: null, list: false };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    if (a === '--engine') o.engine = argv[++k];
    else if (a === '--model') o.model = argv[++k];
    else if (a === '--voice') o.voice = argv[++k];
    else if (a === '--speaker') { o.speaker = Number(argv[++k]); if (!Number.isInteger(o.speaker) || o.speaker < 0) throw new Error('--speaker — номер голосу: 0, 1, 2…'); }
    else if (a === '--force') o.force = true;
    else if (a === '--list') o.list = true;
    else if (a === '--only') o.only = String(argv[++k] || '').split(',').filter(Boolean);
    else throw new Error(`Невідомий аргумент: ${a}`);
  }
  if (!['edge', 'azure', 'piper'].includes(o.engine)) throw new Error(`Невідомий рушій: ${o.engine} (є edge, azure і piper)`);
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
