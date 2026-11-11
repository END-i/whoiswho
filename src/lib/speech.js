// Текст для озвучування: без форм у дужках («з'їв(ла)» → «з'їв»), з великої літери, без зайвих пробілів.
// Використовується і в скрипті генерації аудіо, і в запасному голосі браузера.
import { LOCALES } from './i18n.js';

const GENDER = /\((?:ла|ою|а|я|лася|ну|ним|нею|ий|ися|ась)\)/g;

export function speechText(text) {
  const t = String(text || '').replace(GENDER, '').replace(/\s+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

/** Шлях до файлу озвучки з урахуванням базового шляху сайту: українська — audio/{id}.mp3, інші мови — audio/{мова}/{id}.mp3. */
export const audioUrl = (id, base = '/', lang = 'uk') =>
  `${base.endsWith('/') ? base : base + '/'}audio/${lang === 'uk' ? '' : `${lang}/`}${encodeURIComponent(id)}.mp3`;

/** Голос потрібної мови серед голосів браузера (або null). */
export function pickVoice(voices, lang = 'uk') {
  const list = Array.isArray(voices) ? voices : [];
  const re = new RegExp(`^${lang}(-|_|$)`, 'i');
  return list.find((v) => re.test(v.lang)) || null;
}

/** Затримка автоозвучки після появи питання (мс): картка вже з'явилась, а iPhone ще дозволяє звук після дотику (~1 с). */
export const AUTO_DELAY = 600;

let player = null;
/**
 * Один <audio> на всі питання: iPhone, раз дозволивши звук цьому плеєру після дотику, дозволяє його й далі,
 * тож автоозвучка наступних карток не блокується. Audio передається параметром (у тестах — підставний).
 */
export function questionAudio(url, Audio = globalThis.Audio) {
  player ||= new Audio();
  player.pause?.();
  player.src = url;
  return player;
}
/** Для тестів: забути плеєр. */
export const resetQuestionAudio = () => (player = null);


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
 * Відтворити питання. deps: { makeAudio(url), synth, Utterance, voice, base, lang, onend }.
 * Попереднє відтворення зупиняється. Повертає функцію «стоп».
 */
export function playQuestion(q, mode, deps) {
  deps.synth?.cancel?.();
  if (mode === 'file') {
    const a = deps.makeAudio(audioUrl(q.id, deps.base, deps.lang));
    const done = () => deps.onend?.();
    a.onended = a.onerror = done;
    a.play?.()?.catch?.(done); // відтворення заборонене чи файл не завантажився — просто тиша
    // плеєр спільний: «стоп» старої картки не зупиняє питання, яке вже грає наступна
    return () => { if (a.onended === done) a.pause?.(); };
  }
  if (mode === 'voice') {
    const u = new deps.Utterance(speechText(q.text));
    u.lang = LOCALES[deps.lang] || LOCALES.uk; u.voice = deps.voice; u.rate = 0.92;
    u.onend = u.onerror = deps.onend || null;
    deps.synth.speak(u);
    return () => deps.synth.cancel();
  }
  return () => {};
}
