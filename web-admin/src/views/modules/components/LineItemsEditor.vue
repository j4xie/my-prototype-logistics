<script setup lang="ts">
/**
 * LineItemsEditor — 订单行项目编辑器
 * 用于 line_items 类型字段 (如 销售订单明细)
 */
import { computed, watch } from 'vue'
import ReferenceSelector from './ReferenceSelector.vue'

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
    if (f.type === 'decimal' || f.type === 'integer') newRow[f.code] = 0
    else newRow[f.code] = ''
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
</script>

<template>
  <div class="line-items-editor">
    <el-table :data="rows" border size="small" style="width: 100%">
      <el-table-column type="index" label="#" width="40" />
      <template v-for="field in itemSchema.fields" :key="field.code">
        <el-table-column :label="field.label" :min-width="field.type === 'reference' ? 160 : 100">
          <template #default="{ row, $index }">
            <!-- reference -->
            <ReferenceSelector
              v-if="field.type === 'reference' && field.referenceConfig"
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
