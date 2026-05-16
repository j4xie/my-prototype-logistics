/**
 * Sprint 2 Track I — useListSummary composable (web-admin parity with
 * RN frontend/CretasFoodTrace/src/hooks/useListSummary.ts).
 */
import { ref, watch, type Ref } from 'vue'
import { fetchListSummary } from '@/api/listSummary'
import { useFactoryId } from './useFactoryId'
import type {
  ListSummaryRequest,
  ListSummaryResponse,
  SupportedSummaryEntityType,
} from '@/types/listSummary'

export function useListSummary(
  entityType: SupportedSummaryEntityType | string,
  request: Ref<ListSummaryRequest>,
) {
  const summary = ref<ListSummaryResponse | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const factoryId = useFactoryId()

  async function refresh() {
    if (!factoryId.value) {
      error.value = new Error('useListSummary: no factoryId in auth store')
      summary.value = null
      return
    }
    loading.value = true
    error.value = null
    try {
      // fetchListSummary returns the `{success,data,message}` ApiResponse envelope —
      // the shared post<T>() helper is typed `Promise<ApiResponse<T>>` and the
      // interceptor already rejected on success=false / 4xx / 5xx, so any envelope
      // reaching this line is success=true. Unwrap `.data` before exposing
      // ListSummaryResponse to consumers; otherwise <TableFooter> reads
      // `summary.stats` on the envelope (undefined) and renders its '暂无数据'
      // empty state — smoke v2 bug #14 (sales 5 orders ¥6.1M but footer "暂无数据").
      // RN sibling hook frontend/CretasFoodTrace/src/hooks/useListSummary.ts:41
      // already does this unwrap; this restores cross-platform parity.
      const envelope = await fetchListSummary(factoryId.value, entityType, request.value)
      summary.value = envelope.data
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      summary.value = null
    } finally {
      loading.value = false
    }
  }

  // Refetch on request change + initial load.
  watch(request, refresh, { deep: true, immediate: true })

  return { summary, loading, error, refresh }
}
