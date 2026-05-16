<template>
  <div class="el-print-qr" :style="containerStyle">
    <svg v-if="dataUrl == null" viewBox="0 0 24 24" :width="size" :height="size" class="placeholder">
      <rect width="24" height="24" fill="#f3f4f6" stroke="#9ca3af" stroke-dasharray="2 2"/>
      <text x="12" y="14" text-anchor="middle" font-size="6" fill="#6b7280">QR</text>
    </svg>
    <img v-else :src="dataUrl" :width="size" :height="size" alt="QR" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import QRCode from 'qrcode'
import type { QrElement } from '../../utils/printSchemaTypes'
import { ptToPx } from '../../utils/a4Coords'
import { renderBinding } from '../../utils/templateRenderer'

const props = defineProps<{
  element: QrElement
  zoom: number
  mockData?: Record<string, unknown>
}>()

const size = computed(() => ptToPx(props.element.size, props.zoom))

const containerStyle = computed(() => ({
  width: `${size.value}px`,
  height: `${size.value}px`,
  pointerEvents: 'none' as const,
}))

const dataUrl = ref<string | null>(null)

const resolvedContent = computed(() => {
  if (!props.mockData) return props.element.content
  return renderBinding(props.element.content, props.mockData)
})

watch(
  () => [resolvedContent.value, size.value] as const,
  async ([content, sz]) => {
    if (!content || content.includes('{{')) {
      dataUrl.value = null
      return
    }
    try {
      dataUrl.value = await QRCode.toDataURL(String(content), {
        width: Math.round(sz),
        margin: 1,
      })
    } catch {
      dataUrl.value = null
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.el-print-qr {
  display: inline-block;
}
.placeholder {
  display: block;
}
</style>
