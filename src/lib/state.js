// Логіка гри без Svelte. На кроці 2 тут модель стану, колода без перемішування і ролі.
// Перемішування з derangement і збереження в localStorage з'являться на кроці 3.

/**
 * Модель стану гри (повністю запрацює на кроці 3).
 * @typedef {Object} Game
 * @property {number} version            версія формату для localStorage
 * @property {string[]} players          імена за годинниковою стрілкою; players[i+1] сидить ліворуч від players[i]
 * @property {'family'|'kids'} audience  фільтр аудиторії
 * @property {boolean} scoring           режим з балами
 * @property {number} turn               індекс гравця, чия черга
 * @property {Object<string,string[]>} deck   категорія → id питань; номер картки = індекс + 1
 * @property {Object<string,number[]>} used   категорія → використані номери
 * @property {number[]} scores           бали за індексом гравця
 * @property {{answered:number, skipped:number}} stats
 */

export const VERSION = 1;

/** Колода: для кожної категорії список id у порядку номерів (на кроці 3 — перемішаний). */
export function buildDeck(questions) {
  const deck = {};
  for (const q of questions) (deck[q.category] ||= []).push(q.id);
  return deck;
}

export function newGame({ players, audience = 'family', scoring = false, questions }) {
  return {
    version: VERSION, players, audience, scoring, turn: 0,
    deck: buildDeck(questions), used: {}, scores: players.map(() => 0),
    stats: { answered: 0, skipped: 0 },
  };
}

export const remaining = (game, cat) => (game.deck[cat]?.length || 0) - (game.used[cat]?.length || 0);
export const isUsed = (game, cat, num) => !!game.used[cat]?.includes(num);
export const questionAt = (game, cat, num) => game.deck[cat]?.[num - 1];

/** Позначає номер використаним і передає хід далі. Повертає новий стан (старий не змінюється). */
export function finishCard(game, cat, num, outcome) {
  if (isUsed(game, cat, num)) return game;
  return {
    ...game,
    used: { ...game.used, [cat]: [...(game.used[cat] || []), num] },
    turn: (game.turn + 1) % game.players.length,
    stats: {
      answered: game.stats.answered + (outcome === 'skipped' ? 0 : 1),
      skipped: game.stats.skipped + (outcome === 'skipped' ? 1 : 0),
    },
  };
}

/**
 * Індекс гравця для ролі, відлік від того, чия черга (i), при n гравцях.
 * left = i+1, right = i−1, opposite = i+n/2 (при непарному n — наступний), pick = null (вибирає гравець).
 */
export function seat(role, i, n) {
  switch (role) {
    case 'self': return i;
    case 'left': return (i + 1) % n;
    case 'right': return (i - 1 + n) % n;
    case 'opposite': return n % 2 === 0 ? (i + n / 2) % n : (i + 1) % n;
    case 'pick': return n === 2 ? (i + 1) % n : null;
    default: throw new Error(`Невідома роль: ${role}`);
  }
}

/** Хто відповідає і про кого питання (індекси; null — треба вибрати). */
export function roles(q, i, n) {
  const answerer = seat(q.answerer, i, n);
  const about = q.about === 'answerer' ? answerer : seat(q.about, i, n);
  return { answerer, about };
}

/** Текст з іменами. Невідомі (ще не вибрані) імена лишаються як «…». */
export function fillText(text, names) {
  return text
    .replaceAll('{about}', names.about ?? '…')
    .replaceAll('{answerer}', names.answerer ?? '…');
}
