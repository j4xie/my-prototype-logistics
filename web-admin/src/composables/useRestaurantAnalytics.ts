/**
 * Shared composable for restaurant analytics pages.
 * Handles: upload list loading, deduplication, data source selection, error feedback.
 */
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { listRestaurantUploads, computeRestaurantAnalytics } from '@/api/restaurant-analytics'
import type { RestaurantAnalyticsResult, RestaurantUploadItem } from '@/types/restaurant-analytics'

export function useRestaurantAnalytics<T>(
  extractFn: (result: RestaurantAnalyticsResult) => T | null,
  options?: { autoSelect?: boolean },
) {
  const uploads = ref<RestaurantUploadItem[]>([])
  const selectedUploadId = ref<number | null>(null)
  const data = ref<T | null>(null) as ReturnType<typeof ref<T | null>>
  const loading = ref(false)
  const fullResult = ref<RestaurantAnalyticsResult | null>(null)
  const dataQualityWarnings = ref<string[]>([])

  async function loadUploads() {
    try {
      const res = await listRestaurantUploads()
      if (res.success) {
        // Deduplicate by uploadId (same file+sheet can appear multiple times)
        const seen = new Set<number>()
        uploads.value = res.data.filter((u: RestaurantUploadItem) => {
          if (seen.has(u.id)) return false
          seen.add(u.id)
          return true
        })
      }
    } catch (e) {
      console.error('Failed to load restaurant uploads:', e)
      ElMessage.error('加载数据源列表失败，请稍后重试')
    }
  }

  async function loadAnalytics(uploadId: number, force = false) {
    loading.value = true
    data.value = null
    fullResult.value = null
    dataQualityWarnings.value = []
    try {
      const res = await computeRestaurantAnalytics(uploadId, force)
      if (res.success && res.data) {
        fullResult.value = res.data
        data.value = extractFn(res.data)
        // Extract data quality warnings if present
        if (res.data.dataQualityWarnings) {
          dataQualityWarnings.value = res.data.dataQualityWarnings
        }
      }
    } catch (e) {
      console.error('Failed to load analytics:', e)
      ElMessage.error('分析数据加载失败，请检查数据源或稍后重试')
    } finally {
      loading.value = false
    }
  }

  function handleSelectUpload(id: number) {
    if (id) loadAnalytics(id)
  }

  function handleRefresh() {
    if (selectedUploadId.value) loadAnalytics(selectedUploadId.value, true)
  }

  onMounted(async () => {
    await loadUploads()
    if ((options?.autoSelect !== false) && uploads.value.length > 0 && !selectedUploadId.value) {
      selectedUploadId.value = uploads.value[0].id
      await loadAnalytics(uploads.value[0].id)
    }
  })

  return {
    uploads,
    selectedUploadId,
    data,
    fullResult,
    loading,
    dataQualityWarnings,
    loadUploads,
    loadAnalytics,
    handleSelectUpload,
    handleRefresh,
  }
}
