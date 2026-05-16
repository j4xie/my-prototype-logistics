<template>
  <div class="el-print-field" :style="style">
    <span class="binding-preview">{{ rendered }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FieldElement } from '../../utils/printSchemaTypes'
import { ptToPx } from '../../utils/a4Coords'
import { renderBinding } from '../../utils/templateRenderer'

const props = defineProps<{
  element: FieldElement
  zoom: number
  mockData?: Record<string, unknown>
}>()

const rendered = computed(() => {
  if (!props.mockData) return props.element.binding
  const resolved = renderBinding(props.element.binding, props.mockData)
  if (resolved === '-' && props.element.emptyText) return props.element.emptyText
  return resolved
})

const style = computed(() => ({
  fontSize: `${ptToPx(props.element.fontSize, props.zoom)}px`,
  color: props.element.color ?? '#1f2937',
  fontWeight: props.element.bold ? 700 : 400,
  textAlign: props.element.align ?? 'left',
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  width: '100%',
  pointerEvents: 'none' as const,
}))
</script>

<style scoped>
.el-print-field {
  height: 100%;
}
.binding-preview {
  /* show binding template in distinct color when no mock data */
  font-family: inherit;
}
</style>
