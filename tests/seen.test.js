import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markSeen, freshQuestions, cleanSeen, MIN_FRESH } from '../src/lib/seen.js';

const qs = (cat, n, from = 1) => Array.from({ length: n }, (_, k) => ({ id: `${cat}-${k + from}`, category: cat }));

test('markSeen: додає один раз, окремо для кожного набору; без id — нічого', () => {
  let s = markSeen({}, 'family', 'a');
  s = markSeen(s, 'family', 'a');
  s = markSeen(s, 'friends', 'a');
  assert.deepEqual(s, { family: ['a'], friends: ['a'] });
  assert.equal(markSeen(s, 'family', null), s);
});

test('freshQuestions: у новій грі лише незіграні; інші набори й чужі питання не чіпає', () => {
  const all = [...qs('g', 6), ...qs('w', 5)];
  const seen = { family: ['g-1', 'g-2', 'kids-only'], couples: ['x'] };
  const r = freshQuestions(all, seen, 'family');
  assert.deepEqual(r.questions.map((q) => q.id), ['g-3', 'g-4', 'g-5', 'g-6', 'w-1', 'w-2', 'w-3', 'w-4', 'w-5']);
  assert.deepEqual(r.restarted, []);
  assert.deepEqual(r.seen, { family: ['g-1', 'g-2', 'kids-only'], couples: ['x'] }, 'питання іншої аудиторії лишаються зіграними');
});

test(`freshQuestions: менше ${MIN_FRESH} незіграних — категорія по колу, її зіграні забуваються`, () => {
  const all = [...qs('g', 5), ...qs('w', 4)];
  const seen = { family: ['g-1', 'g-2', 'g-3', 'w-1'] };
  const r = freshQuestions(all, seen, 'family');
  assert.deepEqual(r.restarted, ['g']);
  assert.deepEqual(r.questions.filter((q) => q.category === 'g').length, 5);
  assert.deepEqual(r.questions.filter((q) => q.category === 'w').map((q) => q.id), ['w-2', 'w-3', 'w-4']);
  assert.deepEqual(r.seen.family, ['w-1']);
  // усе зіграно — теж по колу
  const done = freshQuestions(qs('g', 4), { family: ['g-1', 'g-2', 'g-3', 'g-4'] }, 'family');
  assert.deepEqual(done.restarted, ['g']); assert.equal(done.questions.length, 4); assert.deepEqual(done.seen.family, []);
});

test('freshQuestions: маленька категорія без зіграних не «починається по колу»; порожній seen', () => {
  const r = freshQuestions(qs('k', 2), {}, 'family');
  assert.equal(r.questions.length, 2); assert.deepEqual(r.restarted, []); assert.deepEqual(r.seen, { family: [] });
  const one = freshQuestions(qs('k', 2), { family: ['k-1'] }, 'family');
  assert.deepEqual(one.restarted, ['k'], 'лишилось 1 з 2 — по колу');
  assert.equal(freshQuestions(qs('k', 4), {}, 'family', 10).questions.length, 4, 'поріг можна задати');
});

test('cleanSeen: лише списки рядків, без повторів; сміття — порожньо', () => {
  assert.deepEqual(cleanSeen({ family: ['a', 'a', 3, 'b'], bad: 'x', also: null }), { family: ['a', 'b'] });
  for (const raw of [null, undefined, 'x', [1], 5]) assert.deepEqual(cleanSeen(raw), {});
});
