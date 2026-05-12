/**
 * P1-D (PR #442 follow-up) — SchemaTableRenderer priceSensitive null rendering.
 *
 * Verifies the Canvas Dynamic renderer mirrors the static-Vue v-if defense
 * pattern from PR #423 (procurement/orders/list.vue + sales/orders/list.vue +
 * procurement/receives/list.vue):
 *
 *   <span v-if="row.totalAmount != null">{{ formatAmount(row.totalAmount) }}</span>
 *   <span v-else class="price-masked">—</span>
 *
 * Backend already strips @PriceSensitive fields to ``null`` via
 * ``PriceFieldResponseAdvice`` (PR #423) + ``PriceSensitiveSerializerModifier``
 * (PR #443). Before P1-D, Canvas Dynamic rendered such nulls as the formatter
 * fallback ``"-"`` (hyphen-minus) without semantic class. The fix:
 *
 *   1. Backend ``FactoryConfigServiceImpl#buildEffectiveFields`` plumbs the
 *      ``priceSensitive`` flag from raw schema JSON through to
 *      ``EffectiveField.extra``.
 *   2. Migration ``V20260513_01__module_schemas_price_sensitive_flags.sql``
 *      flags ``sales_order.totalAmount`` / ``purchase_order.totalAmount`` /
 *      ``bom.unitPrice`` as ``priceSensitive: true``.
 *   3. This component (``SchemaTableRenderer``) introduces a template
 *      ``v-else-if="isPriceSensitiveNull(...)"`` branch that emits the em-dash
 *      span with ``class="price-masked"`` instead of falling through to
 *      ``formatCell()``.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import SchemaTableRenderer from '../SchemaTableRenderer.vue';
import type { EffectiveField } from '@/types/config';

// Element Plus table primitives are stubbed to a flat slot expansion so the
// cell template is rendered into queryable DOM and the priceSensitive branch
// is visible to assertions.
const stubs = {
  'el-table': defineComponent({
    props: ['data'],
    setup(props, { slots }) {
      return () =>
        h('table', { class: 'el-table' }, [
          h('tbody', (props.data as Record<string, unknown>[]).map((row, idx) =>
            h('tr', { key: idx }, slots.default ? slots.default() : []),
          )),
        ]);
    },
  }),
  'el-table-column': defineComponent({
    props: ['prop', 'label'],
    setup(props, { slots }) {
      const cellSlot = slots.default;
      return () =>
        h('td', { class: 'el-table-column', 'data-prop': props.prop, 'data-label': props.label },
          cellSlot
            ? cellSlot({ row: { totalAmount: null, unitPrice: 9.99, orderNumber: 'SO-001' } })
            : [],
        );
    },
  }),
  'el-tag': true,
  'el-pagination': true,
  'el-button': true,
};

function field(opts: Partial<EffectiveField> & { code: string }): EffectiveField {
  return {
    code: opts.code,
    label: opts.label ?? opts.code,
    type: opts.type ?? 'decimal',
    required: false,
    visible: true,
    readonly: false,
    defaultValue: null,
    options: null,
    group: 'basic',
    order: opts.order ?? 0,
    extra: opts.extra ?? {},
  };
}

function mountRenderer(fields: EffectiveField[], data: Record<string, unknown>[]) {
  return mount(SchemaTableRenderer, {
    props: {
      fields,
      workflowTransitions: [],
      data,
      loading: false,
      pagination: { page: 1, size: 20, total: data.length },
    },
    global: { stubs },
  });
}

describe('SchemaTableRenderer priceSensitive null rendering (P1-D)', () => {
  it('renders stripped priceSensitive null cell as em-dash with .price-masked class', () => {
    const fields: EffectiveField[] = [
      field({
        code: 'totalAmount',
        label: '订单总金额',
        type: 'decimal',
        extra: { listVisible: true, listOrder: 1, formatter: 'currency', priceSensitive: true },
      }),
    ];
    const wrapper = mountRenderer(fields, [{ totalAmount: null }]);
    const html = wrapper.html();

    expect(wrapper.find('span.price-masked').exists()).toBe(true);
    expect(wrapper.find('span.price-masked').text()).toBe('—');
    // The em-dash must NOT be the plain hyphen-minus fallback from formatCell()
    expect(html).not.toMatch(/<span(?![^>]*price-masked)[^>]*>-<\/span>/);
  });

  it('renders priceSensitive cell with a real value through the currency formatter (admin path)', () => {
    const fields: EffectiveField[] = [
      field({
        code: 'totalAmount',
        label: '订单总金额',
        type: 'decimal',
        extra: { listVisible: true, listOrder: 1, formatter: 'currency', priceSensitive: true },
      }),
    ];
    // Override the stub row to a non-null totalAmount for this admin-path assertion.
    const wrapper = mount(SchemaTableRenderer, {
      props: {
        fields,
        workflowTransitions: [],
        data: [{ totalAmount: 1234.56 }],
        loading: false,
        pagination: { page: 1, size: 20, total: 1 },
      },
      global: {
        stubs: {
          ...stubs,
          'el-table-column': defineComponent({
            props: ['prop', 'label'],
            setup(props, { slots }) {
              return () =>
                h('td', { 'data-prop': props.prop },
                  slots.default ? slots.default({ row: { totalAmount: 1234.56 } }) : [],
                );
            },
          }),
        },
      },
    });
    expect(wrapper.find('span.price-masked').exists()).toBe(false);
    expect(wrapper.html()).toContain('¥1,234.56');
  });

  it('does NOT apply em-dash defense to non-priceSensitive null cells (preserves default "-" fallback)', () => {
    // Field has no priceSensitive flag → null falls through to formatCell()
    // which returns the plain "-" string (existing behavior).
    const fields: EffectiveField[] = [
      field({
        code: 'remark',
        label: '备注',
        type: 'textarea',
        extra: { listVisible: true, listOrder: 1 },
      }),
    ];
    const wrapper = mount(SchemaTableRenderer, {
      props: {
        fields,
        workflowTransitions: [],
        data: [{ remark: null }],
        loading: false,
        pagination: { page: 1, size: 20, total: 1 },
      },
      global: {
        stubs: {
          ...stubs,
          'el-table-column': defineComponent({
            props: ['prop'],
            setup(props, { slots }) {
              return () =>
                h('td', { 'data-prop': props.prop },
                  slots.default ? slots.default({ row: { remark: null } }) : [],
                );
            },
          }),
        },
      },
    });
    expect(wrapper.find('span.price-masked').exists()).toBe(false);
    // The classic formatCell() fallback emits "-" for any null cell — preserved
    // to avoid changing UX for fields that are not RBAC-stripped.
    expect(wrapper.text()).toContain('-');
  });

  it('priceSensitive flag also recognizes undefined as a null-equivalent strip outcome', () => {
    // PriceFieldResponseAdvice writes ``null`` via reflection, but the Jackson
    // serializer (PR #443 Option D) emits the field as absent in some code paths;
    // after parsing the field becomes ``undefined`` in JS. Both must trigger the
    // em-dash branch.
    const fields: EffectiveField[] = [
      field({
        code: 'totalAmount',
        label: '订单总金额',
        type: 'decimal',
        extra: { listVisible: true, formatter: 'currency', priceSensitive: true },
      }),
    ];
    const wrapper = mount(SchemaTableRenderer, {
      props: {
        fields,
        workflowTransitions: [],
        data: [{ /* totalAmount intentionally absent */ }],
        loading: false,
        pagination: { page: 1, size: 20, total: 1 },
      },
      global: {
        stubs: {
          ...stubs,
          'el-table-column': defineComponent({
            props: ['prop'],
            setup(props, { slots }) {
              return () =>
                h('td', { 'data-prop': props.prop },
                  slots.default ? slots.default({ row: {} }) : [],
                );
            },
          }),
        },
      },
    });
    expect(wrapper.find('span.price-masked').exists()).toBe(true);
    expect(wrapper.find('span.price-masked').text()).toBe('—');
  });
});
