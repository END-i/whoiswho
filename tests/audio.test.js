import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { speechText, audioUrl, pickUkVoice, listenMode, playQuestion } from '../src/lib/speech.js';
import { listAudioIds, planJobs, ssml, piperEngine, azureEngine, edgeEngine, geminiEngine, geminiRequest, geminiBatch, geminiMp3, checkPronunciation, applyPronunciation, stressedIds, pcmToMp3, retryDelay, isDailyQuota, GEMINI_STYLE, runJobs, fatal, parseArgs, parseEnv, piperText, numberWords, parseWav, wavToMp3 } from '../scripts/audio-lib.mjs';
import { audioIdsPlugin, VIRTUAL_ID } from '../scripts/vite-audio-plugin.mjs';
import { mkdtempSync, writeFileSync as wf, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const raw = JSON.parse(readFileSync(new URL('../src/data/questions.json', import.meta.url)));

// ---------- текст ----------

test('speechText: форми в дужках зникають, перша літера велика, пробіли стискаються', () => {
  assert.equal(speechText("чого він не з'їв(ла) б?"), "Чого він не з'їв б?");
  assert.equal(speechText('  Ти   щасливим(ою)  '), 'Ти щасливим');
  assert.equal(speechText(''), ''); assert.equal(speechText(null), '');
});

test('speechText: справжні питання не змінюються, крім першої літери', () => {
  for (const q of raw.questions) assert.equal(speechText(q.text), q.text.charAt(0).toUpperCase() + q.text.slice(1), q.id);
});

test('audioUrl і pickUkVoice', () => {
  assert.equal(audioUrl('gs-01'), '/audio/gs-01.mp3');
  assert.equal(audioUrl('a b', '/game'), '/game/audio/a%20b.mp3');
  assert.equal(pickUkVoice([{ lang: 'en-US' }, { lang: 'uk-UA', name: 'Lesya' }]).name, 'Lesya');
  assert.equal(pickUkVoice([{ lang: 'uk_UA' }]).lang, 'uk_UA');
  assert.equal(pickUkVoice([{ lang: 'ukr' }]), null);
  assert.equal(pickUkVoice(undefined), null);
});

// ---------- план ----------

test('listAudioIds: лише .mp3, відсортовано; немає теки — порожньо', () => {
  const fs = { readdirSync: () => ['b.mp3', 'a.mp3', 'a.wav', 'x.txt'] };
  assert.deepEqual(listAudioIds('/x', fs), ['a', 'b']);
  assert.deepEqual(listAudioIds('/x', { readdirSync: () => { throw new Error('ENOENT'); } }), []);
});

test('planJobs: пропускає готові, --force і --only', () => {
  const qs = [{ id: 'a', text: 'перше' }, { id: 'b', text: 'друге' }, { id: 'c', text: 'третє' }];
  assert.deepEqual(planJobs(qs, new Set(['a'])).map((j) => j.id), ['b', 'c']);
  assert.deepEqual(planJobs(qs, new Set(['a']), { force: true }).map((j) => j.id), ['a', 'b', 'c']);
  assert.deepEqual(planJobs(qs, new Set(), { only: ['c'] }), [{ id: 'c', text: 'Третє' }]);
  assert.equal(planJobs(raw.questions, new Set()).length, raw.questions.length);
});

test('ssml: екранування й голос', () => {
  const s = ssml(`Том & Джеррі <"'>`);
  assert.match(s, /uk-UA-PolinaNeural/);
  assert.match(s, /Том &amp; Джеррі &lt;&quot;&apos;&gt;/);
  assert.match(ssml('x', 'uk-UA-OstapNeural', '0%'), /OstapNeural.*rate="0%"/);
});

// ---------- рушії ----------

// WAV PCM16 з синусоїдою — для тестів кодування
function makeWav({ seconds = 0.2, rate = 22050, channels = 1, extraChunk = false } = {}) {
  const n = Math.round(seconds * rate) * channels, data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.sin(i / 8) * 12000), i * 2);
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0); fmt.writeUInt16LE(channels, 2); fmt.writeUInt32LE(rate, 4);
  fmt.writeUInt32LE(rate * channels * 2, 8); fmt.writeUInt16LE(channels * 2, 12); fmt.writeUInt16LE(16, 14);
  const chunk = (id, body) => Buffer.concat([Buffer.from(id, 'ascii'), Buffer.from(Uint32Array.of(body.length).buffer), body, body.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  const parts = [chunk('fmt ', fmt), ...(extraChunk ? [chunk('LIST', Buffer.from('abc'))] : []), chunk('data', data)];
  const body = Buffer.concat([Buffer.from('WAVE', 'ascii'), ...parts]);
  return Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.from(Uint32Array.of(body.length).buffer), body]);
}

test('numberWords: 0–999 словами, більші — по цифрі', () => {
  assert.equal(numberWords(0), 'нуль'); assert.equal(numberWords(7), 'сім');
  assert.equal(numberWords(10), 'десять'); assert.equal(numberWords(15), "п'ятнадцять");
  assert.equal(numberWords(40), 'сорок'); assert.equal(numberWords(42), 'сорок два');
  assert.equal(numberWords(200), 'двісті'); assert.equal(numberWords(305), "триста п'ять");
  assert.equal(numberWords(2026), 'два нуль два шість');
  assert.throws(() => numberWords(-1)); assert.throws(() => numberWords(1.5));
});

test('piperText: малі літери, числа словами, без лапок, лише символи моделі', () => {
  assert.equal(piperText('Протанцюй 10 секунд!'), 'протанцюй десять секунд!');
  assert.equal(piperText('Скажи «я тебе люблю» — тричі…'), 'скажи я тебе люблю — тричі...');
  assert.equal(piperText('Чого він не з’їв(ла) б?'), "чого він не з'їв б?");
  const symbols = new Set([...'абвгдеєжзиіїйклмнопрстуфхцчшщьюяґ\' ?']);
  assert.equal(piperText('Що це? #тег 😀', symbols), 'що це? тег');
});

test('piperText: усі 200 питань перетворюються на символи української моделі', () => {
  const symbols = new Set([...' !$\',-.:;?^_́̆̈абвгдежзийклмнопрстуфхцчшщьюяєіїґ—']); // з uk_UA-ukrainian_tts-medium.onnx.json
  for (const q of raw.questions) {
    const t = piperText(q.text);
    assert.deepEqual([...t].filter((ch) => !symbols.has(ch)), [], `${q.id}: «${t}»`);
    assert.ok(t.length > 5, q.id);
  }
});

test('parseWav: моно й стерео, пропускає зайві блоки; не WAV — помилка', () => {
  const m = parseWav(makeWav({ extraChunk: true }));
  assert.equal(m.sampleRate, 22050); assert.equal(m.channels, 1); assert.equal(m.samples.length, 4410);
  assert.equal(parseWav(makeWav({ channels: 2 })).channels, 2);
  assert.throws(() => parseWav(Buffer.from('hello world, not a wav')), /не WAV/);
  const noData = makeWav().subarray(0, 12 + 8 + 16);
  const fixed = Buffer.from(noData); fixed.writeUInt32LE(fixed.length - 8, 4);
  assert.throws(() => parseWav(fixed), /fmt або data/);
  const float = makeWav(); float.writeUInt16LE(3, 20); // формат 3 = float
  assert.throws(() => parseWav(float), /PCM 16/);
  assert.equal(parseWav(new Uint8Array(makeWav())).channels, 1, 'приймає й Uint8Array');
});

test('wavToMp3: справжній MP3 потрібного розміру, стерео зводиться в моно', () => {
  const mp3 = wavToMp3(makeWav({ seconds: 2 }));
  assert.ok(mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0, 'починається з MP3-кадру');
  assert.ok(mp3.length > 5000 && mp3.length < 12000, `32 кбіт/с × 2 с ≈ 8 КБ, вийшло ${mp3.length}`);
  const st = wavToMp3(makeWav({ seconds: 1, channels: 2 }));
  assert.ok(st.length > 2000 && st.length < 7000);
  assert.ok(wavToMp3(makeWav({ seconds: 1 }), 64).length > wavToMp3(makeWav({ seconds: 1 }), 32).length, 'бітрейт має значення');
});

test('piperEngine: нормалізований текст у stdin, голос, WAV → MP3 без ffmpeg', async () => {
  const calls = [], files = {};
  const fs = { readFileSync: () => makeWav({ seconds: 0.5 }), writeFileSync: (f, b) => (files[f] = b) };
  const eng = piperEngine({ model: 'm.onnx', run: async (...a) => calls.push(a), tmpWav: (id) => `/tmp/${id}.wav`, fs, speaker: 2, bin: '/x/piper' });
  const tmp = await eng({ id: 'q1', text: 'Протанцюй 10 секунд' }, '/out/q1.mp3');
  assert.equal(tmp, '/tmp/q1.wav');
  assert.deepEqual(calls[0], ['/x/piper', ['--model', 'm.onnx', '--output_file', '/tmp/q1.wav', '--speaker', '2'], 'протанцюй десять секунд']);
  assert.equal(calls.length, 1, 'ffmpeg більше не потрібен');
  assert.equal(files['/out/q1.mp3'][0], 0xff);
  const eng2 = piperEngine({ model: 'm.onnx', run: async (...a) => calls.push(a), tmpWav: (id) => id, fs });
  await eng2({ id: 'q2', text: 'так' }, '/o');
  assert.deepEqual(calls[1], ['piper', ['--model', 'm.onnx', '--output_file', 'q2'], 'так']);
  assert.throws(() => piperEngine({ run() {}, tmpWav() {}, fs }), /модель Piper/);
});

test('edgeEngine: голос, темп і текст як є (нейронний голос сам читає числа й лапки)', async () => {
  const calls = [];
  const eng = edgeEngine({ run: async (...a) => calls.push(a) });
  assert.equal(await eng({ id: 'q', text: 'Протанцюй 10 секунд!' }, '/o/q.mp3'), null);
  assert.deepEqual(calls[0], ['edge-tts', ['--voice', 'uk-UA-PolinaNeural', '--rate=-5%', '--text', 'Протанцюй 10 секунд!', '--write-media', '/o/q.mp3']]);
  await edgeEngine({ run: async (...a) => calls.push(a), voice: 'uk-UA-OstapNeural', rate: '+0%', bin: '/b/edge-tts' })({ id: 'q', text: 'Так' }, '/o');
  assert.deepEqual(calls[1], ['/b/edge-tts', ['--voice', 'uk-UA-OstapNeural', '--rate=+0%', '--text', 'Так', '--write-media', '/o']]);
});

// ---------- Gemini ----------
const pcm = (seconds = 0.5, rate = 24000) => { const b = Buffer.alloc(Math.round(seconds * rate) * 2); for (let i = 0; i < b.length / 2; i++) b.writeInt16LE(Math.round(Math.sin(i / 6) * 9000), i * 2); return b; };
const okBody = (rate = 24000) => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: `audio/L16;codec=pcm;rate=${rate}`, data: pcm(0.5, rate).toString('base64') } }] } }] });
const reply = (status, body) => ({ ok: status < 300, status, json: async () => body });

test('pcmToMp3: сирий PCM → MP3; непарний байт не ламає', () => {
  const mp3 = pcmToMp3(pcm(1));
  assert.equal(mp3[0], 0xff);
  assert.ok(mp3.length > 3000 && mp3.length < 9000, String(mp3.length));
  assert.equal(pcmToMp3(new Uint8Array(Buffer.concat([pcm(0.2), Buffer.from([1])])))[0], 0xff);
});

test('retryDelay: береться з RetryInfo, інакше експоненційно з межею', () => {
  assert.equal(retryDelay({ error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37s' }] } }, 0), 37500);
  assert.equal(retryDelay({}, 0), 2000);
  assert.equal(retryDelay(null, 3), 16000);
  assert.equal(retryDelay({ error: { details: [{ '@type': 'x' }] } }, 10), 60000);
  assert.equal(retryDelay({ error: { details: [{ retryDelay: '5s' }] } }, 1), 4000, 'деталь без @type — не RetryInfo');
});

test('geminiEngine: правильний запит (голос, стиль, ключ у заголовку) і MP3 з потрібною частотою', async () => {
  let req, file;
  const eng = geminiEngine({ key: 'K', voice: 'Puck', model: 'gemini-2.5-flash-preview-tts', fetch: async (url, init) => { req = { url, init }; return reply(200, okBody(22050)); }, writeFile: (f, b) => (file = { f, b }) });
  assert.equal(await eng({ id: 'q', text: 'Привіт!' }, '/o/q.mp3'), null);
  assert.match(req.url, /models\/gemini-2\.5-flash-preview-tts:generateContent$/);
  assert.equal(req.init.headers['x-goog-api-key'], 'K');
  assert.ok(!req.url.includes('K'), 'ключ не в адресі');
  const body = JSON.parse(req.init.body);
  assert.equal(body.contents[0].parts[0].text, `Прочитай українською ${GEMINI_STYLE}: Привіт!`);
  assert.deepEqual(body.generationConfig.responseModalities, ['AUDIO']);
  assert.equal(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Puck');
  assert.equal(file.f, '/o/q.mp3'); assert.equal(file.b[0], 0xff);
});

test('geminiRequest: 2.x — стиль у тексті; 3.x — текст дослівно, стиль у speech_metadata, голос у voice', () => {
  const old = geminiRequest('Питання?', { voice: 'Kore', model: 'gemini-2.5-pro-preview-tts' });
  assert.equal(old.contents[0].parts[0].text, `Прочитай українською ${GEMINI_STYLE}: Питання?`);
  assert.equal(old.contents[0].parts[0].speech_metadata, undefined);
  assert.deepEqual(old.generationConfig.speechConfig.voiceConfig, { prebuiltVoiceConfig: { voiceName: 'Kore' } });
  const neu = geminiRequest('Питання?', { voice: 'Kore', style: 'весело', model: 'gemini-3.8-flash-tts' });
  assert.deepEqual(neu.contents[0].parts[0], { text: 'Питання?', speech_metadata: { style: 'весело' } });
  assert.deepEqual(neu.generationConfig.speechConfig.voiceConfig, { voice: 'Kore' });
  assert.deepEqual(neu.generationConfig.responseModalities, ['AUDIO']);
  // за замовчуванням — модель GEMINI_MODEL і голос Achird
  assert.match(JSON.stringify(geminiRequest('x')), /Achird/);
});

test('geminiEngine: модель задається; WAV-відповідь 3.x кодується без заголовка, сирий PCM 2.5 — як PCM', async () => {
  const wav = makeWav({ seconds: 0.3, rate: 24000 });
  const out = [];
  const replyWith = (inlineData) => async (url) => { out.push(url); return reply(200, { candidates: [{ content: { parts: [{ inlineData }] } }] }); };
  const files = [];
  const write = (_f, b) => files.push(b);
  await geminiEngine({ key: 'K', model: 'gemini-3.8-flash-tts', writeFile: write, fetch: replyWith({ mimeType: 'audio/wav', data: wav.toString('base64') }) })({ id: 'a', text: 'x' }, '/o/a.mp3');
  assert.match(out[0], /models\/gemini-3\.8-flash-tts:generateContent$/);
  assert.deepEqual(files[0], wavToMp3(wav, 48), 'WAV з mimeType — через wavToMp3');
  // без mimeType, але з підписом RIFF — теж WAV
  await geminiEngine({ key: 'K', writeFile: write, fetch: replyWith({ data: wav.toString('base64') }) })({ id: 'b', text: 'x' }, '/o/b.mp3');
  assert.deepEqual(files[1], wavToMp3(wav, 48));
  const raw = pcm(0.3);
  await geminiEngine({ key: 'K', writeFile: write, fetch: replyWith({ mimeType: 'audio/L16;codec=pcm;rate=24000', data: raw.toString('base64') }) })({ id: 'c', text: 'x' }, '/o/c.mp3');
  assert.deepEqual(files[2], pcmToMp3(raw, 24000));
});

test('geminiEngine: 429 — чекає й повторює; вичерпав спроби чи інша помилка — зрозуміле повідомлення', async () => {
  const waits = [], logs = [];
  let n = 0;
  const eng = geminiEngine({ key: 'K', retries: 2, sleep: async (ms) => waits.push(ms), log: (m) => logs.push(m), writeFile() {},
    fetch: async () => (++n < 3 ? reply(429, { error: { details: [{ '@type': 'RetryInfo', retryDelay: '2s' }] } }) : reply(200, okBody())) });
  await eng({ id: 'q', text: 'x' }, '/o');
  assert.deepEqual(waits, [2500, 2500]); assert.equal(logs.length, 2);
  const always429 = geminiEngine({ key: 'K', retries: 1, sleep: async () => {}, writeFile() {}, fetch: async () => reply(429, { error: { message: 'Quota exceeded' } }) });
  await assert.rejects(always429({ id: 'q', text: 'x' }, '/o'), /429: Quota exceeded/);
  const bad = geminiEngine({ key: 'K', writeFile() {}, fetch: async () => ({ ok: false, status: 500, json: async () => { throw new Error('not json'); } }) });
  await assert.rejects(bad({ id: 'q', text: 'x' }, '/o'), /500/);
  const silent = geminiEngine({ key: 'K', writeFile() {}, fetch: async () => reply(200, { candidates: [{ content: { parts: [{ text: 'sorry' }] } }] }) });
  await assert.rejects(silent({ id: 'q', text: 'x' }, '/o'), /не повернув звуку/);
  const noRate = geminiEngine({ key: 'K', writeFile: (f, b) => assert.equal(b[0], 0xff), fetch: async () => reply(200, { candidates: [{ content: { parts: [{ inlineData: { data: pcm(0.2).toString('base64') } }] } }] }) });
  await noRate({ id: 'q', text: 'x' }, '/o');
  assert.throws(() => geminiEngine({ fetch() {}, writeFile() {} }), /GEMINI_API_KEY/);
});

test('geminiEngine: денний ліміт і надто довге очікування — одразу зупиняється з поясненням', async () => {
  const daily = { error: { details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }, { '@type': 'RetryInfo', retryDelay: '40518s' }] } };
  assert.equal(isDailyQuota(daily), true);
  assert.equal(isDailyQuota({ error: { details: [{ violations: [{ quotaId: 'PerMinute' }] }, { violations: [{}] }, {}] } }), false);
  assert.equal(isDailyQuota(null), false);
  let slept = 0;
  const eng = geminiEngine({ key: 'K', sleep: async () => slept++, writeFile() {}, fetch: async () => reply(429, daily) });
  await assert.rejects(eng({ id: 'q', text: 'x' }, '/o'), (e) => e.fatal && /денний ліміт Gemini для gemini-3\.8-flash-tts\. Ліміт скинеться приблизно через 676 хв/.test(e.message));
  // Tier 1: у відповіді є quotaValue — показуємо його
  const tier1 = { error: { details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel', quotaValue: '100' }] }, { '@type': 'RetryInfo', retryDelay: '669s' }] } };
  const eng1 = geminiEngine({ key: 'K', writeFile() {}, fetch: async () => reply(429, tier1) });
  await assert.rejects(eng1({ id: 'q', text: 'x' }, '/o'), /\(100 запитів на добу\).*через 12 хв/);
  const long = geminiEngine({ key: 'K', maxWait: 1000, sleep: async () => slept++, writeFile() {}, fetch: async () => reply(429, { error: { details: [{ '@type': 'RetryInfo', retryDelay: '300s' }] } }) });
  await assert.rejects(long({ id: 'q', text: 'x' }, '/o'), (e) => e.fatal && /зачекати 5 хв/.test(e.message));
  assert.equal(slept, 0, 'марно не чекає');
});

test('geminiEngine: значення за замовчуванням (модель 3.8 і голос Achird, справжній sleep)', async () => {
  let body;
  let n = 0;
  const eng = geminiEngine({ key: 'K', writeFile() {}, fetch: async (_u, init) => { body = JSON.parse(init.body); return ++n === 1 ? reply(429, { error: { details: [{ '@type': 'RetryInfo', retryDelay: '0s' }] } }) : reply(200, okBody()); } });
  await eng({ id: 'q', text: 'x' }, '/o');
  assert.deepEqual(body.generationConfig.speechConfig.voiceConfig, { voice: 'Achird' });
  assert.equal(body.contents[0].parts[0].text, 'x', '3.8 — текст дослівно');
});

test('azureEngine: правильний запит і запис файлу; помилка сервера — зрозуміла', async () => {
  let req, written;
  const ok = azureEngine({
    key: 'K', region: 'westeurope',
    fetch: async (url, init) => { req = { url, init }; return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }; },
    writeFile: (f, b) => { written = { f, len: b.length }; },
  });
  assert.equal(await ok({ id: 'q', text: 'Так' }, '/o/q.mp3'), null);
  assert.equal(req.url, 'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
  assert.equal(req.init.headers['Ocp-Apim-Subscription-Key'], 'K');
  assert.match(req.init.headers['X-Microsoft-OutputFormat'], /mono-mp3/);
  assert.match(req.init.body, /Так/);
  assert.deepEqual(written, { f: '/o/q.mp3', len: 3 });
  const bad = azureEngine({ key: 'K', region: 'r', fetch: async () => ({ ok: false, status: 401, text: async () => 'Unauthorized' }), writeFile() {} });
  await assert.rejects(bad({ id: 'q', text: 'x' }, '/o'), /401: Unauthorized/);
  assert.throws(() => azureEngine({ region: 'r' }), /AZURE_SPEECH_KEY/);
});

test('runJobs: фатальна помилка (ліміт на добу) зупиняє решту — не перебирає марно всі питання', async () => {
  let calls = 0;
  const engine = async (job) => { calls++; if (job.id === 'b') throw fatal('ліміт'); return null; };
  const r = await runJobs([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], engine, { outFile: (id) => id });
  assert.deepEqual(r, { done: ['a'], failed: [{ id: 'b', error: 'ліміт' }], stopped: ['c', 'd'] });
  assert.equal(calls, 2);
});

test('runJobs: помилка одного не зупиняє решту, тимчасові файли прибираються', async () => {
  const cleaned = [], logs = [];
  const engine = async (job) => { if (job.id === 'b') throw new Error('бах'); return job.id === 'a' ? '/tmp/a.wav' : null; };
  const r = await runJobs([{ id: 'a' }, { id: 'b' }, { id: 'c' }], engine, { outFile: (id) => id, cleanup: (f) => cleaned.push(f), log: (m) => logs.push(m) });
  assert.deepEqual(r, { done: ['a', 'c'], failed: [{ id: 'b', error: 'бах' }], stopped: [] });
  assert.deepEqual(cleaned, ['/tmp/a.wav']);
  assert.equal(logs.length, 3);
  assert.deepEqual(await runJobs([{ id: 'z' }], async () => null, { outFile: (x) => x }), { done: ['z'], failed: [], stopped: [] });
  assert.deepEqual(await runJobs([{ id: 'w' }], async () => '/tmp/w.wav', { outFile: (x) => x }), { done: ['w'], failed: [], stopped: [] }, 'без cleanup — тимчасовий файл просто лишається');
});

// ---------- аргументи й .env ----------

test('parseArgs', () => {
  assert.deepEqual(parseArgs([]), { engine: 'edge', voice: null, model: null, speaker: null, force: false, stressed: false, batch: false, only: null, list: false, out: null });
  assert.equal(parseArgs(['--engine', 'gemini', '--out', '/tmp/s']).out, '/tmp/s');
  assert.deepEqual(parseArgs(['--engine', 'azure', '--force', '--only', 'a,b', '--list', '--speaker', '1', '--voice', 'uk-UA-OstapNeural']),
    { engine: 'azure', voice: 'uk-UA-OstapNeural', model: null, speaker: 1, force: true, stressed: false, batch: false, only: ['a', 'b'], list: true, out: null });
  assert.equal(parseArgs(['--engine', 'piper']).engine, 'piper');
  assert.throws(() => parseArgs(['--speaker', 'x']), /номер голосу/);
  assert.equal(parseArgs(['--model', 'x.onnx']).model, 'x.onnx');
  assert.deepEqual(parseArgs(['--only']).only, []);
  assert.throws(() => parseArgs(['--engine', 'gtts']), /Невідомий рушій/);
  assert.throws(() => parseArgs(['--what']), /Невідомий аргумент/);
});

test('parseEnv', () => {
  assert.deepEqual(parseEnv('# коментар\nAZURE_SPEECH_KEY="abc"\n AZURE_SPEECH_REGION = westeurope \nBAD LINE\nX=\'1\''),
    { AZURE_SPEECH_KEY: 'abc', AZURE_SPEECH_REGION: 'westeurope', X: '1' });
  assert.deepEqual(parseEnv(undefined), {});
});

test('listenMode: файл має перевагу, голос — лише якщо ввімкнено й є український', () => {
  const ids = new Set(['a']);
  assert.equal(listenMode('a', { ids, voiceOn: false, voice: null }), 'file');
  assert.equal(listenMode('b', { ids, voiceOn: true, voice: {} }), 'voice');
  assert.equal(listenMode('b', { ids, voiceOn: true, voice: null }), null);
  assert.equal(listenMode('b', { ids, voiceOn: false, voice: {} }), null);
  assert.equal(listenMode('b', {}), null);
});

test('playQuestion: файл — Audio з правильною адресою, стоп ставить на паузу', async () => {
  const made = [];
  let ended = 0;
  const deps = { base: '/', onend: () => ended++, synth: { cancel() { this.c = (this.c || 0) + 1; } },
    makeAudio: (url) => { const a = { url, paused: false, play: () => Promise.reject(new Error('NotAllowed')), pause() { this.paused = true; } }; made.push(a); return a; } };
  const stop = playQuestion({ id: 'gs-01', text: 'x' }, 'file', deps);
  assert.equal(made[0].url, '/audio/gs-01.mp3');
  assert.equal(deps.synth.c, 1, 'спершу зупиняє голос браузера');
  stop(); assert.equal(made[0].paused, true);
  await new Promise((r) => setTimeout(r, 0)); // відмова play() не стає необробленою помилкою
  assert.equal(ended, 1, 'відмова play() — кнопка перестає «грати»');
  assert.equal(made[0].onended, deps.onend);
});

test('playQuestion: голос браузера — український, трохи повільніше, текст без дужок', () => {
  const spoken = [];
  class Utterance { constructor(t) { this.text = t; } }
  const synth = { speak: (u) => spoken.push(u), cancel() { this.c = (this.c || 0) + 1; } };
  const onend = () => {};
  const stop = playQuestion({ id: 'q', text: "чи з'їв(ла) б?" }, 'voice', { synth, Utterance, voice: { name: 'Lesya' }, onend });
  assert.equal(spoken[0].onend, onend);
  assert.equal(spoken[0].text, "Чи з'їв б?"); assert.equal(spoken[0].lang, 'uk-UA');
  assert.equal(spoken[0].voice.name, 'Lesya'); assert.ok(spoken[0].rate < 1);
  stop(); assert.equal(synth.c, 2);
});

test('playQuestion: без режиму — нічого, і без synth не падає', () => {
  const stop = playQuestion({ id: 'q', text: 'x' }, null, {});
  stop();
  const a = playQuestion({ id: 'q', text: 'x' }, 'file', { makeAudio: () => ({}) });
  a();
});

test('playQuestion: без onend теж працює (голос і файл, що не відтворився)', async () => {
  class Utterance { constructor(t) { this.text = t; } }
  const synth = { speak: (u) => { synth.u = u; }, cancel() {} };
  playQuestion({ id: 'q', text: 'x' }, 'voice', { synth, Utterance, voice: {} });
  assert.equal(synth.u.onend, null);
  playQuestion({ id: 'q', text: 'x' }, 'file', { makeAudio: () => ({ play: () => Promise.reject(new Error('x')) }) });
  await new Promise((r) => setTimeout(r, 0));
});


test('vite-плагін: virtual:audio-ids містить id з теки озвучки', () => {
  const dir = mkdtempSync(join(tmpdir(), 'audio-'));
  wf(join(dir, 'gs-01.mp3'), ''); wf(join(dir, 'am-02.mp3'), ''); wf(join(dir, 'note.txt'), '');
  const p = audioIdsPlugin(dir);
  const resolved = p.resolveId(VIRTUAL_ID);
  assert.ok(resolved.startsWith('\0'));
  assert.equal(p.resolveId('other'), null);
  assert.equal(p.load('other'), null);
  assert.equal(p.load(resolved), 'export default ["am-02","gs-01"];');
  rmSync(dir, { recursive: true });
  assert.equal(audioIdsPlugin(join(dir, 'nope')).load(resolved), 'export default [];');
});

test('vite-плагін: E2E_AUDIO_IDS підміняє список (лише для e2e)', () => {
  const p = audioIdsPlugin('/nope', { readdirSync: () => ['real.mp3'] }, 'gs-02,gs-01,');
  assert.equal(p.load(p.resolveId(VIRTUAL_ID)), 'export default ["gs-01","gs-02"];');
});

test('vite-плагін у dev: зміна в теці озвучки інвалідує модуль, інші файли — ні', () => {
  const dir = '/proj/public/audio';
  const p = audioIdsPlugin(dir, { readdirSync: () => [] });
  let handler, added, invalidated = 0;
  const mod = {};
  const server = {
    watcher: { add: (d) => (added = d), on: (_e, f) => (handler = f) },
    moduleGraph: { getModuleById: (id) => (id.startsWith('\0') ? (server.has ? mod : null) : null), invalidateModule: () => invalidated++ },
    has: true,
  };
  p.configureServer(server);
  assert.equal(added, dir);
  handler('add', '/proj/src/App.svelte'); assert.equal(invalidated, 0);
  handler('add', '/proj/public/audio/x.mp3'); assert.equal(invalidated, 1);
  server.has = false; handler('add', '/proj/public/audio/y.mp3'); assert.equal(invalidated, 1);
});

const A = '\u0301';
const DICT = { 'фарбу': `фа${A}рбу`, 'замок': `замо${A}к` };

test('applyPronunciation: лише цілі слова зі словника, регістр першої літери зберігається', () => {
  assert.equal(applyPronunciation('Хто купив фарбу?', DICT), `Хто купив фа${A}рбу?`);
  assert.equal(applyPronunciation('Фарбу! ЗАМОК і замок', DICT), `Фа${A}рбу! Замо${A}к і замо${A}к`);
  assert.equal(applyPronunciation('фарбувати замками', DICT), 'фарбувати замками', 'частини слів не чіпаємо');
  assert.equal(applyPronunciation('Без словника'), 'Без словника');
  assert.equal(applyPronunciation("м'ята", { "м'ята": `м'я${A}та` }), `м'я${A}та`, 'апостроф — частина слова');
});

test('checkPronunciation: рівно один наголос після голосної, те саме слово, ключ малими', () => {
  assert.deepEqual(checkPronunciation(DICT), []);
  const errs = checkPronunciation({ 'Фарбу': `фа${A}рбу`, 'фарба': `фа${A}рбу`, 'кіт': 'кіт', 'мама': `ма${A}ма${A}`, 'сон': `с${A}он`, [`то${A}`]: `то${A}` });
  assert.equal(errs.length, 6);
  assert.match(errs[0], /малими/); assert.match(errs[1], /інше слово/); assert.match(errs[2], /рівно один.*0/);
  assert.match(errs[3], /рівно один.*2/); assert.match(errs[4], /після голосної/); assert.match(errs[5], /без наголосу/);
});

test('stressedIds і planJobs --stressed: лише питання зі словами зі словника, навіть якщо файл уже є', () => {
  const qs = [{ id: 'a', text: 'Хто купив фарбу?' }, { id: 'b', text: 'Хто спить?' }, { id: 'c', text: 'Де замок?' }];
  assert.deepEqual(stressedIds(qs, DICT), ['a', 'c']);
  assert.deepEqual(stressedIds(qs), []);
  const jobs = planJobs(qs, new Set(['a', 'b', 'c']), { stressed: true, dict: DICT });
  assert.deepEqual(jobs.map((j) => j.id), ['a', 'c']);
  assert.equal(jobs[0].text, `Хто купив фа${A}рбу?`);
  // звичайний запуск теж ставить наголоси в нових файлах
  assert.equal(planJobs(qs, new Set(['b', 'c']), { dict: DICT })[0].text, `Хто купив фа${A}рбу?`);
  assert.equal(parseArgs(['--stressed']).stressed, true);
});

test('src/data/pronunciation.json: словник без помилок', async () => {
  const { readFileSync } = await import('node:fs');
  const { words } = JSON.parse(readFileSync(new URL('../src/data/pronunciation.json', import.meta.url), 'utf8'));
  assert.equal(typeof words, 'object');
  assert.deepEqual(checkPronunciation(words), []);
});

// ---- Gemini Batch ----
const wavPart = (sec = 0.2) => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: makeWav({ seconds: sec, rate: 24000 }).toString('base64') } }] } }] });
const json = (status, body) => ({ ok: status < 400, status, json: async () => body, text: async () => body });
function batchApi({ final, polls = [], download } = {}) {
  const calls = [];
  let k = 0;
  const fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method, body: init.body && JSON.parse(init.body), key: init.headers?.['x-goog-api-key'] });
    if (url.includes(':batchGenerateContent')) return json(200, { name: 'batches/b1', metadata: { state: 'BATCH_STATE_PENDING' } });
    if (url.includes(':download')) return download();
    return json(200, k < polls.length ? polls[k++] : final);
  };
  return { fetch, calls };
}

test('geminiBatch: одне завдання на всі питання, опитування до кінця, файли й помилки по кожному питанню', async () => {
  const final = { name: 'batches/b1', done: true, metadata: { state: 'BATCH_STATE_SUCCEEDED', output: { inlinedResponses: { inlinedResponses: [
    { metadata: { key: 'a' }, response: wavPart() },
    { metadata: { key: 'b' }, error: { message: 'зламалось' } },
    { metadata: { key: 'd' }, error: {} },
  ] } } } };
  const { fetch, calls } = batchApi({ final, polls: [{ name: 'batches/b1', metadata: { state: 'BATCH_STATE_RUNNING', batchStats: { requestCount: '4' } } }, { name: 'batches/b1', metadata: { state: 'BATCH_STATE_RUNNING' } }] });
  const files = {}, logs = [];
  let slept = 0;
  const jobs = [{ id: 'a', text: 'Перше?' }, { id: 'b', text: 'Друге?' }, { id: 'c', text: 'Третє?' }, { id: 'd', text: 'Четверте?' }];
  const r = await geminiBatch(jobs, { key: 'K', fetch, writeFile: (f, b) => (files[f] = b), outFile: (id) => `/o/${id}.mp3`, sleep: async () => slept++, log: (m) => logs.push(m) });
  assert.match(calls[0].url, /models\/gemini-3\.8-flash-tts:batchGenerateContent$/);
  assert.equal(calls[0].method, 'POST'); assert.equal(calls[0].key, 'K');
  const reqs = calls[0].body.batch.input_config.requests.requests;
  assert.deepEqual(reqs.map((x) => x.metadata.key), ['a', 'b', 'c', 'd']);
  assert.deepEqual(reqs[0].request, geminiRequest('Перше?'));
  assert.ok(calls.slice(1).every((c) => c.url.endsWith('/v1beta/batches/b1') && c.method === 'GET'));
  assert.equal(slept, 3);
  assert.deepEqual(r.done, ['a']);
  assert.deepEqual(r.failed, [{ id: 'b', error: 'зламалось' }, { id: 'd', error: 'помилка' }, { id: 'c', error: 'немає відповіді в пакеті' }]);
  assert.deepEqual(r.stopped, []);
  assert.deepEqual(files['/o/a.mp3'], geminiMp3(wavPart()));
  assert.ok(logs.some((m) => /готово 0 з 4/.test(m)));
  assert.ok(logs.some((m) => m === '… BATCH_STATE_RUNNING'));
});

test('geminiBatch: великий результат файлом JSONL; результат у response; порожній результат', async () => {
  const fileFinal = { name: 'batches/b1', done: true, metadata: { state: 'BATCH_STATE_SUCCEEDED', output: { responsesFile: 'files/out1' } } };
  const lines = [JSON.stringify({ key: 'a', response: wavPart() }), JSON.stringify({ key: 'b', error: { message: 'x' } }), ''].join('\n');
  const okApi = batchApi({ final: fileFinal, download: async () => json(200, lines) });
  const files = {};
  const opts = { key: 'K', writeFile: (f, b) => (files[f] = b), outFile: (id) => id, sleep: async () => {} };
  const r = await geminiBatch([{ id: 'a', text: 'x' }, { id: 'b', text: 'y' }], { ...opts, fetch: okApi.fetch });
  assert.match(okApi.calls.at(-1).url, /\/download\/v1beta\/files\/out1:download\?alt=media$/);
  assert.deepEqual(r.done, ['a']); assert.deepEqual(r.failed, [{ id: 'b', error: 'x' }]);
  const badApi = batchApi({ final: fileFinal, download: async () => json(500, '') });
  await assert.rejects(geminiBatch([{ id: 'a', text: 'x' }], { ...opts, fetch: badApi.fetch }), /результат пакета: 500/);
  // інше розташування результату (op.response)
  const respApi = batchApi({ final: { name: 'batches/b1', done: true, metadata: { state: 'BATCH_STATE_SUCCEEDED' }, response: { inlinedResponses: { inlinedResponses: [{ metadata: { key: 'a' }, response: wavPart() }] } } } });
  assert.deepEqual((await geminiBatch([{ id: 'a', text: 'x' }], { ...opts, fetch: respApi.fetch })).done, ['a']);
  const emptyApi = batchApi({ final: { name: 'batches/b1', done: true, metadata: { state: 'BATCH_STATE_SUCCEEDED' } } });
  assert.deepEqual((await geminiBatch([{ id: 'a', text: 'x' }], { ...opts, fetch: emptyApi.fetch })).failed, [{ id: 'a', error: 'немає відповіді в пакеті' }]);
});

test('geminiBatch: пакет не вдався, помилка API, задовго, без ключа; значення за замовчуванням', async () => {
  const opts = { key: 'K', writeFile() {}, outFile: (id) => id, sleep: async () => {} };
  const failedApi = batchApi({ final: { name: 'batches/b1', done: true, metadata: { state: 'BATCH_STATE_FAILED' } } });
  await assert.rejects(geminiBatch([{ id: 'a', text: 'x' }], { ...opts, fetch: failedApi.fetch }), /Пакет не вдався: BATCH_STATE_FAILED$/);
  const errApi = batchApi({ final: { name: 'batches/b1', done: true, error: { message: 'квота' }, metadata: { state: 'BATCH_STATE_SUCCEEDED' } } });
  await assert.rejects(geminiBatch([{ id: 'a', text: 'x' }], { ...opts, fetch: errApi.fetch }), /квота/);
  const down = async () => ({ ok: false, status: 503, json: async () => { throw new Error('not json'); } });
  await assert.rejects(geminiBatch([{ id: 'a', text: 'x' }], { ...opts, fetch: down }), /Gemini Batch відповів 503: $/);
  const forbidden = async () => json(403, { error: { message: 'немає доступу' } });
  await assert.rejects(geminiBatch([{ id: 'a', text: 'x' }], { ...opts, fetch: forbidden }), /403: немає доступу/);
  const slow = batchApi({ final: { name: 'batches/b1', metadata: { state: 'BATCH_STATE_RUNNING' } } });
  await assert.rejects(geminiBatch([{ id: 'a', text: 'x' }], { ...opts, fetch: slow.fetch, maxPolls: 2, poll: 60000 }), /не готовий після 2 хв/);
  await assert.rejects(geminiBatch([], { writeFile() {}, outFile() {}, fetch() {} }), /GEMINI_API_KEY/);
  // справжній sleep (poll: 0) і log за замовчуванням
  const quick = batchApi({ final: { name: 'batches/b1', done: true, metadata: { state: 'BATCH_STATE_SUCCEEDED', output: { inlinedResponses: { inlinedResponses: [{ metadata: { key: 'a' }, response: wavPart() }] } } } } });
  assert.deepEqual((await geminiBatch([{ id: 'a', text: 'x' }], { key: 'K', fetch: quick.fetch, writeFile() {}, outFile: (id) => id, poll: 0 })).done, ['a']);
  assert.equal(parseArgs(['--engine', 'gemini', '--batch']).batch, true);
  assert.throws(() => parseArgs(['--batch']), /лише з --engine gemini/);
});
