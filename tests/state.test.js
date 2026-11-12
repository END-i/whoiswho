import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shuffle, derange, buildDeck, newGame, undoCard, POINTS, POINT_SCALE, isRated, pointsFor, finishCard, remaining, isUsed, questionAt, total, allDone,
  updatePlayers, seat, roles, restoreGame, endGame, VERSION, openNumbers, randomNumber, randomCard,
} from '../src/lib/state.js';

// Відтворюваний генератор випадкових чисел (mulberry32)
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const P = (...names) => names.map((name, k) => ({ id: `p${k}`, name }));
const Q = (cat, n, prefix = cat) => Array.from({ length: n }, (_, k) => ({ id: `${prefix}-${k}`, category: cat }));
const isPerm = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const prevMap = (arr) => new Map(arr.map((id, k) => [id, k + 1]));
const conflicts = (arr, prev) => arr.filter((id, k) => prev.get(id) === k + 1).length;

// ---------- перемішування ----------

test('shuffle: перестановка того самого набору, оригінал не змінюється', () => {
  const src = ['a', 'b', 'c', 'd', 'e'];
  const out = shuffle(src, rng(1));
  assert.ok(isPerm(out, src));
  assert.deepEqual(src, ['a', 'b', 'c', 'd', 'e']);
});

test('shuffle: з тим самим seed — той самий результат', () => {
  assert.deepEqual(shuffle([1, 2, 3, 4, 5, 6], rng(7)), shuffle([1, 2, 3, 4, 5, 6], rng(7)));
});

test('shuffle: усі позиції рівноймовірні (грубо)', () => {
  const r = rng(3), counts = [0, 0, 0];
  for (let k = 0; k < 30000; k++) counts[shuffle(['x', 'y', 'z'], r).indexOf('x')]++;
  for (const c of counts) assert.ok(Math.abs(c - 10000) < 600, `перекіс: ${counts}`);
});

test('derange: 10 000 ігор поспіль без жодного збігу з минулою грою', () => {
  const ids = Array.from({ length: 25 }, (_, k) => `q${k}`);
  const r = rng(42);
  let prev = shuffle(ids, r);
  for (let g = 0; g < 10000; g++) {
    const next = derange(ids, prevMap(prev), r);
    assert.ok(isPerm(next, ids));
    assert.equal(conflicts(next, prevMap(prev)), 0, `гра ${g}`);
    prev = next;
  }
});

test('derange: малі категорії — 2 і 3 питання, багато разів', () => {
  const r = rng(5);
  for (const n of [2, 3]) {
    const ids = Array.from({ length: n }, (_, k) => `q${k}`);
    let prev = ids.slice();
    for (let g = 0; g < 2000; g++) { const next = derange(ids, prevMap(prev), r); assert.equal(conflicts(next, prevMap(prev)), 0); prev = next; }
  }
});

test('derange: одне питання — збіг дозволений', () => {
  assert.deepEqual(derange(['only'], new Map([['only', 1]])), ['only']);
});

test('derange: набір змінився — перевіряються лише спільні питання', () => {
  const r = rng(9);
  const prev = new Map([['a', 1], ['b', 2], ['gone', 3], ['c', 4]]);
  for (let g = 0; g < 2000; g++) {
    const next = derange(['a', 'b', 'c', 'new1', 'new2'], prev, r);
    assert.ok(isPerm(next, ['a', 'b', 'c', 'new1', 'new2']));
    assert.equal(conflicts(next, prev), 0);
  }
});

test('derange: запасний алгоритм теж дає розв\'язок (rand завжди 0)', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const always0 = () => 0; // shuffle тоді завжди дає ту саму перестановку — випадкові спроби не допоможуть
  const fixed = shuffle(ids, always0);
  const out = derange(ids, prevMap(fixed), always0);
  assert.ok(isPerm(out, ids));
  assert.equal(conflicts(out, prevMap(fixed)), 0);
});

test('buildDeck: окрема колода на кожну категорію, з урахуванням минулої', () => {
  const qs = [...Q('a', 5), ...Q('b', 3)];
  const d1 = buildDeck(qs, null, rng(1));
  assert.deepEqual(Object.keys(d1).sort(), ['a', 'b']);
  assert.ok(isPerm(d1.a, qs.filter((q) => q.category === 'a').map((q) => q.id)));
  const d2 = buildDeck(qs, d1, rng(2));
  for (const c of ['a', 'b']) assert.equal(conflicts(d2[c], prevMap(d1[c])), 0);
});

test('buildDeck: null-місця з минулої колоди ігноруються', () => {
  const d = buildDeck(Q('a', 3), { a: ['a-0', null, 'a-2'] }, rng(4));
  assert.notEqual(d.a[0], 'a-0'); assert.notEqual(d.a[2], 'a-2');
});

// ---------- гра ----------

test('newGame: початковий стан', () => {
  const g = newGame({ players: P('A', 'B'), questions: Q('c', 3), scoring: true, audience: 'kids', rand: rng(1) });
  assert.equal(g.version, VERSION);
  assert.deepEqual(g.order, ['p0', 'p1']);
  assert.deepEqual(g.scores, { p0: 0, p1: 0 });
  assert.equal(g.turn, 0); assert.equal(g.scoring, true); assert.equal(g.audience, 'kids');
  assert.equal(total(g, 'c'), 3); assert.equal(remaining(g, 'c'), 3); assert.equal(allDone(g), false);
});

test('finishCard: номер не повторюється, хід по колу, статистика', () => {
  let g = newGame({ players: P('A', 'B', 'C'), questions: Q('c', 2), rand: rng(1) });
  g = finishCard(g, 'c', 1, 'answered');
  assert.ok(isUsed(g, 'c', 1)); assert.equal(g.turn, 1); assert.equal(remaining(g, 'c'), 1);
  assert.equal(finishCard(g, 'c', 1, 'answered'), g, 'повторне закриття нічого не змінює');
  g = finishCard(g, 'c', 2, 'skipped');
  assert.deepEqual(g.stats, { answered: 1, skipped: 1 });
  assert.equal(g.turn, 2); assert.equal(allDone(g), true);
  g = finishCard({ ...g, used: {} }, 'c', 1, 'answered');
  assert.equal(g.turn, 0, 'після останнього гравця хід повертається до першого');
});

test('finishCard: бал за «Правильно» отримує той, хто відповідав', () => {
  let g = newGame({ players: P('A', 'B', 'C'), questions: Q('c', 3), scoring: true, rand: rng(1) });
  g = finishCard(g, 'c', 1, 'correct', 2);
  assert.deepEqual(g.scores, { p0: 0, p1: 0, p2: 20 }, '«Правильно» — 20');
  g = finishCard(g, 'c', 2, 'wrong', 0);
  g = finishCard(g, 'c', 3, 'correct', null);
  assert.deepEqual(g.scores, { p0: 0, p1: 0, p2: 20 });
  assert.deepEqual(g.stats, { answered: 3, skipped: 0 });
});

test('finishCard і pointsFor: бали за сміливість — 10, у сміливій категорії 20; isRated — лише відкриті питання й виклики', () => {
  let g = newGame({ players: P('A', 'B'), questions: Q('c', 3), scoring: true, rand: rng(1) });
  g = finishCard(g, 'c', 1, 'correct', 0, POINTS.answer);
  g = finishCard(g, 'c', 2, 'correct', 0, POINTS.brave);
  assert.equal(g.scores.p0, 30);
  assert.deepEqual(POINTS, { right: 20, answer: 10, brave: 20 });
  assert.equal(pointsFor({ type: 'open' }, { id: 'ifwhat' }), 10, 'відповів — 10');
  assert.equal(pointsFor({ type: 'activity' }, { id: 'show', brave: true }), 20, 'смілива категорія — 20');
  assert.equal(pointsFor({ type: 'guess' }, { brave: true }), 20, 'вгадав — 20');
  assert.equal(pointsFor({ type: 'open' }), 10, 'без категорії — 10');
  assert.deepEqual(['open', 'activity', 'guess', 'quiz', 'who'].map(isRated), [true, true, false, false, false]);
});

test('restoreGame: гра, почата до 1.7.0 (по 1 балу), — бали ×20 один раз', () => {
  const { players, g } = fresh();
  const old = { ...JSON.parse(JSON.stringify(g)), scores: { [players[0].id]: 2, [players[1].id]: 0 } };
  delete old.points;
  const r = restoreGame(old, ids, players);
  assert.deepEqual(r.scores, { [players[0].id]: 40, [players[1].id]: 0 });
  assert.equal(r.points, POINT_SCALE);
  assert.deepEqual(restoreGame(JSON.parse(JSON.stringify(r)), ids, players).scores, r.scores, 'вдруге не множиться');
  assert.equal(restoreGame({ ...old, scores: { [players[0].id]: 'x' } }, ids, players).scores[players[0].id], 0, 'сміття — 0');
});

test('finishCard: старий стан не змінюється', () => {
  const g = newGame({ players: P('A', 'B'), questions: Q('c', 2), rand: rng(1) });
  const snap = JSON.stringify(g);
  finishCard(g, 'c', 1, 'correct', 1);
  assert.equal(JSON.stringify(g), snap);
});

test('questionAt / isUsed: null-місце вважається використаним', () => {
  const g = { ...newGame({ players: P('A', 'B'), questions: Q('c', 2), rand: rng(1) }), deck: { c: ['c-0', null] } };
  assert.equal(questionAt(g, 'c', 1), 'c-0'); assert.equal(questionAt(g, 'c', 2), null);
  assert.ok(isUsed(g, 'c', 2)); assert.equal(remaining(g, 'c'), 1);
});

// ---------- зміна гравців ----------

test('updatePlayers: перейменування й перестановка — хід лишається в тієї самої людини', () => {
  const players = P('A', 'B', 'C');
  let g = { ...newGame({ players, questions: Q('c', 1), rand: rng(1) }), turn: 1 };
  g = updatePlayers(g, [players[2], players[1], players[0]]);
  assert.deepEqual(g.order, ['p2', 'p1', 'p0']); assert.equal(g.turn, 1);
});

test('updatePlayers: прибрали того, чия черга — хід переходить до наступного за колом', () => {
  const players = P('A', 'B', 'C', 'D');
  let g = { ...newGame({ players, questions: Q('c', 1), rand: rng(1) }), turn: 1, scores: { p0: 0, p1: 3, p2: 0, p3: 0 } };
  g = updatePlayers(g, [players[0], players[2], players[3]], { p1: 'B' });
  assert.equal(g.order[g.turn], 'p2');
  assert.equal(g.scores.p1, 3, 'бали видаленого лишаються');
  assert.deepEqual(g.gone, { p1: 'B' });
});

test('updatePlayers: прибрали останнього, коли черга була його — хід до першого', () => {
  const players = P('A', 'B', 'C');
  const g = updatePlayers({ ...newGame({ players, questions: Q('c', 1), rand: rng(1) }), turn: 2 }, players.slice(0, 2));
  assert.equal(g.order[g.turn], 'p0');
});

test('updatePlayers: додали гравця — 0 балів; повернули видаленого — він більше не «gone»', () => {
  const players = P('A', 'B', 'C');
  let g = updatePlayers(newGame({ players: players.slice(0, 2), questions: Q('c', 1), rand: rng(1) }), players);
  assert.equal(g.scores.p2, 0);
  g = updatePlayers(g, players.slice(0, 2), { p2: 'C' });
  assert.deepEqual(g.gone, { p2: 'C' });
  g = updatePlayers(g, players);
  assert.deepEqual(g.gone, {});
});

test('updatePlayers: менше двох гравців — помилка', () => {
  const g = newGame({ players: P('A', 'B'), questions: Q('c', 1), rand: rng(1) });
  assert.throws(() => updatePlayers(g, P('A')));
});

// ---------- ролі ----------

test('seat: ліворуч — наступний, праворуч — попередній, по колу, для 2–8 гравців', () => {
  for (let n = 2; n <= 8; n++) for (let i = 0; i < n; i++) {
    assert.equal(seat('self', i, n), i);
    assert.equal(seat('left', i, n), (i + 1) % n);
    assert.equal(seat('right', i, n), (i - 1 + n) % n);
    assert.notEqual(seat('left', i, n), i); assert.notEqual(seat('right', i, n), i);
  }
});

test('seat: pick — вибір гравця (null), удвох — одразу другий', () => {
  for (let n = 3; n <= 8; n++) assert.equal(seat('pick', 0, n), null);
  assert.equal(seat('pick', 0, 2), 1); assert.equal(seat('pick', 1, 2), 0);
  assert.equal(seat('left', 0, 2), seat('right', 0, 2), 'удвох ліворуч і праворуч — та сама людина');
});

test('seat: «навпроти» більше немає', () => {
  assert.throws(() => seat('opposite', 0, 4), /Невідома роль/);
});

test('roles: about=answerer — людина відповідає про себе', () => {
  assert.deepEqual(roles({ answerer: 'right', about: 'self' }, 0, 4), { answerer: 3, about: 0 });
  assert.deepEqual(roles({ answerer: 'self', about: 'left' }, 1, 4), { answerer: 1, about: 2 });
  assert.deepEqual(roles({ answerer: 'self', about: 'answerer' }, 2, 4), { answerer: 2, about: 2 });
  assert.deepEqual(roles({ answerer: 'pick', about: 'answerer' }, 0, 4), { answerer: null, about: null });
  assert.deepEqual(roles({ answerer: 'self', about: 'pick' }, 0, 2), { answerer: 0, about: 1 });
});

// ---------- відновлення ----------

const fresh = () => {
  const players = P('A', 'B', 'C');
  let g = newGame({ players, questions: [...Q('a', 3), ...Q('b', 2)], scoring: true, rand: rng(1) });
  g = finishCard(g, 'a', 2, 'correct', 0);
  return { players, g };
};
const ids = [...Q('a', 3), ...Q('b', 2)].map((q) => q.id);

test('restoreGame: збережене через JSON відновлюється без змін', () => {
  const { players, g } = fresh();
  const { last, ...rest } = g; // «Скасувати» живе лише до перезавантаження
  assert.ok(last);
  assert.deepEqual(restoreGame(JSON.parse(JSON.stringify(g)), ids, players), { ...rest, over: false });
});

test('endGame: гру завершено — картки більше не закриваються, позначка переживає збереження', () => {
  const { players, g } = fresh();
  const over = endGame(g);
  assert.equal(over.over, true); assert.equal(g.over, undefined, 'старий стан не змінюється');
  assert.equal(finishCard(over, 'a', 1, 'correct', 0), over);
  assert.equal(restoreGame(JSON.parse(JSON.stringify(over)), ids, players).over, true);
});

test('restoreGame: чужа версія чи зламаний формат — null', () => {
  const { players, g } = fresh();
  for (const bad of [null, {}, { ...g, version: 1 }, { ...g, order: 'x' }, { ...g, deck: null }, { ...g, used: undefined },
    { ...g, deck: { a: 'oops' } }, { ...g, order: ['p0'] }, { ...g, order: ['p0', 'ghost'] }]) {
    assert.equal(restoreGame(bad, ids, players), null, JSON.stringify(bad)?.slice(0, 60));
  }
});

test('restoreGame: питання прибрали з файлу — місце стає використаним, номери не зсуваються', () => {
  const { players, g } = fresh();
  const gone = g.deck.a[0];
  const r = restoreGame(g, ids.filter((x) => x !== gone), players);
  assert.equal(r.deck.a[0], null); assert.equal(r.deck.a.length, 3);
  assert.ok(isUsed(r, 'a', 1)); assert.equal(remaining(r, 'a'), 1);
});

test('restoreGame: сміття в used і turn виправляється', () => {
  const { players, g } = fresh();
  const r = restoreGame({ ...g, used: { a: [2, 2, 99, 0, 'x'], ghost: [1] }, turn: 17, stats: { answered: 'x' } }, ids, players);
  assert.deepEqual(r.used, { a: [2] }); assert.equal(r.turn, 0);
  assert.deepEqual(r.stats, { answered: 0, skipped: 0 });
});

test('крайні випадки: невідома категорія, значення за замовчуванням', () => {
  const g = newGame({ players: P('A', 'B'), questions: Q('c', 2) });
  assert.equal(total(g, 'nope'), 0); assert.equal(remaining(g, 'nope'), 0);
  assert.equal(questionAt(g, 'nope', 1), null); assert.ok(isUsed(g, 'nope', 1));
  assert.equal(g.audience, 'family'); assert.equal(g.scoring, false);
  assert.ok(isPerm(derange(['a', 'b', 'c'], new Map()), ['a', 'b', 'c']));
  assert.ok(isPerm(shuffle([1, 2, 3]), [1, 2, 3]));
  assert.deepEqual(Object.keys(buildDeck(Q('c', 2))), ['c']);
});

test('updatePlayers: склад повністю новий — хід першому; імʼя видаленого невідоме — порожнє', () => {
  const g0 = newGame({ players: P('A', 'B'), questions: Q('c', 1), rand: rng(1) });
  const others = [{ id: 'x1', name: 'X' }, { id: 'x2', name: 'Y' }];
  const g = updatePlayers({ ...g0, turn: 1 }, others);
  assert.equal(g.turn, 0);
  assert.deepEqual(g.gone, { p0: '', p1: '' });
  assert.deepEqual(updatePlayers(g, others, { p0: 'A' }).gone, { p0: '', p1: '' }, 'ім\'я береться з names лише в момент видалення');
});

test('restoreGame: відсутні gone й аудиторія kids', () => {
  const { players, g } = fresh();
  const r = restoreGame({ ...g, gone: undefined, audience: 'kids' }, ids, players);
  assert.deepEqual(r.gone, {}); assert.equal(r.audience, 'kids');
  assert.equal(restoreGame({ ...g, audience: 'weird' }, ids, players).audience, 'family');
});

test('pack: нова гра знає свій набір; старе збереження без набору — сімейний', () => {
  const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const questions = [{ id: 'q1', category: 'c1' }];
  assert.equal(newGame({ players, questions }).pack, 'family');
  const g = newGame({ players, questions, pack: 'friends' });
  assert.equal(g.pack, 'friends');
  assert.equal(restoreGame(g, ['q1'], players).pack, 'friends');
  const { pack, ...old } = g;
  assert.equal(restoreGame(old, ['q1'], players).pack, 'family');
});

test('undoCard: картка знову закрита, бали, статистика й черга — як до неї; лише один крок', () => {
  let g = newGame({ players: P('A', 'B'), questions: Q('c', 3), scoring: true, rand: rng(1) });
  g = finishCard(g, 'c', 1, 'correct', 0);
  const before = g;
  g = finishCard(g, 'c', 2, 'correct', 1, 50);
  const u = undoCard(g);
  assert.deepEqual(u.used.c, [1]); assert.equal(u.turn, before.turn);
  assert.deepEqual(u.scores, before.scores); assert.deepEqual(u.stats, before.stats);
  assert.equal(undoCard(u), u, 'вдруге — нічого');
  assert.equal(undoCard(endGame(g)).used.c.length, 2, 'гру завершено — не скасовується');
  assert.equal(undoCard(updatePlayers(g, P('A', 'B'), {})).used.c.length, 2, 'змінили склад — не скасовується');
  const odd = { ...g, used: {} };
  assert.deepEqual(undoCard(odd).used.c, [], 'без запису used — порожньо, не падає');
});

test('openNumbers/randomNumber: лише ще не відкриті карти; усе відкрито — null', () => {
  const g = { deck: { a: ['q1', 'q2', null, 'q4'] }, used: { a: [2] } };
  assert.deepEqual(openNumbers(g, 'a'), [1, 4]);
  assert.deepEqual(openNumbers(g, 'нема'), []);
  assert.equal(randomNumber(g, 'a', () => 0), 1);
  assert.equal(randomNumber(g, 'a', () => 0.99), 4);
  assert.equal(randomNumber(g, 'a', () => 1), 4);
  assert.equal(randomNumber({ deck: { a: ['q1'] }, used: { a: [1] } }, 'a'), null);
  assert.ok([1, 4].includes(randomNumber(g, 'a')));
});

test('randomCard: категорія лише з тих, де ще є карти, і карта в ній ще не відкрита', () => {
  const g = { deck: { a: ['q1'], b: ['q2', 'q3'], c: ['q4'] }, used: { a: [1], c: [] } };
  const r = rng(5), seen = new Set();
  for (let k = 0; k < 200; k++) {
    const { cat, num } = randomCard(g, ['a', 'b', 'c'], r);
    assert.notEqual(cat, 'a');
    assert.ok(!isUsed(g, cat, num));
    seen.add(cat + num);
  }
  assert.deepEqual([...seen].sort(), ['b1', 'b2', 'c1']);
  assert.deepEqual(randomCard(g, ['b'], () => 1), { cat: 'b', num: 2 });
  assert.equal(randomCard(g, ['a']), null);
  assert.equal(randomCard(g, []), null);
  assert.ok(randomCard(g, ['c']).cat === 'c');
});
