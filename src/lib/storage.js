// Збереження в localStorage. Сховище передається параметром, щоб тести працювали без браузера.
// Фото зараз теж тут (до 8 × ~25 КБ); на кроці 6 вони переїдуть в IndexedDB.

export const KEY = 'whoiswho.v2';

export function loadAll(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && typeof d === 'object' ? d : null;
  } catch {
    return null; // пошкоджений JSON — починаємо з нуля
  }
}

export function saveAll(data, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false; // переповнене сховище чи приватний режим — гра працює далі без збереження
  }
}

export const newId = () => Math.random().toString(36).slice(2, 10);
