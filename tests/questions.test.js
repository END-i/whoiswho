import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate, load, byAudience, isAboutOther } from '../src/lib/questions.js';

const raw = JSON.parse(readFileSync(new URL('../src/data/questions.json', import.meta.url)));
const clone = () => structuredClone(raw);

test('справжній questions.json проходить перевірку', () => {
  assert.deepEqual(validate(raw), []);
});

test('кожна категорія має питання в обох фільтрах', () => {
  const { categories, questions } = load(raw);
  for (const f of ['family', 'kids']) {
    const qs = byAudience(questions, f);
    for (const c of categories) assert.ok(qs.some((q) => q.category === c.id), `${c.id} порожня у фільтрі ${f}`);
  }
});

test('фільтр: family — лише all, kids — all і kids', () => {
  const { questions } = load(raw);
  assert.ok(byAudience(questions, 'family').every((q) => q.audience === 'all'));
  const kids = byAudience(questions, 'kids');
  assert.ok(kids.length > byAudience(questions, 'family').length);
  assert.ok(kids.every((q) => ['all', 'kids'].includes(q.audience)));
});

test('значення за замовчуванням підставляються', () => {
  const q = load(raw).questions.find((x) => x.id === 'op-02');
  assert.equal(q.type, 'open'); assert.equal(q.audience, 'all');
  assert.equal(q.answerer, 'self'); assert.equal(q.about, 'answerer');
  assert.equal(isAboutOther(q), false);
});

test('валідатор ловить типові помилки', () => {
  const cases = [
    [(d) => { d.questions[1].id = d.questions[0].id; }, /повторюється/],
    [(d) => { d.questions[0].category = 'nope'; }, /немає категорії/],
    [(d) => { d.questions[0].type = 'quiz'; }, /невідомий type/],
    [(d) => { d.questions[0].audience = 'adults'; }, /adults.*сімейна/],
    [(d) => { const q = d.questions.find((x) => x.type === 'who'); q.about = 'left'; }, /Хто з нас/],
    [(d) => { const q = d.questions.find((x) => x.category === 'guess'); q.about = 'answerer'; q.text = 'Що ти любиш?'; }, /мають бути різними/],
    [(d) => { const q = d.questions.find((x) => x.category === 'guess'); q.text += ' {about}'; }, /імена не підставляються/],
    [(d) => { d.meta.scoringCategories.push('ghost'); }, /scoringCategories/],
    [(d) => { delete d.meta; }, /meta/],
  ];
  for (const [mutate, re] of cases) {
    const d = clone(); mutate(d);
    const errs = validate(d);
    assert.ok(errs.some((e) => re.test(e)), `очікував ${re}, отримав: ${errs.join(' | ')}`);
  }
});

test("у текстах і підказках немає форм на кшталт «з'їв(ла)»", () => {
  const bad = raw.questions.filter((q) => /\((ла|ою|а|лася|ну|ним|нею)\)/.test(q.text + (q.tip || '')));
  assert.deepEqual(bad.map((q) => q.id), []);
});

test('load кидає помилку зі списком', () => {
  const d = clone(); d.questions.find((q) => q.id === 'op-02').type = 'x';
  assert.throws(() => load(d), (e) => Array.isArray(e.errors) && e.errors.length === 1);
});
