<script setup lang="ts">
/**
 * SubTableEditor — 子表格编辑器
 * 渲染动态子表格作为可编辑的 el-table
 */
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getSubTableRows, addSubTableRow, updateSubTableRow, deleteSubTableRow } from '@/api/canvasApi'

interface SubTableColumn {
  code: string
  label: string
  type: string
}

interface SubTableRow extends Record<string, unknown> {
  id?: string
  _dirty?: boolean
}

const props = defineProps<{
  factoryId: string
  moduleCode: string
  recordId: string
  fieldCode: string
  label?: string
  columns: SubTableColumn[]
  readonly?: boolean
}>()

const rows = ref<SubTableRow[]>([])
const loading = ref(false)

onMounted(async () => {
  if (!props.recordId) return
  loading.value = true
  try {
    const result = await getSubTableRows(props.factoryId, props.moduleCode, props.recordId, props.fieldCode)
    rows.value = (result as SubTableRow[]) || []
  } catch (e) {
    console.warn('Failed to load sub-table rows:', e)
  } finally {
    loading.value = false
  }
})

function addRow() {
  const newRow: SubTableRow = { _dirty: true }
  props.columns.forEach((col) => {
    if (col.type === 'decimal' || col.type === 'integer') newRow[col.code] = 0
    else newRow[col.code] = ''
  })
  rows.value = [...rows.value, newRow]
}

function updateCell(rowIndex: number, fieldCode: string, value: unknown) {
  const updated = rows.value.map((r, i) =>
    i === rowIndex ? { ...r, [fieldCode]: value, _dirty: true } : r,
  )
  rows.value = updated
}

async function deleteRow(rowIndex: number) {
  const row = rows.value[rowIndex]
  if (row.id) {
    try {
      await deleteSubTableRow(props.factoryId, props.moduleCode, props.recordId, props.fieldCode, row.id as string)
    } catch (e) {
      // Interceptor shows specific toast; dedupe fallback
      console.error('[删除失败]', e)
      return
    }
  }
  const updated = [...rows.value]
  updated.splice(rowIndex, 1)
  rows.value = updated
}

async function saveAll() {
  const dirtyRows = rows.value.filter((r) => r._dirty)
  if (dirtyRows.length === 0) return

  for (const row of dirtyRows) {
    const { _dirty, ...payload } = row
    try {
      if (row.id) {
        await updateSubTableRow(
          props.factoryId,
          props.moduleCode,
          props.recordId,
          props.fieldCode,
          row.id as string,
          payload,
        )
      } else {
        const saved = await addSubTableRow(
          props.factoryId,
          props.moduleCode,
          props.recordId,
          props.fieldCode,
          payload,
        )
        // Update the row with the returned id
        const idx = rows.value.indexOf(row)
        if (idx !== -1 && saved) {
          rows.value[idx] = { ...(saved as SubTableRow), _dirty: false }
        }
      }
    } catch (e) {
      // Interceptor shows specific toast; dedupe fallback — rethrow so caller knows
      console.error('[保存失败]', e)
      throw e
    }
  }

  // Clear dirty flags
  rows.value = rows.value.map((r) => ({ ...r, _dirty: false }))
  ElMessage.success('保存成功')
}

defineExpose({ saveAll })
</script>

<template>
  <div class="sub-table-editor">
    <div v-if="label" class="sub-table-label">{{ label }}</div>
    <el-table v-loading="loading" :data="rows" border size="small" style="width: 100%">
      <el-table-column type="index" label="#" width="44" />
      <el-table-column
        v-for="col in columns"
        :key="col.code"
        :label="col.label"
        :min-width="col.type === 'date' ? 140 : 110"
      >
        <template #default="{ row, $index }">
          <!-- integer -->
          <el-input-number
            v-if="col.type === 'integer'"
            :model-value="(row[col.code] as number) ?? 0"
            :precision="0"
            :disabled="readonly"
            size="small"
            controls-position="right"
            style="width: 100%"
            @update:model-value="(v: number | undefined) => updateCell($index, col.code, v)"
          />
          <!-- decimal -->
          <el-input-number
            v-else-if="col.type === 'decimal'"
            :model-value="(row[col.code] as number) ?? 0"
            :precision="2"
            :disabled="readonly"
            size="small"
            controls-position="right"
            style="width: 100%"
            @update:model-value="(v: number | undefined) => updateCell($index, col.code, v)"
          />
          <!-- date -->
          <el-date-picker
            v-else-if="col.type === 'date'"
            :model-value="(row[col.code] as string)"
            type="date"
            value-format="YYYY-MM-DD"
            :disabled="readonly"
            size="small"
            style="width: 100%"
            @update:model-value="(v: string) => updateCell($index, col.code, v)"
          />
          <!-- string / text fallback -->
          <el-input
            v-else
            :model-value="String(row[col.code] ?? '')"
            :disabled="readonly"
            size="small"
            @update:model-value="(v: string) => updateCell($index, col.code, v)"
          />
        </template>
      </el-table-column>
      <el-table-column v-if="!readonly" label="操作" width="64">
        <template #default="{ $index }">
          <el-button type="danger" link size="small" @click="deleteRow($index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div v-if="!readonly" style="margin-top: 8px">
      <el-button type="primary" link size="small" :icon="Plus" @click="addRow">添加行</el-button>
    </div>
  </div>
</template>

<style scoped>
.sub-table-editor {
  width: 100%;
}
.sub-table-label {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
</style>
