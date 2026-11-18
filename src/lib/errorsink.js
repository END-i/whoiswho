// Приймач помилок з браузерів гравців: /api/error (Cloudflare Pages Function) → база D1 «pet-errors».
// Шле лише whoiswho (рішення 18.11; інші застосунки — можливо, згодом: додати їхній сайт в ORIGINS).
// Лише технічне: текст помилки, місце в коді, сторінка, версія, браузер.
// Захист від сміття: лише свої сайти, обрізані поля, не більше DAILY_LIMIT записів на добу, старше KEEP_DAYS — видаляється.

export const ORIGINS = {
  'https://whoiswho-akj.pages.dev': 'whoiswho',
};
export const DAILY_LIMIT = 1000;
export const KEEP_DAYS = 30;
const MAX_BODY = 8192;
const LIMITS = { version: 40, kind: 20, message: 500, source: 1000, page: 200, ua: 300 };

const cut = (v, n) => String(v ?? '').slice(0, n);

/** Тіло запиту → поля запису або null, якщо це не звіт про помилку. app — за сайтом, звідки прийшло. */
export function parseReport(text, app) {
  if (typeof text !== 'string' || text.length > MAX_BODY) return null;
  let r;
  try { r = JSON.parse(text); } catch { return null; }
  if (!r || typeof r !== 'object' || !r.message) return null;
  // сторінка — без параметрів і #: там можуть бути id карток чи пошук
  const page = cut(String(r.page ?? '').split(/[?#]/)[0], LIMITS.page);
  return {
    app,
    version: cut(r.version, LIMITS.version) || '?',
    kind: r.kind === 'rejection' ? 'rejection' : 'error',
    message: cut(r.message, LIMITS.message),
    source: cut(r.source, LIMITS.source),
    page,
    ua: '',
  };
}

const cors = (origin) => (origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {});

/** Запит до /api/error → відповідь. db — прив'язка D1 (немає — нічого не пишемо). */
export async function handleError(request, db, now = new Date()) {
  const origin = request.headers.get('Origin') || '';
  const app = ORIGINS[origin];
  if (request.method === 'OPTIONS') return new Response(null, { status: app ? 204 : 403, headers: cors(app ? origin : '') });
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  if (!app) return new Response(null, { status: 403 });
  const report = parseReport(await request.text(), app);
  if (!report) return new Response(null, { status: 400, headers: cors(origin) });
  if (!db) return new Response(null, { status: 204, headers: cors(origin) });
  report.ua = cut(request.headers.get('User-Agent'), LIMITS.ua);
  const at = now.toISOString();
  const day = at.slice(0, 10);
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM errors WHERE at >= ?').bind(day).first();
  if (n >= DAILY_LIMIT) return new Response(null, { status: 429, headers: cors(origin) });
  const old = new Date(now.getTime() - KEEP_DAYS * 86400e3).toISOString();
  await db.batch([
    db.prepare('INSERT INTO errors (at, app, version, kind, message, source, page, ua) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(at, report.app, report.version, report.kind, report.message, report.source, report.page, report.ua),
    db.prepare('DELETE FROM errors WHERE at < ?').bind(old),
  ]);
  return new Response(null, { status: 204, headers: cors(origin) });
}
