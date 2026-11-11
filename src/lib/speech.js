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

let player = null, playerUrl = null;
/**
 * Один <audio> на всі питання: iPhone, раз дозволивши звук цьому плеєру після дотику, дозволяє його й далі,
 * тож автоозвучка наступних карток не блокується. Та сама адреса — файл не завантажується вдруге
 * (його вже почали качати при дотику до карти). Audio передається параметром (у тестах — підставний).
 */
export function questionAudio(url, Audio = globalThis.Audio) {
  player ||= new Audio();
  player.pause?.();
  // load() явно: Safari інакше не качає, доки не попросять грати (preload для нього лише підказка)
  if (playerUrl !== url) { player.preload = 'auto'; player.src = url; playerUrl = url; player.load?.(); }
  return player;
}
/** Для тестів: забути плеєр. */
export const resetQuestionAudio = () => { player = null; playerUrl = null; };


/**
 * Як озвучити питання: 'file' — є mp3; 'voice' — немає файлу, але ввімкнено голос браузера й є український голос;
 * null — кнопку не показуємо.
 */
export function listenMode(id, { ids, voiceOn, voice }) {
  if (ids?.has(id)) return 'file';
  if (voiceOn && voice) return 'voice';
  return null;
}

/** Адреса запису з позицією, де починається голос (#t= — медіафрагмент: браузер одразу стартує звідти). */
export const startUrl = (url, start) => (start > 0 ? `${url}#t=${start}` : url);

/** Почати завантажувати запис питання заздалегідь — у момент дотику до карти, поки вона перевертається. */
export function preloadQuestion(id, { ids, start = {}, base = '/', lang = 'uk', makeAudio }) {
  if (!ids?.has(id)) return null;
  return makeAudio(startUrl(audioUrl(id, base, lang), start[id]));
}

/**
 * Відтворити питання. deps: { makeAudio(url), synth, Utterance, voice, base, lang, start, onend }.
 * start — id → секунди, де в записі починається голос (тиша на початку пропускається).
 * Попереднє відтворення зупиняється. Повертає функцію «стоп».
 */
export function playQuestion(q, mode, deps) {
  deps.synth?.cancel?.();
  if (mode === 'file') {
    const from = deps.start?.[q.id] || 0;
    const a = deps.makeAudio(startUrl(audioUrl(q.id, deps.base, deps.lang), from));
    if (a.readyState >= 1) a.currentTime = from; // уже завантажений (повтор) — знову з початку голосу
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
