import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPINS, pickSpin, sectorAt, spinTarget } from '../src/lib/wheel.js';

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('sectorAt: колесо стоїть — під стрілкою сектор 0; повернули на крок назад — сектор 1', () => {
  assert.equal(sectorAt(0, 9), 0);
  assert.equal(sectorAt(-40 - 1, 9), 1);
  assert.equal(sectorAt(1, 9), 8); // трохи за годинниковою — під стрілкою вже останній
  assert.equal(sectorAt(-359.9999, 4), 3);
  assert.equal(sectorAt(720, 6), 0); // повні оберти нічого не змінюють
  assert.equal(sectorAt(0, 1), 0);
});

test('spinTarget: після будь-якого обертання під стрілкою саме той сектор, що вибрали', () => {
  const r = rng(7);
  for (let k = 0; k < 3000; k++) {
    const count = 1 + Math.floor(r() * 9);
    const index = Math.floor(r() * count);
    const from = (r() - 0.5) * 20000;
    const spin = SPINS[k % SPINS.length];
    const to = spinTarget(from, index, count, spin, r);
    assert.equal(sectorAt(to, count), index, JSON.stringify({ count, index, from, spin: spin.id }));
  }
});

test('spinTarget: завжди за годинниковою, не менше заданих обертів і хоч пів сектора', () => {
  const r = rng(3);
  for (const spin of SPINS) for (let k = 0; k < 300; k++) {
    const count = 2 + (k % 8), step = 360 / count, from = r() * 1000;
    const d = spinTarget(from, k % count, count, spin, r) - from;
    assert.ok(d >= spin.turns * 360 + step / 2 && d < (spin.turns + 1) * 360 + step / 2, `${spin.id}: ${d}`);
  }
});

test('spinTarget: зупиняється не точно в центрі, але далеко від межі сектора', () => {
  const step = 360 / 6;
  const at = (x) => { const a = ((-spinTarget(0, 2, 6, SPINS[0], () => x)) % 360 + 360) % 360; return a - 2 * step; };
  assert.ok(Math.abs(at(0.5) - step / 2) < 1e-9);       // посередині
  assert.ok(at(0) > step * 0.1 && at(0.9999) < step * 0.9); // краї — щонайменше 15% від межі
  assert.notEqual(at(0.1), at(0.9));
});

test('стилі обертання різні, «маленький круть» без повних обертів; pickSpin — будь-який зі стилів', () => {
  assert.equal(new Set(SPINS.map((s) => s.ms)).size, SPINS.length);
  assert.equal(SPINS.find((s) => s.id === 'nudge').turns, 0);
  assert.ok(SPINS.some((s) => /, 1\.\d+\)$/.test(s.ease)), 'є стиль із перескоком');
  assert.equal(pickSpin(() => 0), SPINS[0]);
  assert.equal(pickSpin(() => 0.9999999), SPINS.at(-1));
  assert.equal(pickSpin(() => 1), SPINS.at(-1)); // навіть якщо генератор повернув 1
  assert.ok(SPINS.includes(pickSpin()));
});
