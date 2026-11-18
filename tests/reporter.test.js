import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe, createReporter, installErrorReporting } from '../src/lib/reporter.js';

test('describe: Error → «Тип: текст» і перші рядки стеку; рядок і об’єкт — як є; без стеку — місце', () => {
  const e = new TypeError('x is undefined');
  e.stack = 'TypeError: x is undefined\n at a (app.js:1:2)\n at b (app.js:3:4)\n at c (app.js:5:6)\n at d (app.js:7:8)';
  assert.deepEqual(describe(e), { message: 'TypeError: x is undefined', source: e.stack.split('\n').slice(0, 4).join('\n') });
  const bare = new Error('boom'); bare.stack = '';
  assert.deepEqual(describe(bare, 'app.js:9:1'), { message: 'Error: boom', source: 'app.js:9:1' });
  assert.deepEqual(describe('щось зламалось'), { message: 'щось зламалось', source: '' });
  assert.equal(describe({ code: 42 }).message, '{"code":42}');
  const loop = {}; loop.self = loop;
  assert.equal(describe(loop).message, '[object Object]');
  assert.equal(describe(undefined).message, 'unknown'); // JSON.stringify(undefined) → undefined
  assert.equal(describe('').message, 'unknown');
});

test('createReporter: та сама помилка — не частіше разу на хвилину; не більше 10 за сторінку; шум пропускаємо', () => {
  const sent = [];
  let t = 0;
  const report = createReporter({ version: '1.9.0', page: () => '/x', send: (b) => sent.push(JSON.parse(b)), now: () => t });
  assert.equal(report('error', new Error('a')), true);
  assert.equal(report('error', new Error('a')), false, 'повтор за хвилину');
  t = 60_000;
  assert.equal(report('error', new Error('a')), true, 'через хвилину — знову');
  assert.equal(report('rejection', new Error('a')), true, 'інший вид — окремо');
  assert.deepEqual(sent[0], { kind: 'error', message: 'Error: a', source: sent[0].source, page: '/x', version: '1.9.0' });
  for (const noise of ['Script error.', 'ResizeObserver loop limit exceeded']) assert.equal(report('error', noise), false, noise);
  assert.equal(report('error', 'x', 'chrome-extension://abc/content.js:1:1'), false, 'розширення браузера');
  for (let k = 0; k < 20; k++) report('error', `e${k}`);
  assert.equal(sent.length, 10);
});

test('createReporter: не вдалося надіслати — гра не падає', () => {
  const report = createReporter({ version: '1', send: () => { throw new Error('offline'); } });
  assert.equal(report('error', 'x'), false);
});

/** Підставне вікно: слухачі подій, адреса, fetch. */
function fakeWin(hostname) {
  const listeners = {}, fetches = [];
  return {
    listeners, fetches,
    location: { hostname, pathname: '/cards' },
    addEventListener: (type, fn) => (listeners[type] = fn),
    fetch: (url, init) => { fetches.push([url, init]); return Promise.reject(new Error('net')); },
  };
}

test('installErrorReporting: лише на продакшн-сайті; помилка й відхилений проміс ідуть через sendBeacon', async () => {
  assert.equal(installErrorReporting({ version: '1', host: 'whoiswho-akj.pages.dev', endpoint: '/api/error', win: fakeWin('localhost') }), null);
  assert.equal(installErrorReporting({ version: '1', host: 'h', endpoint: '/e', win: undefined }), null);
  const win = fakeWin('whoiswho-akj.pages.dev');
  const beacons = [];
  const nav = { sendBeacon: (url, blob) => { beacons.push([url, blob]); return true; } };
  assert.equal(typeof installErrorReporting({ version: '1.9.0', host: 'whoiswho-akj.pages.dev', endpoint: '/api/error', win, nav }), 'function');
  win.listeners.error({ error: new Error('boom'), filename: 'app.js', lineno: 3, colno: 7 });
  win.listeners.error({ message: 'plain', filename: '' });
  win.listeners.unhandledrejection({ reason: 'rejected' });
  assert.equal(beacons.length, 3);
  assert.equal(beacons[0][0], '/api/error');
  assert.equal(beacons[0][1].type, 'text/plain');
  const body = JSON.parse(await beacons[0][1].text());
  assert.equal(body.message, 'Error: boom');
  assert.equal(body.page, '/cards');
  assert.deepEqual(JSON.parse(await beacons[1][1].text()).source, '');
  assert.equal(JSON.parse(await beacons[2][1].text()).kind, 'rejection');
  assert.deepEqual(win.fetches, []);
});

test('installErrorReporting: sendBeacon відмовив чи його немає — fetch keepalive; помилка мережі не вилітає', async () => {
  for (const nav of [{ sendBeacon: () => false }, {}, undefined]) {
    const win = fakeWin('h');
    installErrorReporting({ version: '1', host: 'h', endpoint: '/e', win, nav });
    win.listeners.error({ error: new Error('x') });
    assert.equal(win.fetches.length, 1);
    assert.equal(win.fetches[0][1].keepalive, true);
    assert.equal(win.fetches[0][1].method, 'POST');
  }
  const noFetch = { ...fakeWin('h'), fetch: undefined };
  installErrorReporting({ version: '1', host: 'h', endpoint: '/e', win: noFetch, nav: {} });
  noFetch.listeners.error({ error: new Error('x') }); // нічим надіслати — тихо
  await new Promise((r) => setTimeout(r, 0));
});
