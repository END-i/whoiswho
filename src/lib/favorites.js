// Улюблені питання: ❤️ на картці. Зберігаються на телефоні разом з грою — список id.

/** Позначити чи зняти позначку. */
export const toggleFavorite = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** Улюблені з цього набору (і цієї аудиторії) — для гри «лише улюблені». */
export const favoriteQuestions = (questions, list) => {
  const set = new Set(list);
  return questions.filter((q) => set.has(q.id));
};

/** Перевірити збережене: лише рядки, без повторів. */
export const cleanFavorites = (raw) => (Array.isArray(raw) ? [...new Set(raw.filter((x) => typeof x === 'string'))] : []);
