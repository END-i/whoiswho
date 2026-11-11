// Зіграні питання між іграми: нова гра спершу роздає ті, що ще не траплялися.
// seen — { набір: [id, …] }, зберігається на телефоні разом з грою.

/** Скільки незіграних має лишитися в категорії; менше — категорія починається по колу (сітка з 1–2 карток дивна). */
export const MIN_FRESH = 3;

/** Позначити питання зіграним у наборі. */
export function markSeen(seen, pack, id) {
  if (!id) return seen;
  const list = seen[pack] || [];
  return list.includes(id) ? seen : { ...seen, [pack]: [...list, id] };
}

/**
 * Питання для нової гри. У кожній категорії — лише незіграні; якщо їх менше за MIN_FRESH,
 * категорія починається по колу: усі її питання знову в грі, а зіграні з неї забуваються.
 * Повертає { questions, seen, restarted: [id категорій, що почались по колу] }.
 */
export function freshQuestions(questions, seen, pack, min = MIN_FRESH) {
  const ids = new Set(questions.map((q) => q.id));
  // питання, яких уже немає у файлі (чи не для цієї аудиторії), не рахуємо
  const was = new Set((seen[pack] || []).filter((id) => ids.has(id)));
  const byCat = new Map();
  for (const q of questions) byCat.set(q.category, [...(byCat.get(q.category) || []), q]);
  const out = [], restarted = [];
  for (const [cat, qs] of byCat) {
    const fresh = qs.filter((q) => !was.has(q.id));
    if (fresh.length >= min || fresh.length === qs.length) out.push(...fresh);
    else { out.push(...qs); restarted.push(cat); qs.forEach((q) => was.delete(q.id)); }
  }
  const keep = (seen[pack] || []).filter((id) => !ids.has(id) || was.has(id));
  return { questions: out, seen: { ...seen, [pack]: keep }, restarted };
}

/** Перевірити збережене: лише { рядок: [рядки] }. */
export function cleanSeen(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw)
    .filter(([, v]) => Array.isArray(v))
    .map(([k, v]) => [k, [...new Set(v.filter((x) => typeof x === 'string'))]]));
}
