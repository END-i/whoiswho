// Російські набори: ті самі питання, що й українські, лише текст інший.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, loadPacks } from '../src/lib/questions.js';
import { packFiles, ruFiles, allRuQuestions } from './packs.js';

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
    assert.deepEqual(ru.questions.map(shape), uk.questions.map(shape), `${name}: питання`);
    assert.deepEqual(ru.questions.map((q) => Object.keys(q).sort()), uk.questions.map((q) => Object.keys(q).sort()), `${name}: поля`);
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

test('російська сімейна гра: ролі словами, питання до того, чия черга, — на «ты»', () => {
  const ru = ruFiles['family.json'];
  if (!ru) return;
  const words = { left: /слева/, right: /справа/, pick: /выбери любого|на твой выбор/i, self: /(^|[^а-яё])(ты|тебя|тебе|тобой|твой|твоя|твоё|твои|твою)([^а-яё]|$)/i };
  for (const q of ru.questions.filter((x) => x.type === 'guess')) {
    const target = !q.about || q.about === 'answerer' ? (q.answerer || 'self') : q.about;
    assert.match(q.text, words[target], `${q.id}: «${q.text}» не каже, про кого (${target})`);
  }
});
