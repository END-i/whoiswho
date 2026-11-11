// Версія гри й «Що нового» (з CHANGELOG.md). Чисті функції — тестуються без браузера.

/** «1.1.0 · 11.11.2026 · a3fbaaa» — номер, дата збірки (дд.мм.рррр), короткий хеш коміту. */
export function formatVersion({ version, date, commit } = {}) {
  const d = date ? new Date(date) : null;
  const day = d && !Number.isNaN(+d)
    ? `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}` : '';
  return [version, day, commit ? String(commit).slice(0, 7) : ''].filter(Boolean).join(' · ');
}

/** CHANGELOG.md → [{ version, date, items[] }] у порядку файлу (нове згори). */
export function parseChangelog(md) {
  const out = [];
  for (const line of String(md || '').split(/\r?\n/)) {
    const h = line.match(/^##\s+(\d+\.\d+\.\d+)\s*(?:[—-]\s*(.+))?$/);
    if (h) { out.push({ version: h[1], date: (h[2] || '').trim(), items: [] }); continue; }
    const li = line.match(/^\s*[-*]\s+(.+)$/);
    if (li && out.length) out[out.length - 1].items.push(li[1].trim());
  }
  return out;
}

export const isSemver = (v) => /^\d+\.\d+\.\d+$/.test(String(v));
