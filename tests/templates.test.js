import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, templateById, clampTpl, dragTpl, tplTransform, TPL_DEFAULT, migrateTemplate } from '../src/lib/templates.js';

test('шаблони: унікальні id, назви, вид fun/serious, обидва види є', () => {
  const ids = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of TEMPLATES) {
    assert.ok(t.name && t.svg.trim(), t.id);
    assert.ok(['fun', 'serious'].includes(t.kind), t.id);
  }
  assert.ok(TEMPLATES.some((t) => t.kind === 'fun') && TEMPLATES.some((t) => t.kind === 'serious'));
});

test('шаблони: безпечний SVG без скриптів, посилань і обробників подій', () => {
  for (const t of TEMPLATES) assert.doesNotMatch(t.svg, /<script|href=|on\w+=|javascript:/i, t.id);
});

test('шаблони: теги збалансовані (грубо) і без NaN у координатах', () => {
  for (const t of TEMPLATES) {
    assert.doesNotMatch(t.svg, /NaN|undefined/, t.id);
    const open = (t.svg.match(/<(g|text)\b/g) || []).length, close = (t.svg.match(/<\/(g|text)>/g) || []).length;
    assert.equal(open, close, t.id);
  }
});

test('templateById', () => {
  assert.equal(templateById('crown').name, 'Корона');
  assert.equal(templateById('nope'), undefined);
});

test('clampTpl: значення за замовчуванням, межі; розмір завжди 1 (повзунка більше немає)', () => {
  assert.deepEqual(clampTpl(undefined), { ...TPL_DEFAULT });
  assert.deepEqual(clampTpl('x'), { ...TPL_DEFAULT });
  assert.deepEqual(clampTpl({ x: 99, y: -99, s: 1.6 }), { x: 40, y: -40, s: 1 });
  assert.deepEqual(clampTpl({ x: NaN, y: 12.345, s: 0.1 }), { x: 0, y: 12.3, s: 1 });
});

test('dragTpl: пікселі переводяться у відсотки розміру й обмежуються', () => {
  assert.deepEqual(dragTpl({ x: 0, y: 0 }, 30, -15, 150), { x: 20, y: -10, s: 1 });
  assert.deepEqual(dragTpl({ x: 30, y: 0 }, 300, 0, 150), { x: 40, y: 0, s: 1 });
  assert.deepEqual(dragTpl({ x: 5 }, 10, 10, 0), { x: 5, y: 0, s: 1 }, 'розмір 0 — без зсуву');
});

test('tplTransform: лише зсув', () => {
  assert.equal(tplTransform({ x: 10, y: -5, s: 1.4 }), 'translate(10%, -5%)');
  assert.equal(tplTransform(null), 'translate(0%, 0%)');
});

test('«Гравець тижня» прибрано; збережений замінюється на зірку; невідомі — без шаблону', () => {
  assert.equal(templateById('week'), undefined);
  assert.equal(migrateTemplate('week'), 'star');
  assert.equal(migrateTemplate('crown'), 'crown');
  assert.equal(migrateTemplate('ghost'), null);
  assert.equal(migrateTemplate(null), null);
  assert.deepEqual(TEMPLATES.filter((t) => t.kind === 'serious').map((t) => t.id), ['star', 'wreath', 'sun', 'medal', 'polaroid', 'laurel']);
});

test('шаблони без тексту на кшталт «гравець тижня» — підходять для будь-якого дня', () => {
  for (const t of TEMPLATES) assert.doesNotMatch(t.svg, /<text/i, t.id);
});
