<script setup lang="ts">
/**
 * DynamicArrayEditor — JSON 数组行内编辑器
 * 用于 json_array 类型字段 (如 extraFees)
 */
import { computed } from 'vue'

interface ItemField {
  code: string
  type: string
  label: string
  required: boolean
  min?: number
  /** Apr 25 2026 audit: schema-driven default for new array entries. */
  defaultValue?: unknown
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
    // Apr 25 2026 audit (Rule 8 same-cause sweep): respect schema defaultValue
    // — same fix as LineItemsEditor.addRow (b13edd00b).
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
  const updated = [...rows.value]
  updated[rowIndex] = { ...updated[rowIndex], [fieldCode]: value }
  emit('update:modelValue', updated)
}
</script>

<template>
  <div class="dynamic-array-editor">
    <el-table :data="rows" border size="small" style="width: 100%">
      <el-table-column
        v-for="field in itemSchema.fields"
        :key="field.code"
        :label="field.label"
        :min-width="field.type === 'string' ? 140 : 100"
      >
        <template #default="{ row, $index }">
          <el-input-number
            v-if="field.type === 'decimal' || field.type === 'integer'"
            :model-value="(row[field.code] as number) ?? 0"
            :min="field.min ?? undefined"
            :precision="field.type === 'decimal' ? 2 : 0"
            :disabled="disabled"
            size="small"
            controls-position="right"
            style="width: 100%"
            @update:model-value="(v: number | undefined) => updateField($index, field.code, v)"
          />
          <el-input
            v-else
            :model-value="String(row[field.code] ?? '')"
            :disabled="disabled"
            size="small"
            @update:model-value="(v: string) => updateField($index, field.code, v)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="60" v-if="!disabled">
        <template #default="{ $index }">
          <el-button type="danger" link size="small" @click="removeRow($index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-button
      v-if="!disabled"
      type="primary"
      link
      size="small"
      style="margin-top: 8px"
      @click="addRow"
    >
      + 添加行
    </el-button>
  </div>
</template>
