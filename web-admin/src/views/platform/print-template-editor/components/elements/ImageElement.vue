<template>
  <div class="el-print-image" :style="containerStyle">
    <img v-if="element.src" :src="element.src" alt="image" class="img" />
    <div v-else class="placeholder">
      <el-icon><Picture /></el-icon>
      <span>(图片占位)</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Picture } from '@element-plus/icons-vue'
import type { ImageElement } from '../../utils/printSchemaTypes'
import { ptToPx } from '../../utils/a4Coords'

const props = defineProps<{
  element: ImageElement
  zoom: number
}>()

const containerStyle = computed(() => ({
  width: `${ptToPx(props.element.width, props.zoom)}px`,
  height: `${ptToPx(props.element.height, props.zoom)}px`,
  pointerEvents: 'none' as const,
}))
</script>

<style scoped>
.el-print-image {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;
  border: 1px dashed #d1d5db;
}
.img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #9ca3af;
  font-size: 10px;
}
</style>
