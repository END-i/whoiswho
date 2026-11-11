import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, load, byAudience, isAboutOther, loadPacks } from '../src/lib/questions.js';
import { packFiles, family as raw, allQuestions } from './packs.js';

const clone = () => structuredClone(raw);

test('усі набори з src/data/packs проходять перевірку, id питань не повторюються між наборами', () => {
  for (const [name, p] of Object.entries(packFiles)) assert.deepEqual(validate(p), [], name);
  assert.deepEqual(loadPacks(packFiles).errors, []);
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
    [(d) => { d.questions[0].type = 'riddle'; }, /невідомий type/],
    [(d) => { d.questions[0].audience = 'adults'; }, /adults.*сімейна/],
    [(d) => { const q = d.questions.find((x) => x.type === 'who'); q.about = 'left'; }, /Хто з нас/],
    [(d) => { const q = d.questions.find((x) => x.category === 'guess'); q.about = 'answerer'; q.text = 'Що ти любиш?'; }, /мають бути різними/],
    [(d) => { const q = d.questions.find((x) => x.category === 'guess'); q.text += ' {about}'; }, /імена не підставляються/],
    [(d) => { d.meta.scoringCategories.push('ghost'); }, /scoringCategories/],
    [(d) => { d.questions[0].about = 'opposite'; }, /невідомий about/],
    [(d) => { d.questions.find((x) => x.category === 'aboutme').answerer = 'opposite'; }, /невідомий answerer/],
    [(d) => { delete d.meta; }, /meta/],
  ];
  for (const [mutate, re] of cases) {
    const d = clone(); mutate(d);
    const errs = validate(d);
    assert.ok(errs.some((e) => re.test(e)), `очікував ${re}, отримав: ${errs.join(' | ')}`);
  }
});

test("у текстах і підказках усіх наборів немає форм на кшталт «з'їв(ла)»", () => {
  const bad = allQuestions.filter((q) => /\((ла|ою|а|лася|ну|ним|нею)\)/.test(q.text + (q.tip || '')));
  assert.deepEqual(bad.map((q) => q.id), []);
});

test('load кидає помилку зі списком', () => {
  const d = clone(); d.questions.find((q) => q.id === 'op-02').type = 'x';
  assert.throws(() => load(d), (e) => Array.isArray(e.errors) && e.errors.length === 1);
});

test("у текстах усіх наборів немає «навпроти» — такої ролі немає", () => {
  assert.deepEqual(allQuestions.filter((q) => /навпроти/i.test(q.text)).map((q) => q.id), []);
});

test("guess-питання про іншого називають його роль словами", () => {
  const { questions } = load(raw);
  // до того, чия черга, — на «ти» (form: you)
  const words = { left: /ліворуч/, right: /праворуч/, pick: /вибери будь-кого|на твій вибір/i, self: /(^|[^а-яіїєґʼ'])(ти|тебе|тобі|твій|твоя|твоє|твої|твою)([^а-яіїєґʼ']|$)/i };
  for (const q of questions.filter((x) => x.type === 'guess')) {
    const target = q.about === 'answerer' ? q.answerer : q.about;
    if (target === 'self') assert.equal(q.form, 'you', `${q.id}: питання про того, чия черга, — лише на «ти»`);
    assert.match(q.text, words[target], `${q.id}: «${q.text}» не каже, про кого (${target})`);
  }
});

test('валідатор: «той, чия черга» заборонено; form лише "you" і лише для питання до того, чия черга, з іншим, хто відповідає', () => {
  const errs = (mut) => { const d = clone(); mut(d.questions.find((q) => q.id === 'am-01'), d); return validate(d); };
  assert.deepEqual(errs(() => {}), []);
  assert.ok(errs((q) => { q.text = 'Що любить той, чия черга?'; }).some((e) => /чия черга/.test(e)));
  assert.ok(errs((q) => { q.form = 'they'; }).some((e) => /невідомий form/.test(e)));
  assert.ok(errs((q) => { q.about = 'left'; }).some((e) => /form "you"/.test(e)));
  assert.ok(errs((q) => { q.answerer = 'self'; q.about = 'left'; }).some((e) => /form "you"/.test(e)));
  assert.deepEqual(errs((q) => { delete q.form; }), [], 'без form — звичайне питання');
});

test('валідатор: quiz — потрібна відповідь, відповідає сам; answer лише в quiz', () => {
  const run = (q) => { const d = clone(); d.questions.push({ id: 'zz-01', category: 'guess', text: 'Скільки ніг у павука?', ...q }); return validate(d); };
  assert.deepEqual(run({ type: 'quiz', answer: 'Вісім.' }), []);
  assert.ok(run({ type: 'quiz' }).some((e) => /потрібна відповідь/.test(e)));
  assert.ok(run({ type: 'quiz', answer: 7 }).some((e) => /потрібна відповідь/.test(e)));
  assert.ok(run({ type: 'quiz', answer: 'Вісім.', about: 'left' }).some((e) => /без answerer і about/.test(e)));
  assert.ok(run({ type: 'quiz', answer: 'Вісім.', answerer: 'left' }).some((e) => /без answerer і about/.test(e)));
  assert.ok(run({ answer: 'Вісім.' }).some((e) => /answer буває лише в quiz/.test(e)));
});

test('валідатор: структура файлу і категорії', () => {
  const cases = [
    [() => null, /порожній/],
    [() => 'text', /порожній/],
    [(d) => { d.meta.title = ''; }, /meta.title/],
    [(d) => { d.meta.rules = []; }, /meta.rules/],
    [(d) => { d.meta.scoringCategories = 'guess'; }, /scoringCategories має бути списком/],
    [(d) => { d.categories = []; }, /categories має бути/],
    [(d) => { d.questions = []; }, /questions має бути/],
    [(d) => { delete d.categories[0].id; }, /немає id/],
    [(d) => { d.categories[1].id = d.categories[0].id; }, /id повторюється/],
    [(d) => { d.categories[0].emoji = ''; }, /порожнє поле emoji/],
    [(d) => { delete d.questions[0].id; }, /Питання #1: немає id/],
    [(d) => { d.questions[0].text = ''; }, /порожній текст/],
    [(d) => { d.questions[0].audience = 'teens'; }, /невідомий audience/],
    [(d) => { d.questions.find((x) => x.category === 'open').type = 'guess'; }, /мають бути різними/],
  ];
  for (const [mutate, re] of cases) {
    let d = clone(); const r = mutate(d); if (r !== undefined) d = r;
    const errs = validate(d);
    assert.ok(errs.some((e) => re.test(e)), `очікував ${re}, отримав: ${errs.join(' | ')}`);
  }
});

test('валідатор: fieldDefaults можуть бути відсутні — беруться вбудовані', () => {
  const d = clone(); delete d.meta.fieldDefaults;
  // без fieldDefaults guess-питання мають явний type, а решта — open/all/self/answerer
  assert.deepEqual(validate(d), []);
  const q = load(d).questions.find((x) => x.id === 'op-02');
  assert.deepEqual([q.type, q.audience, q.answerer, q.about], ['open', 'all', 'self', 'answerer']);
});

test('load: помилка без списку errors теж читабельна', () => {
  assert.throws(() => load(null), /порожній/);
});

test('meta.pack: id, назва, кількість гравців, kids і adults разом не можна', () => {
  const run = (mut) => { const d = clone(); mut(d.meta.pack, d); return validate(d); };
  assert.deepEqual(run(() => {}), []);
  assert.ok(run((p, d) => { delete d.meta.pack; }).some((e) => /Немає meta.pack/.test(e)));
  assert.ok(run((p) => { p.id = 'Сім'; }).some((e) => /meta.pack.id/.test(e)));
  assert.ok(run((p) => { p.title = ''; }).some((e) => /meta.pack.title/.test(e)));
  assert.ok(run((p) => { p.minPlayers = 1; }).some((e) => /minPlayers/.test(e)));
  assert.ok(run((p) => { p.maxPlayers = 9; }).some((e) => /maxPlayers/.test(e)));
  assert.ok(run((p) => { p.maxPlayers = 1.5; }).some((e) => /maxPlayers/.test(e)));
  assert.ok(run((p) => { p.adults = true; }).some((e) => /водночас/.test(e)));
  assert.deepEqual(run((p) => { p.roleNames = { left: 'твоя половинка' }; }), []);
  for (const bad of [null, 'x', { left: '' }, { left: 3 }, { aside: 'хтось' }]) assert.ok(run((p) => { p.roleNames = bad; }).some((e) => /roleNames/.test(e)), JSON.stringify(bad));
  assert.ok(run((p) => { delete p.kids; }).some((e) => /audience «kids» — лише/.test(e)), 'дитячі питання — лише в наборі з фільтром');
});

test('loadPacks: усі набори, порядок, повтор id питання чи набору, зламаний файл, без сімейного', () => {
  const other = (id, qid = 'xx-01') => {
    const d = clone();
    d.meta.pack = { ...d.meta.pack, id, kids: false };
    d.questions = [{ id: qid, category: d.categories[0].id, text: 'Питання?' }];
    return d;
  };
  const ok = loadPacks({ 'z.json': other('zeta'), 'f.json': clone(), 'c.json': other('couples', 'xx-02') });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.order, ['family', 'couples', 'zeta']);
  assert.equal(ok.packs.zeta.questions[0].type, 'open', 'питання з усіма полями');
  const dupQ = loadPacks({ 'f.json': clone(), 'c.json': other('couples', 'gs-01') });
  assert.ok(dupQ.errors.some((e) => /c.json: питання gs-01 уже є в наборі «family»/.test(e)));
  const dupP = loadPacks({ 'f.json': clone(), 'g.json': clone() });
  assert.ok(dupP.errors.some((e) => /g.json: набір «family» уже є/.test(e)));
  const broken = loadPacks({ 'f.json': clone(), 'b.json': null });
  assert.ok(broken.errors.some((e) => /^b.json: Файл питань порожній/.test(e)));
  assert.deepEqual(loadPacks({ 'c.json': other('couples') }).errors, ['Немає сімейного набору (family)']);
});

test('у текстах усіх наборів немає подвійних пробілів, порожніх кінців і повторів', () => {
  const texts = new Map();
  for (const q of allQuestions) {
    assert.equal(q.text, q.text.trim(), q.id);
    assert.ok(!/ {2}/.test(q.text), `${q.id}: подвійний пробіл`);
    assert.ok(/[.?!…»)]$/.test(q.text), `${q.id}: текст має закінчуватися розділовим знаком`);
    const key = q.text.toLowerCase();
    assert.ok(!texts.has(key), `${q.id}: такий самий текст, як у ${texts.get(key)}`);
    texts.set(key, q.id);
  }
});
