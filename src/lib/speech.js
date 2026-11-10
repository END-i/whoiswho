// Текст для озвучування: без форм у дужках («з'їв(ла)» → «з'їв»), з великої літери, без зайвих пробілів.
// Використовується і в скрипті генерації аудіо, і в запасному голосі браузера.

const GENDER = /\((?:ла|ою|а|я|лася|ну|ним|нею|ий|ися|ась)\)/g;

export function speechText(text) {
  const t = String(text || '').replace(GENDER, '').replace(/\s+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

/** Шлях до файлу озвучки з урахуванням базового шляху сайту. */
export const audioUrl = (id, base = '/') => `${base.endsWith('/') ? base : base + '/'}audio/${encodeURIComponent(id)}.mp3`;

/** Український голос серед голосів браузера (або null). */
export function pickUkVoice(voices) {
  const list = Array.isArray(voices) ? voices : [];
  return list.find((v) => /^uk(-|_|$)/i.test(v.lang)) || null;
}

/**
 * Як озвучити питання: 'file' — є mp3; 'voice' — немає файлу, але ввімкнено голос браузера й є український голос;
 * null — кнопку не показуємо.
 */
export function listenMode(id, { ids, voiceOn, voice }) {
  if (ids?.has(id)) return 'file';
  if (voiceOn && voice) return 'voice';
  return null;
}

/**
 * Відтворити питання. deps: { makeAudio(url), synth, Utterance, voice, base, onend }.
 * Попереднє відтворення зупиняється. Повертає функцію «стоп».
 */
export function playQuestion(q, mode, deps) {
  deps.synth?.cancel?.();
  if (mode === 'file') {
    const a = deps.makeAudio(audioUrl(q.id, deps.base));
    a.onended = a.onerror = deps.onend || null;
    a.play?.()?.catch?.(() => deps.onend?.()); // відтворення заборонене чи файл не завантажився — просто тиша
    return () => { a.pause?.(); };
  }
  if (mode === 'voice') {
    const u = new deps.Utterance(speechText(q.text));
    u.lang = 'uk-UA'; u.voice = deps.voice; u.rate = 0.92;
    u.onend = u.onerror = deps.onend || null;
    deps.synth.speak(u);
    return () => deps.synth.cancel();
  }
  return () => {};
}
