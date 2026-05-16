/**
 * Regression test for smoke-v2 bug #14 — Sticky Footer 数据没接通.
 *
 * Sales sales_mgr → /sales/orders showed 5 real orders ¥6,127,550 in the table
 * but the bottom <TableFooter> rendered "暂无数据". Root cause: useListSummary
 * stored the axios ApiResponse envelope `{success,data,message}` into
 * `summary.value` and components read `summary.value.stats` — which is
 * `undefined` on the envelope, so `footerSummary?.stats ?? []` collapsed to []
 * and TableFooter showed its empty-state placeholder. RN sibling hook already
 * unwraps `envelope.data`; this test pins that behavior on the web-admin side.
 *
 * Mocks `fetchListSummary` (so we control the envelope shape) and
 * `useFactoryId` (Pinia not initialized in this test runner, per
 * src/__tests__/setup.ts).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref, nextTick } from 'vue';

// ── Top-level mocks (vi.mock is hoisted) ──────────────────────────────

let mockFactoryId: string = 'F006';
vi.mock('../useFactoryId', () => ({
  useFactoryId: () => {
    return {
      get value() {
        return mockFactoryId;
      },
    };
  },
}));

const fetchListSummary = vi.fn();
vi.mock('@/api/listSummary', () => ({
  fetchListSummary: (...args: unknown[]) => fetchListSummary(...args),
}));

// Import composable AFTER mocks are set up.
import { useListSummary } from '../useListSummary';
import type { ListSummaryRequest, ListSummaryResponse } from '@/types/listSummary';

// ── Fixtures ──────────────────────────────────────────────────────────

const SALES_ORDER_PAYLOAD: ListSummaryResponse = {
  entityType: 'salesOrder',
  stats: [
    { label: '共', value: 5, format: 'number', unit: '单' },
    { label: '总金额', value: 6127550, format: 'currency' },
    { label: '当前页', value: '1/1', format: 'plain' },
  ],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,
    totalItems: 5,
  },
};

function makeEnvelope(payload: ListSummaryResponse) {
  // Matches the shape returned by web-admin's shared post<T>() helper —
  // post<T> is typed Promise<ApiResponse<T>> and the axios interceptor
  // resolves with the unmodified backend body (line 212 of api/request.ts).
  return { success: true, data: payload, message: 'OK' };
}

// Wait for the watcher's initial-load + the awaited fetch + the assignment.
async function flushWatcher() {
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('useListSummary', () => {
  beforeEach(() => {
    mockFactoryId = 'F006';
    fetchListSummary.mockReset();
  });

  it('unwraps the ApiResponse envelope so summary.stats is the backend stats array (smoke-v2 bug #14)', async () => {
    fetchListSummary.mockResolvedValueOnce(makeEnvelope(SALES_ORDER_PAYLOAD));

    const request = ref<ListSummaryRequest>({});
    const { summary, loading, error } = useListSummary('salesOrder', request);

    await flushWatcher();

    expect(fetchListSummary).toHaveBeenCalledTimes(1);
    expect(fetchListSummary).toHaveBeenCalledWith('F006', 'salesOrder', {});

    expect(error.value).toBeNull();
    expect(loading.value).toBe(false);
    expect(summary.value).not.toBeNull();

    // Regression assertion — before the fix `summary.value` held the envelope
    // and `summary.value.stats` was undefined.
    expect(summary.value?.stats).toEqual(SALES_ORDER_PAYLOAD.stats);
    expect(summary.value?.stats).toHaveLength(3);
    expect(summary.value?.entityType).toBe('salesOrder');
    expect(summary.value?.pagination?.totalItems).toBe(5);
  });

  it('does NOT shape-leak the envelope — summary must not look like {success,data,message}', async () => {
    fetchListSummary.mockResolvedValueOnce(makeEnvelope(SALES_ORDER_PAYLOAD));

    const request = ref<ListSummaryRequest>({});
    const { summary } = useListSummary('salesOrder', request);

    await flushWatcher();

    const value = summary.value as unknown as Record<string, unknown>;
    expect(value).not.toHaveProperty('success');
    expect(value).not.toHaveProperty('message');
    // The envelope's `data` key would shadow ListSummaryResponse without an
    // unwrap; verify the consumed shape uses the real ListSummaryResponse keys.
    expect(value).toHaveProperty('entityType');
    expect(value).toHaveProperty('stats');
  });

  it('refetches when the request ref deeply mutates and reflects the new payload', async () => {
    fetchListSummary.mockResolvedValueOnce(makeEnvelope(SALES_ORDER_PAYLOAD));

    const request = ref<ListSummaryRequest>({ filterConditions: {} });
    const { summary } = useListSummary('salesOrder', request);

    await flushWatcher();
    expect(summary.value?.stats?.[0]?.value).toBe(5);

    const filteredPayload: ListSummaryResponse = {
      entityType: 'salesOrder',
      stats: [{ label: '共', value: 2, format: 'number', unit: '单' }],
    };
    fetchListSummary.mockResolvedValueOnce(makeEnvelope(filteredPayload));

    request.value = { filterConditions: { status: 'CONFIRMED' } };
    await flushWatcher();

    expect(fetchListSummary).toHaveBeenCalledTimes(2);
    expect(fetchListSummary).toHaveBeenLastCalledWith('F006', 'salesOrder', {
      filterConditions: { status: 'CONFIRMED' },
    });
    expect(summary.value?.stats?.[0]?.value).toBe(2);
  });

  it('skips the network call when no factoryId is available and surfaces an error', async () => {
    mockFactoryId = '';

    const request = ref<ListSummaryRequest>({});
    const { summary, error } = useListSummary('salesOrder', request);

    await flushWatcher();

    expect(fetchListSummary).not.toHaveBeenCalled();
    expect(summary.value).toBeNull();
    expect(error.value).not.toBeNull();
    expect(error.value?.message).toMatch(/factoryId/);
  });

  it('clears summary and records the error when fetchListSummary rejects', async () => {
    const apiErr = new Error('boom — backend 500');
    fetchListSummary.mockRejectedValueOnce(apiErr);

    const request = ref<ListSummaryRequest>({});
    const { summary, error, loading } = useListSummary('salesOrder', request);

    await flushWatcher();

    expect(summary.value).toBeNull();
    expect(error.value).toBe(apiErr);
    expect(loading.value).toBe(false);
  });
});
