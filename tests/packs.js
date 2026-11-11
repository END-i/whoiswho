// Набори питань з src/data/packs для тестів: { назва файлу: вміст }.
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../src/data/packs/', import.meta.url);
export const packFiles = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  .map((f) => [f, JSON.parse(readFileSync(new URL(f, dir), 'utf8'))]));
export const family = packFiles['family.json'];
export const allQuestions = Object.values(packFiles).flatMap((p) => p.questions);
