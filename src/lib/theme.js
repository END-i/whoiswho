// Кольори: у кожної категорії своя пара (світлий → темний для градієнта), у кожного гравця — свій колір.

// [світлий, темний, колір тексту]. Підібрано обчисленням: текст має контраст ≥ 4.5 (WCAG AA) з обома кінцями градієнта.
export const INK = '#2D1B3D';
export const CATEGORY_COLORS = {
  guess: ['#795EDD', '#5B3DF0', '#FFFFFF'],
  aboutme: ['#FF7BA6', '#EA5887', INK],
  who: ['#FFC23D', '#F08C00', INK],
  remember: ['#36D1C4', '#219F94', INK],
  kind: ['#FF8C66', '#E95F44', INK],
  open: ['#4374B5', '#296FDD', '#FFFFFF'],
  ifwhat: ['#7DCE45', '#4E9F22', INK],
  show: ['#B050A4', '#B83BA3', '#FFFFFF'],
  facts: ['#5BC0EB', '#1E96D1', INK],
  // для пар
  cguess: ['#F06292', '#E35B8D', INK],
  cstory: ['#FFB74D', '#F57C00', INK],
  cdreams: ['#8367B4', '#673AB7', '#FFFFFF'],
  cwarm: ['#FF8A80', '#EA5D59', INK],
  cwho: ['#FFD54F', '#FFA000', INK],
  cdare: ['#4DB6AC', '#299C90', INK],
  // для друзів
  fwho: ['#FFCA28', '#FF8F00', INK],
  fguess: ['#7E57C2', '#5E35B1', '#FFFFFF'],
  fstory: ['#26C6DA', '#00ACC1', INK],
  fdare: ['#C94643', '#C62828', '#FFFFFF'],
  fifwhat: ['#9CCC65', '#689F38', INK],
  fhonest: ['#5C6BC0', '#3949AB', '#FFFFFF'],
  flaugh: ['#FF7043', '#E96035', INK],
  // 18+
  aconfess: ['#AD1457', '#880E4F', '#FFFFFF'],
  adate: ['#D0386B', '#C2185B', '#FFFFFF'],
  aflirt: ['#F48FB1', '#EE5488', INK],
  awho: ['#FFB300', '#FF6F00', INK],
  aguess: ['#8E24AA', '#6A1B9A', '#FFFFFF'],
  adesire: ['#D32F2F', '#B71C1C', '#FFFFFF'],
  abold: ['#6D4C41', '#4E342E', '#FFFFFF'],
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

/**
 * Різні кольори гравцям одного списку: свій збережений колір, якщо він з палітри й ще не зайнятий,
 * інакше колір за id, а коли й він зайнятий — перший вільний. Хто не змінився — той самий об'єкт.
 */
export function assignColors(players) {
  const used = new Set();
  return players.map((p) => {
    let c = PLAYER_COLORS.includes(p.color) && !used.has(p.color) ? p.color : playerColor(p.id);
    if (used.has(c)) c = PLAYER_COLORS.find((x) => !used.has(x)) ?? c;
    used.add(c);
    return c === p.color ? p : { ...p, color: c };
  });
}

/** Перша літера імені для кружечка без фото. */
export const initial = (name) => (String(name || '').trim().charAt(0) || '?').toUpperCase();

// ---------- контраст (WCAG 2.x) ----------
const channel = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
/** Відносна яскравість кольору #RRGGBB. */
export function luminance(hex) {
  const h = String(hex).replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`Колір має бути #RRGGBB: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
/** Контраст двох кольорів, від 1 до 21. */
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// Кольори інтерфейсу (дублюють CSS-змінні в App.svelte; тест звіряє їх з CSS)
export const TOKENS = {
  light: { bg: '#FFF5EA', card: '#FFFFFF', ink: INK, dim: '#76637E', accent: '#E66E18', ok: '#2AA660', no: '#E0434C' },
  dark: { bg: '#1A1224', card: '#2A1F38', ink: '#F8F0FF', dim: '#B7A6C6', accent: '#E66E18', ok: '#2AA660', no: '#E0434C' },
};
