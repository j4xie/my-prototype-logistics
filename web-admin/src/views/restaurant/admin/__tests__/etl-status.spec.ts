/**
 * Tests for etl-status.vue (Restaurant Phase A-1, Task 1.5).
 *
 * Test 1: renders factory list on mount — mockFetchAllEtlStatus resolves
 *         with one factory; asserts factoryId text appears in the table.
 * Test 2: triggers ETL when 立即同步 button clicked — mockTriggerEtl
 *         resolves; asserts it was called with the correct factoryId.
 *
 * Mocks @/api/restaurant/etl-admin so no real network calls are made.
 * Mocks @/store/modules/auth to provide a factoryId for the auth store.
 * Stubs Element Plus components + v-loading directive to avoid jsdom issues.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

// ── Mock auth store ──────────────────────────────────────────────────
vi.mock('@/store/modules/auth', () => ({
  useAuthStore: () => ({ factoryId: 'F001', factoryType: 'RESTAURANT' }),
}));

// ── Mock API client ──────────────────────────────────────────────────
const mockFetchAllEtlStatus = vi.fn();
const mockFetchEtlStatus = vi.fn();
const mockTriggerEtl = vi.fn();

vi.mock('@/api/restaurant/etl-admin', () => ({
  fetchAllEtlStatus: (...args: unknown[]) => mockFetchAllEtlStatus(...args),
  fetchEtlStatus: (...args: unknown[]) => mockFetchEtlStatus(...args),
  triggerEtl: (...args: unknown[]) => mockTriggerEtl(...args),
}));

// ── Mock Element Plus (ElMessage) ────────────────────────────────────
const { elMessageSuccess, elMessageError } = vi.hoisted(() => ({
  elMessageSuccess: vi.fn(),
  elMessageError: vi.fn(),
}));
vi.mock('element-plus', () => ({
  ElMessage: { success: elMessageSuccess, error: elMessageError, warning: vi.fn() },
}));

// ── Global stubs for Element Plus components ─────────────────────────
// Note: el-table-column template must NOT use TypeScript `as` casts —
// the Vue runtime template compiler in jsdom cannot handle them.
const globalStubs = {
  'el-card': {
    template: '<div class="el-card"><div class="el-card__header"><slot name="header" /></div><div class="el-card__body"><slot /></div></div>',
  },
  'el-skeleton': { template: '<div class="el-skeleton" />' },
  'el-empty': {
    props: ['description'],
    template: '<div class="el-empty">{{ description }}</div>',
  },
  'el-button': {
    props: ['type', 'size', 'disabled', 'loading', 'icon', 'plain'],
    emits: ['click'],
    template: '<button class="el-button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  'el-dialog': {
    props: ['modelValue', 'title'],
    emits: ['update:modelValue'],
    template: `
      <div v-if="modelValue" class="el-dialog">
        <div class="el-dialog__title">{{ title }}</div>
        <slot />
        <div class="el-dialog__footer"><slot name="footer" /></div>
      </div>`,
  },
  // el-table with provide/inject so el-table-column default slots see the row
  'el-table': {
    props: ['data'],
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
  // Avoid TypeScript `as` in template; use a plain JS accessor via computed
  'el-table-column': {
    props: ['label', 'prop', 'width', 'minWidth', 'fixed', 'align'],
    inject: { currentRow: { default: () => () => ({}) } },
    computed: {
      rowData(): Record<string, unknown> {
        const getter = (this as unknown as { currentRow: () => Record<string, unknown> }).currentRow;
        return getter();
      },
      cellValue(): unknown {
        const propName = (this as unknown as { prop: string | undefined }).prop;
        if (!propName) return '';
        return (this as unknown as { rowData: Record<string, unknown> }).rowData[propName];
      },
    },
    template: '<td class="el-table__cell"><slot :row="rowData">{{ cellValue }}</slot></td>',
  },
};

// v-loading is an Element Plus directive not available in jsdom — stub it out
const vLoadingStub = { mounted() {}, updated() {}, unmounted() {} };

import EtlStatus from '../etl-status.vue';

// ── Fixtures ─────────────────────────────────────────────────────────

function makeAllStatusResponse() {
  return {
    factories: [
      {
        factoryId: 'RES_3101_009',
        factoryName: '青花椒门店',
        lastSuccessRun: '2026-04-28T10:00:00Z',
      },
    ],
  };
}

function makeDetailResponse(factoryId: string) {
  return {
    factoryId,
    factoryName: '青花椒门店',
    lastSuccessRun: '2026-04-28T10:00:00Z',
    lastStatus: 'success' as const,
    rowCounts: { daily_sales: 202 },
    recentFailures: [],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('etl-status.vue (Restaurant Phase A-1)', () => {
  beforeEach(() => {
    mockFetchAllEtlStatus.mockReset();
    mockFetchEtlStatus.mockReset();
    mockTriggerEtl.mockReset();
    elMessageSuccess.mockClear();
    elMessageError.mockClear();
  });

  it('Test 1: renders factory list on mount — factoryId appears in table', async () => {
    mockFetchAllEtlStatus.mockResolvedValueOnce(makeAllStatusResponse());
    mockFetchEtlStatus.mockResolvedValueOnce(makeDetailResponse('RES_3101_009'));

    const wrapper = mount(EtlStatus, {
      global: {
        stubs: globalStubs,
        directives: { loading: vLoadingStub },
      },
    });
    await flushPromises();

    expect(mockFetchAllEtlStatus).toHaveBeenCalledTimes(1);
    const html = wrapper.html();
    expect(html).toContain('RES_3101_009');
  });

  it('Test 2: calls triggerEtl with correct factoryId when 立即同步 clicked', async () => {
    mockFetchAllEtlStatus.mockResolvedValueOnce(makeAllStatusResponse());
    mockFetchEtlStatus.mockResolvedValue(makeDetailResponse('RES_3101_009'));
    mockTriggerEtl.mockResolvedValueOnce({ jobId: 'job-123', status: 'queued', eta: 30 });

    const wrapper = mount(EtlStatus, {
      global: {
        stubs: globalStubs,
        directives: { loading: vLoadingStub },
      },
    });
    await flushPromises();

    // Find the 立即同步 button (not disabled — status is 'success')
    const buttons = wrapper.findAll('button.el-button');
    const triggerBtn = buttons.find((b) => b.text().includes('立即同步'));
    expect(triggerBtn).toBeDefined();

    await triggerBtn!.trigger('click');
    await flushPromises();

    expect(mockTriggerEtl).toHaveBeenCalledTimes(1);
    expect(mockTriggerEtl).toHaveBeenCalledWith('RES_3101_009');
  });
});
