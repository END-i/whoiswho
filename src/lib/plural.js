// Українські числівникові форми: 1 гравець, 2 гравці, 5 гравців, 21 гравець, 11 гравців.
export function plural(n, [one, few, many]) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a >= 11 && a <= 14) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}
