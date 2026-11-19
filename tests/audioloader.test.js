import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudioLoader } from '../src/lib/audioloader.js';

// завантаження, що чекає, доки його не відпустять або не зупинять
function pending() {
  const runs = [];
  const run = (signal) => new Promise((resolve) => {
    const r = { signal, done: (v) => resolve(v) };
    signal.addEventListener('abort', () => resolve('зупинено'));
    runs.push(r);
  });
  return { runs, run };
}
const tick = () => new Promise((r) => setTimeout(r));

test('завантаження доходить до кінця: result і aborted = false, потім нічого не качається', async () => {
  const l = createAudioLoader();
  assert.equal(l.key, null);
  const p = l.start('uk|family', async () => 42);
  assert.equal(l.key, 'uk|family');
  assert.deepEqual(await p, { result: 42, aborted: false });
  assert.equal(l.key, null);
});

test('інший набір зупиняє попереднє завантаження й одразу починає нове (відгук 19.11)', async () => {
  const l = createAudioLoader();
  const { runs, run } = pending();
  const friends = l.start('uk|friends', run);
  await tick();
  const couples = l.start('uk|couples', run);
  await tick();
  assert.equal(runs.length, 2, 'нове почалось, не чекаючи старого');
  assert.equal(runs[0].signal.aborted, true);
  assert.equal(runs[1].signal.aborted, false);
  assert.equal(l.key, 'uk|couples');
  assert.deepEqual(await friends, { result: 'зупинено', aborted: true });
  runs[1].done(7);
  assert.deepEqual(await couples, { result: 7, aborted: false });
  assert.equal(l.key, null);
});

test('зупинене ще до старту (кілька перемикань поспіль) не починається зовсім', async () => {
  const l = createAudioLoader();
  const { runs, run } = pending();
  const friends = l.start('uk|friends', run);
  const couples = l.start('uk|couples', run);
  assert.deepEqual(await friends, { result: undefined, aborted: true });
  assert.equal(runs.length, 1);
  assert.equal(runs[0].signal.aborted, false);
  runs[0].done(3);
  assert.deepEqual(await couples, { result: 3, aborted: false });
});

test('той самий набір вдруге — те саме завантаження, друге не починається', async () => {
  const l = createAudioLoader();
  const { runs, run } = pending();
  const a = l.start('uk|family', run);
  const b = l.start('uk|family', run);
  assert.equal(a, b);
  await tick();
  assert.equal(runs.length, 1);
  runs[0].done(1);
  assert.deepEqual(await a, { result: 1, aborted: false });
});

test('туди й назад (друзі → пари → друзі): старе «друзі» зупинене й не чіпає нового', async () => {
  const l = createAudioLoader();
  const { runs, run } = pending();
  const first = l.start('uk|friends', run);
  await tick();
  l.start('uk|couples', run);
  await tick();
  const again = l.start('uk|friends', run);
  assert.notEqual(first, again);
  assert.deepEqual(await first, { result: 'зупинено', aborted: true });
  assert.equal(l.key, 'uk|friends', 'зупинене не скидає того, що качається зараз');
  await tick();
  assert.equal(runs.length, 3);
  runs[2].done(5);
  assert.deepEqual(await again, { result: 5, aborted: false });
});

test('stop: зупиняє поточне; без завантаження — нічого не ламає', async () => {
  const l = createAudioLoader();
  l.stop();
  const { run } = pending();
  const p = l.start('uk|family', run);
  await tick();
  l.stop();
  assert.equal(l.key, null);
  assert.deepEqual(await p, { result: 'зупинено', aborted: true });
});

test('помилка в завантаженні доходить до того, хто чекав, і звільняє чергу', async () => {
  const l = createAudioLoader();
  await assert.rejects(l.start('uk|family', async () => { throw new Error('мережа'); }), /мережа/);
  assert.equal(l.key, null);
});
