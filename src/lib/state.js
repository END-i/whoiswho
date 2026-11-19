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
 */

export const VERSION = 2;

// ---------- бали ----------
/**
 * Бали: «Правильно» — 20. Питання без правильної відповіді — бали за сміливість: відповів — 10,
 * а в сміливій категорії («Відкрийся», «Покажи!», виклики…) — навмання 30, 40 чи 50 (з 1.9.0). Пропуск — 0.
 * Серія: з третьої відповіді з балами поспіль гравець щоразу отримує ще streak.
 */
export const POINTS = { right: 20, answer: 10, brave: [30, 40, 50], streak: 10 };
/** З якої відповіді поспіль діє бонус за серію. */
export const STREAK_FROM = 3;
/** Шкала балів у збереженій грі й історії: до 1.7.0 за відповідь був 1 бал (тепер це 20). */
export const POINT_SCALE = 2;
export const OLD_POINT = POINTS.right;
/** Питання без правильної відповіді — бали за те, що відповів. */
export const isRated = (type) => type === 'open' || type === 'activity';
/**
 * Бали сміливого питання в цій грі: 30, 40 чи 50 — навмання, але сталі для гри й питання
 * (перезавантаження чи «Скасувати» не перекидають жереб).
 */
export function bravePoints(seed, qid) {
  return POINTS.brave[gameHash(seed, qid) % POINTS.brave.length];
}
/** Невід'ємне ціле з seed гри й рядка: «навмання», але однаково після перезавантаження. */
function gameHash(seed, text) {
  let h = (seed >>> 0) || 1;
  for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 2654435761) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}
/** Скільки балів дає картка: вгадав — right; відповів на відкрите — answer, у сміливій категорії — bravePoints. */
export const pointsFor = (question, category, seed = 0) =>
  (!isRated(question.type) ? POINTS.right : category?.brave ? bravePoints(seed, question.id) : POINTS.answer);

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

export function newGame({ players, pack = 'family', audience = 'family', scoring = false, questions, prevDeck = null, rand = Math.random }) {
  return {
    version: VERSION, points: POINT_SCALE,
    seed: Math.floor(rand() * 2 ** 31), // для балів сміливих питань і того, кого вибирає гра (роль any)
    order: players.map((p) => p.id),
    pack, audience, scoring, turn: 0,
    deck: buildDeck(questions, prevDeck, rand),
    used: {},
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    streak: {}, // id → скільки відповідей з балами поспіль
    gone: {},
    stats: { answered: 0, skipped: 0 },
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
/** Номери ще не відкритих карт категорії. */
export const openNumbers = (game, cat) => (game.deck[cat] || []).map((_, k) => k + 1).filter((n) => !isUsed(game, cat, n));
/** Випадкова ще не відкрита карта категорії (номер) або null. */
export function randomNumber(game, cat, rand = Math.random) {
  const nums = openNumbers(game, cat);
  return nums.length ? nums[Math.min(nums.length - 1, Math.floor(rand() * nums.length))] : null;
}
/** «🎲 Випадкове»: випадкова категорія з тих, де ще є карти, і в ній випадкова карта; нічого немає — null. */
export function randomCard(game, cats, rand = Math.random) {
  const open = cats.filter((c) => remaining(game, c));
  if (!open.length) return null;
  const cat = open[Math.min(open.length - 1, Math.floor(rand() * open.length))];
  return { cat, num: randomNumber(game, cat, rand) };
}

/** Завершити гру: далі лише підсумок і нова гра. */
export const endGame = (game) => ({ ...game, over: true });

/**
 * Закриває картку й передає хід далі.
 * outcome: 'answered' | 'skipped' | 'correct' | 'wrong'. За 'correct' бал отримує гравець з індексом answerer.
 * Серія: 'correct' — +1 тому, хто отримав бали (з STREAK_FROM-ї — ще POINTS.streak); 'wrong' — серія того,
 * хто відповідав, з нуля; пропуск — серія того, чия черга, з нуля. last.bonus — бонус за серію цієї картки.
 */
export function finishCard(game, cat, num, outcome, answerer = null, points = POINTS.right) {
  if (game.over || isUsed(game, cat, num)) return game;
  const pid = answerer !== null ? game.order[answerer] : null;
  const before = game.streak || {};
  const streak = { ...before };
  let bonus = 0;
  if (outcome === 'correct' && pid) {
    streak[pid] = (before[pid] || 0) + 1;
    if (streak[pid] >= STREAK_FROM) bonus = POINTS.streak;
  } else if (outcome === 'wrong' && pid) streak[pid] = 0;
  else if (outcome === 'skipped') streak[game.order[game.turn]] = 0;
  const scores = outcome === 'correct' && pid ? { ...game.scores, [pid]: (game.scores[pid] || 0) + points + bonus } : game.scores;
  return {
    ...game, scores, streak,
    // для «Скасувати»: як було до цієї картки (лише один крок назад)
    last: { cat, num, turn: game.turn, scores: game.scores, stats: game.stats, streak: before, bonus },
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
  // склад змінився — «Скасувати» вже не має сенсу (черга й бали могли зсунутися)
  return { ...game, order, turn, scores, gone, last: null };
}

/**
 * Скасувати останню картку: вона знову закрита, бали, статистика й черга — як до неї.
 * Лише один крок; після завершення гри чи зміни складу — нічого.
 */
export function undoCard(game) {
  const l = game.last;
  if (!l || game.over) return game;
  return {
    ...game, turn: l.turn, scores: l.scores, stats: l.stats, streak: l.streak || {}, last: null,
    used: { ...game.used, [l.cat]: (game.used[l.cat] || []).filter((n) => n !== l.num) },
  };
}

// ---------- ролі ----------

/**
 * Індекс гравця для ролі, відлік від того, чия черга (i), при n гравцях.
 * self — той, чия черга; any — гра вибирає будь-кого з інших (місця за столом не важливі, рішення 19.11):
 * навмання, але стало для гри й питання (seed + id), тож перезавантаження й «Скасувати» не міняють людину.
 */
export function seat(role, i, n, seed = 0, qid = '') {
  switch (role) {
    case 'self': return i;
    case 'any': {
      const k = gameHash(seed, `any:${qid}`) % (n - 1);
      return k >= i ? k + 1 : k;
    }
    default: throw new Error(`Невідома роль: ${role}`);
  }
}

/** Хто відповідає і про кого питання (індекси в order). */
export function roles(q, i, n, seed = 0) {
  const answerer = seat(q.answerer, i, n, seed, q.id);
  const about = q.about === 'answerer' ? answerer : seat(q.about, i, n, seed, q.id);
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
    // гра, почата до 1.7.0: 1 бал тоді — 20 тепер
    turn, deck, used, scores: g.points === POINT_SCALE ? { ...g.scores } : Object.fromEntries(Object.entries(g.scores).map(([k, v]) => [k, (+v || 0) * OLD_POINT])),
    gone: { ...(g.gone || {}) }, points: POINT_SCALE,
    seed: Number.isInteger(g.seed) ? g.seed : 0,
    streak: Object.fromEntries(Object.entries(g.streak && typeof g.streak === 'object' ? g.streak : {}).filter(([id, n]) => g.order.includes(id) && Number.isInteger(n) && n > 0)),
    stats: { answered: +g.stats.answered || 0, skipped: +g.stats.skipped || 0 },
    over: !!g.over,
  };
}
