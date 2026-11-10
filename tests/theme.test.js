import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATEGORY_COLORS, categoryColor, playerColor, PLAYER_COLORS, initial, contrast, luminance, TOKENS, INK } from '../src/lib/theme.js';

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


test('контраст: відомі значення й перевірка формату', () => {
  assert.equal(contrast('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(contrast('#FFFFFF', '#FFFFFF'), 1);
  assert.equal(contrast('#777777', '#FFFFFF').toFixed(2), '4.48');
  assert.throws(() => luminance('red'), /#RRGGBB/);
});

test('WCAG AA: текст категорії має ≥ 4.5 з обома кінцями градієнта', () => {
  for (const [id, [c1, c2, text]] of Object.entries(CATEGORY_COLORS)) {
    assert.ok(contrast(text, c1) >= 4.5, `${id}: ${text} на ${c1} = ${contrast(text, c1).toFixed(2)}`);
    assert.ok(contrast(text, c2) >= 4.5, `${id}: ${text} на ${c2} = ${contrast(text, c2).toFixed(2)}`);
  }
});

test('WCAG AA: основний і другорядний текст ≥ 4.5 на тлі й картках в обох темах', () => {
  for (const [theme, t] of Object.entries(TOKENS)) for (const fg of ['ink', 'dim']) for (const bg of ['bg', 'card']) {
    assert.ok(contrast(t[fg], t[bg]) >= 4.5, `${theme}: ${fg} на ${bg} = ${contrast(t[fg], t[bg]).toFixed(2)}`);
  }
});

test('WCAG AA для великого жирного тексту: білий на кнопках ≥ 3', () => {
  for (const k of ['accent', 'ok', 'no']) assert.ok(contrast('#FFFFFF', TOKENS.light[k]) >= 3, k);
  assert.ok(contrast(INK, '#FFFFFF') >= 4.5);
});
