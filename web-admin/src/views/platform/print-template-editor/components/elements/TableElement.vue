<template>
  <table class="el-print-table" :style="tableStyle">
    <thead>
      <tr :style="headerRowStyle">
        <th
          v-for="col in element.columns"
          :key="col.header"
          :style="cellStyle(col, true)"
        >{{ col.header }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, i) in displayRows" :key="i" :style="bodyRowStyle">
        <td
          v-for="col in element.columns"
          :key="col.header"
          :style="cellStyle(col, false)"
        >{{ cellValue(row, col) }}</td>
      </tr>
      <tr v-if="displayRows.length === 0" :style="bodyRowStyle">
        <td
          :colspan="element.columns.length"
          class="empty-cell"
        >(无数据 — 实际打印时由 {{ element.binding }} 填充)</td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TableElement, TableColumn } from '../../utils/printSchemaTypes'
import { ptToPx } from '../../utils/a4Coords'
import { renderBinding, resolveArray } from '../../utils/templateRenderer'

const props = defineProps<{
  element: TableElement
  zoom: number
  mockData?: Record<string, unknown>
}>()

const displayRows = computed(() => {
  if (!props.mockData) return [] as Record<string, unknown>[]
  return resolveArray(props.element.binding, props.mockData)
})

const tableStyle = computed(() => ({
  width: '100%',
  borderCollapse: 'collapse' as const,
  pointerEvents: 'none' as const,
}))

const headerRowStyle = computed(() => ({
  backgroundColor: props.element.headerBg ?? '#f3f4f6',
  fontSize: `${ptToPx(props.element.headerFontSize ?? 11, props.zoom)}px`,
  fontWeight: 700 as const,
  color: '#1f2937',
}))

const bodyRowStyle = computed(() => ({
  fontSize: `${ptToPx(props.element.bodyFontSize ?? 10, props.zoom)}px`,
  color: '#1f2937',
  height: `${ptToPx(props.element.rowHeight, props.zoom)}px`,
}))

function cellStyle(col: TableColumn, header: boolean): Record<string, string | number> {
  return {
    width: `${col.width / props.element.width * 100}%`,
    textAlign: col.align ?? (header ? 'center' : 'left'),
    padding: '4px 6px',
    border: '1px solid #e5e7eb',
  }
}

function cellValue(row: Record<string, unknown>, col: TableColumn): string {
  // {{item.field}} → resolve against row scoped as 'item'
  return renderBinding(col.binding, { item: row })
}
</script>

<style scoped>
.empty-cell {
  text-align: center;
  color: #9ca3af;
  padding: 8px;
  font-style: italic;
}
</style>
