/**
 * useWidgetData — P1 #65 C-WIDGET-1 — endpoint binding composable.
 *
 * Encapsulates the canonical load-data / loading / error / lastUpdated /
 * refresh state that every endpoint-bound widget needs. Pairs with the
 * `Widget.vue` base wrapper:
 *
 *   const { data, loading, error, lastUpdated, refresh, empty } = useWidgetData({
 *     fetcher: async () => get<Foo>('/api/path'),
 *     isEmpty: (d) => !d || (Array.isArray(d) && d.length === 0),
 *     autoRefreshMs: 60_000,
 *   });
 *
 *   onMounted(refresh);
 *
 * Auto-refresh is opt-in (autoRefreshMs > 0). Cleared on unmount.
 *
 * No `as any` — uses generics, no type assertions on caller's response.
 */
import { ref, onUnmounted, type Ref } from 'vue';
import type { ApiResponse } from '@/types/api';

export interface UseWidgetDataOptions<T> {
  /** Async fn returning an ApiResponse<T>. */
  fetcher: () => Promise<ApiResponse<T>>;
  /** Optional predicate for empty state — defaults to falsy + empty array. */
  isEmpty?: (data: T | null) => boolean;
  /** Optional auto-refresh interval. 0 / undefined = disabled. */
  autoRefreshMs?: number;
  /** Optional fallback message override on error. */
  errorMessage?: string;
}

export interface UseWidgetDataReturn<T> {
  data: Ref<T | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  lastUpdated: Ref<Date | null>;
  empty: Ref<boolean>;
  refresh: () => Promise<void>;
}

function defaultIsEmpty<T>(data: T | null): boolean {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object') {
    // Page-shape `{ content: [], totalElements: 0 }` ⇒ empty when content is empty.
    const maybePage = data as { content?: unknown };
    if (Array.isArray(maybePage.content)) return maybePage.content.length === 0;
  }
  return false;
}

export function useWidgetData<T>(opts: UseWidgetDataOptions<T>): UseWidgetDataReturn<T> {
  const data: Ref<T | null> = ref(null) as Ref<T | null>;
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);
  const empty = ref(false);

  const isEmpty = opts.isEmpty ?? defaultIsEmpty;

  async function refresh(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const resp = await opts.fetcher();
      if (resp && resp.success) {
        data.value = resp.data ?? null;
        lastUpdated.value = new Date();
        empty.value = isEmpty(data.value);
      } else {
        error.value = resp?.message ?? opts.errorMessage ?? '加载失败';
        empty.value = false;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      error.value = msg || opts.errorMessage || '网络错误';
      empty.value = false;
    } finally {
      loading.value = false;
    }
  }

  // Auto-refresh
  let timer: ReturnType<typeof setInterval> | null = null;
  if (opts.autoRefreshMs && opts.autoRefreshMs > 0) {
    timer = setInterval(() => {
      // skip when previous still loading
      if (!loading.value) {
        void refresh();
      }
    }, opts.autoRefreshMs);
  }

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  });

  return { data, loading, error, lastUpdated, empty, refresh };
}
