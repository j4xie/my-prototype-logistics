/**
 * SpEL subset evaluator for ApprovalWorkflow simulator.
 *
 * Sprint 3 Track-I (C-APPROVAL-EDITOR-1) Day 9.
 *
 * Mirrors backend Spring SpelExpressionParser for a constrained syntax subset:
 *   - Variable references:    `#identifier`
 *   - Comparison:              ==  !=  >  <  >=  <=
 *   - Logical:                 &&  ||  !
 *   - Literals:                numbers / 'single-quoted strings' / true / false / null
 *   - Grouping:                ( ... )
 *
 * Out of scope (will throw at parse time, caller handles fallback to false):
 *   - Method invocation (#foo.bar() / functions)
 *   - Property navigation (.field)
 *   - Arithmetic (+ - * /)
 *   - Ternary (? :)
 *   - Collection projections / safe navigation
 *
 * For workflows needing richer SpEL, route the condition through backend
 * /validate or a dedicated /simulate endpoint instead of the JS evaluator.
 *
 * @since 2026-05-16
 */

type Token = {
  type:
    | 'NUMBER'
    | 'STRING'
    | 'BOOL'
    | 'NULL'
    | 'IDENT'   // bare identifier (e.g. `true` covered by BOOL — IDENT not currently used post-tokenize)
    | 'VAR'     // #foo (the # is consumed; value is the var name)
    | 'OP'      // ==  !=  >  <  >=  <=  &&  ||  !
    | 'LPAREN'
    | 'RPAREN'
    | 'EOF'
  value: string | number | boolean | null
}

const OPS = new Set([
  '==', '!=', '>=', '<=', '&&', '||', '>', '<', '!',
])

class Tokenizer {
  private pos = 0
  constructor(private readonly src: string) {}

  tokenize(): Token[] {
    const tokens: Token[] = []
    while (this.pos < this.src.length) {
      const c = this.src[this.pos]
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
        this.pos++
        continue
      }
      if (c === '(') { tokens.push({ type: 'LPAREN', value: '(' }); this.pos++; continue }
      if (c === ')') { tokens.push({ type: 'RPAREN', value: ')' }); this.pos++; continue }
      if (c === '#') {
        this.pos++
        const name = this.readIdent()
        if (!name) throw new Error(`Expected identifier after '#' at pos ${this.pos}`)
        tokens.push({ type: 'VAR', value: name })
        continue
      }
      if (c === "'") {
        tokens.push({ type: 'STRING', value: this.readString() })
        continue
      }
      if (this.isDigit(c)) {
        tokens.push({ type: 'NUMBER', value: this.readNumber() })
        continue
      }
      if (this.isIdentStart(c)) {
        const id = this.readIdent()
        if (id === 'true') tokens.push({ type: 'BOOL', value: true })
        else if (id === 'false') tokens.push({ type: 'BOOL', value: false })
        else if (id === 'null') tokens.push({ type: 'NULL', value: null })
        else throw new Error(`Unknown identifier: ${id}`)
        continue
      }
      // Try to match a 2-char op first, then 1-char op
      const two = this.src.slice(this.pos, this.pos + 2)
      if (OPS.has(two)) {
        tokens.push({ type: 'OP', value: two })
        this.pos += 2
        continue
      }
      if (OPS.has(c)) {
        tokens.push({ type: 'OP', value: c })
        this.pos++
        continue
      }
      throw new Error(`Unexpected character '${c}' at pos ${this.pos}`)
    }
    tokens.push({ type: 'EOF', value: '' })
    return tokens
  }

  private readIdent(): string {
    let s = ''
    while (this.pos < this.src.length && this.isIdentPart(this.src[this.pos])) {
      s += this.src[this.pos++]
    }
    return s
  }

  private readNumber(): number {
    let s = ''
    while (this.pos < this.src.length && (this.isDigit(this.src[this.pos]) || this.src[this.pos] === '.')) {
      s += this.src[this.pos++]
    }
    return Number(s)
  }

  private readString(): string {
    this.pos++ // skip opening '
    let s = ''
    while (this.pos < this.src.length && this.src[this.pos] !== "'") {
      s += this.src[this.pos++]
    }
    if (this.src[this.pos] !== "'") throw new Error("Unterminated string literal")
    this.pos++ // skip closing '
    return s
  }

  private isDigit(c: string): boolean { return c >= '0' && c <= '9' }
  private isIdentStart(c: string): boolean { return /[a-zA-Z_]/.test(c) }
  private isIdentPart(c: string): boolean { return /[a-zA-Z0-9_]/.test(c) }
}

type AstNode =
  | { kind: 'literal'; value: unknown }
  | { kind: 'var'; name: string }
  | { kind: 'binary'; op: string; left: AstNode; right: AstNode }
  | { kind: 'unary'; op: string; operand: AstNode }

class Parser {
  private pos = 0
  constructor(private readonly tokens: Token[]) {}

  parse(): AstNode {
    const ast = this.parseOr()
    if (this.peek().type !== 'EOF') {
      throw new Error(`Unexpected trailing token: ${this.peek().value}`)
    }
    return ast
  }

  private parseOr(): AstNode {
    let left = this.parseAnd()
    while (this.peek().type === 'OP' && this.peek().value === '||') {
      this.advance()
      const right = this.parseAnd()
      left = { kind: 'binary', op: '||', left, right }
    }
    return left
  }

  private parseAnd(): AstNode {
    let left = this.parseCompare()
    while (this.peek().type === 'OP' && this.peek().value === '&&') {
      this.advance()
      const right = this.parseCompare()
      left = { kind: 'binary', op: '&&', left, right }
    }
    return left
  }

  private parseCompare(): AstNode {
    const left = this.parseUnary()
    const tk = this.peek()
    if (tk.type === 'OP' && ['==', '!=', '>', '<', '>=', '<='].includes(tk.value as string)) {
      const op = tk.value as string
      this.advance()
      const right = this.parseUnary()
      return { kind: 'binary', op, left, right }
    }
    return left
  }

  private parseUnary(): AstNode {
    if (this.peek().type === 'OP' && this.peek().value === '!') {
      this.advance()
      return { kind: 'unary', op: '!', operand: this.parseUnary() }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): AstNode {
    const tk = this.peek()
    if (tk.type === 'NUMBER' || tk.type === 'STRING' || tk.type === 'BOOL' || tk.type === 'NULL') {
      this.advance()
      return { kind: 'literal', value: tk.value }
    }
    if (tk.type === 'VAR') {
      this.advance()
      return { kind: 'var', name: String(tk.value) }
    }
    if (tk.type === 'LPAREN') {
      this.advance()
      const ast = this.parseOr()
      if (this.peek().type !== 'RPAREN') throw new Error('Expected )')
      this.advance()
      return ast
    }
    throw new Error(`Unexpected token at pos ${this.pos}: ${tk.type} ${tk.value}`)
  }

  private peek(): Token { return this.tokens[this.pos] }
  private advance(): Token { return this.tokens[this.pos++] }
}

function evalAst(node: AstNode, vars: Record<string, unknown>): unknown {
  switch (node.kind) {
    case 'literal': return node.value
    case 'var': return vars[node.name]
    case 'unary':
      if (node.op === '!') return !truthy(evalAst(node.operand, vars))
      throw new Error(`Unknown unary op: ${node.op}`)
    case 'binary': {
      // Short-circuit for logical ops
      if (node.op === '&&') return truthy(evalAst(node.left, vars)) && truthy(evalAst(node.right, vars))
      if (node.op === '||') return truthy(evalAst(node.left, vars)) || truthy(evalAst(node.right, vars))
      const l = evalAst(node.left, vars)
      const r = evalAst(node.right, vars)
      switch (node.op) {
        case '==': return looseEq(l, r)
        case '!=': return !looseEq(l, r)
        case '>': return numCompare(l, r) > 0
        case '<': return numCompare(l, r) < 0
        case '>=': return numCompare(l, r) >= 0
        case '<=': return numCompare(l, r) <= 0
        default: throw new Error(`Unknown binary op: ${node.op}`)
      }
    }
  }
}

function truthy(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (v == null) return false
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v !== ''
  return Boolean(v)
}

function looseEq(a: unknown, b: unknown): boolean {
  // Match Java SpEL behavior: numbers compare numerically; strings compare by .equals.
  // For mixed types, fall back to string compare.
  if (typeof a === 'number' && typeof b === 'number') return a === b
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b
  if (a == null || b == null) return a === b
  return String(a) === String(b)
}

function numCompare(a: unknown, b: unknown): number {
  const na = Number(a)
  const nb = Number(b)
  if (Number.isNaN(na) || Number.isNaN(nb)) {
    throw new Error(`Cannot numerically compare non-numeric values: ${a} <-> ${b}`)
  }
  return na - nb
}

/**
 * Evaluate a SpEL expression against a variable map.
 *
 * @param expression e.g. "#amount > 10000 && #department == 'finance'"
 * @param vars      e.g. { amount: 15000, department: 'finance' }
 * @returns boolean (truthy of result)
 */
export function evaluateSpel(expression: string, vars: Record<string, unknown> = {}): boolean {
  if (!expression || !expression.trim()) return true // empty = always true (no condition)
  try {
    const tokens = new Tokenizer(expression).tokenize()
    const ast = new Parser(tokens).parse()
    return truthy(evalAst(ast, vars))
  } catch (e) {
    // Mirror backend behavior: SpEL parse/eval errors → false (caller may log).
    if (typeof console !== 'undefined') {
      console.warn(`[spel] eval failed for "${expression}":`, e instanceof Error ? e.message : e)
    }
    return false
  }
}
