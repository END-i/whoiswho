import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareLines, shareImage } from '../src/lib/share.js';

test('shareLines: заголовок, місця з медалями й балами (до 8), підпис; без балів — без чисел', () => {
  const rows = [{ name: 'Оля', score: 60, place: 1 }, { name: 'Тарас', score: 20, place: 2 }, { name: 'Мама', score: 10, place: 3 }, { name: 'Тато', score: 0, place: 4 }];
  const l = shareLines(rows, { title: 'Хто є хто', footer: '11 листопада' });
  assert.deepEqual(l.map((x) => x.text), ['Хто є хто', '🥇 Оля', '🥈 Тарас', '🥉 Мама', '4. Тато', '11 листопада']);
  assert.equal(l[1].score, '60');
  assert.equal(shareLines(rows, { title: '', footer: '', scoring: false })[1].score, '');
  assert.equal(shareLines(Array.from({ length: 10 }, (_, k) => ({ name: `${k}`, score: 0, place: 1 })), { title: '', footer: '' }).length, 10);
});

test('shareImage: є меню «Поділитися» з файлами — ділимось; скасували — cancelled; немає — завантажуємо PNG', async () => {
  const blob = new Blob(['x'], { type: 'image/png' });
  const shared = [];
  const nav = { canShare: () => true, share: async (d) => shared.push(d.files[0].name) };
  assert.equal(await shareImage(blob, 'a.png', { navigator: nav }), 'shared');
  assert.deepEqual(shared, ['a.png']);
  assert.equal(await shareImage(blob, 'a.png', { navigator: { canShare: () => true, share: async () => { throw new Error('AbortError'); } } }), 'cancelled');
  const clicks = [];
  const doc = { body: { appendChild() {} }, createElement: () => ({ click() { clicks.push(this.download); }, remove() {} }) };
  assert.equal(await shareImage(blob, 'b.png', { navigator: {}, document: doc }), 'downloaded');
  assert.deepEqual(clicks, ['b.png']);
  assert.equal(await shareImage(blob, 'c.png', { navigator: undefined, document: doc }), 'downloaded');
});
