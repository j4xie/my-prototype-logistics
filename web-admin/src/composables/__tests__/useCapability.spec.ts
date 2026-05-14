/**
 * Unit tests for useCapability composable.
 * Spec §5.1 (数据织网/02-A-能力驱动渲染.md v1.5):
 *   - S5: inflight dedup (concurrent calls share one network request)
 *   - S6: loading state
 *   - S7: fail-open on error (hasAll → permissive)
 *   - S8: auth race (no factoryId → skip fetch, no crash)
 *
 * Important: useCapability uses module-level singleton state. Tests must call
 * _resetCapabilityState() in beforeEach to clear it between cases.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Top-level mocks (vi.mock is hoisted, must be at module scope) ──────

// Mock auth store. Tests mutate `mockFactoryId` to simulate auth states.
let mockFactoryId = 'F001';
vi.mock('@/store/modules/auth', () => ({
  useAuthStore: () => ({
    get factoryId() {
      return mockFactoryId;
    },
  }),
}));

// Mock card-manifest (owned by another agent, may not exist yet at runtime).
vi.mock('@/capability/card-manifest', () => ({
  CARD_MANIFEST: [
    { id: 'dish_sales_top_n', requires: ['store_name', 'date'] },
    { id: 'monthly_trend', requires: ['date'] },
    { id: 'no_requires', requires: [] },
  ],
}));

// Mock SmartBI common module (we only need URL + auth headers; avoid pulling
// in axios/request transitive deps).
vi.mock('@/api/smartbi/common', () => ({
  PYTHON_SMARTBI_URL: '/smartbi-api',
  getPythonAuthHeaders: () => ({ 'X-Test': '1' }),
}));

// ── Import composable AFTER mocks are set up ──────────────────────────
import { useCapability, _resetCapabilityState } from '../useCapability';

// ── Helpers ────────────────────────────────────────────────────────────

function mockFetchOnce(payload: unknown, opts: { ok?: boolean; status?: number } = {}) {
  const ok = opts.ok ?? true;
  const status = opts.status ?? (ok ? 200 : 500);
  return vi.fn().mockResolvedValueOnce({
    ok,
    status,
    json: async () => payload,
  });
}

const SAMPLE_RESPONSE = {
  factory_id: 'F001',
  available_fields: ['store_name', 'order_amount'],
  template_status: {
    dish_sales_top_n: { satisfied: false, missing: ['date'] },
    monthly_trend: { satisfied: false, missing: ['date'] },
  },
  unlock_suggestions: [
    {
      missing_field: 'date',
      unlocks_count: 5,
      unlocks_examples: ['monthly_trend', 'dish_sales_top_n'],
      cta: '上传含日期的报表解锁 5 张卡片',
    },
  ],
  time_coverage: null as null | { from: string; to: string },
};

// ── Tests ──────────────────────────────────────────────────────────────

describe('useCapability', () => {
  beforeEach(() => {
    _resetCapabilityState();
    mockFactoryId = 'F001';
    vi.unstubAllGlobals();
  });

  it('case 1: fail-open BEFORE fetch — hasAll returns true (cache empty → permissive)', () => {
    const { hasAll, missingOf, available } = useCapability();
    expect(available.value).toBeNull();
    expect(hasAll(['anything', 'else'])).toBe(true);
    expect(hasAll([])).toBe(true);
    expect(missingOf(['anything'])).toEqual([]);
  });

  it('case 2: fetched + satisfied — hasAll([store_name]) returns true', async () => {
    const fetchMock = mockFetchOnce(SAMPLE_RESPONSE);
    vi.stubGlobal('fetch', fetchMock);

    const { fetchCapability, hasAll, available } = useCapability();
    const data = await fetchCapability();

    expect(data).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/smartbi-api/api/smartbi/capability/F001',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'X-Test': '1' }),
      }),
    );
    expect(available.value).toEqual(new Set(['store_name', 'order_amount']));
    expect(hasAll(['store_name'])).toBe(true);
    expect(hasAll(['store_name', 'order_amount'])).toBe(true);
  });

  it('case 3: fetched + missing — hasAll([date]) returns false; missingOf reports it', async () => {
    const fetchMock = mockFetchOnce(SAMPLE_RESPONSE);
    vi.stubGlobal('fetch', fetchMock);

    const { fetchCapability, hasAll, missingOf, cardStatus } = useCapability();
    await fetchCapability();

    expect(hasAll(['date'])).toBe(false);
    expect(hasAll(['store_name', 'date'])).toBe(false);
    expect(missingOf(['date', 'store_name'])).toEqual(['date']);

    // cardStatus derives from CARD_MANIFEST mock
    expect(cardStatus.value['dish_sales_top_n']).toEqual({
      satisfied: false,
      missing: ['date'],
    });
    expect(cardStatus.value['monthly_trend']).toEqual({
      satisfied: false,
      missing: ['date'],
    });
    expect(cardStatus.value['no_requires']).toEqual({
      satisfied: true,
      missing: [],
    });
  });

  it('case 4: inflight dedup — 3 concurrent fetchCapability calls only fire 1 network request', async () => {
    let resolveJson!: (v: unknown) => void;
    const jsonPromise = new Promise((r) => {
      resolveJson = r;
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => jsonPromise,
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchCapability } = useCapability();

    // Fire 3 concurrent calls before the first resolves
    const p1 = fetchCapability();
    const p2 = fetchCapability();
    const p3 = fetchCapability();

    // Now resolve the underlying network json
    resolveJson(SAMPLE_RESPONSE);

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(SAMPLE_RESPONSE);
    expect(r2).toEqual(SAMPLE_RESPONSE);
    expect(r3).toEqual(SAMPLE_RESPONSE);
  });

  it('case 5: fail-open on error — 500 returns null; hasAll() still permissive (true)', async () => {
    const fetchMock = mockFetchOnce({}, { ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    // Silence the expected console.error noise from the fail-open path.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { fetchCapability, hasAll, available, error } = useCapability();
    const result = await fetchCapability();

    expect(result).toBeNull();
    expect(available.value).toBeNull();
    expect(error.value).not.toBeNull();
    expect(error.value?.message).toMatch(/500/);
    // S7 fail-open: even after error, hasAll is permissive
    expect(hasAll(['date', 'anything'])).toBe(true);

    errSpy.mockRestore();
  });

  it('bonus: no factoryId — fetchCapability returns null without calling fetch (S8)', async () => {
    mockFactoryId = '';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { fetchCapability } = useCapability();
    const result = await fetchCapability();

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
