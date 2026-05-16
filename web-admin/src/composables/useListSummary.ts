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
      summary.value = await fetchListSummary(factoryId.value, entityType, request.value)
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
