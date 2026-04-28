/**
 * Tests for data-quality-tab.vue (Restaurant Phase B-1, Task 9).
 *
 * Test 1: renders outliers list and dismissed folded section
 *   - mock fetchOutliers returns 2 outliers + 1 dismissed
 *   - asserts summary text ('待复核 2'), table rows show date/kpi label
 *
 * Test 2: renders global baseline badge when baselineSource is global
 *   - mock outlier with baselineSource='global'
 *   - asserts text contains '全网基线'
 *
 * Test 3: does NOT render global baseline badge when baselineSource is self
 *   - mock baselineSource='self'
 *   - asserts '全网基线' NOT in text
 *
 * Test 4: dismiss button triggers API and reloads
 *   - mock 1 outlier; click "✓ 非异常" button
 *   - asserts dismissOutlier called with correct payload
 *   - asserts fetchOutliers called twice (initial + reload)
 *
 * Mocks @/api/restaurant/outliers so no real network calls are made.
 * Mocks @/store/modules/auth to provide factoryId.
 * Stubs Element Plus components (incl. el-table/el-table-column 的 row-driven 模式
 * inspired by Phase A data-quality-queue.spec.ts) — jsdom 不渲 layout-driven 行.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

// ── Mock API client ──────────────────────────────────────────────────
vi.mock('@/api/restaurant/outliers', () => ({
  fetchOutliers: vi.fn(),
  dismissOutlier: vi.fn(),
  undismissOutlier: vi.fn(),
}));

// ── Mock auth store ──────────────────────────────────────────────────
vi.mock('@/store/modules/auth', () => ({
  useAuthStore: () => ({ factoryId: 'F002' }),
}));

// ── Mock element-plus ElMessage ──────────────────────────────────────
const { elMessageSuccess, elMessageError } = vi.hoisted(() => ({
  elMessageSuccess: vi.fn(),
  elMessageError: vi.fn(),
}));

vi.mock('element-plus', () => ({
  ElMessage: {
    success: elMessageSuccess,
    error: elMessageError,
  },
}));

import { fetchOutliers, dismissOutlier, undismissOutlier } from '@/api/restaurant/outliers';
import DataQualityTab from '../data-quality-tab.vue';

// ── Element Plus stubs ───────────────────────────────────────────────
// el-table 在 jsdom 不渲行 (依赖 layout) — 用 provide/inject 模拟 row scope
const globalStubs = {
  'el-card': {
    template: '<div class="el-card"><slot /></div>',
  },
  'el-skeleton': {
    props: ['rows', 'animated'],
    template: '<div class="el-skeleton" />',
  },
  'el-alert': {
    props: ['title', 'type', 'showIcon', 'closable'],
    template: '<div class="el-alert" :data-type="type">{{ title }}</div>',
  },
  'el-tag': {
    props: ['type', 'size', 'effect'],
    template: '<span class="el-tag"><slot /></span>',
  },
  'el-button': {
    props: ['type', 'size', 'loading', 'plain', 'link'],
    emits: ['click'],
    template:
      '<button class="el-button" @click="$emit(\'click\')"><slot /></button>',
  },
  'el-empty': {
    props: ['description'],
    template: '<div class="el-empty">{{ description }}</div>',
  },
  // el-table — render rows via provide/inject pattern (Phase A proven)
  'el-table': {
    props: ['data', 'stripe', 'size'],
    template: `
      <table class="el-table">
        <tbody>
          <fake-row v-for="(row, idx) in (data || [])" :key="idx" :row="row">
            <slot />
          </fake-row>
        </tbody>
      </table>`,
    components: {
      'fake-row': {
        props: ['row'],
        provide() {
          const self = this as unknown as { row: unknown };
          return { currentRow: () => self.row };
        },
        template: '<tr class="el-table__row"><slot /></tr>',
      },
    },
  },
  'el-table-column': {
    props: ['label', 'prop', 'width', 'minWidth', 'fixed', 'align'],
    inject: { currentRow: { default: () => () => ({}) } },
    computed: {
      rowData(): Record<string, unknown> {
        const getter = (this as unknown as {
          currentRow: () => Record<string, unknown>;
        }).currentRow;
        return getter();
      },
      cellValue(): unknown {
        const propName = (this as unknown as { prop: string | undefined }).prop;
        if (!propName) return '';
        return (this as unknown as { rowData: Record<string, unknown> }).rowData[
          propName
        ];
      },
    },
    template:
      '<td class="el-table__cell"><slot :row="rowData" :$index="0">{{ cellValue }}</slot></td>',
  },
};

// ── Fixture helper ────────────────────────────────────────────────────
const mockOutlier = (date: string, baseline: 'self' | 'global' = 'self') => ({
  anomalyDate: date,
  kpiKind: 'wastage_cost_total',
  kpiLabel: '损耗成本',
  value: 8500,
  q1: 1200,
  q3: 3400,
  iqr: 2200,
  lowerFence: -2100,
  upperFence: 6700,
  deviationX: 0.82,
  severity: 'medium' as const,
  direction: 'above' as const,
  baselineSource: baseline,
  baselineN: baseline === 'global' ? ('100-499' as const) : ('10-49' as const),
});

describe('DataQualityTab (Restaurant Phase B-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    elMessageSuccess.mockClear();
    elMessageError.mockClear();
  });

  it('Test 1: renders outliers list and dismissed folded section', async () => {
    (fetchOutliers as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      factoryId: 'F002',
      windowDays: 30,
      cachedAt: new Date().toISOString(),
      summary: { totalAnomalies: 2, dismissedThisMonth: 1, insufficientKpis: [] },
      outliers: [mockOutlier('2026-04-25'), mockOutlier('2026-04-23')],
      dismissed: [
        {
          id: 1,
          anomalyDate: '2026-04-20',
          kpiKind: 'wastage_cost_total',
          kpiLabel: '损耗成本',
          dismissedBy: 'admin1',
          dismissedAt: '2026-04-26T10:00:00Z',
          snapshotValue: 5000,
          snapshotQ1: 1200,
          snapshotQ3: 3400,
          snapshotBaselineSource: 'self',
        },
      ],
    });

    const wrapper = mount(DataQualityTab, {
      global: { stubs: globalStubs },
    });
    await flushPromises();

    const tableText = wrapper.text();
    expect(tableText).toContain('2026-04-25');
    expect(tableText).toContain('损耗成本');
    expect(tableText).toContain('待复核 2');
  });

  it('Test 2: renders global baseline badge when baselineSource is global', async () => {
    (fetchOutliers as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      factoryId: 'R_NEW',
      windowDays: 30,
      cachedAt: new Date().toISOString(),
      summary: { totalAnomalies: 1, dismissedThisMonth: 0, insufficientKpis: [] },
      outliers: [mockOutlier('2026-04-25', 'global')],
      dismissed: [],
    });

    const wrapper = mount(DataQualityTab, {
      global: { stubs: globalStubs },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('全网基线');
  });

  it('Test 3: does NOT render global baseline badge when baselineSource is self', async () => {
    (fetchOutliers as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      factoryId: 'F002',
      windowDays: 30,
      cachedAt: new Date().toISOString(),
      summary: { totalAnomalies: 1, dismissedThisMonth: 0, insufficientKpis: [] },
      outliers: [mockOutlier('2026-04-25', 'self')],
      dismissed: [],
    });

    const wrapper = mount(DataQualityTab, {
      global: { stubs: globalStubs },
    });
    await flushPromises();

    expect(wrapper.text()).not.toContain('全网基线');
  });

  it('Test 4: dismiss button triggers API and reloads', async () => {
    (fetchOutliers as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      factoryId: 'F002',
      windowDays: 30,
      cachedAt: new Date().toISOString(),
      summary: { totalAnomalies: 1, dismissedThisMonth: 0, insufficientKpis: [] },
      outliers: [mockOutlier('2026-04-25')],
      dismissed: [],
    });
    (dismissOutlier as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 99,
    });
    (fetchOutliers as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      factoryId: 'F002',
      windowDays: 30,
      cachedAt: new Date().toISOString(),
      summary: { totalAnomalies: 0, dismissedThisMonth: 1, insufficientKpis: [] },
      outliers: [],
      dismissed: [
        {
          id: 99,
          anomalyDate: '2026-04-25',
          kpiKind: 'wastage_cost_total',
          kpiLabel: '损耗成本',
          dismissedBy: 'F002_admin',
          dismissedAt: new Date().toISOString(),
          snapshotValue: 8500,
          snapshotQ1: 1200,
          snapshotQ3: 3400,
          snapshotBaselineSource: 'self',
        },
      ],
    });

    const wrapper = mount(DataQualityTab, {
      global: { stubs: globalStubs },
    });
    await flushPromises();

    const dismissBtn = wrapper.findAll('button').find((b) => b.text().includes('非异常'));
    expect(dismissBtn).toBeTruthy();
    await dismissBtn!.trigger('click');
    await flushPromises();

    expect(dismissOutlier).toHaveBeenCalledWith(
      expect.objectContaining({
        factoryId: 'F002',
        anomalyDate: '2026-04-25',
        kpiKind: 'wastage_cost_total',
        snapshotBaselineSource: 'self',
      })
    );
    expect(fetchOutliers).toHaveBeenCalledTimes(2); // initial + reload
    expect(undismissOutlier).not.toHaveBeenCalled();
  });
});
