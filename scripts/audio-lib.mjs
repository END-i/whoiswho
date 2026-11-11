// Ядро генерації аудіо (без побічних ефектів на рівні модуля — тестується в Node).
// Рушії: Piper (локально, безкоштовно) і Azure F0 (безкоштовний рівень, ключ у .env).

import { createHash } from 'node:crypto';
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
  return encodeMono(mono, sampleRate, kbps);
}

/** Сирий PCM 16 біт моно → MP3 (так повертає звук Gemini). */
export function pcmToMp3(pcm, sampleRate = 24000, kbps = 48) {
  const b = Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm);
  const samples = new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length - (b.length % 2)));
  return encodeMono(samples, sampleRate, kbps);
}

function encodeMono(mono, sampleRate, kbps) {
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
export function planJobs(questions, existing, { force = false, only = null, stressed = false, dict = {} } = {}) {
  // --stressed: перегенерувати лише питання зі словами зі словника вимови
  const want = stressed ? new Set(stressedIds(questions, dict)) : only ? new Set(only) : null;
  return questions
    .filter((q) => !want || want.has(q.id))
    .filter((q) => force || stressed || !existing.has(q.id))
    .map((q) => ({ id: q.id, text: applyPronunciation(speechText(q.text), dict) }));
}

// ---- Маніфест озвучки: id → відбиток тексту, з якого записано файл. Так видно застарілу озвучку. ----

export const MANIFEST = 'manifest.json';
/** Відбиток тексту, який читає голос (після speechText і словника вимови). */
export const textHash = (spoken) => createHash('sha1').update(spoken).digest('hex').slice(0, 12);

/** Записати в маніфест щойно озвучені питання. jobs — з planJobs, done — їхні id. */
export function updateManifest(manifest, jobs, done) {
  const out = { ...manifest };
  for (const j of jobs) if (done.includes(j.id)) out[j.id] = textHash(j.text);
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Застаріла озвучка: файл є, а текст змінився (чи файл не записаний у маніфест).
 * existing — id готових файлів; повертає [{ id, reason }].
 */
export function staleAudio(questions, existing, manifest, dict = {}) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const out = [];
  for (const id of existing) {
    const q = byId.get(id);
    if (!q) out.push({ id, reason: 'питання вже немає' });
    else if (!manifest[id]) out.push({ id, reason: 'немає в маніфесті' });
    else if (manifest[id] !== textHash(applyPronunciation(speechText(q.text), dict))) out.push({ id, reason: 'текст змінився' });
  }
  return out;
}

// ---- Словник вимови: слово → те саме слово з наголосом (U+0301 після наголошеної голосної) ----

const STRESS = '\u0301';
const VOWELS = 'аеєиіїоуюяАЕЄИІЇОУЮЯ';
const WORD = /[\p{L}\u0301'ʼ’]+/gu;

/** Помилки у словнику: наголос рівно один, лише після голосної, і без нього слово те саме. */
export function checkPronunciation(dict) {
  const errors = [];
  for (const [word, said] of Object.entries(dict)) {
    const marks = [...said].filter((c) => c === STRESS).length;
    if (word !== word.toLowerCase() || word.includes(STRESS)) errors.push(`«${word}»: ключ — слово малими літерами без наголосу`);
    else if (said.replaceAll(STRESS, '').toLowerCase() !== word) errors.push(`«${word}»: «${said}» — це інше слово`);
    else if (marks !== 1) errors.push(`«${word}»: потрібен рівно один наголос (U+0301), а є ${marks}`);
    else if (!VOWELS.includes(said[said.indexOf(STRESS) - 1])) errors.push(`«${word}»: наголос має стояти після голосної`);
  }
  return errors;
}

/** Поставити наголоси за словником. Лише цілі слова, велика перша літера зберігається. */
export function applyPronunciation(text, dict = {}) {
  return text.replace(WORD, (w) => {
    const said = dict[w.toLowerCase()];
    if (!said) return w;
    return w[0] !== w[0].toLowerCase() ? said[0].toUpperCase() + said.slice(1) : said;
  });
}

/** Питання, у тексті яких є слова зі словника, — лише їх треба перегенерувати. */
export function stressedIds(questions, dict = {}) {
  return questions.filter((q) => applyPronunciation(q.text, dict) !== q.text).map((q) => q.id);
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

// ---------- Gemini TTS ----------
export const GEMINI_STYLE = 'тепло й весело, як ведучий сімейної гри для дітей, чітко й не поспішаючи';
/** Стиль читання мовою питань (моделі 3.x отримують його в speech_metadata.style). */
export const GEMINI_STYLES = { uk: GEMINI_STYLE, ru: 'тепло и весело, как ведущий семейной игры для детей, чётко и не спеша' };
export const GEMINI_MODEL = 'gemini-3.8-flash-tts';
export const GEMINI_VOICE = 'Achird'; // вибір 11.11: чоловічий, привітний

/**
 * Тіло запиту до Gemini TTS. Моделі 2.x беруть стиль прямо в тексті («Прочитай …: питання»).
 * Моделі 3.x читають text дослівно (разом з інструкцією!), тож стиль іде окремо — у speech_metadata.style.
 */
export function geminiRequest(text, { voice = GEMINI_VOICE, style = GEMINI_STYLE, model = GEMINI_MODEL } = {}) {
  const legacy = /^gemini-2\./.test(model);
  return {
    contents: [{ role: 'user', parts: [legacy ? { text: `Прочитай українською ${style}: ${text}` } : { text, speech_metadata: { style } }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: legacy ? { prebuiltVoiceConfig: { voiceName: voice } } : { voice } } },
  };
}

/** Чи вичерпано денний ліміт (тоді чекати марно — до кінця доби). */
export function isDailyQuota(errorBody) {
  return (errorBody?.error?.details || []).some((d) => (d.violations || []).some((v) => /PerDay/i.test(v.quotaId || '')));
}

/** Скільки чекати після 429: з RetryInfo у відповіді (напр. "37s") або експоненційно. */
export function retryDelay(errorBody, attempt) {
  const d = errorBody?.error?.details?.find?.((x) => String(x['@type'] || '').includes('RetryInfo'))?.retryDelay;
  const s = d ? parseFloat(d) : NaN;
  return Number.isFinite(s) ? Math.ceil(s * 1000) + 500 : Math.min(60000, 2000 * 2 ** attempt);
}

/** Відповідь Gemini (generateContent) → MP3. 2.5 віддає сирий PCM (audio/L16;rate=24000), 3.x — WAV із заголовком. */
export function geminiMp3(response) {
  const part = response?.candidates?.[0]?.content?.parts?.find?.((p) => p.inlineData)?.inlineData;
  if (!part?.data) throw new Error('Gemini не повернув звуку');
  const audio = Buffer.from(part.data, 'base64');
  const isWav = /wav/i.test(part.mimeType || '') || audio.subarray(0, 4).toString('latin1') === 'RIFF';
  const rate = Number((part.mimeType || '').match(/rate=(\d+)/)?.[1]) || 24000;
  return isWav ? wavToMp3(audio, 48) : pcmToMp3(audio, rate);
}

/**
 * Пакетна озвучка (Batch API): питання пакетами по chunk штук. Удвічі дешевше, і окремий ліміт —
 * не впирається в 100 запитів на добу. Зазвичай готово за кілька хвилин (максимум — 48 год).
 * Пакети невеликі, бо відповідь приходить одним JSON: 900 питань — це ~580 МБ, більше, ніж рядок у JavaScript.
 * Повертає { done, failed } як runJobs; файли пише через writeFile(outFile(id), mp3).
 */
export async function geminiBatch(jobs, { chunk = 250, log = () => {}, ...opts }) {
  if (!opts.key) throw new Error('Для Gemini потрібен GEMINI_API_KEY у .env (aistudio.google.com → Get API key)');
  const done = [], failed = [];
  for (let i = 0; i < jobs.length; i += chunk) {
    const part = jobs.slice(i, i + chunk);
    if (jobs.length > chunk) log(`Частина ${i / chunk + 1} з ${Math.ceil(jobs.length / chunk)}`);
    const r = await batchPart(part, { ...opts, log });
    done.push(...r.done); failed.push(...r.failed);
  }
  return { done, failed, stopped: [] };
}

async function batchPart(jobs, { key, fetch, writeFile, outFile, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), voice = GEMINI_VOICE, style = GEMINI_STYLE, model = GEMINI_MODEL, poll = 20000, maxPolls = 540, log }) {
  const api = 'https://generativelanguage.googleapis.com/v1beta';
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': key };
  const call = async (url, init) => {
    const res = await fetch(url, { headers, ...init });
    let body;
    try { body = await res.json(); } catch { body = null; }
    if (!res.ok) throw new Error(`Gemini Batch відповів ${res.status}: ${String(body?.error?.message || '').slice(0, 200)}`);
    if (!body) throw new Error('Відповідь Gemini Batch не прочиталася — завелика? Зменш --chunk');
    return body;
  };
  const requests = jobs.map((j) => ({ request: geminiRequest(j.text, { voice, style, model }), metadata: { key: j.id } }));
  let op = await call(`${api}/models/${model}:batchGenerateContent`, {
    method: 'POST', body: JSON.stringify({ batch: { display_name: `whoiswho-${jobs.length}`, input_config: { requests: { requests } } } }),
  });
  const name = op.name; // назва пакета — з першої відповіді, щоб не загубити
  log(`Пакет ${name}: ${jobs.length} питань, чекаю…`);
  for (let k = 0; !op.done; k++) {
    if (k >= maxPolls) throw new Error(`Пакет ${name} не готовий після ${Math.round((maxPolls * poll) / 60000)} хв — перевір пізніше`);
    await sleep(poll);
    op = await call(`${api}/${name}`, { method: 'GET' });
    const st = op.metadata?.batchStats;
    log(`… ${op.metadata?.state}${st ? `: готово ${st.successfulRequestCount || 0} з ${st.requestCount}` : ''}`);
  }
  if (op.error || op.metadata?.state !== 'BATCH_STATE_SUCCEEDED') throw new Error(`Пакет не вдався: ${op.metadata?.state} ${op.error?.message || ''}`.trim());
  const out = op.metadata.output || op.response || {};
  let results = out.inlinedResponses?.inlinedResponses;
  if (!results && out.responsesFile) {
    // великий результат Google віддає файлом JSONL: рядок — { key, response | error }
    const res = await fetch(`https://generativelanguage.googleapis.com/download/v1beta/${out.responsesFile}:download?alt=media`, { headers });
    if (!res.ok) throw new Error(`Не вдалося завантажити результат пакета: ${res.status}`);
    results = (await res.text()).split('\n').filter(Boolean).map((l) => { const r = JSON.parse(l); return { ...r, metadata: { key: r.key } }; });
  }
  const done = [], failed = [];
  for (const r of results || []) {
    const id = r.metadata?.key;
    try {
      if (r.error) throw new Error(r.error.message || 'помилка');
      writeFile(outFile(id), geminiMp3(r.response));
      done.push(id);
    } catch (e) { failed.push({ id, error: e.message }); log(`✗ ${id}: ${e.message}`); }
  }
  // те, на що пакет не відповів зовсім
  for (const j of jobs) if (!done.includes(j.id) && !failed.some((f) => f.id === j.id)) failed.push({ id: j.id, error: 'немає відповіді в пакеті' });
  return { done, failed };
}

/**
 * Google Gemini TTS: текст + опис стилю → PCM 24 кГц → MP3.
 * fetch, writeFile, sleep передаються параметрами. 429 — чекаємо й повторюємо (до retries разів).
 */
export function geminiEngine({ key, fetch, writeFile, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), voice = GEMINI_VOICE, style = GEMINI_STYLE, model = GEMINI_MODEL, retries = 6, maxWait = 120000, log = () => {} }) {
  if (!key) throw new Error('Для Gemini потрібен GEMINI_API_KEY у .env (aistudio.google.com → Get API key)');
  return async (job, outFile) => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(geminiRequest(job.text, { voice, style, model })),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 429 && isDailyQuota(body)) {
        // ліміт на добу — на модель і проєкт: безкоштовно 10, на Tier 1 — 100 (для 3.8)
        const limit = body.error.details.flatMap((d) => d.violations || []).map((v) => v.quotaValue).find(Boolean);
        const mins = Math.ceil(retryDelay(body, 0) / 60000);
        throw fatal(`Вичерпано денний ліміт Gemini для ${model}${limit ? ` (${limit} запитів на добу)` : ''}. Ліміт скинеться приблизно через ${mins} хв — тоді запусти ще раз, готові файли пропускаються`);
      }
      if (res.status === 429 && attempt < retries) {
        const ms = retryDelay(body, attempt);
        if (ms > maxWait) throw fatal(`Gemini просить зачекати ${Math.round(ms / 60000)} хв — зупиняюсь, спробуй пізніше`);
        log(`… ліміт запитів, чекаю ${Math.round(ms / 1000)} с`); await sleep(ms); continue;
      }
      if (!res.ok) throw new Error(`Gemini відповів ${res.status}: ${String(body?.error?.message || '').slice(0, 200)}`);
      writeFile(outFile, geminiMp3(body));
      return null;
    }
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
/** Помилка, після якої решту питань озвучувати марно (ліміт на добу тощо): runJobs зупиняється. */
export function fatal(message) {
  return Object.assign(new Error(message), { fatal: true });
}

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
      if (e.fatal) return { done, failed, stopped: jobs.slice(k + 1).map((j) => j.id) };
    }
  }
  return { done, failed, stopped: [] };
}

/** Аргументи: --engine edge|gemini|azure|piper --lang uk|ru --voice назва --model шлях --speaker N --force --stressed --batch --only a,b --list --out тека */
export function parseArgs(argv) {
  const o = { engine: 'edge', lang: 'uk', voice: null, model: null, speaker: null, force: false, stressed: false, batch: false, only: null, list: false, out: null };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    if (a === '--engine') o.engine = argv[++k];
    else if (a === '--model') o.model = argv[++k];
    else if (a === '--lang') o.lang = argv[++k];
    else if (a === '--voice') o.voice = argv[++k];
    else if (a === '--out') o.out = argv[++k];
    else if (a === '--speaker') { o.speaker = Number(argv[++k]); if (!Number.isInteger(o.speaker) || o.speaker < 0) throw new Error('--speaker — номер голосу: 0, 1, 2…'); }
    else if (a === '--force') o.force = true;
    else if (a === '--stressed') o.stressed = true;
    else if (a === '--batch') o.batch = true;
    else if (a === '--list') o.list = true;
    else if (a === '--only') o.only = String(argv[++k] || '').split(',').filter(Boolean);
    else throw new Error(`Невідомий аргумент: ${a}`);
  }
  if (!['edge', 'gemini', 'azure', 'piper'].includes(o.engine)) throw new Error(`Невідомий рушій: ${o.engine} (є edge, gemini, azure і piper)`);
  if (o.batch && o.engine !== 'gemini') throw new Error('--batch працює лише з --engine gemini');
  if (!GEMINI_STYLES[o.lang]) throw new Error(`Невідома мова: ${o.lang} (є ${Object.keys(GEMINI_STYLES).join(', ')})`);
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
