// Правила набору під режим гри: у «Навмання» категорію й карту вибирає гра,
// тож крок «вибери категорію й будь-яку карту» (другий у кожному наборі) — інший.
export const PICK_RULE = 1;

/** Правила для екрана: у режимі колеса другий крок замінено на wheelText. */
export function modeRules(rules, mode, wheelText) {
  return mode === 'wheel' ? rules.map((r, k) => (k === PICK_RULE ? wheelText : r)) : rules;
}
