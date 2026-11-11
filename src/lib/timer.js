// Таймер для «Покажи!» і викликів: 30 секунд, останні 5 — тикання, наприкінці — сигнал.
// Чиста логіка без setInterval: скільки лишилось — з моменту старту й поточного часу (тестується без годинника).

export const TIMER_SECONDS = 30;
/** Скільки останніх секунд тикає. */
export const TICK_FROM = 5;

/** Скільки цілих секунд лишилось (від total до 0). */
export function secondsLeft(startedAt, now, total = TIMER_SECONDS) {
  return Math.max(0, Math.ceil(total - (now - startedAt) / 1000));
}

/** Який звук на зміні секунди: 'tick' — в останні секунди, 'end' — час вийшов, null — тиша. */
export function timerSound(prev, left) {
  if (left === prev) return null;
  if (left === 0) return 'end';
  return left <= TICK_FROM ? 'tick' : null;
}

/** 0:30, 0:05 */
export const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
