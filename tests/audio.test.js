import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { speechText, audioUrl, pickUkVoice, listenMode, playQuestion } from '../src/lib/speech.js';
import { listAudioIds, planJobs, ssml, piperEngine, azureEngine, runJobs, parseArgs, parseEnv, MP3_ARGS } from '../scripts/audio-lib.mjs';
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

test('piperEngine: piper отримує текст у stdin, ffmpeg робить моно MP3 32 кбіт/с', async () => {
  const calls = [];
  const eng = piperEngine({ model: 'm.onnx', run: async (...a) => calls.push(a), tmpWav: (id) => `/tmp/${id}.wav` });
  const tmp = await eng({ id: 'q1', text: 'Привіт' }, '/out/q1.mp3');
  assert.equal(tmp, '/tmp/q1.wav');
  assert.deepEqual(calls[0], ['piper', ['--model', 'm.onnx', '--output_file', '/tmp/q1.wav'], 'Привіт']);
  assert.equal(calls[1][0], 'ffmpeg');
  assert.deepEqual(calls[1][1].slice(-MP3_ARGS.length - 1), [...MP3_ARGS, '/out/q1.mp3']);
  assert.throws(() => piperEngine({ run() {}, tmpWav() {} }), /модель Piper/);
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

test('runJobs: помилка одного не зупиняє решту, тимчасові файли прибираються', async () => {
  const cleaned = [], logs = [];
  const engine = async (job) => { if (job.id === 'b') throw new Error('бах'); return job.id === 'a' ? '/tmp/a.wav' : null; };
  const r = await runJobs([{ id: 'a' }, { id: 'b' }, { id: 'c' }], engine, { outFile: (id) => id, cleanup: (f) => cleaned.push(f), log: (m) => logs.push(m) });
  assert.deepEqual(r, { done: ['a', 'c'], failed: [{ id: 'b', error: 'бах' }] });
  assert.deepEqual(cleaned, ['/tmp/a.wav']);
  assert.equal(logs.length, 3);
  assert.deepEqual(await runJobs([{ id: 'z' }], async () => null, { outFile: (x) => x }), { done: ['z'], failed: [] });
  assert.deepEqual(await runJobs([{ id: 'w' }], async () => '/tmp/w.wav', { outFile: (x) => x }), { done: ['w'], failed: [] }, 'без cleanup — тимчасовий файл просто лишається');
});

// ---------- аргументи й .env ----------

test('parseArgs', () => {
  assert.deepEqual(parseArgs([]), { engine: 'piper', model: null, force: false, only: null, list: false });
  assert.deepEqual(parseArgs(['--engine', 'azure', '--force', '--only', 'a,b', '--list']),
    { engine: 'azure', model: null, force: true, only: ['a', 'b'], list: true });
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
