// Звіти про помилки з браузера гравця → /api/error (приймач — src/lib/errorsink.js, база D1 у Cloudflare).
// Лише на справжньому сайті (не в розробці й не в тестах), лише технічне, не частіше одного разу на хвилину
// для тієї самої помилки й не більше 10 звітів за відкриття сторінки.

const IGNORE = [/^Script error\.?$/i, /ResizeObserver loop/i, /chrome-extension:|moz-extension:|safari-extension:/i];

/** Помилка (Error, рядок, будь-що) → { message, source } для звіту. */
export function describe(error, where = '') {
  const e = error instanceof Error ? error : null;
  const message = e ? `${e.name}: ${e.message}` : typeof error === 'string' ? error : (() => { try { return JSON.stringify(error); } catch { return String(error); } })();
  const stack = e?.stack ? e.stack.split('\n').slice(0, 4).join('\n') : '';
  return { message: String(message || 'unknown'), source: stack || where };
}

/**
 * Звітувальник: report(kind, error, where) → true, якщо звіт пішов.
 * send(body) — як надіслати (sendBeacon у браузері); now — для тестів.
 */
export function createReporter({ version, page = () => '', send, now = Date.now, limit = 10, gapMs = 60_000 }) {
  const last = new Map();
  let sent = 0;
  return function report(kind, error, where = '') {
    const { message, source } = describe(error, where);
    if (IGNORE.some((re) => re.test(message) || re.test(source))) return false;
    const key = `${kind}|${message}`;
    const t = now();
    if (sent >= limit || (last.has(key) && t - last.get(key) < gapMs)) return false;
    last.set(key, t);
    sent++;
    try {
      send(JSON.stringify({ kind, message, source, page: page(), version }));
      return true;
    } catch {
      return false;
    }
  };
}

/**
 * Ловити помилки сторінки й надсилати на endpoint. Лише коли сайт — host (продакшн):
 * у розробці, тестах і тестових версіях гілок нічого не шле. Повертає звітувальника або null.
 */
export function installErrorReporting({ version, host, endpoint, win = globalThis.window, nav = globalThis.navigator }) {
  if (!win || win.location?.hostname !== host) return null;
  const send = (body) => {
    if (nav?.sendBeacon?.(endpoint, new Blob([body], { type: 'text/plain' }))) return;
    win.fetch?.(endpoint, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } })?.catch?.(() => {});
  };
  const report = createReporter({ version, page: () => win.location.pathname, send });
  win.addEventListener('error', (e) => report('error', e.error ?? e.message, e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : ''));
  win.addEventListener('unhandledrejection', (e) => report('rejection', e.reason));
  return report;
}
