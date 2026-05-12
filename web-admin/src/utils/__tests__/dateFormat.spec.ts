/**
 * dateFormat.ts unit tests.
 *
 * Regression coverage for P1-A (PR #468 §6): SalesAnalysis.vue:810
 * `e.toISOString` TypeError when user picks date.
 *
 * Root cause: el-date-picker with `value-format="YYYY-MM-DD"` emits strings
 * at runtime, but TS type `[Date, Date]` lied. Calling `date.toISOString()`
 * on a string threw, the silent catch left users with stale data.
 *
 * `toApiDateString` accepts Date | string | null and never throws.
 */
import { describe, it, expect } from 'vitest';
import { toApiDateString, toDateString } from '../dateFormat';

describe('toApiDateString', () => {
  it('formats a Date object to YYYY-MM-DD (local time)', () => {
    const d = new Date(2026, 4, 12); // May 12 2026 local
    expect(toApiDateString(d)).toBe('2026-05-12');
  });

  it('passes through el-date-picker YYYY-MM-DD strings unchanged', () => {
    expect(toApiDateString('2026-05-12')).toBe('2026-05-12');
  });

  it('trims longer ISO strings to YYYY-MM-DD', () => {
    expect(toApiDateString('2026-05-12T10:30:00Z')).toBe('2026-05-12');
  });

  it('returns empty string for null', () => {
    expect(toApiDateString(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(toApiDateString(undefined)).toBe('');
  });

  it('returns empty string for invalid Date (does not throw)', () => {
    expect(toApiDateString(new Date('not-a-date'))).toBe('');
  });

  it('returns empty string for non-Date / non-string inputs (does not throw)', () => {
    // @ts-expect-error testing defensive path
    expect(toApiDateString({} as Date)).toBe('');
    // @ts-expect-error testing defensive path
    expect(toApiDateString(123 as unknown as Date)).toBe('');
  });
});

describe('toDateString (legacy, Date-only)', () => {
  it('still formats Date to YYYY-MM-DD', () => {
    expect(toDateString(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});
