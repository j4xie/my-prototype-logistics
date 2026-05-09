/**
 * Phase B C-6 spec §7.1: spelEvaluator unit tests.
 *
 * Covers:
 *  - Backward compat: existing toy-parser cases (a*b multiplication)
 *  - New: division `a / b` (P1-2 boxQuantity)
 *  - New: null-guard 三元 (returns null, not NaN/0)
 *  - New: String.includes() method (P1-3 抄码 detection — pre-R2 includes path)
 *  - R2 catch behavior: invalid expression returns true (documented quirk)
 */
import { describe, it, expect } from 'vitest';
import { evaluateSpel, evaluateSpelBoolean, evaluateSpelValue } from '../spelEvaluator';

describe('spelEvaluator backward compat (existing toy-parser cases)', () => {
  it('quantity * unitPrice = lineAmount (multiplication)', () => {
    expect(evaluateSpelValue('quantity * unitPrice', { quantity: 5, unitPrice: 100 })).toBe(500);
  });

  it('decimal multiplication with precision', () => {
    expect(evaluateSpelValue('quantity * unitPrice', { quantity: 3.5, unitPrice: 12.5 })).toBe(43.75);
  });

  it('null operand → 0 (existing toy parser behavior, JS coerce)', () => {
    expect(evaluateSpelValue('quantity * unitPrice', { quantity: 5, unitPrice: null })).toBe(0);
  });

  it('zero qty → 0', () => {
    expect(evaluateSpelValue('quantity * unitPrice', { quantity: 0, unitPrice: 100 })).toBe(0);
  });
});

describe('spelEvaluator new C-6 expressions', () => {
  it('division: quantity / _level1PerLevel2 = boxQuantity (P1-2)', () => {
    expect(evaluateSpelValue('quantity / _level1PerLevel2', { quantity: 50, _level1PerLevel2: 10 })).toBe(5);
  });

  it('null-guard 三元 happy path: returns computed value', () => {
    const expr = 'quantity > 0 && _x != null && _x > 0 ? quantity / _x : null';
    expect(evaluateSpelValue(expr, { quantity: 50, _x: 10 })).toBe(5);
  });

  it('null-guard 三元 returns null when _x is null (NOT 0 or NaN)', () => {
    const expr = 'quantity > 0 && _x != null && _x > 0 ? quantity / _x : null';
    expect(evaluateSpelValue(expr, { quantity: 50, _x: null })).toBe(null);
  });

  it('null-guard 三元 returns null when quantity is 0', () => {
    const expr = 'quantity > 0 && _x != null && _x > 0 ? quantity / _x : null';
    expect(evaluateSpelValue(expr, { quantity: 0, _x: 10 })).toBe(null);
  });

  it('String.includes() for visibleWhen 抄码 detection (legacy includes path)', () => {
    expect(evaluateSpelBoolean("_specification.includes('抄码')", { _specification: '抄码' })).toBe(true);
    expect(evaluateSpelBoolean("_specification.includes('抄码')", { _specification: '抄码区限量' })).toBe(true);  // includes leaks
    expect(evaluateSpelBoolean("_specification.includes('抄码')", { _specification: '普通规格' })).toBe(false);
  });
});

describe('spelEvaluator catch-fallback (R2 reviewer note)', () => {
  it('invalid expression returns true (documented quirk — visibleWhen-friendly default)', () => {
    // Reference behavior at spelEvaluator.ts:69 — catch returns true.
    // Task 3 LineItemsEditor.recomputeRow defends by checking typeof === 'boolean'.
    expect(evaluateSpelValue('this is not valid SpEL @@@', {})).toBe(true);
  });

  it('empty expression returns true (no-op)', () => {
    expect(evaluateSpelValue('', {})).toBe(true);
  });

  it('SpEL operator translation: and/or/not → &&/||/!', () => {
    expect(evaluateSpelBoolean('a and b', { a: true, b: true })).toBe(true);
    expect(evaluateSpelBoolean('a or b', { a: false, b: true })).toBe(true);
    expect(evaluateSpelBoolean('not a', { a: false })).toBe(true);
  });

  it('SpEL eq/ne/ge/le → ==/!=/>=/<=', () => {
    expect(evaluateSpelBoolean('a eq 5', { a: 5 })).toBe(true);
    expect(evaluateSpelBoolean('a ne 5', { a: 6 })).toBe(true);
    expect(evaluateSpelBoolean('a ge 5', { a: 5 })).toBe(true);
    expect(evaluateSpelBoolean('a le 5', { a: 4 })).toBe(true);
  });
});
