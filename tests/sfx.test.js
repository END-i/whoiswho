import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tones, playSfx, resetSfx } from '../src/lib/sfx.js';

class FakeCtx {
  static made = 0;
  constructor() { FakeCtx.made++; this.currentTime = 10; this.destination = {}; this.log = []; }
  resume() { this.resumed = true; }
  createOscillator() { const o = { frequency: {}, connect: () => {}, start: (t) => this.log.push(['start', o.frequency.value, t]), stop: () => {} }; return o; }
  createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => {} }; }
}

test('tones: бал — три висхідні ноти, «ні» — одна тиха й низька', () => {
  const p = tones('point');
  assert.equal(p.length, 3);
  assert.ok(p[0].freq < p[1].freq && p[1].freq < p[2].freq, 'мелодія йде вгору');
  const m = tones('miss');
  assert.equal(m.length, 1);
  assert.ok(m[0].freq < p[0].freq && m[0].gain < p[0].gain, 'тихіше й нижче');
  assert.deepEqual(tones('nope'), []);
});

test('playSfx: запускає ноти у правильний час; спільний контекст створюється один раз', () => {
  resetSfx(); FakeCtx.made = 0;
  assert.equal(playSfx('point', { AudioContextClass: FakeCtx }), 3);
  assert.equal(playSfx('miss', { AudioContextClass: FakeCtx }), 1);
  assert.equal(FakeCtx.made, 1);
  const ctx = new FakeCtx();
  playSfx('point', { ctx });
  assert.deepEqual(ctx.log.map(([, f, t]) => [f, +(t - 10).toFixed(2)]), [[784, 0], [988, 0.1], [1319, 0.2]]);
  assert.equal(ctx.resumed, true);
});

test('playSfx: вимкнено, немає Web Audio чи помилка — тиша без падіння', () => {
  resetSfx();
  assert.equal(playSfx('point', { enabled: false, AudioContextClass: FakeCtx }), 0);
  assert.equal(playSfx('point', { AudioContextClass: undefined }), 0);
  assert.equal(playSfx('point', { ctx: { currentTime: 0, createOscillator() { throw new Error('closed'); } } }), 0);
});
