import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatVersion, parseChangelog, isSemver } from '../src/lib/version.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');

test('formatVersion: номер · дата · короткий коміт; відсутнє пропускається', () => {
  assert.equal(formatVersion({ version: '1.1.0', date: '2026-11-11T08:00:00Z', commit: 'a3fbaaa1234567' }), '1.1.0 · 11.11.2026 · a3fbaaa');
  assert.equal(formatVersion({ version: '1.1.0' }), '1.1.0');
  assert.equal(formatVersion({ version: '1.1.0', date: 'не дата' }), '1.1.0');
  assert.equal(formatVersion(), '');
});

test('parseChangelog: версії, дати, пункти; рядки поза версіями ігноруються', () => {
  const r = parseChangelog('# Що нового\n- сирота\n## 2.0.0 — 01.01.2027\n- А\n* Б\n\n## 1.0.0\n- В\n## не версія\n- Г');
  assert.deepEqual(r, [{ version: '2.0.0', date: '01.01.2027', items: ['А', 'Б'] }, { version: '1.0.0', date: '', items: ['В', 'Г'] }]);
  assert.deepEqual(parseChangelog(undefined), []);
});

test('версія в package.json — semver, і CHANGELOG починається саме з неї (не забули записати «що нового»)', () => {
  assert.ok(isSemver(pkg.version), pkg.version);
  assert.equal(isSemver('1.0'), false);
  const entries = parseChangelog(changelog);
  assert.equal(entries[0].version, pkg.version);
  assert.ok(entries[0].items.length > 0);
  assert.equal(new Set(entries.map((e) => e.version)).size, entries.length, 'версії не повторюються');
});

test('CHANGELOG.ru.md: ті самі версії й дати, що й CHANGELOG.md, з тією самою кількістю пунктів', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (f) => parseChangelog(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
  const uk = read('CHANGELOG.md'), ru = read('CHANGELOG.ru.md');
  assert.deepEqual(ru.map((v) => [v.version, v.date, v.items.length]), uk.map((v) => [v.version, v.date, v.items.length]));
});
