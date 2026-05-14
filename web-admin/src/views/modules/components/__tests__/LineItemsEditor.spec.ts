/**
 * Phase B C-6: LineItemsEditor recomputeRow + onReferenceProject tests.
 *
 * Covers spec §7.1:
 *  - Task 3 (toy parser → SpEL evaluator): backward compat + new expressions
 *  - Task 2 (onReferenceProject): shadow field write + recompute trigger
 *  - R2 boolean catch-fallback skip (Number(true)=1 不污染数值字段)
 *  - null-guard 三元 returns null (not 0)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/api/request', () => ({ default: { get: vi.fn() } }));
vi.mock('@/store/modules/auth', () => ({
  useAuthStore: () => ({ factoryId: 'F006' }),
}));

import LineItemsEditor from '../LineItemsEditor.vue';

const stubs = {
  'el-table': defineComponent({
    setup(_, { slots }) { return () => h('div', slots.default?.()); },
  }),
  'el-table-column': defineComponent({
    setup(_, { slots }) { return () => h('div', slots.default?.({ row: {}, $index: 0 })); },
  }),
  'el-input': true,
  'el-input-number': true,
  'el-select': true,
  'el-option': true,
  'el-button': true,
  ReferenceSelector: true,
};

function makeWrapper(itemSchema: { fields: any[] }, modelValue: Record<string, unknown>[] = [{}]) {
  return mount(LineItemsEditor, {
    props: { itemSchema, modelValue },
    global: { stubs },
  });
}

describe('LineItemsEditor recomputeRow (Task 3)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('backward compat: quantity * unitPrice → lineAmount', () => {
    const w = makeWrapper({
      fields: [
        { code: 'quantity', type: 'decimal', label: 'Q', required: false },
        { code: 'unitPrice', type: 'decimal', label: 'P', required: false },
        { code: 'lineAmount', type: 'decimal', label: 'L', required: false, computed: 'quantity * unitPrice' },
      ],
    });
    const row = { quantity: 5, unitPrice: 100 } as Record<string, unknown>;
    (w.vm as any).recomputeRow(row);
    expect(row.lineAmount).toBe(500);
  });

  it('new SpEL: quantity / _level1PerLevel2 → boxQuantity (P1-2 box auto-calc)', () => {
    const w = makeWrapper({
      fields: [
        { code: 'quantity', type: 'decimal', label: 'Q', required: false },
        { code: 'boxQuantity', type: 'decimal', label: 'B', required: false,
          computed: 'quantity > 0 && _l1pl2 != null && _l1pl2 > 0 ? quantity / _l1pl2 : null' },
      ],
    });
    const row = { quantity: 50, _l1pl2: 10 } as Record<string, unknown>;
    (w.vm as any).recomputeRow(row);
    expect(row.boxQuantity).toBe(5);
  });

  it('null-guard returns null (NOT 0) when shadow missing', () => {
    const w = makeWrapper({
      fields: [
        { code: 'quantity', type: 'decimal', label: 'Q', required: false },
        { code: 'boxQuantity', type: 'decimal', label: 'B', required: false,
          computed: 'quantity > 0 && _l1pl2 != null && _l1pl2 > 0 ? quantity / _l1pl2 : null' },
      ],
    });
    const row = { quantity: 50, _l1pl2: null } as Record<string, unknown>;
    (w.vm as any).recomputeRow(row);
    expect(row.boxQuantity).toBe(null);
  });

  it('R2 boolean catch result skipped (no Number(true)=1 pollution)', () => {
    const w = makeWrapper({
      fields: [
        { code: 'boxQuantity', type: 'decimal', label: 'B', required: false,
          computed: 'this is invalid SpEL @@@' },  // → catch returns true
      ],
    });
    const row = { boxQuantity: 99 } as Record<string, unknown>;
    (w.vm as any).recomputeRow(row);
    // boolean catch result should NOT overwrite. row.boxQuantity stays 99 (preserved).
    expect(row.boxQuantity).toBe(99);
  });

  it('decimal precision rounded to 2 places', () => {
    const w = makeWrapper({
      fields: [
        { code: 'quantity', type: 'decimal', label: 'Q', required: false },
        { code: 'lineAmount', type: 'decimal', label: 'L', required: false, computed: 'quantity * 12.345' },
      ],
    });
    const row = { quantity: 7 } as Record<string, unknown>;
    (w.vm as any).recomputeRow(row);
    // 7 * 12.345 = 86.415, rounded to 86.42
    expect(row.lineAmount).toBe(86.42);
  });
});

describe('LineItemsEditor onReferenceProject (Task 2)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('spreads shadow fields into target row', () => {
    const initialRows = [{ quantity: 50 }, { quantity: 100 }];
    const w = makeWrapper({
      fields: [
        { code: 'quantity', type: 'decimal', label: 'Q', required: false },
        { code: 'boxQuantity', type: 'decimal', label: 'B', required: false,
          computed: 'quantity > 0 && _l1pl2 != null ? quantity / _l1pl2 : null' },
      ],
    }, initialRows);
    (w.vm as any).onReferenceProject(0, { _l1pl2: 10 });
    const emitted = w.emitted('update:modelValue') as unknown[][] | undefined;
    expect(emitted).toBeDefined();
    const newRows = emitted!.at(-1)?.[0] as Record<string, unknown>[];
    // Row 0 has shadow + computed boxQuantity
    expect(newRows[0]._l1pl2).toBe(10);
    expect(newRows[0].boxQuantity).toBe(5);
    // Row 1 untouched
    expect(newRows[1]._l1pl2).toBeUndefined();
    expect(newRows[1].boxQuantity).toBeUndefined();
  });

  it('only modifies the targeted row index (no cross-contamination)', () => {
    const initialRows = [{ a: 1 }, { a: 2 }, { a: 3 }];
    const w = makeWrapper({ fields: [{ code: 'a', type: 'decimal', label: 'A', required: false }] }, initialRows);
    (w.vm as any).onReferenceProject(1, { _shadow: 'X' });
    const emitted = w.emitted('update:modelValue') as unknown[][] | undefined;
    const newRows = emitted!.at(-1)?.[0] as Record<string, unknown>[];
    expect(newRows[0]._shadow).toBeUndefined();
    expect(newRows[1]._shadow).toBe('X');
    expect(newRows[2]._shadow).toBeUndefined();
    // Original a values preserved
    expect(newRows.map(r => r.a)).toEqual([1, 2, 3]);
  });

  it('empty projected (cache miss) writes nothing extra to row', () => {
    const initialRows = [{ a: 1 }];
    const w = makeWrapper({ fields: [{ code: 'a', type: 'decimal', label: 'A', required: false }] }, initialRows);
    (w.vm as any).onReferenceProject(0, {});
    const emitted = w.emitted('update:modelValue') as unknown[][] | undefined;
    const newRows = emitted!.at(-1)?.[0] as Record<string, unknown>[];
    expect(newRows[0]).toEqual({ a: 1 });
  });
});
