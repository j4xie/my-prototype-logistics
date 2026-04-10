/**
 * Lightweight SpEL-to-JS evaluator for frontend conditional rendering.
 * Supports: ==, !=, >, <, >=, <=, &&, ||, !, ternary, property access.
 */
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

  try {
    const keys = Object.keys(context)
    const values = Object.values(context)
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
