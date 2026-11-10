// Vite-плагін: список готових файлів озвучки (public/audio/{id}.mp3) як модуль `virtual:audio-ids`.
// Кнопка «Прослухати» показується лише там, де файл справді є, без мережевих запитів.
import nodeFs from 'node:fs';
import { listAudioIds } from './audio-lib.mjs';

export const VIRTUAL_ID = 'virtual:audio-ids';
const RESOLVED = '\0' + VIRTUAL_ID;

export function audioIdsPlugin(dir, fs = nodeFs) {
  return {
    name: 'whoiswho-audio-ids',
    resolveId: (x) => (x === VIRTUAL_ID ? RESOLVED : null),
    load: (x) => (x === RESOLVED ? `export default ${JSON.stringify(listAudioIds(dir, fs))};` : null),
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
