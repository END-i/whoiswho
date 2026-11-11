// Логіка гри без Svelte: колода з перемішуванням (derangement), черга, бали, зміна гравців.
// Усі функції чисті: повертають новий стан і не змінюють старий.

/**
 * @typedef {{ id: string, name: string, photo?: string|null, template?: string|null }} Player
 * @typedef {Object} Game
 * @property {number} version
 * @property {string[]} order            id гравців за годинниковою стрілкою; order[i+1] сидить ліворуч від order[i]
 * @property {string} pack                    набір питань (src/data/packs)
 * @property {'family'|'kids'} audience
 * @property {boolean} scoring
 * @property {number} turn               індекс в order того, чия черга
 * @property {Object<string,(string|null)[]>} deck  категорія → id питань; номер = індекс + 1; null — питання прибрали з файлу
 * @property {Object<string,number[]>} used          категорія → використані номери
 * @property {Object<string,number>} scores          id гравця → бали (видалені гравці лишаються)
 * @property {Object<string,string>} gone            id видаленого гравця → ім'я, щоб показати в підсумку
 * @property {{answered:number, skipped:number}} stats
 * @property {boolean} [over]                    гру завершено — лишається лише підсумок
 * @property {string[]} restarted               категорії, у яких усі питання вже були, і вони пішли по колу
 */

export const VERSION = 2;

// ---------- перемішування ----------

/** Фішер–Єйтс. rand — функція [0,1), щоб тести були відтворюваними. */
export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Розкладає ids по номерах так, щоб жодне питання не отримало свій номер з минулої гри.
 * prev — Map id → минулий номер (1-based). Перевіряються лише спільні питання.
 * Якщо питання одне — збіг дозволений (інакше неможливо).
 */
export function derange(ids, prev, rand = Math.random) {
  const n = ids.length;
  if (n <= 1) return ids.slice();
  const bad = (a, pos) => prev.get(a[pos]) === pos + 1;
  for (let t = 0; t < 30; t++) {
    const a = shuffle(ids, rand);
    if (!a.some((_, k) => bad(a, k))) return a;
  }
  // Запасний шлях: міняємо конфліктні позиції, доки конфліктів не лишиться.
  // Кожне питання має щонайбільше один заборонений номер, і кожен номер заборонений
  // щонайбільше одному питанню, тож при n ≥ 2 обмін, що прибирає конфлікт, існує завжди.
  const a = shuffle(ids, rand);
  for (let guard = 0; guard < n * n; guard++) {
    const k = a.findIndex((_, pos) => bad(a, pos));
    if (k < 0) return a;
    for (let j = 0; j < n; j++) {
      if (j === k) continue;
      if (prev.get(a[k]) !== j + 1 && prev.get(a[j]) !== k + 1) { [a[k], a[j]] = [a[j], a[k]]; break; }
    }
  }
  return a;
}

/** Колода нової гри: для кожної категорії свій порядок. prevDeck — колода минулої гри (або null). */
export function buildDeck(questions, prevDeck = null, rand = Math.random) {
  const byCat = {};
  for (const q of questions) (byCat[q.category] ||= []).push(q.id);
  const deck = {};
  for (const [cat, ids] of Object.entries(byCat)) {
    const prev = new Map();
    (prevDeck?.[cat] || []).forEach((id, k) => id && prev.set(id, k + 1));
    deck[cat] = derange(ids, prev, rand);
  }
  return deck;
}

// ---------- гра ----------

export function newGame({ players, pack = 'family', audience = 'family', scoring = false, questions, prevDeck = null, restarted = [], rand = Math.random }) {
  return {
    version: VERSION,
    order: players.map((p) => p.id),
    pack, audience, scoring, turn: 0,
    deck: buildDeck(questions, prevDeck, rand),
    used: {},
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    gone: {},
    stats: { answered: 0, skipped: 0 },
    restarted,
  };
}

export const total = (game, cat) => game.deck[cat]?.length || 0;
export const isUsed = (game, cat, num) => !!game.used[cat]?.includes(num) || game.deck[cat]?.[num - 1] == null;
export const remaining = (game, cat) => {
  const d = game.deck[cat] || [];
  return d.reduce((s, id, k) => s + (id != null && !game.used[cat]?.includes(k + 1) ? 1 : 0), 0);
};
export const questionAt = (game, cat, num) => game.deck[cat]?.[num - 1] ?? null;
export const allDone = (game) => Object.keys(game.deck).every((c) => remaining(game, c) === 0);

/** Завершити гру: далі лише підсумок і нова гра. */
export const endGame = (game) => ({ ...game, over: true });

/**
 * Закриває картку й передає хід далі.
 * outcome: 'answered' | 'skipped' | 'correct' | 'wrong'. За 'correct' бал отримує гравець з індексом answerer.
 */
export function finishCard(game, cat, num, outcome, answerer = null) {
  if (game.over || isUsed(game, cat, num)) return game;
  const pid = answerer !== null ? game.order[answerer] : null;
  const scores = outcome === 'correct' && pid ? { ...game.scores, [pid]: (game.scores[pid] || 0) + 1 } : game.scores;
  return {
    ...game, scores,
    used: { ...game.used, [cat]: [...(game.used[cat] || []), num] },
    turn: (game.turn + 1) % game.order.length,
    stats: {
      answered: game.stats.answered + (outcome === 'skipped' ? 0 : 1),
      skipped: game.stats.skipped + (outcome === 'skipped' ? 1 : 0),
    },
  };
}

/**
 * Новий склад гравців посеред гри (перейменування, порядок, додавання, видалення).
 * names — id → ім'я для всіх, хто будь-коли грав (щоб показати видалених у підсумку).
 * Хід лишається в того самого гравця; якщо його прибрали — переходить до наступного за колом.
 */
export function updatePlayers(game, players, names = {}) {
  const order = players.map((p) => p.id);
  if (order.length < 2) throw new Error('Потрібно щонайменше двоє гравців');
  const current = game.order[game.turn];
  let turn = order.indexOf(current);
  for (let k = 1; turn < 0 && k <= game.order.length; k++) turn = order.indexOf(game.order[(game.turn + k) % game.order.length]);
  if (turn < 0) turn = 0;
  const scores = { ...game.scores };
  for (const id of order) scores[id] ??= 0;
  const gone = { ...game.gone };
  for (const id of game.order) if (!order.includes(id)) gone[id] = names[id] ?? gone[id] ?? '';
  for (const id of order) delete gone[id];
  return { ...game, order, turn, scores, gone };
}

// ---------- ролі ----------

/**
 * Індекс гравця для ролі, відлік від того, чия черга (i), при n гравцях.
 * left = i+1, right = i−1, pick = null (вибирає той, чия черга; удвох — другий гравець одразу).
 */
export function seat(role, i, n) {
  switch (role) {
    case 'self': return i;
    case 'left': return (i + 1) % n;
    case 'right': return (i - 1 + n) % n;
    case 'pick': return n === 2 ? (i + 1) % n : null;
    default: throw new Error(`Невідома роль: ${role}`);
  }
}

/** Хто відповідає і про кого питання (індекси в order; null — треба вибрати). */
export function roles(q, i, n) {
  const answerer = seat(q.answerer, i, n);
  const about = q.about === 'answerer' ? answerer : seat(q.about, i, n);
  return { answerer, about };
}

// ---------- збереження ----------

/**
 * Перевіряє й «лікує» збережену гру під поточні питання.
 * Невідома версія чи зламаний формат — null (почнемо з нуля, нічого не падає).
 * Питання, яких уже немає у файлі, стають null у колоді: номер лишається на місці й вважається використаним.
 */
export function restoreGame(saved, questionIds, players) {
  if (!saved || saved.version !== VERSION) return null;
  const g = saved;
  if (!Array.isArray(g.order) || !g.deck || typeof g.deck !== 'object' || !g.used || !g.scores || !g.stats) return null;
  const pids = new Set(players.map((p) => p.id));
  if (g.order.length < 2 || !g.order.every((id) => pids.has(id))) return null;
  const known = new Set(questionIds);
  const deck = {};
  for (const [cat, ids] of Object.entries(g.deck)) {
    if (!Array.isArray(ids)) return null;
    deck[cat] = ids.map((id) => (known.has(id) ? id : null));
  }
  const used = {};
  for (const [cat, nums] of Object.entries(g.used)) {
    if (!deck[cat] || !Array.isArray(nums)) continue;
    used[cat] = [...new Set(nums.filter((x) => Number.isInteger(x) && x >= 1 && x <= deck[cat].length))];
  }
  const turn = Number.isInteger(g.turn) && g.turn >= 0 && g.turn < g.order.length ? g.turn : 0;
  return {
    version: VERSION, order: g.order, pack: typeof g.pack === 'string' ? g.pack : 'family', audience: g.audience === 'kids' ? 'kids' : 'family', scoring: !!g.scoring,
    turn, deck, used, scores: { ...g.scores }, gone: { ...(g.gone || {}) },
    stats: { answered: +g.stats.answered || 0, skipped: +g.stats.skipped || 0 },
    over: !!g.over,
    restarted: Array.isArray(g.restarted) ? g.restarted.filter((c) => deck[c]) : [],
  };
}
