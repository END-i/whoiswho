import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seat, roles, fillText, newGame, finishCard, remaining, isUsed } from '../src/lib/state.js';

test('місця: ліворуч наступний, праворуч попередній, по колу', () => {
  assert.equal(seat('left', 3, 4), 0);
  assert.equal(seat('right', 0, 4), 3);
  assert.equal(seat('self', 2, 5), 2);
});

test('навпроти: при парному n — через половину, при непарному — наступний', () => {
  assert.equal(seat('opposite', 0, 4), 2);
  assert.equal(seat('opposite', 3, 6), 0);
  assert.equal(seat('opposite', 1, 5), 2);
  for (let n = 2; n <= 8; n++) for (let i = 0; i < n; i++) assert.notEqual(seat('opposite', i, n), i);
});

test('удвох усі ролі вказують на другого, pick підставляється сам', () => {
  for (const r of ['left', 'right', 'opposite', 'pick']) assert.equal(seat(r, 0, 2), 1);
  assert.equal(seat('pick', 0, 3), null);
});

test('ролі картки: about=answerer — про того, хто відповідає', () => {
  assert.deepEqual(roles({ answerer: 'opposite', about: 'self' }, 0, 4), { answerer: 2, about: 0 });
  assert.deepEqual(roles({ answerer: 'self', about: 'left' }, 1, 4), { answerer: 1, about: 2 });
  assert.deepEqual(roles({ answerer: 'pick', about: 'answerer' }, 0, 4), { answerer: null, about: null });
});

test('підстановка імен', () => {
  assert.equal(fillText('Що {about} любить?', { about: 'Оля' }), 'Що Оля любить?');
  assert.equal(fillText('Що {about} любить?', {}), 'Що … любить?');
});

test('картка: використаний номер не повторюється, хід переходить по колу', () => {
  const qs = [{ id: 'a', category: 'c' }, { id: 'b', category: 'c' }];
  let g = newGame({ players: ['A', 'B', 'C'], questions: qs });
  assert.equal(remaining(g, 'c'), 2);
  g = finishCard(g, 'c', 1, 'answered');
  assert.ok(isUsed(g, 'c', 1)); assert.equal(g.turn, 1); assert.equal(remaining(g, 'c'), 1);
  const same = finishCard(g, 'c', 1, 'answered');
  assert.equal(same, g, 'повторне закриття того самого номера нічого не змінює');
  g = finishCard(g, 'c', 2, 'skipped');
  assert.deepEqual(g.stats, { answered: 1, skipped: 1 });
  assert.equal(g.turn, 2);
});
