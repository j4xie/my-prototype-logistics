/**
 * Client-side binding resolver — Day 4 specifies this MUST mirror the
 * Python resolver byte-for-byte. If these tests pass but the Python suite
 * (backend/python/tests/test_template_renderer.py::TestBindingResolver) is
 * different, parity has drifted — the server-rendered PDF will show
 * different values than the editor preview.
 */
import { describe, it, expect } from 'vitest';
import { renderBinding, resolveArray } from '../utils/templateRenderer';

describe('templateRenderer', () => {
  describe('renderBinding — plain access', () => {
    it('resolves a dotted path', () => {
      expect(renderBinding('{{order.orderNumber}}', { order: { orderNumber: 'SO-001' } }))
        .toBe('SO-001');
    });

    it("returns '-' for missing fields", () => {
      expect(renderBinding('{{order.missing}}', { order: {} })).toBe('-');
    });

    it("returns '-' for nested-None access", () => {
      expect(renderBinding('{{a.b.c}}', { a: null })).toBe('-');
    });

    it('passes through a template with no bindings', () => {
      expect(renderBinding('plain text', {})).toBe('plain text');
    });

    it('safely handles empty input', () => {
      expect(renderBinding('', {})).toBe('');
    });
  });

  describe('renderBinding — format helpers', () => {
    it('formats currency with ¥ + thousands separator + 2 decimals', () => {
      expect(renderBinding('{{format.currency(amount)}}', { amount: 1234.5 }))
        .toBe('¥1,234.50');
    });

    it('formats integer amounts with .00', () => {
      expect(renderBinding('{{format.currency(amount)}}', { amount: 100 }))
        .toBe('¥100.00');
    });

    it('formats currency on null → -', () => {
      expect(renderBinding('{{format.currency(amount)}}', { amount: null }))
        .toBe('-');
    });

    it('formats date with default YYYY-MM-DD', () => {
      expect(renderBinding('{{format.date(d)}}', { d: '2026-05-16' }))
        .toBe('2026-05-16');
    });

    it('formats date with custom pattern argument', () => {
      expect(renderBinding('{{format.date(d, \'YYYY-MM-DD\')}}', { d: '2026-05-16' }))
        .toBe('2026-05-16');
    });

    it('formats qty stripping trailing zeros for integer values', () => {
      expect(renderBinding('{{format.qty(n)}}', { n: 30 })).toBe('30');
      expect(renderBinding('{{format.qty(n)}}', { n: 30.5 })).toBe('30.50');
    });

    it('formats percent multiplying by 100 with 2 decimals', () => {
      expect(renderBinding('{{format.percent(n)}}', { n: 0.155 })).toBe('15.50%');
    });
  });

  describe('renderBinding — mixed templates', () => {
    it('substitutes multiple bindings in one string', () => {
      const out = renderBinding(
        '订单 {{order.orderNumber}}: {{format.currency(order.totalAmount)}}',
        { order: { orderNumber: 'SO-001', totalAmount: 1234.5 } },
      );
      expect(out).toBe('订单 SO-001: ¥1,234.50');
    });

    it('substitutes alongside literal text', () => {
      expect(renderBinding('客户: {{name}}', { name: '示例' })).toBe('客户: 示例');
    });
  });

  describe('renderBinding — computed placeholder', () => {
    it("returns '[computed.X]' for unimplemented computed bindings", () => {
      expect(renderBinding('{{computed.totalAmount}}', {}))
        .toBe('[computed.totalAmount]');
    });
  });

  describe('resolveArray', () => {
    it('returns an empty array for missing path', () => {
      expect(resolveArray('{{order.items}}', { order: {} })).toEqual([]);
    });

    it('returns an empty array for empty data', () => {
      expect(resolveArray('{{order.items}}', { order: { items: [] } })).toEqual([]);
    });

    it('returns a populated array', () => {
      const rows = resolveArray('{{order.items}}', { order: { items: [{ a: 1 }, { a: 2 }] } });
      expect(rows).toEqual([{ a: 1 }, { a: 2 }]);
    });

    it('defensively returns [] when path resolves to non-array', () => {
      // Defensive: prevents row-iteration crash if the entityData shape drifts.
      expect(resolveArray('{{order.items}}', { order: { items: 'not-a-list' } })).toEqual([]);
    });
  });
});
