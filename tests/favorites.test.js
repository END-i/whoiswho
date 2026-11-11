import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleFavorite, favoriteQuestions, cleanFavorites } from '../src/lib/favorites.js';

test('toggleFavorite: позначити й зняти; оригінал не змінюється', () => {
  const a = [];
  const b = toggleFavorite(a, 'x');
  assert.deepEqual(b, ['x']); assert.deepEqual(a, []);
  assert.deepEqual(toggleFavorite(b, 'x'), []);
});

test('favoriteQuestions: лише позначені з цього набору, у порядку набору', () => {
  const qs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(favoriteQuestions(qs, ['c', 'zz', 'a']).map((q) => q.id), ['a', 'c']);
});

test('cleanFavorites: сміття — порожньо, повтори зникають', () => {
  assert.deepEqual(cleanFavorites(null), []);
  assert.deepEqual(cleanFavorites(['a', 1, 'a', 'b']), ['a', 'b']);
});
