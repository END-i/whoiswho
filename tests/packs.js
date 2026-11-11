// Набори питань з src/data/packs для тестів: { назва файлу: вміст }; ruFiles — переклади з src/data/packs/ru.
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const read = (dir) => (existsSync(dir) ? Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  .map((f) => [f, JSON.parse(readFileSync(new URL(f, dir), 'utf8'))])) : {});
export const packFiles = read(new URL('../src/data/packs/', import.meta.url));
export const ruFiles = read(new URL('../src/data/packs/ru/', import.meta.url));
export const family = packFiles['family.json'];
export const allQuestions = Object.values(packFiles).flatMap((p) => p.questions);
export const allRuQuestions = Object.values(ruFiles).flatMap((p) => p.questions);
