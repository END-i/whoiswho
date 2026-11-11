// Озвучка для офлайну: завантаження у фоні в окремий кеш (Cache Storage), прогрес і видалення.
// caches і fetch передаються параметрами — тестується без браузера.
// Service worker віддає /audio/*.mp3 з цього самого кешу (див. vite.config.js, runtimeCaching).

import { audioUrl } from './speech.js';

export const AUDIO_CACHE = 'whoiswho-audio';

/** Скільки файлів з переліку вже в кеші. */
export async function cachedCount(ids, { caches, base = '/', lang = 'uk' }) {
  if (!caches || !ids.length) return 0;
  const cache = await caches.open(AUDIO_CACHE);
  let n = 0;
  for (const id of ids) if (await cache.match(audioUrl(id, base, lang))) n++;
  return n;
}

/**
 * Довантажити те, чого ще немає. onProgress(done, total) після кожного файлу.
 * signal — AbortSignal, щоб зупинити. Обрив мережі не ламає вже збережене.
 * Повертає { done, total, failed }.
 */
export async function downloadAll(ids, { caches, fetch, base = '/', lang = 'uk', onProgress = () => {}, signal } = {}) {
  const total = ids.length;
  if (!caches || !fetch || !total) return { done: 0, total, failed: 0 };
  const cache = await caches.open(AUDIO_CACHE);
  let done = 0, failed = 0;
  for (const id of ids) {
    if (signal?.aborted) break;
    const url = audioUrl(id, base, lang);
    if (await cache.match(url)) { done++; onProgress(done, total); continue; }
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(String(res.status));
      await cache.put(url, res);
      done++;
    } catch {
      failed++; // мережа зникла чи файлу немає — спробуємо наступного разу
    }
    onProgress(done, total);
  }
  return { done, total, failed };
}

/** Видалити всю завантажену озвучку. */
export async function clearAudio({ caches }) {
  return caches ? caches.delete(AUDIO_CACHE) : false;
}
