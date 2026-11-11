import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate, paramsOf, cleanLang, LANGS, LANG_NAMES } from '../src/lib/i18n.js';
import { TYPES, ROLES } from '../src/lib/questions.js';
import { TEMPLATES } from '../src/lib/templates.js';
import uk from '../src/i18n/uk.js';
import ru from '../src/i18n/ru.js';

const DICTS = { uk, ru };

test('словники: однакові ключі, однакові параметри, множина — три форми, порожніх немає', () => {
  assert.deepEqual(Object.keys(ru).sort(), Object.keys(uk).sort());
  for (const [lang, d] of Object.entries(DICTS)) {
    for (const [k, v] of Object.entries(d)) {
      if (Array.isArray(v)) {
        assert.equal(v.length, 3, `${lang} ${k}: три форми множини`);
        assert.equal(Array.isArray(uk[k]), true, `${k}: множина в обох мовах`);
      } else assert.equal(typeof v, 'string', `${lang} ${k}`);
      assert.ok((Array.isArray(v) ? v : [v]).every((x) => x.trim()), `${lang} ${k}: порожньо`);
      assert.deepEqual(paramsOf(v), paramsOf(uk[k]), `${lang} ${k}: параметри як в uk`);
    }
  }
});

test('словники: є переклад для кожної ролі, типу картки, шаблону й групи шаблонів', () => {
  for (const d of Object.values(DICTS)) {
    for (const r of ROLES) assert.ok(d[`role.${r}`], `role.${r}`);
    for (const ty of TYPES) assert.ok(d[`type.${ty}`], `type.${ty}`);
    for (const tpl of TEMPLATES) assert.ok(d[`tpl.${tpl.id}`], `tpl.${tpl.id}`);
    for (const kind of new Set(TEMPLATES.map((x) => x.kind))) assert.ok(d[`photo.group.${kind}`], kind);
  }
});

test('translate: параметри, множина за n, невідомий параметр лишається, немає ключа — сам ключ', () => {
  const d = { hi: 'Привіт, {name}!', cards: ['{n} картка', '{n} картки', '{n} карток'], raw: 'a {x} b' };
  assert.equal(translate(d, 'hi', { name: 'Оля' }), 'Привіт, Оля!');
  assert.deepEqual([1, 3, 5, 11, 21].map((n) => translate(d, 'cards', { n })), ['1 картка', '3 картки', '5 карток', '11 карток', '21 картка']);
  assert.equal(translate(d, 'cards'), '{n} карток', 'без n — форма як для нуля, параметр не підставлено');
  assert.equal(translate(d, 'raw'), 'a {x} b');
  assert.equal(translate(d, 'nope'), 'nope');
  assert.deepEqual(paramsOf('{a} і {b}, знову {a}'), ['{a}', '{b}']);
  assert.deepEqual(paramsOf(['{n} x', '{n} y', 'z']), ['{n}']);
});

test('cleanLang: лише відомі мови, інакше українська; у кожної мови є назва', () => {
  assert.equal(cleanLang('ru'), 'ru');
  for (const bad of [undefined, 'en', '', null]) assert.equal(cleanLang(bad), 'uk');
  for (const l of LANGS) assert.ok(LANG_NAMES[l]);
});
