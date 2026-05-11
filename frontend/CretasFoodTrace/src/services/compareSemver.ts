/**
 * Pure semver comparator (no runtime deps) — extracted from appVersionCheck.ts
 * so jest can unit-test it without pulling in expo-constants.
 *
 * Returns:
 *   - negative if a < b
 *   - 0 if a == b
 *   - positive if a > b
 *
 * Tolerates missing parts ("1.2" === "1.2.0") and non-numeric segments (coerced to 0).
 */
export function compareSemver(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .split('.')
      .map((s) => parseInt(s, 10))
      .map((n) => (Number.isFinite(n) ? n : 0));
  const aP = parse(a);
  const bP = parse(b);
  const len = Math.max(aP.length, bP.length);
  for (let i = 0; i < len; i++) {
    const av = aP[i] ?? 0;
    const bv = bP[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}
