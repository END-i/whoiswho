// Як встановити гру на телефон: визначення платформи (чиста функція — тестується без браузера).

/**
 * 'installed' — гра вже відкрита як застосунок;
 * 'ios-safari' / 'ios-other' — iPhone/iPad (встановити можна лише з Safari);
 * 'android' — Android; 'desktop' — комп'ютер.
 */
export function platform(userAgent = '', { standalone = false, maxTouchPoints = 0 } = {}) {
  if (standalone) return 'installed';
  const ua = String(userAgent);
  // iPadOS 13+ видає себе за Mac, але має сенсорний екран
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|GSA\//i.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** Чи відкрито як встановлений застосунок (передаються matchMedia і navigator). */
export function isStandalone({ matchMedia = globalThis.matchMedia, navigator = globalThis.navigator } = {}) {
  return !!(matchMedia?.('(display-mode: standalone)')?.matches || navigator?.standalone);
}
