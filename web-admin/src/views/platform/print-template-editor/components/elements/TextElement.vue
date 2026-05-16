<template>
  <div
    class="el-print-text"
    :style="style"
  >{{ element.text || '(空文本)' }}</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TextElement } from '../../utils/printSchemaTypes'
import { ptToPx } from '../../utils/a4Coords'

const props = defineProps<{
  element: TextElement
  zoom: number
}>()

const style = computed(() => ({
  fontSize: `${ptToPx(props.element.fontSize, props.zoom)}px`,
  color: props.element.color ?? '#1f2937',
  fontWeight: props.element.bold ? 700 : 400,
  fontStyle: props.element.italic ? 'italic' : 'normal',
  textAlign: props.element.align ?? 'left',
  whiteSpace: 'pre',
  lineHeight: 1.2,
  pointerEvents: 'none' as const,
}))
</script>

<style scoped>
.el-print-text {
  width: 100%;
  height: 100%;
}
</style>
