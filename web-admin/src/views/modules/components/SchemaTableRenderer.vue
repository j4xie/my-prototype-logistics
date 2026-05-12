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
// R40 BUG-5 fix: filter out manualTrigger=false (auto-triggered by upstream events,
// no backend endpoint — rendering button would 404). manualTrigger undefined defaults
// to true (backward compat).
function getAvailableTransitions(row: Record<string, unknown>): WorkflowTransition[] {
  const status = String(row.status || '')
  return props.workflowTransitions.filter(
    (t) => t.from === status && t.enabled && t.manualTrigger !== false,
  )
}

/**
 * Bug I (UX): for reference fields (e.g., customerId), prefer the joined display name
 * (e.g., customerName) from the row if backend provides it via @Formula or DTO mapping.
 * Convention: <code> ending in "Id" → look for <prefix>Name (drop "Id", append "Name").
 * Fallback to raw value if no display sibling exists.
 */
function resolveDisplayValue(row: Record<string, unknown>, field: EffectiveField): unknown {
  const rawValue = row[field.code]
  if (field.type === 'reference' && field.code.endsWith('Id')) {
    const prefix = field.code.slice(0, -2)  // customerId → customer
    const nameKey = prefix + 'Name'         // → customerName
    const displayName = row[nameKey]
    if (displayName != null && String(displayName).length > 0) {
      return displayName
    }
  }
  return rawValue
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
    INACTIVE: 'info',
    DEPRECATED: 'danger',
  }
  return map[status] || 'info'
}

/**
 * Bug J (UX): map ERP status codes to friendly Chinese display.
 * Falls back to raw code if not mapped (covers schema-defined options + custom enums).
 */
function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: '草稿',
    CONFIRMED: '已确认',
    PENDING_FINANCE_REVIEW: '待财务审核',
    FINANCE_APPROVED: '财务通过',
    FINANCE_REJECTED: '财务驳回',
    PROCESSING: '处理中',
    SHIPPED: '已发货',
    PARTIAL_SHIPPED: '部分发货',
    DELIVERED: '已送达',
    COMPLETED: '已完成',
    CANCELLED: '已取消',
    ACTIVE: '合作中',
    INACTIVE: '已停用',
    DEPRECATED: '已弃用',
    NOT_INVOICED: '未开票',
    PARTIAL_INVOICED: '部分开票',
    FULLY_INVOICED: '已开票',
    UNPAID: '未收款',
    PARTIAL: '部分收款',
    PAID: '已收款',
  }
  return map[status] || status || '-'
}

function isStatusField(field: EffectiveField): boolean {
  return field.code === 'status' || field.extra?.formatter === 'status'
}

/**
 * P1-D (PR #442 follow-up): RBAC defense-in-depth check used by the table cell template.
 * Mirrors the static-Vue ``v-if="row.totalAmount != null"`` pattern from
 * ``procurement/orders/list.vue`` line 489-491 etc., so warehouse / quality_inspector /
 * operator roles see "—" (em-dash) for stripped price columns instead of formatter
 * fallback "-" (hyphen-minus). Backend strip lands as null via
 * ``PriceFieldResponseAdvice`` (PR #423) + ``PriceSensitiveSerializerModifier`` (PR #443).
 *
 * The flag is sourced from ``field.extra.priceSensitive`` (set per-column in the
 * module_schemas seed migration, see V20260513_01).
 */
function isPriceSensitiveNull(row: Record<string, unknown>, field: EffectiveField): boolean {
  if (field.extra?.priceSensitive !== true) return false
  const value = resolveDisplayValue(row, field)
  return value === null || value === undefined
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
          <!-- 状态字段用 Tag (Bug J: friendly Chinese label) -->
          <el-tag
            v-if="isStatusField(field)"
            :type="getTagType(String(row[field.code] || ''))"
            size="small"
          >
            {{ getStatusLabel(String(row[field.code] || '')) }}
          </el-tag>
          <!--
            P1-D (PR #442 follow-up): mirror the static-Vue v-if defense from
            procurement/orders/list.vue + procurement/receives/list.vue + sales/orders/list.vue.
            Backend PriceFieldResponseAdvice (PR #423) + PriceSensitiveSerializerModifier (PR #443)
            already strip @PriceSensitive fields to null for roles lacking procurement:price:view —
            this branch renders the stripped null as em-dash "—" with .price-masked class so the
            UX matches the legacy hardcoded-template defense path. Without this branch the cell
            would fall through to formatCell() which returns "-" (hyphen-minus) without semantic class.
          -->
          <span
            v-else-if="isPriceSensitiveNull(row, field)"
            class="price-masked"
          >—</span>
          <!-- 其他字段用 formatter; reference 字段优先显示 joined name (Bug I) -->
          <span v-else>{{ formatCell(resolveDisplayValue(row, field), field) }}</span>
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
