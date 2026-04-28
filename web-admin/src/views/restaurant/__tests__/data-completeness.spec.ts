/**
 * Tests for data-completeness.vue (Restaurant Phase A-2, Task 2.2).
 *
 * Test 1: renders 6 modules with overall completeness
 *   - mockFetchCompleteness resolves with full CompletenessResponse
 *   - asserts all 6 module names appear in HTML
 *   - asserts overall percentage (72%) appears in HTML
 *
 * Test 2: shows error alert when fetchCompleteness rejects
 *   - mockRejectedValue with Error('网络错误')
 *   - asserts el-alert with error text is visible
 *
 * Mocks @/api/restaurant/completeness so no real network calls are made.
 * Mocks @/store/modules/auth to provide factoryId.
 * Mocks vue-router (useRouter) to avoid full router setup.
 * Stubs Element Plus components + v-loading directive.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

// ── Mock vue-router ──────────────────────────────────────────────────
const mockRouterPush = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

// ── Mock auth store ──────────────────────────────────────────────────
vi.mock('@/store/modules/auth', () => ({
  useAuthStore: () => ({ factoryId: 'RES_3101_009' }),
}));

// ── Mock API client ──────────────────────────────────────────────────
const mockFetchCompleteness = vi.fn();

vi.mock('@/api/restaurant/completeness', () => ({
  fetchCompleteness: (...args: unknown[]) => mockFetchCompleteness(...args),
}));

// ── Global stubs for Element Plus components ─────────────────────────
const globalStubs = {
  'el-card': {
    template: '<div class="el-card"><div class="el-card__header"><slot name="header" /></div><div class="el-card__body"><slot /></div></div>',
  },
  'el-skeleton': {
    props: ['rows', 'animated'],
    template: '<div class="el-skeleton" />',
  },
  'el-alert': {
    props: ['title', 'type', 'showIcon', 'closable'],
    template: '<div class="el-alert" :data-type="type">{{ title }}</div>',
  },
  'el-progress': {
    props: ['percentage', 'color', 'showText', 'strokeWidth', 'status'],
    template: '<div class="el-progress">{{ percentage }}%</div>',
  },
  'el-tag': {
    props: ['type', 'size'],
    template: '<span class="el-tag"><slot /></span>',
  },
  'el-button': {
    props: ['type', 'size', 'loading', 'plain'],
    emits: ['click'],
    template: '<button class="el-button" @click="$emit(\'click\')"><slot /></button>',
  },
};

// v-loading stub
const vLoadingStub = { mounted() {}, updated() {}, unmounted() {} };

// ── Import component under test ──────────────────────────────────────
import DataCompleteness from '../data-completeness.vue';

// ── Fixture ───────────────────────────────────────────────────────────
function makeCompletenessResponse() {
  return {
    factoryId: 'RES_3101_009',
    factoryName: '青花椒餐饮连锁',
    factoryType: 'RESTAURANT',
    factoryAgeDays: 120,
    overallCompleteness: 72,
    cachedAt: 'miss',
    modules: [
      {
        id: 'daily_sales',
        name: '每日销售',
        hasData: true,
        recordCount: 202,
        lastUpdated: '2026-04-28T10:00:00Z',
        coverage: 85,
        missingHints: [],
        windowDays: 30,
      },
      {
        id: 'member_info',
        name: '会员信息',
        hasData: true,
        recordCount: 32997,
        lastUpdated: '2026-04-27T08:00:00Z',
        coverage: 90,
        missingHints: [],
        windowDays: 90,
      },
      {
        id: 'food_cost',
        name: '食材成本',
        hasData: false,
        recordCount: 0,
        lastUpdated: null,
        coverage: 0,
        missingHints: ['请上传食材采购明细 Excel 文件'],
        windowDays: 30,
      },
      {
        id: 'store_ops',
        name: '门店运营',
        hasData: true,
        recordCount: 4,
        lastUpdated: '2026-04-28T09:00:00Z',
        coverage: 70,
        missingHints: [],
        windowDays: 30,
      },
      {
        id: 'menu_items',
        name: '菜单品类',
        hasData: true,
        recordCount: 150,
        lastUpdated: '2026-04-20T00:00:00Z',
        coverage: 60,
        missingHints: [],
        windowDays: 30,
      },
      {
        id: 'reviews',
        name: '评价数据',
        hasData: false,
        recordCount: 0,
        lastUpdated: null,
        coverage: 0,
        missingHints: ['请上传大众点评评价 Excel 文件'],
        windowDays: 30,
      },
    ],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('data-completeness.vue (Restaurant Phase A-2)', () => {
  beforeEach(() => {
    mockFetchCompleteness.mockReset();
    mockRouterPush.mockReset();
  });

  it('Test 1: renders 6 modules with overall completeness on successful load', async () => {
    mockFetchCompleteness.mockResolvedValueOnce(makeCompletenessResponse());

    const wrapper = mount(DataCompleteness, {
      global: {
        stubs: globalStubs,
        directives: { loading: vLoadingStub },
      },
    });
    await flushPromises();

    expect(mockFetchCompleteness).toHaveBeenCalledWith('RES_3101_009');

    const html = wrapper.html();

    // Overall percentage should appear
    expect(html).toContain('72%');

    // All 6 module names
    expect(html).toContain('每日销售');
    expect(html).toContain('会员信息');
    expect(html).toContain('食材成本');
    expect(html).toContain('门店运营');
    expect(html).toContain('菜单品类');
    expect(html).toContain('评价数据');
  });

  it('Test 2: shows error alert when fetchCompleteness rejects', async () => {
    mockFetchCompleteness.mockRejectedValueOnce(new Error('网络错误'));

    const wrapper = mount(DataCompleteness, {
      global: {
        stubs: globalStubs,
        directives: { loading: vLoadingStub },
      },
    });
    await flushPromises();

    const html = wrapper.html();
    expect(html).toContain('网络错误');

    // The el-alert stub should be present with error type
    const alert = wrapper.find('.el-alert');
    expect(alert.exists()).toBe(true);
    expect(alert.attributes('data-type')).toBe('error');
  });
});
