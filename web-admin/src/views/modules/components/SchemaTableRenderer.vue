<script setup lang="ts">
/**
 * SchemaTableRenderer — Schema 驱动动态列表
 * 根据 EffectiveModuleConfig.fields (listVisible) 自动渲染表格列
 */
import { computed } from 'vue'
import dayjs from 'dayjs'
import type { EffectiveField, WorkflowTransition } from '@/types/config'

const props = defineProps<{
  fields: EffectiveField[]
  workflowTransitions: WorkflowTransition[]
  data: Record<string, unknown>[]
  loading: boolean
  pagination: { page: number; size: number; total: number }
}>()

const emit = defineEmits<{
  'page-change': [page: number]
  'size-change': [size: number]
  'row-click': [row: Record<string, unknown>]
  action: [row: Record<string, unknown>, transition: WorkflowTransition]
}>()

// 列表可见字段，按 listOrder 排序
const listFields = computed(() =>
  props.fields
    .filter((f) => f.extra?.listVisible)
    .sort((a, b) => ((a.extra?.listOrder as number) ?? 99) - ((b.extra?.listOrder as number) ?? 99)),
)

// 当前行可用的工作流操作
function getAvailableTransitions(row: Record<string, unknown>): WorkflowTransition[] {
  const status = String(row.status || '')
  return props.workflowTransitions.filter((t) => t.from === status && t.enabled)
}

// 格式化
function formatCell(value: unknown, field: EffectiveField): string {
  if (value === null || value === undefined) return '-'
  const formatter = field.extra?.formatter as string | undefined

  switch (formatter) {
    case 'currency':
      return `¥${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
    case 'date':
      return dayjs(String(value)).format('YYYY-MM-DD')
    case 'datetime':
      return dayjs(String(value)).format('YYYY-MM-DD HH:mm')
    case 'boolean':
      return value ? '是' : '否'
    default:
      return String(value)
  }
}

// 状态标签颜色
function getTagType(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'info',
    CONFIRMED: '',
    PENDING_FINANCE_REVIEW: 'warning',
    FINANCE_APPROVED: 'success',
    FINANCE_REJECTED: 'danger',
    PROCESSING: '',
    SHIPPED: 'success',
    COMPLETED: 'success',
    CANCELLED: 'danger',
    ACTIVE: 'success',
    DEPRECATED: 'danger',
  }
  return map[status] || 'info'
}

function isStatusField(field: EffectiveField): boolean {
  return field.code === 'status' || field.extra?.formatter === 'status'
}
</script>

<template>
  <div class="schema-table-renderer">
    <el-table
      :data="data"
      :loading="loading"
      border
      stripe
      highlight-current-row
      @row-click="(row: Record<string, unknown>) => emit('row-click', row)"
      style="width: 100%"
    >
      <el-table-column type="index" label="#" width="50" />

      <el-table-column
        v-for="field in listFields"
        :key="field.code"
        :prop="field.code"
        :label="field.label"
        :width="(field.extra?.listWidth as number) ?? undefined"
        :min-width="100"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <!-- 状态字段用 Tag -->
          <el-tag
            v-if="isStatusField(field)"
            :type="getTagType(String(row[field.code] || ''))"
            size="small"
          >
            {{ row[field.code] || '-' }}
          </el-tag>
          <!-- 其他字段用 formatter -->
          <span v-else>{{ formatCell(row[field.code], field) }}</span>
        </template>
      </el-table-column>

      <!-- 操作列 (工作流按钮) -->
      <el-table-column label="操作" fixed="right" min-width="180" v-if="workflowTransitions.length">
        <template #default="{ row }">
          <el-button
            v-for="t in getAvailableTransitions(row)"
            :key="t.action"
            :type="(t.buttonType as any) || 'primary'"
            size="small"
            link
            @click.stop="emit('action', row, t)"
          >
            {{ t.label }}
          </el-button>
          <el-button type="primary" size="small" link @click.stop="emit('row-click', row)">
            详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div style="display: flex; justify-content: flex-end; margin-top: 16px" v-if="pagination.total > 0">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="(p: number) => emit('page-change', p)"
        @size-change="(s: number) => emit('size-change', s)"
      />
    </div>
  </div>
</template>
