// Історія ігор і загальна таблиця за всі ігри. Зберігається разом з грою в localStorage.

import { rank, winners } from './ranking.js';
import { POINT_SCALE, OLD_POINT } from './state.js';

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
    date, finished, scoring: !!game.scoring, pack: game.pack || 'family', points: POINT_SCALE,
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
    .map((r) => ({
      ...r, pack: typeof r.pack === 'string' ? r.pack : 'family', winners: Array.isArray(r.winners) ? r.winners : [], cards: r.cards || { answered: 0, skipped: 0 },
      // ігри до 1.7.0 рахували по 1 балу — переводимо в нову шкалу, щоб загальна таблиця була чесною
      points: POINT_SCALE, players: r.points === POINT_SCALE ? r.players : r.players.map((p) => ({ ...p, score: p.score * OLD_POINT })),
    }))
    .slice(0, HISTORY_LIMIT);
}

/** Ім'я для зведення гравців: без різниці великих і малих літер і зайвих пробілів. */
export const nameKey = (name) => String(name).trim().replace(/\s+/g, ' ').toLocaleLowerCase('uk');

/**
 * Загальна таблиця за всі ігри: для кожного гравця — ігри, перемоги, сума балів.
 * Гравець — за ім'ям, яке видно в списку ігор (з 18.11): вдома рядки гравців переписують під інших людей
 * («Том» → «Мама»), і зведення за id дописувало чужі бали. Двоє з однаковим ім'ям в одній грі — різні люди.
 * id запису — з найсвіжішої гри (для фото). Порядок: перемоги, далі бали; однакові показники — однакове місце.
 */
export function leaderboard(history) {
  const byName = new Map();
  // історія зберігається від нових до старих — перший запис, який зустрінемо, найсвіжіший
  for (const r of history) {
    const seen = new Map();
    for (const p of r.players) {
      const base = nameKey(p.name);
      const n = seen.get(base) || 0;
      seen.set(base, n + 1);
      const key = n ? `${base}#${n}` : base;
      const e = byName.get(key) || { id: p.id, name: p.name, games: 0, wins: 0, points: 0 };
      e.games += 1;
      e.points += r.scoring === false ? 0 : p.score;
      if (r.winners.includes(p.id)) e.wins += 1;
      byName.set(key, e);
    }
  }
  // однакові перемоги розводимо за балами: «рахунок» = перемоги * велике число + бали
  const ranked = rank([...byName.values()].map((e) => ({ ...e, score: e.wins * 1e6 + e.points })));
  return ranked.map(({ score, ...e }) => e);
}
