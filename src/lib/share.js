// Підсумок гри картинкою: рядки для малювання (чиста логіка); малює екран підсумку (canvas — перевіряє e2e).
// Ділимось через меню телефона (Web Share API з файлом), а де його немає — завантажуємо PNG.

/** Рядки картинки: заголовок, місця з медалями й балами, підпис. rows — [{ name, score, place }] з rank(). */
export function shareLines(rows, { title, footer, scoring = true }) {
  const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };
  return [
    { kind: 'title', text: title },
    ...rows.slice(0, 8).map((r) => ({ kind: 'row', text: `${MEDAL[r.place] || `${r.place}.`} ${r.name}`, score: scoring ? String(r.score) : '' })),
    { kind: 'footer', text: footer },
  ];
}

/**
 * Поділитися картинкою: share з файлом, інакше — завантажити. deps — { navigator, document } (у тестах підставні).
 * Повертає 'shared' | 'downloaded' | 'cancelled'.
 */
export async function shareImage(blob, name, { navigator: nav = globalThis.navigator, document: doc = globalThis.document } = {}) {
  const file = new File([blob], name, { type: 'image/png' });
  if (nav?.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file] }); return 'shared'; } catch { return 'cancelled'; }
  }
  const a = doc.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  doc.body.appendChild(a); a.click(); a.remove();
  return 'downloaded';
}
