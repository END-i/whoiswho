import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate, paramsOf, cleanLang, LANGS, LANG_NAMES, LOCALES } from '../src/lib/i18n.js';
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
  for (const l of LANGS) assert.ok(LANG_NAMES[l] && LOCALES[l]?.startsWith(`${l}-`), l);
});

// Власник 23.11: гра не знає роду гравця й не відмінює імена — тексти мають читатися з будь-яким ім'ям.
test('словники й правила наборів: без роду й відмінків для імені гравця', async () => {
  const { readFileSync } = await import('node:fs');
  const packRules = (lang) => ['family', 'friends', 'couples', 'adults']
    .flatMap((p) => JSON.parse(readFileSync(new URL(`../src/data/packs/${lang === 'ru' ? 'ru/' : ''}${p}.json`, import.meta.url))).meta.rules);
  const RULES = {
    uk: { prep: /(для|про|від|до|у|в|з|біля|Прогноз|Прибрати) \{(name|who)\}/, pron: /(^|[^а-яіїєґ'])(його|її|йому|їй|нього|неї)([^а-яіїєґ']|$)/i, past: /(^|[^а-яіїєґ'])(Вгадав|Вгадала|Відповів|Відповіла)([^а-яіїєґ']|$)/ }, // \b не бачить кирилиці
    ru: { prep: /(для|о|от|до|у|с|Прогноз|Убрать) \{(name|who)\}/, pron: /(^|[^а-яё])(его|её|ее|ему|ей)([^а-яё]|$)/i, past: /(^|[^а-яё])(Угадал|Угадала|Ответил|Ответила)([^а-яё]|$)/ },
  };
  for (const [lang, d] of Object.entries(DICTS)) {
    const texts = [...Object.entries(d).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((x) => [k, x])), ...packRules(lang).map((x) => ['rules', x])];
    for (const [k, v] of texts) {
      assert.doesNotMatch(v, RULES[lang].prep, `${lang} ${k}: ім'я після прийменника треба відмінювати`);
      assert.doesNotMatch(v, RULES[lang].past, `${lang} ${k}: дієслово в минулому часі має рід`);
      if (/\{(name|who)\}/.test(v)) assert.doesNotMatch(v, RULES[lang].pron, `${lang} ${k}: займенник має рід`);
    }
  }
});
