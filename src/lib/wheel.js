// Колесо категорій: стилі обертання, кут зупинки, сектор під стрілкою.
// Кути — у градусах, за годинниковою стрілкою; стрілка нерухома, зверху (0°).
// Сектор i займає на колесі кути від i·крок до (i+1)·крок (як conic-gradient від верху).

/**
 * Щоразу крутиться по-різному. turns — скільки повних обертів щонайменше, ms — тривалість,
 * ease — крива сповільнення (у «перескоку» вона виходить за 1: колесо проскакує й вертається).
 */
export const SPINS = [
  { id: 'classic', turns: 4, ms: 3200, ease: 'cubic-bezier(.15, .9, .25, 1)' },
  { id: 'long', turns: 8, ms: 5600, ease: 'cubic-bezier(.08, .75, .18, 1)' },
  { id: 'quick', turns: 2, ms: 1500, ease: 'cubic-bezier(.25, .9, .3, 1)' },
  { id: 'nudge', turns: 0, ms: 1100, ease: 'cubic-bezier(.3, 1.4, .5, 1)' }, // «маленький круть» — менше оберту
  { id: 'tease', turns: 3, ms: 4000, ease: 'cubic-bezier(.2, .9, .35, 1.15)' },
];

/** Випадковий стиль обертання. */
export const pickSpin = (rand = Math.random) => SPINS[Math.min(SPINS.length - 1, Math.floor(rand() * SPINS.length))];

/** Сектор під стрілкою, коли колесо повернуте на angle. */
export function sectorAt(angle, count) {
  const step = 360 / count;
  const a = (((-angle) % 360) + 360) % 360; // точка колеса, що зараз під стрілкою
  return Math.min(count - 1, Math.floor(a / step));
}

/**
 * Кут, на якому колесо зупиниться: далі від from за годинниковою, щонайменше spin.turns обертів,
 * під стрілкою — сектор index, і не точно в його центрі (так природніше).
 * Навіть «маленький круть» повертає колесо хоч на пів сектора — щоб було видно, що крутнулось.
 */
export function spinTarget(from, index, count, spin, rand = Math.random) {
  const step = 360 / count;
  const offset = (rand() - 0.5) * step * 0.7; // ±35% сектора від центру — далеко від меж
  const land = -(index * step + step / 2 + offset);
  let delta = (((land - from) % 360) + 360) % 360;
  if (delta < step / 2) delta += 360;
  return from + spin.turns * 360 + delta;
}
