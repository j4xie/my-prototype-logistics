/**
 * useWidgetData composable tests (P1 #65 C-WIDGET-1).
 *
 * Covers:
 *  - success path → data set, lastUpdated set, empty computed
 *  - resp.success=false → error message captured, empty=false
 *  - thrown fetch error → error message captured
 *  - isEmpty default for arrays + page-shape
 *  - isEmpty override
 *
 * Composable is wrapped in a `defineComponent` because `onUnmounted` requires
 * an active component instance.
 */
import { describe, it, expect, vi } from 'vitest';
import { defineComponent, nextTick, h, type SetupContext } from 'vue';
import { mount } from '@vue/test-utils';
import { useWidgetData } from '../useWidgetData';
import type { ApiResponse } from '@/types/api';

interface Foo {
  id: number;
}

function mountComposable<T extends object>(setupFn: () => T): T {
  let captured: T | null = null;
  const Comp = defineComponent({
    setup(_props: object, _ctx: SetupContext) {
      captured = setupFn();
      return () => h('div');
    },
  });
  mount(Comp);
  if (!captured) throw new Error('setup did not run');
  return captured;
}

describe('useWidgetData', () => {
  it('success path sets data, lastUpdated, clears error', async () => {
    const resp: ApiResponse<Foo[]> = { success: true, data: [{ id: 1 }, { id: 2 }] };
    const fetcher = vi.fn(() => Promise.resolve(resp));
    const w = mountComposable(() => useWidgetData<Foo[]>({ fetcher }));

    await w.refresh();
    await nextTick();

    expect(w.data.value).toEqual([{ id: 1 }, { id: 2 }]);
    expect(w.error.value).toBeNull();
    expect(w.empty.value).toBe(false);
    expect(w.lastUpdated.value).toBeInstanceOf(Date);
    expect(w.loading.value).toBe(false);
  });

  it('empty array data → empty=true via default isEmpty', async () => {
    const resp: ApiResponse<Foo[]> = { success: true, data: [] };
    const fetcher = vi.fn(() => Promise.resolve(resp));
    const w = mountComposable(() => useWidgetData<Foo[]>({ fetcher }));

    await w.refresh();
    expect(w.empty.value).toBe(true);
  });

  it('page-shape response → empty=true when content is empty', async () => {
    const resp: ApiResponse<{ content: Foo[]; totalElements: number }> = {
      success: true,
      data: { content: [], totalElements: 0 },
    };
    const fetcher = vi.fn(() => Promise.resolve(resp));
    const w = mountComposable(() =>
      useWidgetData<{ content: Foo[]; totalElements: number }>({ fetcher })
    );

    await w.refresh();
    expect(w.empty.value).toBe(true);
  });

  it('resp.success=false captures message into error', async () => {
    const resp: ApiResponse<Foo[]> = { success: false, data: null as unknown as Foo[], message: '权限不足' };
    const fetcher = vi.fn(() => Promise.resolve(resp));
    const w = mountComposable(() => useWidgetData<Foo[]>({ fetcher }));

    await w.refresh();
    expect(w.error.value).toBe('权限不足');
    expect(w.empty.value).toBe(false);
  });

  it('thrown error captured into error state, not propagated', async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error('Network timeout')));
    const w = mountComposable(() => useWidgetData<Foo[]>({ fetcher }));

    await w.refresh();
    expect(w.error.value).toBe('Network timeout');
    expect(w.loading.value).toBe(false);
  });

  it('isEmpty override is respected', async () => {
    const resp: ApiResponse<Foo[]> = { success: true, data: [{ id: 1 }] };
    const fetcher = vi.fn(() => Promise.resolve(resp));
    const w = mountComposable(() =>
      useWidgetData<Foo[]>({
        fetcher,
        isEmpty: () => true, // always-empty override
      })
    );

    await w.refresh();
    expect(w.empty.value).toBe(true);
  });

  it('loading is true mid-fetch, false after', async () => {
    let resolveFn: ((v: ApiResponse<Foo[]>) => void) | null = null;
    const fetcher = vi.fn(
      () =>
        new Promise<ApiResponse<Foo[]>>((resolve) => {
          resolveFn = resolve;
        })
    );
    const w = mountComposable(() => useWidgetData<Foo[]>({ fetcher }));

    const p = w.refresh();
    await nextTick();
    expect(w.loading.value).toBe(true);

    resolveFn!({ success: true, data: [] });
    await p;
    expect(w.loading.value).toBe(false);
  });
});
