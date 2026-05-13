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
import { evaluateSpelBoolean, evaluateSpelValue } from '@/utils/spelEvaluator'
import { usePermissionStore } from '@/store/modules/permission'

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
    /** C-6 Task 2: 选 entity 后写回 shadow 字段映射 (entity field → row shadow key, 推荐 _ 前缀). */
    projectFields?: Record<string, string>
  }
  computed?: string
  /** Apr 25 2026: schema-driven initial value for new rows (e.g. items.unit defaultValue:'kg'). */
  defaultValue?: unknown
  /** Round 4 Fix P2-23: per-row visibility expression (SpEL) evaluated against the row */
  visibleWhen?: string
  /** Schema-driven price gating: hide column when canViewPrice=false. Mirrors SchemaTableRenderer / module_schemas seed. */
  priceSensitive?: boolean
}

const props = defineProps<{
  modelValue: Record<string, unknown>[]
  itemSchema: { fields: ItemField[] }
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>[]]
}>()

const permissionStore = usePermissionStore()
const canViewPrice = computed(() => permissionStore.canViewPrice)

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
  const row = updated[rowIndex]
  recomputeRow(row)
  emit('update:modelValue', updated)
}

/**
 * C-6 Task 2: 接收 ReferenceSelector @project event, 把 entity 的 projected 字段
 * 写入对应 row 的 shadow 字段, 然后触发 computed 重算.
 *
 * `projected` 由 ReferenceSelector.emitProjectFields 构造, 其中 shadowKey 已经过
 * SHADOW_KEY_RE 校验 (单一 emit 来源, defense-in-depth 不在此重复校验).
 *
 * Vue 3 reactivity: spread 创建新 row 对象, rows.value[rowIndex] 赋值 → 触发
 * computed 重算 (含 visibleWhen 表达式), 使 boxQuantity / 抄码品 tag 立即更新.
 */
function onReferenceProject(rowIndex: number, projected: Record<string, unknown>) {
  const updated = rows.value.map((r, i) =>
    i === rowIndex ? { ...r, ...projected } : r
  )
  recomputeRow(updated[rowIndex])
  emit('update:modelValue', updated)
}

/**
 * C-6 Task 3: SpEL evaluator 替换 toy parser.
 *
 * 旧版只支持 `split('*')` 两操作数乘法 — `"quantity * unitPrice"` 这种简单情况.
 * 新版用 `evaluateSpelValue` 复用现有 spelEvaluator.ts:78 实现, 支持:
 *   - 除法: `"quantity / _level1PerLevel2"`
 *   - 三元 null-guard: `"qty > 0 && _x != null && _x > 0 ? qty / _x : null"`
 *   - 字符串方法: `"_spec.includes('抄码')"` (visibleWhen 用)
 *
 * R2 reviewer finding 防御: spelEvaluator catch 返 `true` (line 70) — 若数值字段
 * computed 失败被 Number(true)=1 静默写入会破坏数据. 显式跳过 boolean 结果.
 *
 * 向后兼容: 旧 `"a * b"` 在新 evaluator 下 JS 乘法等价输出, lineAmount 等
 * 现有 schema (purchase_order V20260410_08, sales_order V20260409_02) 不受影响.
 */
function recomputeRow(row: Record<string, unknown>) {
  props.itemSchema.fields
    .filter((f) => f.computed)
    .forEach((f) => {
      try {
        const result = evaluateSpelValue(f.computed!, row)
        if (typeof result === 'boolean') return  // R2: catch-fallback 返 true 不污染数值字段
        if (result == null) { row[f.code] = null; return }
        const n = Number(result)
        if (!isNaN(n)) row[f.code] = Math.round(n * 100) / 100
      } catch {
        // ignore — keep existing value on eval error
      }
    })
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
  if (field.priceSensitive && !canViewPrice.value) return false
  if (!field.visibleWhen) return true
  return rows.value.some(row => isCellVisible(field, row))
}

/** Hide the合计 line when canViewPrice=false (computed field is typically price-bearing). */
const showTotalAmount = computed(() => {
  const amountField = props.itemSchema.fields.find((f) => f.computed)
  if (!amountField) return false
  if (amountField.priceSensitive && !canViewPrice.value) return false
  return Number(totalAmount.value) > 0
})

// C-6 unit-test surface (parallel to ReferenceSelector). Internals only used by tests.
defineExpose({ recomputeRow, onReferenceProject, updateField })
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
            <!-- reference. R17 audit SER-1: drop `&& field.referenceConfig` guard so
                 ReferenceSelector handles missing config via its own loud-fail (R12 fix).
                 Previously falling through to el-input was silent text-input for line-item
                 references with broken schema (purchase_order/transfer items.materialTypeId). -->
            <ReferenceSelector
              v-else-if="field.type === 'reference'"
              :model-value="(row[field.code] as string)"
              :config="(field.referenceConfig as never)"
              :disabled="disabled || !!field.computed"
              @update:model-value="(v) => updateField($index, field.code, v)"
              @project="(projected: Record<string, unknown>) => onReferenceProject($index, projected)"
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
      <span v-if="showTotalAmount" style="font-weight: 600; color: #409eff">合计: ¥{{ totalAmount.toFixed(2) }}</span>
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
