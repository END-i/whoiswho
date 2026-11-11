// Переклади інтерфейсу: словник — плоский об'єкт «ключ → рядок».
// Рядок може мати параметри {name}; масив з трьох форм — множина за {n}: [1 гравець, 2 гравці, 5 гравців].
// Без Svelte — тестується в Node; реактивна мова — у lang.svelte.js.
import { plural } from './plural.js';

export const LANGS = ['uk', 'ru'];
export const LANG_NAMES = { uk: 'Українська', ru: 'Русский' };

/** Рядок за ключем з підставленими параметрами. Немає ключа — сам ключ (видно в інтерфейсі й у тестах). */
export function translate(dict, key, params = {}) {
  let s = dict[key];
  if (s === undefined) return key;
  if (Array.isArray(s)) s = plural(params.n ?? 0, s);
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/** Параметри, які згадує рядок (для перевірки, що переклади їх не гублять). */
export const paramsOf = (value) => [...new Set((Array.isArray(value) ? value.join(' ') : value).match(/\{\w+\}/g) || [])].sort();

/** Мова з налаштувань; невідома — українська. */
export const cleanLang = (lang) => (LANGS.includes(lang) ? lang : 'uk');
