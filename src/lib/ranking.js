// Місця за балами. Однакові бали — однакове місце (1, 1, 3). Якщо в усіх 0 — переможця немає.

/**
 * entries: [{ id, score, ...будь-що }] → нові об'єкти з полем place, від більших балів до менших.
 * Порядок однакових балів зберігається (стабільне сортування).
 */
export function rank(entries) {
  const sorted = [...entries].map((e) => ({ ...e, score: Number(e.score) || 0 })).sort((a, b) => b.score - a.score);
  let place = 0;
  return sorted.map((e, k) => {
    if (k === 0 || e.score !== sorted[k - 1].score) place = k + 1;
    return { ...e, place };
  });
}

/** Переможці: усі з першим місцем, але лише якщо хтось набрав більше нуля. */
export function winners(ranked) {
  return ranked.length && ranked[0].score > 0 ? ranked.filter((e) => e.place === 1) : [];
}

/** Групи для п'єдесталу: місця 1–3, у кожній групі всі, хто поділив місце. Порожньо, якщо всі на нулі. */
export function podium(ranked) {
  if (!winners(ranked).length) return [];
  const groups = [];
  for (const e of ranked) {
    if (e.place > 3) break;
    const g = groups.find((x) => x.place === e.place);
    if (g) g.players.push(e); else groups.push({ place: e.place, players: [e] });
  }
  return groups;
}
