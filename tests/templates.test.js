import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, templateById } from '../src/lib/templates.js';

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
