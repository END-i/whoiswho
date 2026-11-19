// Російські набори: ті самі питання, що й українські, лише текст інший.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, loadPacks } from '../src/lib/questions.js';
import { readFileSync } from 'node:fs';
import { packFiles, ruFiles, allRuQuestions } from './packs.js';

// переписані українською, ще не перекладені (етап 17): російською — старий текст і будова
const PENDING = new Set(JSON.parse(readFileSync(new URL('../src/data/translation-pending.json', import.meta.url))).ru);

const TEXT = new Set(['text', 'answer', 'tip']);
const shape = (q) => Object.fromEntries(Object.entries(q).filter(([k]) => !TEXT.has(k)));

test('кожен російський набір має українську пару й проходить перевірку', () => {
  assert.ok(Object.keys(ruFiles).length > 0, 'є хоча б один переклад');
  for (const [name, ru] of Object.entries(ruFiles)) {
    assert.ok(packFiles[name], `${name}: немає українського файлу`);
    assert.deepEqual(validate(ru), [], name);
  }
  assert.deepEqual(loadPacks({ ...packFiles, ...ruFiles }).errors, []);
});

test('переклад: ті самі id у тому самому порядку, та сама структура; змінюються лише тексти', () => {
  for (const [name, ru] of Object.entries(ruFiles)) {
    const uk = packFiles[name];
    assert.deepEqual(ru.questions.map((q) => q.id), uk.questions.map((q) => q.id), `${name}: id`);
    const done = (list) => list.filter((q) => !PENDING.has(q.id));
    assert.deepEqual(done(ru.questions).map(shape), done(uk.questions).map(shape), `${name}: питання`);
    assert.deepEqual(done(ru.questions).map((q) => Object.keys(q).sort()), done(uk.questions).map((q) => Object.keys(q).sort()), `${name}: поля`);
    // і в тих, що чекають перекладу, — та сама категорія й тип (картка лишається в тій самій колоді)
    for (const q of ru.questions.filter((x) => PENDING.has(x.id))) {
      const u = uk.questions.find((x) => x.id === q.id);
      assert.deepEqual([q.category, q.type], [u.category, u.type], q.id);
    }
    assert.deepEqual(ru.categories.map((c) => [c.id, c.emoji]), uk.categories.map((c) => [c.id, c.emoji]), `${name}: категорії`);
    const { title, description, roleNames, ...pack } = ru.meta.pack;
    const { title: t2, description: d2, roleNames: r2, ...packUk } = uk.meta.pack;
    assert.deepEqual(pack, packUk, `${name}: опис набору`);
    assert.deepEqual(Object.keys(roleNames || {}), Object.keys(r2 || {}), `${name}: ролі`);
    assert.deepEqual(ru.meta.scoringCategories, uk.meta.scoringCategories);
    assert.equal(ru.meta.rules.length, uk.meta.rules.length);
  }
});

test('у російських текстах немає українських літер (нічого не забули перекласти)', () => {
  const strings = Object.entries(ruFiles).flatMap(([name, p]) => [
    p.meta.title, p.meta.pack.title, p.meta.pack.description, ...Object.values(p.meta.pack.roleNames || {}), ...p.meta.rules,
    ...p.categories.flatMap((c) => [c.title, c.description]),
    ...p.questions.flatMap((q) => [q.text, q.answer, q.tip].filter(Boolean).map((s) => `${q.id}: ${s}`)),
  ].map((s) => `${name} ${s}`));
  assert.deepEqual(strings.filter((s) => /[іїєґІЇЄҐ]/.test(s)), []);
});

test('російські тексти: без форм «(ла)», без повторів, закінчуються розділовим знаком', () => {
  const seen = new Map();
  for (const q of allRuQuestions) {
    assert.ok(!/\((ла|а|ась|ою)\)/.test(q.text + (q.tip || '')), `${q.id}: форма на кшталт «(ла)»`);
    assert.ok(/[.?!…»)]$/.test(q.text), `${q.id}: закінчення`);
    assert.ok(!/ {2}/.test(q.text), `${q.id}: подвійний пробіл`);
    const k = q.text.toLowerCase();
    assert.ok(!seen.has(k), `${q.id}: такий самий текст, як у ${seen.get(k)}`);
    seen.set(k, q.id);
  }
});

test('російська сімейна гра: ролі словами; про того, чия черга, коли відповідає інший, — «этот человек» (або на «ты» з form: you)', () => {
  const ru = ruFiles['family.json'];
  if (!ru) return;
  const you = /(^|[^а-яё])(ты|тебя|тебе|тобой|твой|твоя|твоё|твои|твою)([^а-яё]|$)/i;
  const person = /(этот|этого|этому|этим|этом) человек/i;
  const words = { any: person, self: person };
  for (const q of ru.questions.filter((x) => x.type === 'guess')) {
    const target = !q.about || q.about === 'answerer' ? (q.answerer || 'self') : q.about;
    if (q.form === 'you') assert.match(q.text, you, `${q.id}: form you — на «ты»`);
    else assert.match(q.text, words[target], `${q.id}: «${q.text}» не каже, про кого (${target})`);
  }
});

test('чекають перекладу: лише справжні id — і в українських, і в російських наборах', () => {
  const uk = new Set(Object.values(packFiles).flatMap((p) => p.questions).map((q) => q.id));
  const ru = new Set(allRuQuestions.map((q) => q.id));
  for (const id of PENDING) assert.ok(uk.has(id) && ru.has(id), id);
});
