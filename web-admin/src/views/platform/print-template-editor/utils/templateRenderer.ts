/**
 * Client-side template binding resolver for EDITOR PREVIEW ONLY.
 *
 * Real PDF rendering is server-side (Python reportlab via
 * /api/mobile/{factoryId}/print/preview-template). This module exists
 * solely so the editor can show "what the binding will resolve to" using
 * mock data, without a network round-trip on every keystroke.
 *
 * Binding syntax (mirror of Python resolver):
 *   {{entity.field}}                     → simple access
 *   {{entity.nested.field}}              → dotted path
 *   {{format.currency(field)}}           → ¥1,234.56
 *   {{format.date(field, 'YYYY-MM-DD')}} → 格式化日期
 *   {{computed.totalAmount}}             → server-computed (returns placeholder)
 *
 * SOURCE OF TRUTH for production rendering: backend Python — this is
 * a convenience for visual feedback only.
 */

const BINDING_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;

function getPath(obj: unknown, path: string): unknown {
  if (obj == null) return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    if (typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function formatCurrency(v: unknown): string {
  if (v == null) return '-';
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (Number.isNaN(n)) return String(v);
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(v: unknown, fmt: string = 'YYYY-MM-DD'): string {
  if (v == null) return '-';
  let d: Date;
  if (v instanceof Date) {
    d = v;
  } else {
    const s = String(v);
    // Parity with Python `datetime.fromisoformat`: a bare YYYY-MM-DD string is
    // a naive (timezone-less) calendar date, NOT UTC midnight. JS `new Date(s)`
    // defaults to UTC for that shape, which shifts the day in negative-offset
    // timezones (US shows 2026-05-15 for input '2026-05-16'). Force local
    // parsing on the bare-date shape.
    const bareDateMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (bareDateMatch) {
      const [, y, m, day] = bareDateMatch;
      d = new Date(Number(y), Number(m) - 1, Number(day));
    } else {
      d = new Date(s);
    }
  }
  if (Number.isNaN(d.getTime())) return String(v);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return fmt.replace('YYYY', String(y)).replace('MM', m).replace('DD', day);
}

function formatPercent(v: unknown): string {
  if (v == null) return '-';
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (Number.isNaN(n)) return String(v);
  return `${(n * 100).toFixed(2)}%`;
}

function formatQty(v: unknown): string {
  if (v == null) return '-';
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (Number.isNaN(n)) return String(v);
  // Parity with Python `_fmt_qty`: integer values render without decimals,
  // non-integer values render with exactly 2 (so '30.5' becomes '30.50').
  if (Number.isInteger(n)) {
    return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
  }
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function resolveExpression(expr: string, data: Record<string, unknown>): string {
  const trimmed = expr.trim();

  // format.currency(path) / format.date(path) / format.date(path, 'FMT') / format.percent(path) / format.qty(path)
  const fmtMatch = trimmed.match(/^format\.(currency|date|percent|qty)\(\s*([^,)]+?)\s*(?:,\s*['"]([^'"]+)['"]\s*)?\)$/);
  if (fmtMatch) {
    const [, kind, path, arg] = fmtMatch;
    const v = getPath(data, path.trim());
    switch (kind) {
      case 'currency': return formatCurrency(v);
      case 'date':     return formatDate(v, arg);
      case 'percent':  return formatPercent(v);
      case 'qty':      return formatQty(v);
    }
  }

  // computed.* — placeholder; real value comes from server
  if (trimmed.startsWith('computed.')) {
    return `[${trimmed}]`;
  }

  // Plain dotted access
  const v = getPath(data, trimmed);
  if (v == null) return '-';
  return String(v);
}

/**
 * Replace all {{...}} occurrences in `template` with resolved values from `data`.
 * Returns the original string if no bindings present.
 */
export function renderBinding(template: string, data: Record<string, unknown>): string {
  if (!template || !template.includes('{{')) return template;
  return template.replace(BINDING_PATTERN, (_match, expr) => resolveExpression(String(expr), data));
}

/**
 * Resolve a binding expression to an array (for table rows).
 * Strips wrapping {{}} if present and reads the dotted path. Returns [] if not an array.
 */
export function resolveArray(binding: string, data: Record<string, unknown>): Record<string, unknown>[] {
  const expr = binding.replace(BINDING_PATTERN, (_m, e) => String(e).trim());
  const v = getPath(data, expr);
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}
