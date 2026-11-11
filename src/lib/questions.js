// Набори питань (src/data/packs/*.json): значення за замовчуванням, перевірка схеми, фільтр аудиторії.
// Без Svelte — щоб можна було тестувати в Node.

export const TYPES = ['open', 'choice', 'activity', 'guess', 'who', 'quiz'];
export const AUDIENCES = ['all', 'kids'];
export const ROLES = ['self', 'left', 'right', 'pick'];
export const ABOUT = [...ROLES, 'answerer'];

const defaultsOf = (meta) => ({
  type: 'open', audience: 'all', answerer: 'self', about: 'answerer',
  ...(meta?.fieldDefaults || {}),
});

/** Питання з усіма полями, навіть якщо в JSON їх не вказано. */
export function withDefaults(q, meta) {
  return { ...defaultsOf(meta), ...q };
}

/** Чи про іншу людину, ніж та, що відповідає. */
export function isAboutOther(q) {
  return !(q.about === 'answerer' || q.about === q.answerer);
}

export const PACK_ORDER = ['family', 'couples', 'friends', 'adults'];
export const MAX_PLAYERS = 8;

/** Опис набору в meta.pack: id, назва, скільки гравців; kids — є фільтр «Лише діти»; adults — лише для 18+. */
function packErrors(pack) {
  if (!pack || typeof pack !== 'object') return ['Немає meta.pack — опису набору'];
  const e = [];
  if (typeof pack.id !== 'string' || !/^[a-z]+$/.test(pack.id)) e.push('meta.pack.id — латинські малі літери');
  for (const f of ['emoji', 'title', 'description']) if (!pack[f]) e.push(`meta.pack.${f} порожній`);
  const { minPlayers: lo, maxPlayers: hi } = pack;
  if (!Number.isInteger(lo) || lo < 2) e.push('meta.pack.minPlayers — ціле число від 2');
  else if (!Number.isInteger(hi) || hi < lo || hi > MAX_PLAYERS) e.push(`meta.pack.maxPlayers — від minPlayers до ${MAX_PLAYERS}`);
  if (pack.kids && pack.adults) e.push('Набір не може бути водночас для дітей і 18+');
  return e;
}

/** Повертає список помилок українською. Порожній список — усе гаразд. */
export function validate(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') return ['Файл питань порожній або не є JSON-об\'єктом'];
  const { meta, categories, questions } = raw;
  if (!meta) errors.push('Немає розділу meta');
  else {
    if (!meta.title) errors.push('meta.title порожній');
    if (!Array.isArray(meta.rules) || !meta.rules.length) errors.push('meta.rules має бути непорожнім списком');
    if (!Array.isArray(meta.scoringCategories)) errors.push('meta.scoringCategories має бути списком');
    errors.push(...packErrors(meta.pack));
  }
  if (!Array.isArray(categories) || !categories.length) errors.push('categories має бути непорожнім списком');
  if (!Array.isArray(questions) || !questions.length) errors.push('questions має бути непорожнім списком');
  if (errors.length) return errors;

  const catIds = new Set();
  categories.forEach((c, i) => {
    const where = `Категорія #${i + 1}${c.id ? ` (${c.id})` : ''}`;
    if (!c.id) errors.push(`${where}: немає id`);
    else if (catIds.has(c.id)) errors.push(`${where}: id повторюється`);
    catIds.add(c.id);
    for (const f of ['emoji', 'title', 'description']) if (!c[f]) errors.push(`${where}: порожнє поле ${f}`);
  });
  for (const id of meta.scoringCategories) if (!catIds.has(id)) errors.push(`meta.scoringCategories: немає категорії «${id}»`);

  const ids = new Set();
  questions.forEach((raw0, i) => {
    const q = withDefaults(raw0, meta);
    const where = `Питання #${i + 1}${raw0.id ? ` (${raw0.id})` : ''}`;
    if (!raw0.id) errors.push(`${where}: немає id`);
    else if (ids.has(raw0.id)) errors.push(`${where}: id повторюється`);
    ids.add(raw0.id);
    if (!catIds.has(q.category)) errors.push(`${where}: немає категорії «${q.category}»`);
    if (!q.text || typeof q.text !== 'string') { errors.push(`${where}: порожній текст`); return; }
    if (!TYPES.includes(q.type)) errors.push(`${where}: невідомий type «${q.type}»`);
    if (q.audience === 'adults') errors.push(`${where}: audience «adults» не підтримується — гра сімейна (дорослий режим у беклозі)`);
    else if (!AUDIENCES.includes(q.audience)) errors.push(`${where}: невідомий audience «${q.audience}»`);
    else if (q.audience === 'kids' && !meta.pack?.kids) errors.push(`${where}: audience «kids» — лише в наборі з фільтром «Лише діти»`);
    if (!ROLES.includes(q.answerer)) errors.push(`${where}: невідомий answerer «${q.answerer}»`);
    if (!ABOUT.includes(q.about)) errors.push(`${where}: невідомий about «${q.about}»`);
    if (q.type === 'who' && (raw0.answerer || raw0.about)) errors.push(`${where}: у «Хто з нас» не задають answerer чи about`);
    if (q.type === 'guess' && !isAboutOther(q)) errors.push(`${where}: у guess той, хто відповідає, і той, про кого питання, мають бути різними`);
    // Імен у тексті немає: роль пишемо словами («гравець ліворуч»), тож фігурних дужок бути не може.
    if (/[{}]/.test(q.text)) errors.push(`${where}: у тексті є «{…}» — імена не підставляються, пиши роль словами`);
    // «Цікаві факти»: відповідь ховається за кнопкою; відповідає сам той, чия черга
    if (q.type === 'quiz') {
      if (!raw0.answer || typeof raw0.answer !== 'string') errors.push(`${where}: у quiz потрібна відповідь (answer)`);
      if (q.answerer !== 'self' || q.about !== 'answerer') errors.push(`${where}: у quiz відповідає той, чия черга, — без answerer і about`);
    } else if (raw0.answer !== undefined) errors.push(`${where}: answer буває лише в quiz`);
    // «той, чия черга» звучить заплутано: до того, чия черга, звертаємось на «ти» (form: 'you')
    if (/чия черга/i.test(q.text)) errors.push(`${where}: «той, чия черга» — заплутано; звертайся на «ти» й постав form: "you"`);
    if (raw0.form !== undefined && raw0.form !== 'you') errors.push(`${where}: невідомий form «${raw0.form}» (є лише "you")`);
    if (raw0.form === 'you' && (q.about !== 'self' || q.answerer === 'self')) errors.push(`${where}: form "you" — питання до того, чия черга (about: self), а відповідає інший`);
  });
  return errors;
}

/** Нормалізовані дані: питання з усіма полями. Кидає помилку, якщо схема зламана. */
export function load(raw) {
  const errors = validate(raw);
  if (errors.length) { const e = new Error(errors.join('\n')); e.errors = errors; throw e; }
  return {
    meta: raw.meta,
    categories: raw.categories,
    questions: raw.questions.map((q) => withDefaults(q, raw.meta)),
  };
}

/** Фільтр аудиторії: 'family' — лише all; 'kids' — all і kids. */
export function byAudience(questions, filter) {
  const ok = filter === 'kids' ? ['all', 'kids'] : ['all'];
  return questions.filter((q) => ok.includes(q.audience));
}

/**
 * Усі набори разом. files — { назва файлу: вміст }. Повертає { packs: { id: дані }, order, errors }.
 * Id питань не повторюються між наборами: озвучка в одній теці. Без сімейного набору гра не працює.
 */
export function loadPacks(files) {
  const packs = {}, errors = [], owner = new Map();
  for (const [name, raw] of Object.entries(files)) {
    const errs = validate(raw);
    if (errs.length) { errors.push(...errs.map((e) => `${name}: ${e}`)); continue; }
    const id = raw.meta.pack.id;
    if (packs[id]) { errors.push(`${name}: набір «${id}» уже є`); continue; }
    for (const q of raw.questions) {
      if (owner.has(q.id)) errors.push(`${name}: питання ${q.id} уже є в наборі «${owner.get(q.id)}»`);
      else owner.set(q.id, id);
    }
    packs[id] = load(raw);
  }
  if (!packs.family && !errors.length) errors.push('Немає сімейного набору (family)');
  const order = [...PACK_ORDER.filter((id) => packs[id]), ...Object.keys(packs).filter((id) => !PACK_ORDER.includes(id))];
  return { packs, order, errors };
}
