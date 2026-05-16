<script setup lang="ts">
/**
 * Sprint 2 Track I — U-FOOTER-1 TableFooter.
 * Web-admin counterpart to RN frontend/CretasFoodTrace/src/components/list/StickyFooterSummary.tsx.
 * El-pagination + summary stats + 📊 AI / 📤 export same row.
 */
import { computed } from 'vue'
import { ElPagination, ElButton, ElIcon } from 'element-plus'
import { DataAnalysis, Download } from '@element-plus/icons-vue'
import { usePermissionStore } from '@/store/modules/permission'
import type { SummaryStat, ListSummaryPagination } from '@/types/listSummary'

interface Props {
  stats: SummaryStat[]
  pagination?: ListSummaryPagination
  loading?: boolean
  emptyText?: string
  showAi?: boolean
  showExport?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  emptyText: '暂无数据',
  showAi: true,
  showExport: true,
})

const emit = defineEmits<{
  'page-change': [page: number]
  'page-size-change': [size: number]
  'ai-analyze': []
  export: []
}>()

const permissionStore = usePermissionStore()
const canViewPrice = computed(() => permissionStore.canViewPrice)

const visibleStats = computed(() =>
  props.stats.filter((s) => !s.canViewPrice || canViewPrice.value),
)

function formatValue(stat: SummaryStat): string {
  const { value, format, unit } = stat
  if (value == null || value === '') return '—'
  const isNum = typeof value === 'number' || (typeof value === 'string' && !Number.isNaN(Number(value)))
  if (!isNum && format !== 'currency' && format !== 'percent' && format !== 'number') {
    return String(value) + (unit ?? '')
  }
  const num = typeof value === 'number' ? value : Number(value)
  switch (format) {
    case 'currency':
      return `${unit ?? '¥'}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    case 'percent':
      return `${num.toFixed(1)}${unit ?? '%'}`
    case 'number':
      return `${num.toLocaleString()}${unit ?? ''}`
    default:
      return `${num}${unit ?? ''}`
  }
}
</script>

<template>
  <div class="table-footer">
    <div class="stats">
      <template v-if="loading">
        <span class="loading">加载中…</span>
      </template>
      <template v-else-if="visibleStats.length === 0">
        <span class="empty">{{ emptyText }}</span>
      </template>
      <template v-else>
        <span v-for="(stat, i) in visibleStats" :key="`${stat.label}-${i}`" class="stat-item">
          <span class="stat-label">{{ stat.label }}</span>
          <span class="stat-value">
            {{ formatValue(stat) }}
            <span v-if="stat.trend" :class="['trend', stat.trend]">
              {{ stat.trend === 'up' ? '↑' : stat.trend === 'down' ? '↓' : '·' }}{{ stat.trendDelta != null ? Math.abs(stat.trendDelta).toFixed(1) : '' }}
            </span>
          </span>
        </span>
      </template>
    </div>

    <ElPagination
      v-if="pagination"
      :current-page="pagination.currentPage"
      :total="pagination.totalItems"
      :page-size="pagination.pageSize"
      layout="prev, pager, next, jumper"
      class="pagination"
      @current-change="(p: number) => emit('page-change', p)"
      @size-change="(s: number) => emit('page-size-change', s)"
    />

    <div class="actions">
      <ElButton v-if="showAi" link size="small" @click="emit('ai-analyze')" title="AI 分析">
        <ElIcon><DataAnalysis /></ElIcon>
        <span class="action-text">AI 分析</span>
      </ElButton>
      <ElButton v-if="showExport" link size="small" @click="emit('export')" title="导出">
        <ElIcon><Download /></ElIcon>
        <span class="action-text">导出</span>
      </ElButton>
    </div>
  </div>
</template>

<style scoped>
.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  background-color: #f8f9fa;
  border-top: 1px solid #e0e0e0;
  min-height: 50px;
  flex-wrap: wrap;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  flex: 1 1 auto;
  min-width: 0;
}

.stat-item {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
}

.stat-label {
  font-size: 12px;
  color: #666;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #222;
}

.trend {
  font-size: 12px;
  margin-left: 4px;
}

.trend.up {
  color: #2e7d32;
}

.trend.down {
  color: #c62828;
}

.trend.flat {
  color: #999;
}

.loading,
.empty {
  font-size: 13px;
  color: #999;
  font-style: italic;
}

.pagination {
  flex-shrink: 0;
}

.actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.action-text {
  margin-left: 4px;
}
</style>
