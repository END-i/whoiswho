// Історія ігор і загальна таблиця за всі ігри. Зберігається разом з грою в localStorage.

import { rank, winners } from './ranking.js';

export const HISTORY_LIMIT = 200;

/**
 * Запис гри. game — стан із state.js; names — id → ім'я (поточні й колишні гравці).
 * finished — гру завершили (а не почали нову посеред гри).
 * Повертає null, якщо в грі не відкрили жодної картки — такі ігри не зберігаємо.
 */
export function gameRecord(game, names, { finished = true, date = new Date().toISOString(), id } = {}) {
  const cards = (game?.stats?.answered || 0) + (game?.stats?.skipped || 0);
  if (!game || !cards) return null;
  const ids = [...new Set([...game.order, ...Object.keys(game.gone || {})])];
  const ranked = rank(ids.map((pid) => ({ id: pid, name: names[pid] || game.gone?.[pid] || 'Гравець', score: game.scores?.[pid] || 0 })));
  return {
    id: id || `${date}-${Math.random().toString(36).slice(2, 7)}`,
    date, finished, scoring: !!game.scoring,
    players: ranked.map(({ id: pid, name, score, place }) => ({ id: pid, name, score, place })),
    // переможець — лише в завершеній грі з балами; покинута гра рахує ігри й бали, але не перемоги
    winners: game.scoring && finished ? winners(ranked).map((e) => e.id) : [],
    cards: { answered: game.stats.answered || 0, skipped: game.stats.skipped || 0 },
  };
}

/** Додати запис на початок, обмеживши розмір історії. */
export function addRecord(history, record) {
  if (!record) return history;
  return [record, ...history.filter((r) => r.id !== record.id)].slice(0, HISTORY_LIMIT);
}

/** Перевірити й «вилікувати» збережену історію: лише записи потрібної форми. */
export function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r) => r && typeof r.id === 'string' && typeof r.date === 'string' && Array.isArray(r.players)
    && r.players.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && Number.isFinite(p.score) && Number.isInteger(p.place)))
    .map((r) => ({ ...r, winners: Array.isArray(r.winners) ? r.winners : [], cards: r.cards || { answered: 0, skipped: 0 } }))
    .slice(0, HISTORY_LIMIT);
}

/**
 * Загальна таблиця за всі ігри: для кожного гравця — ігри, перемоги, сума балів.
 * Гравець — за id, тож перейменування не ламає статистику; ім'я береться з найсвіжішої гри.
 * Порядок: перемоги, далі бали; місця — як у rank (однакові показники — однакове місце).
 */
export function leaderboard(history) {
  const byId = new Map();
  // історія зберігається від нових до старих — перше ім'я, яке зустрінемо, найсвіжіше
  for (const r of history) {
    for (const p of r.players) {
      const e = byId.get(p.id) || { id: p.id, name: p.name, games: 0, wins: 0, points: 0 };
      e.games += 1;
      e.points += r.scoring === false ? 0 : p.score;
      if (r.winners.includes(p.id)) e.wins += 1;
      byId.set(p.id, e);
    }
  }
  // однакові перемоги розводимо за балами: «рахунок» = перемоги * велике число + бали
  const ranked = rank([...byId.values()].map((e) => ({ ...e, score: e.wins * 1e6 + e.points })));
  return ranked.map(({ score, ...e }) => e);
}
