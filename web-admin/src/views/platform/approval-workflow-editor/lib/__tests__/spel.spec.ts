/**
 * SpEL JS subset evaluator unit tests — Sprint 3 Track-I Day 9.
 *
 * Covers: literals / vars / comparisons / logical / parens / edge cases.
 * Parity target: backend Spring SpelExpressionParser produces same boolean
 * for these inputs (cross-checked manually).
 */
import { describe, expect, it } from 'vitest'
import { evaluateSpel } from '../spel'

describe('evaluateSpel — SpEL JS subset', () => {
  it('empty expression returns true (no condition)', () => {
    expect(evaluateSpel('', {})).toBe(true)
    expect(evaluateSpel('   ', {})).toBe(true)
  })

  it('boolean literal', () => {
    expect(evaluateSpel('true', {})).toBe(true)
    expect(evaluateSpel('false', {})).toBe(false)
  })

  it('numeric comparison: > <  >= <=', () => {
    expect(evaluateSpel('#amount > 10000', { amount: 15000 })).toBe(true)
    expect(evaluateSpel('#amount > 10000', { amount: 5000 })).toBe(false)
    expect(evaluateSpel('#amount >= 10000', { amount: 10000 })).toBe(true)
    expect(evaluateSpel('#amount < 100', { amount: 50 })).toBe(true)
    expect(evaluateSpel('#amount <= 0', { amount: 0 })).toBe(true)
  })

  it('equality with strings', () => {
    expect(evaluateSpel("#department == 'finance'", { department: 'finance' })).toBe(true)
    expect(evaluateSpel("#department == 'finance'", { department: 'hr' })).toBe(false)
    expect(evaluateSpel("#department != 'finance'", { department: 'hr' })).toBe(true)
  })

  it('logical AND / OR with short-circuit', () => {
    expect(evaluateSpel('#a > 10 && #b < 20', { a: 15, b: 5 })).toBe(true)
    expect(evaluateSpel('#a > 10 && #b < 20', { a: 5, b: 5 })).toBe(false)
    expect(evaluateSpel('#a > 10 || #b < 20', { a: 5, b: 5 })).toBe(true)
    expect(evaluateSpel('#a > 10 || #b < 20', { a: 5, b: 100 })).toBe(false)
  })

  it('parens override precedence', () => {
    expect(evaluateSpel('(#a > 10 || #b > 10) && #c == true', { a: 15, b: 5, c: true })).toBe(true)
    expect(evaluateSpel('(#a > 10 || #b > 10) && #c == true', { a: 5, b: 5, c: true })).toBe(false)
  })

  it('negation operator !', () => {
    expect(evaluateSpel('!#trusted', { trusted: false })).toBe(true)
    expect(evaluateSpel('!#trusted', { trusted: true })).toBe(false)
  })

  it('undefined var → falsy', () => {
    expect(evaluateSpel('#missing > 10', { amount: 100 })).toBe(false)
  })

  it('malformed SpEL → false (fail-safe, matches backend)', () => {
    expect(evaluateSpel('#a ## #b', {})).toBe(false)
    expect(evaluateSpel('#a > >', {})).toBe(false)
  })

  it('Cretas business case: amount-based routing', () => {
    const ctx = { amount: 15000, department: 'finance', urgent: true }
    expect(evaluateSpel("#amount > 10000 && #department == 'finance'", ctx)).toBe(true)
    expect(evaluateSpel("#amount > 100000 || #urgent == true", ctx)).toBe(true)
  })

  it('numeric vs string equality strict (no coercion past String())', () => {
    // SpEL behavior: 100 == '100' is true (String() coercion fallback)
    expect(evaluateSpel("#x == '100'", { x: 100 })).toBe(true)
  })
})
