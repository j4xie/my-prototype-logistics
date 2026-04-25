<script setup lang="ts">
/**
 * LineItemsEditor — 订单行项目编辑器
 * 用于 line_items 类型字段 (如 销售订单明细)
 *
 * Round 4 Fix P2-23: added per-row visibleWhen support.
 * Each itemField can declare visibleWhen: "row_field_name == 'value'" to conditionally
 * render the cell per-row. Unblocks 草原鲜牧 use case:
 *   A级客户需要 "切块尺寸" 字段, C级客户不需要 — 通过 visibleWhen: "customer_level == 'A'"
 *   驱动每一行独立显示/隐藏字段, 而不是整列强制显示.
 */
import { computed, watch } from 'vue'
import ReferenceSelector from './ReferenceSelector.vue'
import { evaluateSpelBoolean } from '@/utils/spelEvaluator'

interface ItemField {
  code: string
  type: string
  label: string
  required: boolean
  min?: number
  precision?: number
  options?: Array<{ value: string | number; label: string }>
  referenceConfig?: {
    entity: string
    displayField: string
    valueField: string
    apiEndpoint: string
  }
  computed?: string
  /** Apr 25 2026: schema-driven initial value for new rows (e.g. items.unit defaultValue:'kg'). */
  defaultValue?: unknown
  /** Round 4 Fix P2-23: per-row visibility expression (SpEL) evaluated against the row */
  visibleWhen?: string
}

const props = defineProps<{
  modelValue: Record<string, unknown>[]
  itemSchema: { fields: ItemField[] }
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>[]]
}>()

const rows = computed({
  get: () => props.modelValue || [],
  set: (val) => emit('update:modelValue', val),
})

function addRow() {
  const newRow: Record<string, unknown> = {}
  props.itemSchema.fields.forEach((f) => {
    // Apr 25 2026: respect schema-defined defaultValue (e.g. items.unit:'kg').
    // Found by depth-first-e2e: addRow ignored defaultValue → user had to manually
    // pick required fields like 单位 → silent submit failure with vague 400 toast.
    if (f.defaultValue !== undefined && f.defaultValue !== null) {
      newRow[f.code] = f.defaultValue
    } else if (f.type === 'decimal' || f.type === 'integer') {
      newRow[f.code] = 0
    } else {
      newRow[f.code] = ''
    }
  })
  emit('update:modelValue', [...rows.value, newRow])
}

function removeRow(index: number) {
  const updated = [...rows.value]
  updated.splice(index, 1)
  emit('update:modelValue', updated)
}

function updateField(rowIndex: number, fieldCode: string, value: unknown) {
  const updated = rows.value.map((r, i) => (i === rowIndex ? { ...r, [fieldCode]: value } : r))
  // 自动计算 computed 字段 (如 lineAmount = quantity * unitPrice)
  const row = updated[rowIndex]
  props.itemSchema.fields
    .filter((f) => f.computed)
    .forEach((f) => {
      try {
        // 简单乘法: "quantity * unitPrice"
        const parts = f.computed!.split('*').map((p) => p.trim())
        if (parts.length === 2) {
          const a = Number(row[parts[0]]) || 0
          const b = Number(row[parts[1]]) || 0
          row[f.code] = Math.round(a * b * 100) / 100
        }
      } catch {
        // ignore
      }
    })
  emit('update:modelValue', updated)
}

const totalAmount = computed(() => {
  const amountField = props.itemSchema.fields.find((f) => f.computed)
  if (!amountField) return 0
  return rows.value.reduce((sum, row) => sum + (Number(row[amountField.code]) || 0), 0)
})

/**
 * Round 4 Fix P2-23: Per-row visibility check.
 * If field has no visibleWhen, always visible. Otherwise evaluate SpEL against the row.
 * Uses same evaluator as SchemaFormRenderer for consistency.
 */
function isCellVisible(field: ItemField, row: Record<string, unknown>): boolean {
  if (!field.visibleWhen) return true
  try {
    return evaluateSpelBoolean(field.visibleWhen, row)
  } catch {
    return true
  }
}

/** Check if entire column should render (at least one row has it visible). */
function isColumnVisible(field: ItemField): boolean {
  if (!field.visibleWhen) return true
  return rows.value.some(row => isCellVisible(field, row))
}
</script>

<template>
  <div class="line-items-editor">
    <el-table :data="rows" border size="small" style="width: 100%">
      <el-table-column type="index" label="#" width="40" />
      <template v-for="field in itemSchema.fields" :key="field.code">
        <!-- Round 4 Fix P2-23: Hide entire column if no row shows it; per-cell dim/hide via isCellVisible -->
        <el-table-column v-if="isColumnVisible(field)" :label="field.label" :min-width="field.type === 'reference' ? 160 : 100">
          <template #default="{ row, $index }">
            <!-- Per-row visibility: render placeholder if cell hidden for this row -->
            <span v-if="!isCellVisible(field, row)" class="cell-hidden">—</span>
            <!-- reference -->
            <ReferenceSelector
              v-else-if="field.type === 'reference' && field.referenceConfig"
              :model-value="(row[field.code] as string)"
              :config="field.referenceConfig"
              :disabled="disabled || !!field.computed"
              @update:model-value="(v) => updateField($index, field.code, v)"
            />
            <!-- select -->
            <el-select
              v-else-if="field.type === 'select'"
              :model-value="row[field.code]"
              :disabled="disabled"
              size="small"
              style="width: 100%"
              @change="(v: string | number) => updateField($index, field.code, v)"
            >
              <el-option
                v-for="opt in field.options"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <!-- decimal / integer (computed = readonly) -->
            <el-input-number
              v-else-if="field.type === 'decimal' || field.type === 'integer'"
              :model-value="(row[field.code] as number) ?? 0"
              :min="field.min ?? undefined"
              :precision="field.precision ?? (field.type === 'decimal' ? 2 : 0)"
              :disabled="disabled || !!field.computed"
              size="small"
              controls-position="right"
              style="width: 100%"
              @update:model-value="(v: number | undefined) => updateField($index, field.code, v)"
            />
            <!-- string / text -->
            <el-input
              v-else
              :model-value="String(row[field.code] ?? '')"
              :disabled="disabled || !!field.computed"
              size="small"
              @update:model-value="(v: string) => updateField($index, field.code, v)"
            />
          </template>
        </el-table-column>
      </template>
      <el-table-column label="操作" width="60" v-if="!disabled">
        <template #default="{ $index }">
          <el-button type="danger" link size="small" @click="removeRow($index)">删</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div style="display: flex; justify-content: space-between; margin-top: 8px; align-items: center">
      <el-button v-if="!disabled" type="primary" link size="small" @click="addRow">+ 添加行</el-button>
      <span v-if="totalAmount" style="font-weight: 600; color: #409eff">合计: ¥{{ totalAmount.toFixed(2) }}</span>
    </div>
  </div>
</template>

<style scoped>
/* Round 4 Fix P2-23: placeholder for per-row hidden cells */
.cell-hidden {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
</style>
