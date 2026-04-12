<script setup lang="ts">
/**
 * CanvasAwareWrapper — 根据 rendering_mode 自动切换硬编码页面 vs Canvas 动态页面
 *
 * Usage in router:
 *   component: () => import('@/components/canvas/CanvasAwareWrapper.vue'),
 *   props: { moduleCode: 'sales_order', legacyComponent: () => import('@/views/sales/orders/list.vue') }
 *
 * 或者直接在现有页面中包裹:
 *   <CanvasAwareWrapper module-code="sales_order">
 *     <原有硬编码内容 />
 *   </CanvasAwareWrapper>
 */
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { useAuthStore } from '@/store/modules/auth'
import { get } from '@/api/request'

const props = defineProps<{
  moduleCode: string
}>()

const authStore = useAuthStore()
const renderingMode = ref<string>('LEGACY')
const loading = ref(true)

const DynamicModulePage = defineAsyncComponent(
  () => import('@/views/modules/DynamicModulePage.vue')
)

const useCanvas = computed(() =>
  renderingMode.value === 'CANVAS' || renderingMode.value === 'DYNAMIC'
)

onMounted(async () => {
  if (!authStore.factoryId) { loading.value = false; return }
  try {
    const res = await get(`/${authStore.factoryId}/config/modules/${props.moduleCode}/effective`)
    if (res.success && res.data?.renderingMode) {
      renderingMode.value = res.data.renderingMode
    }
  } catch { /* fallback to LEGACY */ }
  loading.value = false
})
</script>

<template>
  <el-skeleton v-if="loading" :rows="8" animated />
  <DynamicModulePage v-else-if="useCanvas" :module-code="moduleCode" />
  <slot v-else />
</template>
