import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachedCount, downloadAll, clearAudio, AUDIO_CACHE, megabytes } from '../src/lib/audiocache.js';

// Підставний Cache Storage
function fakeCaches() {
  const stores = new Map();
  return {
    stores,
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const m = stores.get(name);
      return { match: async (u) => m.get(u), put: async (u, r) => { m.set(u, r); } };
    },
    async delete(name) { return stores.delete(name); },
  };
}

test('downloadAll: качає все, прогрес після кожного файлу, повторно не качає', async () => {
  const caches = fakeCaches(), got = [], progress = [];
  const fetch = async (u) => { got.push(u); return { ok: true, url: u }; };
  const r = await downloadAll(['a', 'b'], { caches, fetch, onProgress: (d, t) => progress.push(`${d}/${t}`) });
  assert.deepEqual(r, { done: 2, total: 2, failed: 0 });
  assert.deepEqual(got, ['/audio/a.mp3', '/audio/b.mp3']);
  assert.deepEqual(progress, ['1/2', '2/2']);
  assert.ok(caches.stores.get(AUDIO_CACHE).has('/audio/a.mp3'));
  got.length = 0;
  assert.deepEqual(await downloadAll(['a', 'b', 'c'], { caches, fetch }), { done: 3, total: 3, failed: 0 });
  assert.deepEqual(got, ['/audio/c.mp3'], 'вже збережене не качається вдруге');
  assert.equal(await cachedCount(['a', 'b', 'c', 'd'], { caches }), 3);
});

test('downloadAll: обрив мережі й 404 не ламають решту і вже збережене', async () => {
  const caches = fakeCaches();
  const fetch = async (u) => {
    if (u.includes('b')) throw new TypeError('Failed to fetch');
    if (u.includes('c')) return { ok: false, status: 404 };
    return { ok: true };
  };
  assert.deepEqual(await downloadAll(['a', 'b', 'c', 'd'], { caches, fetch }), { done: 2, total: 4, failed: 2 });
  assert.equal(await cachedCount(['a', 'b', 'c', 'd'], { caches }), 2);
});

test('downloadAll: зупинка через AbortSignal', async () => {
  const caches = fakeCaches(), ctl = new AbortController();
  const fetch = async () => { ctl.abort(); return { ok: true }; };
  const r = await downloadAll(['a', 'b', 'c'], { caches, fetch, signal: ctl.signal });
  assert.deepEqual(r, { done: 1, total: 3, failed: 0 });
});

test('без Cache Storage чи файлів — нічого не робить і не падає', async () => {
  assert.deepEqual(await downloadAll(['a'], { fetch: async () => ({}) }), { done: 0, total: 1, failed: 0 });
  assert.deepEqual(await downloadAll([], { caches: fakeCaches(), fetch: async () => ({}) }), { done: 0, total: 0, failed: 0 });
  assert.deepEqual(await downloadAll(['a']), { done: 0, total: 1, failed: 0 });
  assert.equal(await cachedCount(['a'], {}), 0);
  assert.equal(await cachedCount([], { caches: fakeCaches() }), 0);
  assert.equal(await clearAudio({}), false);
});

test('clearAudio видаляє кеш озвучки; базовий шлях сайту враховується', async () => {
  const caches = fakeCaches();
  await downloadAll(['a'], { caches, fetch: async () => ({ ok: true }), base: '/game/' });
  assert.ok(caches.stores.get(AUDIO_CACHE).has('/game/audio/a.mp3'));
  assert.equal(await cachedCount(['a'], { caches, base: '/game/' }), 1);
  assert.equal(await clearAudio({ caches }), true);
  assert.equal(caches.stores.has(AUDIO_CACHE), false);
});

test('Cache Storage відмовляє (приватний режим, немає місця) — жодна функція не кидає помилку', async () => {
  const boom = () => Promise.reject(new Error('SecurityError'));
  const dead = { open: boom, delete: boom };
  assert.equal(await cachedCount(['a'], { caches: dead }), 0);
  assert.deepEqual(await downloadAll(['a', 'b'], { caches: dead, fetch: async () => ({ ok: true }) }), { done: 0, total: 2, failed: 2 });
  assert.equal(await clearAudio({ caches: dead }), false);
  // кеш відкрився, але match/put падають — рахуємо як невдачу й ідемо далі
  const half = { open: async () => ({ match: boom, put: boom }) };
  assert.equal(await cachedCount(['a'], { caches: half }), 0);
  assert.deepEqual(await downloadAll(['a', 'b'], { caches: half, fetch: async () => ({ ok: true }) }), { done: 0, total: 2, failed: 2 });
});

test('megabytes: розмір записів для підказки перед завантаженням', () => {
  const M = 1048576;
  assert.equal(megabytes(['a', 'b'], { a: 12 * M, b: 6.4 * M }), 18);
  assert.equal(megabytes(['a'], { a: 2.36 * M }), 2.4);
  assert.equal(megabytes(['a', 'x']), 0, 'розміри невідомі — 0');
});
