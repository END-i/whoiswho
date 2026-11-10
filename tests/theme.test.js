import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATEGORY_COLORS, categoryColor, playerColor, PLAYER_COLORS, initial } from '../src/lib/theme.js';

const raw = JSON.parse(readFileSync(new URL('../src/data/questions.json', import.meta.url)));

test('кожна категорія з questions.json має свій колір, кольори не повторюються', () => {
  for (const c of raw.categories) assert.ok(CATEGORY_COLORS[c.id], c.id);
  const firsts = Object.values(CATEGORY_COLORS).map((p) => p[0]);
  assert.equal(new Set(firsts).size, firsts.length);
});

test('categoryColor: невідома категорія бере колір з палітри за номером, навіть від\'ємним', () => {
  assert.deepEqual(categoryColor('guess'), CATEGORY_COLORS.guess);
  const n = Object.keys(CATEGORY_COLORS).length;
  assert.deepEqual(categoryColor('new', 0), categoryColor('new', n));
  assert.ok(Array.isArray(categoryColor('new', -1)));
  assert.ok(Array.isArray(categoryColor('new')));
});

test('playerColor: стабільний для id, з палітри', () => {
  assert.equal(playerColor('abc'), playerColor('abc'));
  assert.ok(PLAYER_COLORS.includes(playerColor('xyz')));
  assert.ok(PLAYER_COLORS.includes(playerColor()));
  const spread = new Set(Array.from({ length: 50 }, (_, k) => playerColor(`p${k}`)));
  assert.ok(spread.size >= 5, 'кольори мають розподілятися');
});

test('initial: перша літера, велика; порожнє — «?»', () => {
  assert.equal(initial(' оля'), 'О');
  assert.equal(initial(''), '?');
  assert.equal(initial(null), '?');
});
