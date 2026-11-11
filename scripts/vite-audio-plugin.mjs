// Vite-плагін: список готових файлів озвучки як модуль `virtual:audio-ids`:
// { uk: [...], ru: [...], start: { uk: { id: секунди }, ru: {...} }, size: { uk: { id: байти }, ru: {...} } }
// (public/audio/{id}.mp3 і public/audio/ru/{id}.mp3; start — де в записі починається голос, з starts.json).
// Кнопка «Прослухати» показується лише там, де файл справді є, без мережевих запитів.
import nodeFs from 'node:fs';
import { listAudioIds, STARTS } from './audio-lib.mjs';

export const VIRTUAL_ID = 'virtual:audio-ids';
const RESOLVED = '\0' + VIRTUAL_ID;

// fake — лише для e2e (E2E_AUDIO_IDS, E2E_AUDIO_IDS_RU): { uk, ru } — списки id без справжніх файлів, mp3 віддає Playwright.
export function audioIdsPlugin(dir, fs = nodeFs, fake = {}) {
  const list = (s) => String(s).split(',').filter(Boolean).sort();
  const starts = (d) => { try { return JSON.parse(fs.readFileSync(`${d}/${STARTS}`, 'utf8')); } catch { return {}; } };
  // розмір файлів — щоб гра показала, скільки мегабайтів качати для офлайну (файлу немає — 0)
  const sizes = (d, list) => Object.fromEntries(list.map((id) => { try { return [id, fs.statSync(`${d}/${id}.mp3`).size]; } catch { return [id, 0]; } }));
  const ids = () => {
    const l = fake.uk || fake.ru
      ? { uk: list(fake.uk || ''), ru: list(fake.ru || '') }
      : { uk: listAudioIds(dir, fs), ru: listAudioIds(`${dir}/ru`, fs) };
    return { ...l, start: { uk: starts(dir), ru: starts(`${dir}/ru`) }, size: { uk: sizes(dir, l.uk), ru: sizes(`${dir}/ru`, l.ru) } };
  };
  return {
    name: 'whoiswho-audio-ids',
    resolveId: (x) => (x === VIRTUAL_ID ? RESOLVED : null),
    load: (x) => (x === RESOLVED ? `export default ${JSON.stringify(ids())};` : null),
    configureServer(server) {
      // новий файл озвучки під час `npm run dev` — оновити список
      server.watcher.add(dir);
      server.watcher.on('all', (_event, file) => {
        if (!file.startsWith(dir)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
      });
    },
  };
}
