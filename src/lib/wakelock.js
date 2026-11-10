// Екран не гасне під час гри (Screen Wake Lock API).
// Браузер сам знімає блокування, коли вкладка ховається, тож при поверненні просимо знову.
// nav і doc передаються параметрами, щоб тестувати без браузера.

/** Чи вміє браузер тримати екран увімкненим. */
export const supported = (nav = globalThis.navigator) => !!nav?.wakeLock?.request;

/**
 * Керування блокуванням. set(true) — тримати екран, set(false) — відпустити.
 * Повертає { set, active, dispose }.
 */
export function createWakeLock({ nav = globalThis.navigator, doc = globalThis.document } = {}) {
  let want = false;
  let sentinel = null;
  let pending = null;

  async function acquire() {
    if (!want || sentinel || pending || !supported(nav) || doc?.visibilityState !== 'visible') return;
    pending = nav.wakeLock.request('screen')
      .then((s) => {
        pending = null;
        if (!want) { s.release?.(); return; } // поки чекали, гра вже не потребує
        sentinel = s;
        s.addEventListener?.('release', () => { if (sentinel === s) sentinel = null; });
      })
      .catch(() => { pending = null; }); // відмова (низький заряд, налаштування) — гра працює далі
    return pending;
  }
  function release() {
    const s = sentinel;
    sentinel = null;
    return s?.release?.();
  }
  const onVisibility = () => { if (doc.visibilityState === 'visible') acquire(); };
  doc?.addEventListener?.('visibilitychange', onVisibility);

  return {
    async set(on) {
      want = !!on;
      if (want) await acquire(); else await release();
    },
    active: () => !!sentinel,
    dispose() {
      want = false;
      doc?.removeEventListener?.('visibilitychange', onVisibility);
      return release();
    },
  };
}
