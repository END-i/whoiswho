// Кольори: у кожної категорії своя пара (світлий → темний для градієнта), у кожного гравця — свій колір.

export const CATEGORY_COLORS = {
  guess: ['#8B6CFF', '#5B3DF0'],
  aboutme: ['#FF7BA6', '#E8467A'],
  who: ['#FFC23D', '#F08C00'],
  remember: ['#36D1C4', '#13998D'],
  kind: ['#FF8C66', '#E8573A'],
  open: ['#5EA4FF', '#2B74E6'],
  ifwhat: ['#7DCE45', '#4E9F22'],
  show: ['#EA6ADA', '#B83BA3'],
};
const FALLBACK = Object.values(CATEGORY_COLORS);

/** Пара кольорів категорії; для невідомої — з палітри за порядковим номером. */
export function categoryColor(id, index = 0) {
  return CATEGORY_COLORS[id] ?? FALLBACK[((index % FALLBACK.length) + FALLBACK.length) % FALLBACK.length];
}

export const PLAYER_COLORS = ['#FF7A1A', '#2EC4B6', '#5B3DF0', '#E8467A', '#4E9F22', '#2B74E6', '#F08C00', '#B83BA3'];

/** Стабільний колір гравця за його id (не змінюється, коли міняють ім'я). */
export function playerColor(id = '') {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return PLAYER_COLORS[h % PLAYER_COLORS.length];
}

/** Перша літера імені для кружечка без фото. */
export const initial = (name) => (String(name || '').trim().charAt(0) || '?').toUpperCase();
