import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS, DEFAULT_DESIGN, cleanDesign } from '../src/lib/designs.js';
import uk from '../src/i18n/uk.js';
import ru from '../src/i18n/ru.js';

test('дизайни: K за замовчуванням, шість різних, кожен має назву обома мовами', () => {
  assert.equal(DEFAULT_DESIGN, 'k');
  assert.deepEqual(DESIGNS, ['k', 'g', 'h', 'j', 'e', 'f']);
  for (const d of DESIGNS) { assert.ok(uk[`design.${d}`], `uk ${d}`); assert.ok(ru[`design.${d}`], `ru ${d}`); }
});

test('cleanDesign: відомий лишається, невідомий чи порожній — K', () => {
  for (const d of DESIGNS) assert.equal(cleanDesign(d), d);
  for (const d of [undefined, null, '', 'x', 'K', 42]) assert.equal(cleanDesign(d), 'k');
});
