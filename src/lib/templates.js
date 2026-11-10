// Шаблони для фото гравців: власні SVG (без сторонніх ліцензій), viewBox 0 0 100 100 поверх круглого фото.
// На кроці 6 шаблон можна буде посунути й збільшити пальцем; зараз позиція фіксована.

export const TEMPLATES = [
  { id: 'crown', kind: 'fun', name: 'Корона', svg: `
    <path d="M24 30 L30 8 L42 22 L50 4 L58 22 L70 8 L76 30 Z" fill="#ffc83d" stroke="#c8901a" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="50" cy="20" r="3.5" fill="#e5484d"/><circle cx="36" cy="22" r="2.5" fill="#3b82f6"/><circle cx="64" cy="22" r="2.5" fill="#3fae6a"/>` },
  { id: 'moustache', kind: 'fun', name: 'Вуса', svg: `
    <path d="M50 64 C44 58 34 58 28 64 C24 68 18 68 16 64 C20 74 34 76 50 68 C66 76 80 74 84 64 C82 68 76 68 72 64 C66 58 56 58 50 64 Z" fill="#3b2a1e"/>` },
  { id: 'chef', kind: 'fun', name: 'Кухар', svg: `
    <path d="M28 30 C18 30 16 14 28 14 C30 4 44 2 50 10 C56 2 70 4 72 14 C84 14 82 30 72 30 L70 36 L30 36 Z" fill="#fff" stroke="#d9cfc4" stroke-width="2"/>
    <rect x="30" y="30" width="40" height="8" rx="2" fill="#f4eee7" stroke="#d9cfc4" stroke-width="2"/>` },
  { id: 'pirate', kind: 'fun', name: 'Пірат', svg: `
    <path d="M12 34 L88 30" stroke="#222" stroke-width="3"/>
    <ellipse cx="64" cy="44" rx="11" ry="9" fill="#222"/>` },
  { id: 'cat', kind: 'fun', name: 'Котик', svg: `
    <path d="M18 34 L22 6 L42 24 Z M82 34 L78 6 L58 24 Z" fill="#ff9ec2" stroke="#d96b96" stroke-width="2" stroke-linejoin="round"/>
    <g stroke="#3b2a1e" stroke-width="1.6" stroke-linecap="round"><path d="M30 62 L12 58 M30 66 L12 68 M70 62 L88 58 M70 66 L88 68"/></g>` },
  { id: 'hearts', kind: 'fun', name: 'Окуляри-серця', svg: `
    <g fill="#e5484d" stroke="#a11d22" stroke-width="1.5">
      <path d="M36 52 C30 46 22 40 26 34 C29 30 34 31 36 35 C38 31 43 30 46 34 C50 40 42 46 36 52 Z" transform="translate(-4 4) scale(1.05)"/>
      <path d="M64 52 C58 46 50 40 54 34 C57 30 62 31 64 35 C66 31 71 30 74 34 C78 40 70 46 64 52 Z" transform="translate(2 4) scale(1.05)"/>
    </g><path d="M44 42 L56 42" stroke="#a11d22" stroke-width="2"/>` },
  { id: 'hero', kind: 'fun', name: 'Супергерой', svg: `
    <path d="M14 40 C24 32 40 34 50 40 C60 34 76 32 86 40 C84 52 70 54 58 48 C54 46 46 46 42 48 C30 54 16 52 14 40 Z" fill="#3b82f6" stroke="#1d4ed8" stroke-width="2"/>
    <ellipse cx="34" cy="42" rx="7" ry="4" fill="#fff"/><ellipse cx="66" cy="42" rx="7" ry="4" fill="#fff"/>` },
  { id: 'week', kind: 'serious', name: 'Гравець тижня', svg: `
    <circle cx="50" cy="50" r="47" fill="none" stroke="#ffc83d" stroke-width="5"/>
    <path d="M10 80 L90 80 L84 90 L90 98 L10 98 L16 90 Z" fill="#e5484d"/>
    <text x="50" y="92.5" font-size="8" font-weight="800" fill="#fff" text-anchor="middle" font-family="system-ui" textLength="66" lengthAdjust="spacingAndGlyphs">ГРАВЕЦЬ ТИЖНЯ</text>` },
  { id: 'medal', kind: 'serious', name: 'Медаль', svg: `
    <circle cx="50" cy="50" r="47" fill="none" stroke="#c8901a" stroke-width="4" stroke-dasharray="3 3"/>
    <path d="M70 70 L78 96 L84 88 L92 92 L84 66 Z" fill="#3b82f6"/>
    <circle cx="80" cy="72" r="11" fill="#ffc83d" stroke="#c8901a" stroke-width="2"/><text x="80" y="76" font-size="10" font-weight="900" fill="#8a5a0a" text-anchor="middle" font-family="system-ui">1</text>` },
  { id: 'polaroid', kind: 'serious', name: 'Полароїд', svg: `
    <rect x="3" y="3" width="94" height="94" rx="4" fill="none" stroke="#fff" stroke-width="7"/>
    <rect x="3" y="80" width="94" height="17" fill="#fff"/>` },
  { id: 'laurel', kind: 'serious', name: 'Лаври', svg: `
    <g fill="#3fae6a" stroke="#2a7d4a" stroke-width=".8">${Array.from({ length: 7 }, (_, k) => {
      // Ліва гілка — дуга від верху до низу зліва, права — дзеркальна
      const deg = 130 + k * 20, a = deg * Math.PI / 180;
      const x = 50 + Math.cos(a) * 46, y = 50 - Math.sin(a) * 46, r = 90 - deg;
      const leaf = (cx, rot) => `<ellipse cx="${cx.toFixed(1)}" cy="${y.toFixed(1)}" rx="7" ry="3.2" transform="rotate(${rot} ${cx.toFixed(1)} ${y.toFixed(1)})"/>`;
      return leaf(x, r) + leaf(100 - x, -r);
    }).join('')}</g>` },
];

export const templateById = (id) => TEMPLATES.find((t) => t.id === id);

// ---------- положення шаблону на фото ----------
// x, y — зсув у відсотках розміру аватарки (−40…40), s — масштаб (0.6…1.6).
export const TPL_DEFAULT = Object.freeze({ x: 0, y: 0, s: 1 });
const clampNum = (v, a, b, d) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d);

/** Безпечне положення шаблону: заповнює відсутнє й обмежує межами. */
export function clampTpl(pos) {
  const p = pos && typeof pos === 'object' ? pos : {};
  return {
    x: Math.round(clampNum(p.x, -40, 40, 0) * 10) / 10,
    y: Math.round(clampNum(p.y, -40, 40, 0) * 10) / 10,
    s: Math.round(clampNum(p.s, 0.6, 1.6, 1) * 100) / 100,
  };
}

/** Зсув після перетягування пальцем: dxPx, dyPx — пікселі, size — розмір прев'ю в пікселях. */
export function dragTpl(pos, dxPx, dyPx, size) {
  const p = clampTpl(pos);
  if (!size) return p;
  return clampTpl({ ...p, x: p.x + (dxPx / size) * 100, y: p.y + (dyPx / size) * 100 });
}

/** CSS-трансформація для шару шаблону. */
export const tplTransform = (pos) => {
  const p = clampTpl(pos);
  return `translate(${p.x}%, ${p.y}%) scale(${p.s})`;
};
