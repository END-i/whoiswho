import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleError, parseReport, ORIGINS, DAILY_LIMIT, KEEP_DAYS } from '../src/lib/errorsink.js';

const WHO = 'https://whoiswho-akj.pages.dev';
const req = (method, body, origin = WHO, ua = 'Mozilla/5.0 iPhone') =>
  new Request('https://whoiswho-akj.pages.dev/api/error', { method, body, headers: { ...(origin ? { Origin: origin } : {}), 'User-Agent': ua, 'Content-Type': 'text/plain' } });
const report = (extra = {}) => JSON.stringify({ message: 'TypeError: x is undefined', source: 'index.js:1:20', page: '/cards/details?id=secret#x', version: '1.9.0', kind: 'error', ...extra });

/** Підставна D1: рахує записи, запам'ятовує, що вставили й що видаляли. */
function fakeDb(count = 0) {
  const calls = [];
  const stmt = (sql) => ({ bind: (...args) => ({ sql, args, first: async () => ({ n: count }) }) });
  return { calls, prepare: stmt, batch: async (list) => { calls.push(...list); return []; } };
}

test('звіт з нашого сайту записується: поля обрізані, сторінка без параметрів, браузер з заголовка; старше 30 днів — видаляється', async () => {
  const db = fakeDb();
  const now = new Date('2026-11-18T10:00:00Z');
  const res = await handleError(req('POST', report({ message: 'x'.repeat(900) })), db, now);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), WHO);
  const [insert, cleanup] = db.calls;
  assert.match(insert.sql, /^INSERT INTO errors/);
  const [at, app, version, kind, message, source, page, ua] = insert.args;
  assert.deepEqual([at, app, version, kind, source, page, ua], ['2026-11-18T10:00:00.000Z', 'whoiswho', '1.9.0', 'error', 'index.js:1:20', '/cards/details', 'Mozilla/5.0 iPhone']);
  assert.equal(message.length, 500);
  assert.match(cleanup.sql, /^DELETE FROM errors WHERE at </);
  assert.equal(cleanup.args[0], new Date(now.getTime() - KEEP_DAYS * 86400e3).toISOString());
});

test('застосунок визначається сайтом, звідки прийшов звіт (не тим, що написано в тілі)', async () => {
  for (const [origin, app] of Object.entries(ORIGINS)) {
    const db = fakeDb();
    await handleError(req('POST', report({ app: 'hacker' }), origin), db);
    assert.equal(db.calls[0].args[1], app, origin);
  }
  assert.deepEqual(Object.values(ORIGINS), ['whoiswho']);
  // інші наші сайти поки не шлють (рішення 18.11)
  assert.equal((await handleError(req('POST', report(), 'https://pocket-cards-five.vercel.app'), fakeDb())).status, 403);
});

test('чужий сайт, не POST, сміття в тілі — нічого не пишемо', async () => {
  const db = fakeDb();
  assert.equal((await handleError(req('POST', report(), 'https://evil.example'), db)).status, 403);
  assert.equal((await handleError(req('POST', report(), null), db)).status, 403);
  assert.equal((await handleError(req('GET', undefined), db)).status, 405);
  for (const body of ['не json', JSON.stringify({ source: 'x' }), 'null', 'x'.repeat(9000)]) {
    const res = await handleError(req('POST', body), db);
    assert.equal(res.status, 400, body.slice(0, 20));
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), WHO);
  }
  assert.deepEqual(db.calls, []);
});

test('попередній запит браузера (OPTIONS): свій сайт — так, чужий — ні', async () => {
  const ok = await handleError(req('OPTIONS', undefined), fakeDb());
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('Access-Control-Allow-Methods'), 'POST');
  const no = await handleError(req('OPTIONS', undefined, 'https://evil.example'), fakeDb());
  assert.equal(no.status, 403);
  assert.equal(no.headers.get('Access-Control-Allow-Origin'), null);
});

test('за добу не більше DAILY_LIMIT записів; без бази (тестова версія) — 204 і нічого', async () => {
  const full = fakeDb(DAILY_LIMIT);
  assert.equal((await handleError(req('POST', report()), full)).status, 429);
  assert.deepEqual(full.calls, []);
  assert.equal((await handleError(req('POST', report()), undefined)).status, 204);
});

test('parseReport: невідомий kind — error, без версії — «?», порожні поля — порожні рядки; не рядок — null', () => {
  assert.deepEqual(parseReport(JSON.stringify({ message: 'boom', kind: 'weird' }), 'cards'),
    { app: 'cards', version: '?', kind: 'error', message: 'boom', source: '', page: '', ua: '' });
  assert.equal(parseReport(JSON.stringify({ message: 'm', kind: 'rejection' }), 'cards').kind, 'rejection');
  assert.equal(parseReport(null, 'cards'), null);
  assert.equal(parseReport('"рядок"', 'cards'), null);
});
