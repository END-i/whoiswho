import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWakeLock, supported } from '../src/lib/wakelock.js';

// Підставні navigator і document
function env({ fail = false, visible = true } = {}) {
  const listeners = {};
  const doc = {
    visibilityState: visible ? 'visible' : 'hidden',
    addEventListener: (t, f) => { listeners[t] = f; },
    removeEventListener: (t) => { delete listeners[t]; },
    fire(t) { listeners[t]?.(); },
    has: (t) => !!listeners[t],
  };
  const made = [];
  const nav = {
    wakeLock: {
      request: async () => {
        if (fail) throw new Error('NotAllowed');
        const handlers = {};
        const s = { released: false, release() { this.released = true; handlers.release?.(); }, addEventListener: (t, f) => { handlers[t] = f; } };
        made.push(s);
        return s;
      },
    },
  };
  return { doc, nav, made };
}

test('supported: є API — так, немає — ні', () => {
  assert.equal(supported(env().nav), true);
  assert.equal(supported({}), false);
  assert.equal(supported(undefined), false);
});

test('set(true) тримає екран, set(false) відпускає', async () => {
  const { doc, nav, made } = env();
  const wl = createWakeLock({ nav, doc });
  await wl.set(true);
  assert.equal(wl.active(), true); assert.equal(made.length, 1);
  await wl.set(true);
  assert.equal(made.length, 1, 'повторний запит не створює другого блокування');
  await wl.set(false);
  assert.equal(wl.active(), false); assert.equal(made[0].released, true);
});

test('вкладку сховали — браузер відпустив; повернулися — блокування знову', async () => {
  const { doc, nav, made } = env();
  const wl = createWakeLock({ nav, doc });
  await wl.set(true);
  made[0].release(); // так робить браузер, коли вкладка ховається
  assert.equal(wl.active(), false);
  doc.visibilityState = 'visible';
  doc.fire('visibilitychange');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(wl.active(), true); assert.equal(made.length, 2);
});

test('повернулися, коли блокування не потрібне, — нічого не просимо', async () => {
  const { doc, nav, made } = env();
  const wl = createWakeLock({ nav, doc });
  doc.fire('visibilitychange');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(made.length, 0);
});

test('прихована вкладка — не просимо, доки не стане видимою', async () => {
  const { doc, nav, made } = env({ visible: false });
  const wl = createWakeLock({ nav, doc });
  await wl.set(true);
  assert.equal(made.length, 0);
  doc.visibilityState = 'hidden'; doc.fire('visibilitychange');
  assert.equal(made.length, 0);
});

test('браузер відмовив — гра не падає, блокування немає', async () => {
  const { doc, nav } = env({ fail: true });
  const wl = createWakeLock({ nav, doc });
  await wl.set(true);
  assert.equal(wl.active(), false);
});

test('без API — set і dispose нічого не ламають', async () => {
  const doc = env().doc;
  const wl = createWakeLock({ nav: {}, doc });
  await wl.set(true); await wl.set(false);
  assert.equal(wl.active(), false);
  await wl.dispose();
  const wl2 = createWakeLock({ nav: undefined, doc: undefined });
  await wl2.set(true); await wl2.dispose();
});

test('відпустили, поки запит ще йшов, — отримане блокування одразу звільняється', async () => {
  const { doc, nav, made } = env();
  const wl = createWakeLock({ nav, doc });
  const p = wl.set(true);
  await wl.set(false);
  await p;
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(wl.active(), false);
  assert.equal(made[0].released, true);
});

test('чуже звільнення старого блокування не скидає нове', async () => {
  const { doc, nav, made } = env();
  const wl = createWakeLock({ nav, doc });
  await wl.set(true);
  const old = made[0];
  await wl.set(false); await wl.set(true);
  old.release(); // подія від старого
  assert.equal(wl.active(), true);
});

test('dispose знімає слухача й відпускає', async () => {
  const { doc, nav, made } = env();
  const wl = createWakeLock({ nav, doc });
  await wl.set(true);
  assert.equal(doc.has('visibilitychange'), true);
  await wl.dispose();
  assert.equal(doc.has('visibilitychange'), false);
  assert.equal(made[0].released, true);
});
