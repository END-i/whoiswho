import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORY_COLORS, categoryColor, playerColor, assignColors, PLAYER_COLORS, initial, contrast, luminance, TOKENS, INK } from '../src/lib/theme.js';

import { packFiles } from './packs.js';

test('кожна категорія кожного набору має свій колір, кольори не повторюються', () => {
  for (const [name, p] of Object.entries(packFiles)) for (const c of p.categories) assert.ok(CATEGORY_COLORS[c.id], `${name}: ${c.id}`);
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

test('assignColors: у кожного гравця свій колір; збережений лишається; зайнятий — перший вільний', () => {
  // id з однаковим кольором за хешем
  const same = []; for (let k = 0; same.length < 3; k++) if (playerColor(`p${k}`) === playerColor('p0')) same.push(`p${k}`);
  const out = assignColors(same.map((id) => ({ id })));
  assert.equal(new Set(out.map((p) => p.color)).size, 3);
  const eight = assignColors(Array.from({ length: 8 }, (_, k) => ({ id: same[0] + k, color: PLAYER_COLORS[0] })));
  assert.equal(new Set(eight.map((p) => p.color)).size, 8, '8 гравців — 8 різних кольорів');
  const kept = { id: 'x', color: PLAYER_COLORS[3] };
  assert.equal(assignColors([kept])[0], kept, 'не змінився — той самий об\'єкт');
  assert.equal(assignColors([{ id: 'y', color: 'red' }])[0].color, playerColor('y'), 'колір не з палітри — за id');
  const nine = assignColors(Array.from({ length: 9 }, (_, k) => ({ id: `n${k}` })));
  assert.ok(PLAYER_COLORS.includes(nine[8].color), 'палітра скінчилась — усе одно колір з палітри');
});

test('PLAYER_COLORS: кольори гравців помітно різні між собою (не два майже однакові помаранчеві)', () => {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (const [k, a] of PLAYER_COLORS.entries()) for (const b of PLAYER_COLORS.slice(k + 1)) {
    const d = Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
    assert.ok(d > 60, `${a} і ${b} надто схожі (${d.toFixed(0)})`);
  }
});
