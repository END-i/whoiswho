import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAll, saveAll, newId, KEY } from '../src/lib/storage.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

test('збереження й читання', () => {
  const s = memory();
  assert.equal(loadAll(s), null);
  assert.equal(saveAll({ a: 1, b: [1, 2] }, s), true);
  assert.deepEqual(loadAll(s), { a: 1, b: [1, 2] });
  assert.ok(s.m.has(KEY));
});

test('пошкоджений JSON чи не-обʼєкт — null, без падіння', () => {
  const s = memory();
  s.setItem(KEY, '{oops'); assert.equal(loadAll(s), null);
  s.setItem(KEY, '42'); assert.equal(loadAll(s), null);
  s.setItem(KEY, 'null'); assert.equal(loadAll(s), null);
});

test('сховище недоступне чи переповнене — гра не падає', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('QuotaExceeded'); } };
  assert.equal(loadAll(broken), null);
  assert.equal(saveAll({ a: 1 }, broken), false);
  assert.equal(loadAll(undefined), null);
});

test('newId: короткі й різні', () => {
  const set = new Set(Array.from({ length: 1000 }, newId));
  assert.equal(set.size, 1000);
  for (const id of set) assert.match(id, /^[a-z0-9]{4,10}$/);
});
