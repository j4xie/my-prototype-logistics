/**
 * compareSemver unit tests (PR #309 B5)
 * Tests the pure semver comparator in isolation (no expo-constants dep).
 */
import { compareSemver } from '../../../services/compareSemver';

describe('compareSemver', () => {
  it.each([
    ['1.0.0', '1.0.0', 0],
    ['1.0.0', '1.0.1', -1],
    ['1.0.1', '1.0.0', 1],
    ['1.2.0', '1.10.0', -8],
    ['2.0.0', '1.99.99', 1],
    ['1.5', '1.5.0', 0],         // missing patch tolerated
    ['1.5', '1.5.3', -3],
    ['1.5.0', '1.5', 0],
    ['0.0.0', '1.0.0', -1],
    ['', '1.0.0', -1],            // empty string falls back to [0]
  ])('compareSemver(%s, %s) sign = %s', (a, b, expectedSign) => {
    const result = compareSemver(a, b);
    if (expectedSign === 0) {
      expect(result).toBe(0);
    } else if (expectedSign < 0) {
      expect(result).toBeLessThan(0);
    } else {
      expect(result).toBeGreaterThan(0);
    }
  });

  it('handles non-numeric segments by coercing to 0', () => {
    // "1.x.0" → [1, 0, 0] vs "1.0.0" → [1, 0, 0] → equal
    expect(compareSemver('1.x.0', '1.0.0')).toBe(0);
  });
});
