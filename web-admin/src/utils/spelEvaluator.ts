/**
 * Lightweight SpEL-to-JS evaluator for frontend conditional rendering.
 * Supports: ==, !=, >, <, >=, <=, &&, ||, !, ternary, property access.
 *
 * Round 4 Fix P1-8: added time helper functions that match backend SpelConditionEvaluator:
 *   #now(), #addHours(date, n), #addMinutes(date, n), #addDays(date, n), #daysBetween(a, b)
 * These are injected into the evaluation context so expressions like
 *   "#addHours(#cf_start_time, 4)" work identically on frontend and backend.
 */
function toDate(v: unknown): Date | null {
  if (v == null) return null
  if (v instanceof Date) return v
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

const TIME_HELPERS = {
  now: () => new Date(),
  addHours: (base: unknown, hours: number) => {
    const d = toDate(base)
    if (!d) return null
    return new Date(d.getTime() + hours * 3600 * 1000)
  },
  addMinutes: (base: unknown, minutes: number) => {
    const d = toDate(base)
    if (!d) return null
    return new Date(d.getTime() + minutes * 60 * 1000)
  },
  addDays: (base: unknown, days: number) => {
    const d = toDate(base)
    if (!d) return null
    return new Date(d.getTime() + days * 86400 * 1000)
  },
  daysBetween: (a: unknown, b: unknown) => {
    const d1 = toDate(a), d2 = toDate(b)
    if (!d1 || !d2) return null
    return Math.floor((d2.getTime() - d1.getTime()) / 86400000)
  },
}

export function evaluateSpel(expression: string, context: Record<string, unknown>): unknown {
  if (!expression || !expression.trim()) return true

  let jsExpr = expression
    .replace(/\band\b/gi, '&&')
    .replace(/\bor\b/gi, '||')
    .replace(/\bnot\b/gi, '!')
    .replace(/\beq\b/gi, '==')
    .replace(/\bne\b/gi, '!=')
    .replace(/\bge\b/gi, '>=')
    .replace(/\ble\b/gi, '<=')
    .replace(/\bgt\b/gi, '>')
    .replace(/\blt\b/gi, '<')
    // Round 4 Fix P1-8: normalize SpEL function calls `#now()` / `#addHours(x,4)` to JS form.
    .replace(/#(now|addHours|addMinutes|addDays|daysBetween)\b/g, '$1')
    // Strip SpEL variable prefix `#` so `#cf_total_amount` becomes `cf_total_amount`
    .replace(/#([a-zA-Z_][a-zA-Z0-9_]*)/g, '$1')

  try {
    const mergedContext = { ...TIME_HELPERS, ...context }
    const keys = Object.keys(mergedContext)
    const values = Object.values(mergedContext)
    const fn = new Function(...keys, `return (${jsExpr})`)
    return fn(...values)
  } catch (e) {
    console.warn('SpEL evaluation failed:', expression, e)
    return true
  }
}

export function evaluateSpelBoolean(expression: string, context: Record<string, unknown>): boolean {
  return Boolean(evaluateSpel(expression, context))
}

export function evaluateSpelValue(expression: string, context: Record<string, unknown>): unknown {
  return evaluateSpel(expression, context)
}
