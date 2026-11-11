import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tones, render, wav, playSfx, resetSfx, SFX_RATE } from '../src/lib/sfx.js';

test('tones: бал — три висхідні ноти; «ні» — дві вниз і сповзають; пропуск — короткий тихий шум', () => {
  const p = tones('point');
  assert.equal(p.length, 3);
  assert.ok(p[0].freq < p[1].freq && p[1].freq < p[2].freq, 'мелодія йде вгору');
  const m = tones('miss');
  assert.equal(m.length, 2);
  assert.ok(m[1].freq < m[0].freq, 'друга нота нижча');
  assert.ok(m.every((n) => n.slide < n.freq), 'кожна сповзає вниз');
  assert.ok(m.every((n) => n.slide >= 300), 'не нижче 300 Гц — чути на динаміку телефона');
  const s = tones('skip');
  assert.equal(s.length, 1); assert.equal(s[0].noise, true);
  assert.ok(s[0].gain < m[0].gain && s[0].dur < 0.2, 'тихий і короткий');
  assert.deepEqual(tones('nope'), []);
});

test('tones: таймер — коротке «тік» і подвійний сигнал наприкінці', () => {
  const t = tones('tick');
  assert.equal(t.length, 1); assert.ok(t[0].dur <= 0.06, 'тік короткий');
  const e = tones('end');
  assert.equal(e.length, 2); assert.ok(e[1].start > e[0].start + e[0].dur, 'два окремі сигнали');
  assert.ok(render('end').length > render('tick').length);
});

// домінантна частота відрізка — за кількістю переходів через нуль
const freqOf = (pcm, from, to) => {
  let z = 0;
  for (let i = from + 1; i < to; i++) if ((pcm[i - 1] < 0) !== (pcm[i] < 0)) z++;
  return (z / 2) / ((to - from) / SFX_RATE);
};

test('render: довжина за останньою нотою, частоти як у нотах, без перевантаження', () => {
  const pcm = render('point');
  assert.equal(pcm.length, Math.ceil(0.5 * SFX_RATE) + 1);
  const at = (t) => Math.floor(t * SFX_RATE);
  assert.ok(Math.abs(freqOf(pcm, at(0.01), at(0.09)) - 784) < 40);
  assert.ok(Math.abs(freqOf(pcm, at(0.25), at(0.4)) - 1319) < 60);
  assert.ok(Math.max(...pcm.map(Math.abs)) <= 32767);
  const miss = render('miss');
  assert.ok(freqOf(miss, at(0.25), at(0.35)) < freqOf(miss, at(0.01), at(0.1)), '«ва-ва» іде вниз');
  assert.deepEqual(render('skip'), render('skip'), 'шум детермінований');
  assert.ok(render('skip').some((v) => v !== 0));
  assert.equal(render('nope').length, 1);
});

test('wav: правильний заголовок PCM 16 біт моно', () => {
  const bytes = wav(Int16Array.of(1, -1, 300));
  const v = new DataView(bytes.buffer);
  const s = (o, n) => String.fromCharCode(...bytes.slice(o, o + n));
  assert.equal(s(0, 4), 'RIFF'); assert.equal(s(8, 4), 'WAVE'); assert.equal(s(36, 4), 'data');
  assert.equal(v.getUint32(4, true), 36 + 6);
  assert.equal(v.getUint16(22, true), 1); assert.equal(v.getUint32(24, true), SFX_RATE); assert.equal(v.getUint16(34, true), 16);
  assert.equal(v.getUint32(40, true), 6);
  assert.equal(v.getInt16(48, true), 300);
  assert.equal(bytes.length, 50);
});

class FakeAudio {
  static made = [];
  constructor(src) { this.src = src; this.dataset = {}; this.plays = 0; FakeAudio.made.push(this); }
  play() { this.plays++; return Promise.resolve(); }
}
const FakeURL = { createObjectURL: (blob) => `blob:${blob.size}:${blob.type}` };

test('playSfx: WAV через <audio>; плеєр на звук створюється раз і грає з початку', () => {
  resetSfx(); FakeAudio.made = [];
  assert.equal(playSfx('point', { Audio: FakeAudio, URL: FakeURL }), true);
  assert.equal(playSfx('point', { Audio: FakeAudio, URL: FakeURL }), true);
  assert.equal(playSfx('miss', { Audio: FakeAudio, URL: FakeURL }), true);
  assert.equal(FakeAudio.made.length, 2);
  const [p, m] = FakeAudio.made;
  assert.equal(p.plays, 2); assert.equal(p.currentTime, 0); assert.equal(p.dataset.sfx, 'point'); assert.equal(m.dataset.sfx, 'miss');
  assert.equal(p.src, `blob:${wav(render('point')).length}:audio/wav`);
});

test('playSfx: вимкнено, немає <audio>, невідомий звук, помилка чи заборона браузера — тиша без падіння', async () => {
  resetSfx();
  assert.equal(playSfx('point', { enabled: false, Audio: FakeAudio, URL: FakeURL }), false);
  assert.equal(playSfx('point', { Audio: undefined, URL: FakeURL }), false);
  assert.equal(playSfx('point', { Audio: FakeAudio, URL: {} }), false);
  assert.equal(playSfx('nope', { Audio: FakeAudio, URL: FakeURL }), false);
  assert.equal(playSfx('point', { Audio: class { constructor() { throw new Error('no'); } }, URL: FakeURL }), false);
  resetSfx();
  // браузер не дозволив (Promise відхилено) — помилка тихо ковтається
  const Rejecting = class extends FakeAudio { play() { return Promise.reject(new Error('NotAllowedError')); } };
  assert.equal(playSfx('skip', { Audio: Rejecting, URL: FakeURL }), true);
  await new Promise((r) => setTimeout(r, 0));
  resetSfx();
  // старі браузери: play() без Promise
  assert.equal(playSfx('skip', { Audio: class extends FakeAudio { play() {} }, URL: FakeURL }), true);
  resetSfx();
  // значення за замовчуванням — глобальні Audio/URL (у Node Audio немає)
  assert.equal(playSfx('point'), false);
});
