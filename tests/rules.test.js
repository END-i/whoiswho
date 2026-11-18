import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { modeRules, PICK_RULE } from '../src/lib/rules.js';

test('modeRules: «Навмання» — другий крок про колесо, решта як була; вручну — без змін', () => {
  const rules = ['Сядьте в коло.', 'Вибери категорію й карту.', 'Відповідай.'];
  assert.deepEqual(modeRules(rules, 'wheel', 'Крутни колесо.'), ['Сядьте в коло.', 'Крутни колесо.', 'Відповідай.']);
  assert.equal(modeRules(rules, 'tiles', 'Крутни колесо.'), rules);
  assert.deepEqual(rules[1], 'Вибери категорію й карту.'); // оригінал не змінено
});

test('у кожному наборі обома мовами саме другий крок — про вибір категорії (його й замінює колесо)', () => {
  for (const dir of ['src/data/packs', 'src/data/packs/ru']) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const rules = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')).meta.rules;
      assert.match(rules[PICK_RULE], /категор/i, `${dir}/${f}`);
      assert.equal(rules.filter((r) => /категор/i.test(r)).length, 1, `${dir}/${f}`);
    }
  }
});
