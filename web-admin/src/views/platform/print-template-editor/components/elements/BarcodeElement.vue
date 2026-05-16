<template>
  <div class="el-print-barcode" :style="containerStyle">
    <div class="stripes" />
    <div class="caption">{{ resolvedContent || '(条码内容)' }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BarcodeElement } from '../../utils/printSchemaTypes'
import { ptToPx } from '../../utils/a4Coords'
import { renderBinding } from '../../utils/templateRenderer'

const props = defineProps<{
  element: BarcodeElement
  zoom: number
  mockData?: Record<string, unknown>
}>()

const resolvedContent = computed(() => {
  if (!props.mockData) return props.element.content
  return renderBinding(props.element.content, props.mockData)
})

const containerStyle = computed(() => ({
  width: `${ptToPx(props.element.width, props.zoom)}px`,
  height: `${ptToPx(props.element.height, props.zoom)}px`,
  pointerEvents: 'none' as const,
}))
</script>

<style scoped>
.el-print-barcode {
  display: flex;
  flex-direction: column;
  border: 1px dashed #d1d5db;
  background: #fafafa;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #6b7280;
}
.stripes {
  width: 80%;
  height: 50%;
  background-image: repeating-linear-gradient(
    to right,
    #1f2937 0 2px, transparent 2px 4px, #1f2937 4px 7px, transparent 7px 9px
  );
}
.caption {
  margin-top: 2px;
  font-family: monospace;
}
</style>
