/**
 * Tests for provenance-config.vue (Sub-Project C Day 27).
 *
 * Verifies the §6.4 admin page renders + saves + cancels correctly:
 *   1. Loads from pythonFetch on mount + renders all 3 cards.
 *   2. Save button calls pythonFetch with PUT + correct body shape.
 *   3. Save button is disabled when not dirty (idempotent re-save guard).
 *   4. Save shows error toast when pythonFetch rejects.
 *   5. Cancel re-loads from server.
 *
 * camelCase mocks are CRITICAL — pythonFetch runs response through
 * transformKeys so the runtime shape is camelCase, and modeling tests
 * with snake_case would mask real wiring bugs (Day 26 lesson learned).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

// ── Mock auth store ──────────────────────────────────────────────────
vi.mock('@/store/modules/auth', () => ({
  useAuthStore: () => ({ factoryId: 'F001' }),
}));

// ── Mock vue-router (component doesn't use it, but a sibling file
//     mock keeps Vitest module-graph happy if cell-audit/spec is also
//     in the run) ─────────────────────────────────────────────────────
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

// ── Mock Element Plus ElMessage ──────────────────────────────────────
const elMessageError = vi.fn();
const elMessageSuccess = vi.fn();
vi.mock('element-plus', () => ({
  ElMessage: {
    error: (...a: unknown[]) => elMessageError(...a),
    success: (...a: unknown[]) => elMessageSuccess(...a),
    warning: vi.fn(),
  },
}));

// ── Mock pythonFetch ─────────────────────────────────────────────────
const mockPythonFetch = vi.fn();
vi.mock('@/api/smartbi/common', () => ({
  pythonFetch: (...args: unknown[]) => mockPythonFetch(...args),
}));

// ── Element Plus stubs (mirror cell-audit.spec.ts) ───────────────────
const globalStubs = {
  'el-page-header': {
    props: ['content'],
    template:
      '<div class="el-page-header"><span class="page-content">{{ content }}</span><div class="page-extra"><slot name="extra" /></div><slot /></div>',
  },
  'el-skeleton': { template: '<div class="el-skeleton" />' },
  'el-alert': {
    props: ['type', 'title'],
    template: '<div class="el-alert" :class="`alert-${type}`">{{ title }}</div>',
  },
  'el-card': {
    template:
      '<div class="el-card"><div class="el-card__header"><slot name="header" /></div><div class="el-card__body"><slot /></div></div>',
  },
  'el-slider': {
    props: ['modelValue', 'min', 'max', 'step', 'formatTooltip'],
    emits: ['update:modelValue'],
    template:
      '<input type="range" class="el-slider" :min="min" :max="max" :step="step" :value="modelValue" @input="$emit(\'update:modelValue\', parseFloat($event.target.value))" />',
  },
  'el-input-number': {
    props: ['modelValue', 'min', 'max', 'step', 'precision', 'placeholder', 'controlsPosition', 'size'],
    emits: ['update:modelValue'],
    template:
      '<input type="number" class="el-input-number" :min="min" :max="max" :step="step" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value === \'\' ? null : parseFloat($event.target.value))" />',
  },
  'el-button': {
    props: ['type', 'disabled', 'loading'],
    emits: ['click'],
    template:
      '<button class="el-button" :class="`type-${type}`" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  // Same provide/inject dance as cell-audit.spec.ts so el-table-column
  // default slots see their row.
  'el-table': {
    props: ['data'],
    template: `
      <table class="el-table">
        <tbody>
          <fake-row v-for="(row, idx) in (data || [])" :key="idx" :row="row">
            <slot />
          </fake-row>
        </tbody>
      </table>
    `,
    components: {
      'fake-row': {
        props: ['row'],
        provide() {
          return {
            currentRow: () => (this as unknown as { row: unknown }).row,
          };
        },
        template: '<tr class="el-table__row"><slot /></tr>',
      },
    },
  },
  'el-table-column': {
    props: ['label', 'prop'],
    inject: {
      currentRow: { default: () => () => ({}) },
    },
    computed: {
      rowSlot(): Record<string, unknown> {
        return (this as unknown as { currentRow: () => Record<string, unknown> }).currentRow();
      },
      // When no default slot is supplied, fall back to row[prop] so plain
      // <el-table-column prop="name" /> still shows the value (matches
      // Element Plus's runtime behavior).
      propValue(): unknown {
        const self = this as unknown as {
          prop?: string;
          rowSlot: Record<string, unknown>;
        };
        return self.prop ? self.rowSlot[self.prop] : '';
      },
    },
    template: '<td class="el-table__cell"><slot :row="rowSlot">{{ propValue }}</slot></td>',
  },
};

// Import AFTER mocks.
import ProvenanceConfig from '../provenance-config.vue';

// ── Fixtures ─────────────────────────────────────────────────────────
function makeConfigResponse(overrides: Record<string, unknown> = {}) {
  return {
    factoryId: 'F001',
    diffThreshold: 0.30,
    sourcePriorities: [
      { sourceType: 'manual', name: '客户手动确认', globalDefault: 1, factoryOverride: null as number | null },
      { sourceType: 'bill_flow', name: '账单流水', globalDefault: 2, factoryOverride: null as number | null },
      { sourceType: 'product_summary', name: '商品汇总', globalDefault: 3, factoryOverride: null as number | null },
      { sourceType: 'review', name: '评论数据', globalDefault: 4, factoryOverride: null as number | null },
      { sourceType: 'inferred', name: 'AI 推断', globalDefault: 5, factoryOverride: null as number | null },
      { sourceType: 'industry_default', name: '行业默认值', globalDefault: 6, factoryOverride: null as number | null },
    ],
    industryDefaults: [
      { category: '川菜', name: '川菜', globalDefault: 0.35, override: null as number | null },
      { category: '粤菜', name: '粤菜', globalDefault: 0.40, override: null as number | null },
      { category: '湘菜', name: '湘菜', globalDefault: 0.32, override: null as number | null },
      { category: '火锅', name: '火锅', globalDefault: 0.28, override: null as number | null },
    ],
    updatedAt: '2026-04-27T08:30:00+00:00',
    updatedBy: 'admin:test',
    ...overrides,
  };
}

describe('provenance-config.vue (Sub-Project C Day 27)', () => {
  beforeEach(() => {
    mockPythonFetch.mockReset();
    elMessageError.mockReset();
    elMessageSuccess.mockReset();
  });

  it('loads + renders all 3 cards with N rows', async () => {
    mockPythonFetch.mockResolvedValueOnce(makeConfigResponse());

    const wrapper = mount(ProvenanceConfig, { global: { stubs: globalStubs } });
    await flushPromises();

    // pythonFetch called with GET URL + factory_id query.
    expect(mockPythonFetch).toHaveBeenCalledTimes(1);
    const firstCall = mockPythonFetch.mock.calls[0];
    expect(firstCall[0]).toContain('/api/smartbi/factory-config/provenance');
    expect(firstCall[0]).toContain('factory_id=F001');
    // First call has NO method option (default GET).
    expect(firstCall[1]).toBeUndefined();

    const html = wrapper.html();
    expect(html).toContain('差异阈值 (Q1)');
    expect(html).toContain('来源优先级 (Q2)');
    expect(html).toContain('行业默认成本率 (Q3)');
    // Q1 slider initialized at 0.30 (30%).
    expect(html).toContain('30%');
    // Q2 priority table — 6 rows for source types.
    const slider = wrapper.find('.el-slider');
    expect((slider.element as HTMLInputElement).value).toBe('0.3');
    // 6 source priority rows + 4 industry default rows = 10 table rows.
    const tableRows = wrapper.findAll('.el-table__row');
    expect(tableRows.length).toBe(10);
    // Q2 row labels appear.
    expect(html).toContain('客户手动确认');
    expect(html).toContain('账单流水');
    expect(html).toContain('行业默认值');
    // Q3 categories appear with global defaults rendered as percentages.
    expect(html).toContain('川菜');
    expect(html).toContain('火锅');
    expect(html).toContain('35%'); // 川菜 globalDefault
  });

  it('saves on click — PUT with body shape including overrides', async () => {
    // First call: GET on mount; second call: PUT on save.
    mockPythonFetch.mockResolvedValueOnce(makeConfigResponse());
    mockPythonFetch.mockResolvedValueOnce(
      makeConfigResponse({
        diffThreshold: 0.40,
        updatedAt: '2026-04-27T09:00:00+00:00',
        updatedBy: 'admin:test',
      }),
    );

    const wrapper = mount(ProvenanceConfig, { global: { stubs: globalStubs } });
    await flushPromises();

    // Change the slider from 0.30 → 0.40 to make the form dirty.
    const slider = wrapper.find('.el-slider');
    await slider.setValue(0.4);
    await flushPromises();

    // Click 保存 (the type=primary button, first one).
    const buttons = wrapper.findAll('.el-button');
    const saveBtn = buttons.find((b) => b.text() === '保存');
    expect(saveBtn).toBeDefined();
    expect((saveBtn!.element as HTMLButtonElement).disabled).toBe(false);
    await saveBtn!.trigger('click');
    await flushPromises();

    // PUT was made.
    expect(mockPythonFetch).toHaveBeenCalledTimes(2);
    const putCall = mockPythonFetch.mock.calls[1];
    expect(putCall[0]).toBe('/api/smartbi/factory-config/provenance');
    expect(putCall[1]).toMatchObject({ method: 'PUT' });
    // Body parses to expected shape.
    const body = JSON.parse(putCall[1].body);
    expect(body).toEqual({
      factoryId: 'F001',
      diffThreshold: 0.4,
      sourcePriorities: {},
      industryDefaults: {},
    });

    // Success toast shown.
    expect(elMessageSuccess).toHaveBeenCalledWith('配置已保存');
  });

  it('save button is disabled when form is not dirty', async () => {
    mockPythonFetch.mockResolvedValueOnce(makeConfigResponse());

    const wrapper = mount(ProvenanceConfig, { global: { stubs: globalStubs } });
    await flushPromises();

    // Fresh load — no edits — Save should be disabled.
    let buttons = wrapper.findAll('.el-button');
    let saveBtn = buttons.find((b) => b.text() === '保存')!;
    expect((saveBtn.element as HTMLButtonElement).disabled).toBe(true);

    // Edit the slider — Save should now be enabled.
    const slider = wrapper.find('.el-slider');
    await slider.setValue(0.45);
    await flushPromises();

    buttons = wrapper.findAll('.el-button');
    saveBtn = buttons.find((b) => b.text() === '保存')!;
    expect((saveBtn.element as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows error toast when save rejects', async () => {
    mockPythonFetch.mockResolvedValueOnce(makeConfigResponse());
    mockPythonFetch.mockRejectedValueOnce(new Error('400: bad threshold'));

    const wrapper = mount(ProvenanceConfig, { global: { stubs: globalStubs } });
    await flushPromises();

    // Make form dirty to enable Save.
    const slider = wrapper.find('.el-slider');
    await slider.setValue(0.45);
    await flushPromises();

    const saveBtn = wrapper
      .findAll('.el-button')
      .find((b) => b.text() === '保存')!;
    await saveBtn.trigger('click');
    await flushPromises();

    expect(elMessageError).toHaveBeenCalled();
    const errMsg = elMessageError.mock.calls[0][0] as string;
    expect(errMsg).toContain('400: bad threshold');
  });

  it('cancel re-loads from server', async () => {
    mockPythonFetch.mockResolvedValueOnce(makeConfigResponse({ diffThreshold: 0.30 }));
    mockPythonFetch.mockResolvedValueOnce(makeConfigResponse({ diffThreshold: 0.30 }));

    const wrapper = mount(ProvenanceConfig, { global: { stubs: globalStubs } });
    await flushPromises();

    // Edit locally.
    const slider = wrapper.find('.el-slider');
    await slider.setValue(0.45);
    await flushPromises();
    expect((slider.element as HTMLInputElement).value).toBe('0.45');

    // Click 取消.
    const cancelBtn = wrapper
      .findAll('.el-button')
      .find((b) => b.text() === '取消')!;
    await cancelBtn.trigger('click');
    await flushPromises();

    // pythonFetch called twice (mount + cancel-reload).
    expect(mockPythonFetch).toHaveBeenCalledTimes(2);
    // Slider reverted to server snapshot (0.30).
    const sliderAfter = wrapper.find('.el-slider');
    expect((sliderAfter.element as HTMLInputElement).value).toBe('0.3');
  });
});
