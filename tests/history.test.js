import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rank, winners, podium } from '../src/lib/ranking.js';
import { gameRecord, addRecord, cleanHistory, leaderboard, HISTORY_LIMIT } from '../src/lib/history.js';

const E = (pairs) => pairs.map(([id, score]) => ({ id, score }));
const places = (r) => r.map((e) => `${e.id}:${e.place}`).join(' ');

// ---------- місця ----------

test('rank: від більших до менших, однакові бали — однакове місце (1, 1, 3)', () => {
  assert.equal(places(rank(E([['a', 1], ['b', 3], ['c', 3], ['d', 0]]))), 'b:1 c:1 a:3 d:4');
  assert.equal(places(rank(E([['a', 2], ['b', 1], ['c', 1]]))), 'a:1 b:2 c:2');
  assert.deepEqual(rank([]), []);
  assert.equal(rank([{ id: 'x', score: 'oops' }])[0].score, 0);
});

test('winners: усі на першому місці; якщо в усіх 0 — нікого', () => {
  assert.deepEqual(winners(rank(E([['a', 0], ['b', 0]]))), []);
  assert.deepEqual(winners(rank(E([['a', 2], ['b', 2], ['c', 1]]))).map((e) => e.id), ['a', 'b']);
  assert.deepEqual(winners(rank(E([['a', 1], ['b', 0]]))).map((e) => e.id), ['a']);
  assert.deepEqual(winners([]), []);
});

test('podium: групи 1–3 місць зі спільними місцями; усі на нулі — без п\'єдесталу', () => {
  assert.deepEqual(podium(rank(E([['a', 0], ['b', 0]]))), []);
  const p = podium(rank(E([['a', 3], ['b', 3], ['c', 2], ['d', 1], ['e', 0]])));
  assert.deepEqual(p.map((g) => [g.place, g.players.map((x) => x.id)]), [[1, ['a', 'b']], [3, ['c']]]);
  const p2 = podium(rank(E([['a', 5], ['b', 1], ['c', 1], ['d', 0]])));
  assert.deepEqual(p2.map((g) => [g.place, g.players.map((x) => x.id)]), [[1, ['a']], [2, ['b', 'c']]]);
});

// ---------- запис гри ----------

const game = (over = {}) => ({
  order: ['p1', 'p2'], scoring: true, gone: {}, scores: { p1: 2, p2: 1 }, stats: { answered: 3, skipped: 1 }, ...over,
});
const names = { p1: 'Оля', p2: 'Тарас', p3: 'Мама' };

test('gameRecord: гравці з місцями, переможці, картки', () => {
  const r = gameRecord(game(), names, { date: '2026-11-11T10:00:00Z', id: 'g1' });
  assert.deepEqual(r, {
    id: 'g1', date: '2026-11-11T10:00:00Z', finished: true, scoring: true,
    players: [{ id: 'p1', name: 'Оля', score: 2, place: 1 }, { id: 'p2', name: 'Тарас', score: 1, place: 2 }],
    winners: ['p1'], cards: { answered: 3, skipped: 1 },
  });
});

test('gameRecord: гравці, що вийшли, теж у записі; без балів — без переможців; порожня гра — null', () => {
  const r = gameRecord(game({ gone: { p3: 'Мама' }, scores: { p1: 0, p2: 0, p3: 4 } }), { p1: 'Оля', p2: 'Тарас' }, { finished: false });
  assert.equal(r.finished, false);
  assert.deepEqual(r.players.map((p) => p.name), ['Мама', 'Оля', 'Тарас']);
  assert.deepEqual(r.winners, [], 'покинута гра — без переможця');
  assert.deepEqual(gameRecord(game({ gone: { p3: 'Мама' }, scores: { p1: 0, p2: 0, p3: 4 } }), { p1: 'Оля', p2: 'Тарас' }).winners, ['p3']);
  assert.match(r.id, /^\d{4}-/);
  assert.deepEqual(gameRecord(game({ scoring: false }), names).winners, []);
  assert.deepEqual(gameRecord(game({ scores: { p1: 0, p2: 0 } }), names).winners, []);
  assert.equal(gameRecord(game({ stats: { answered: 0, skipped: 0 } }), names), null);
  assert.deepEqual(gameRecord(game({ stats: { skipped: 2 } }), names).cards, { answered: 0, skipped: 2 }, 'лише пропуски — гра все одно в історії');
  assert.equal(gameRecord(null, names), null);
  assert.equal(gameRecord(game({ scores: undefined, gone: undefined, stats: { answered: 1 } }), {}).players[0].name, 'Гравець');
});

test('addRecord: нове — першим, без дублів, обмеження розміру', () => {
  let h = [];
  h = addRecord(h, { id: 'a' }); h = addRecord(h, { id: 'b' }); h = addRecord(h, { id: 'a' });
  assert.deepEqual(h.map((r) => r.id), ['a', 'b']);
  assert.equal(addRecord(h, null), h);
  let big = [];
  for (let k = 0; k < HISTORY_LIMIT + 5; k++) big = addRecord(big, { id: `g${k}` });
  assert.equal(big.length, HISTORY_LIMIT);
  assert.equal(big[0].id, `g${HISTORY_LIMIT + 4}`);
});

test('cleanHistory: відкидає зламане, доповнює відсутнє', () => {
  const good = gameRecord(game(), names, { id: 'ok', date: 'd' });
  const cleaned = cleanHistory([good, null, { id: 1 }, { id: 'x', date: 'd', players: [{ id: 'p', name: 'N', score: 'x', place: 1 }] },
    { id: 'y', date: 'd', players: [{ id: 'p', name: 'N', score: 1, place: 1 }] }]);
  assert.deepEqual(cleaned.map((r) => r.id), ['ok', 'y']);
  assert.deepEqual(cleaned[1].winners, []); assert.deepEqual(cleaned[1].cards, { answered: 0, skipped: 0 });
  assert.deepEqual(cleanHistory('nope'), []);
  assert.equal(cleanHistory(Array.from({ length: HISTORY_LIMIT + 3 }, () => good)).length, HISTORY_LIMIT);
});

// ---------- загальна таблиця ----------

test('leaderboard: перемоги, ігри, бали; перейменування не ламає; нічия — однакове місце', () => {
  let h = [];
  h = addRecord(h, gameRecord(game({ scores: { p1: 2, p2: 1 } }), { p1: 'Оля', p2: 'Тарас' }, { id: 'g1', date: '1' }));
  h = addRecord(h, gameRecord(game({ scores: { p1: 0, p2: 3 } }), { p1: 'Олечка', p2: 'Тарас' }, { id: 'g2', date: '2' }));
  h = addRecord(h, gameRecord(game({ scores: { p1: 0, p2: 0 } }), { p1: 'Олечка', p2: 'Тарас' }, { id: 'g3', date: '3' }));
  const lb = leaderboard(h);
  assert.deepEqual(lb.map(({ id, name, games, wins, points, place }) => [id, name, games, wins, points, place]),
    [['p2', 'Тарас', 3, 1, 4, 1], ['p1', 'Олечка', 3, 1, 2, 2]]);
  h = addRecord(h, gameRecord(game({ scores: { p1: 2, p2: 0 } }), names, { id: 'g4', date: '4' }));
  assert.deepEqual(leaderboard(h).map((e) => [e.id, e.wins, e.points, e.place]), [['p1', 2, 4, 1], ['p2', 1, 4, 2]]);
  assert.deepEqual(leaderboard([]), []);
});

test('leaderboard: гра без балів додає гру, але не бали й не перемоги', () => {
  const h = [gameRecord(game({ scoring: false }), names, { id: 'n', date: '1' })];
  assert.deepEqual(leaderboard(h).map((e) => [e.id, e.games, e.wins, e.points]), [['p1', 1, 0, 0], ['p2', 1, 0, 0]]);
});
