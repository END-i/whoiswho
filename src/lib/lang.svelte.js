// Поточна мова інтерфейсу ($state): компоненти, що викликають t(), перемальовуються, коли мова змінюється.
import { translate, cleanLang } from './i18n.js';
import uk from '../i18n/uk.js';
import ru from '../i18n/ru.js';

const DICTS = { uk, ru };
export const i18n = $state({ lang: 'uk' });
export const setLang = (lang) => { i18n.lang = cleanLang(lang); document.documentElement.lang = i18n.lang; };
export const t = (key, params) => translate(DICTS[i18n.lang], key, params);
