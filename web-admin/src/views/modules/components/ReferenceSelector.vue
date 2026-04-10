<script setup lang="ts">
/**
 * ReferenceSelector — 远程搜索下拉组件
 * 用于 reference 类型字段，支持远程搜索 + 分页加载
 */
import { ref, watch, onMounted } from 'vue'
import request from '@/api/request'
import { useAuthStore } from '@/store/modules/auth'

interface ReferenceConfig {
  entity: string
  displayField: string
  valueField: string
  searchFields?: string[]
  apiEndpoint: string
}

const props = defineProps<{
  modelValue: string | number | null
  config: ReferenceConfig
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
}>()

const authStore = useAuthStore()
const options = ref<Array<{ label: string; value: string | number }>>([])
const loading = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function resolveEndpoint(): string {
  return props.config.apiEndpoint.replace('{factoryId}', authStore.factoryId || '')
}

async function search(query: string) {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    loading.value = true
    try {
      const endpoint = resolveEndpoint()
      const res = await request.get(endpoint, {
        params: { keyword: query, page: 1, size: 50 },
      })
      const data = res.data
      const list = Array.isArray(data) ? data : (data?.content || [])
      options.value = list.map((item: Record<string, unknown>) => ({
        label: String(item[props.config.displayField] || ''),
        value: item[props.config.valueField] as string | number,
      }))
    } catch (e: any) {
      // Permission denied (403) or missing endpoint is expected when user has limited access.
      // Log as warning, not error — the dropdown just shows no options, which is acceptable UX.
      const msg = e?.message || String(e)
      const isPermission = msg.includes('权限') || msg.includes('403') || msg.includes('Forbidden')
      if (isPermission) {
        console.warn(`ReferenceSelector: no permission for ${props.config.entity} (user sees empty dropdown)`)
      } else {
        console.warn('ReferenceSelector search failed:', msg)
      }
      options.value = []
    } finally {
      loading.value = false
    }
  }, 300)
}

function handleChange(val: string | number | null) {
  emit('update:modelValue', val)
}

onMounted(() => {
  // 初始加载，显示已有选项
  search('')
})
</script>

<template>
  <el-select
    :model-value="modelValue"
    filterable
    remote
    :remote-method="search"
    :loading="loading"
    :disabled="disabled"
    :placeholder="placeholder || '请选择'"
    clearable
    @change="handleChange"
    style="width: 100%"
  >
    <el-option
      v-for="opt in options"
      :key="opt.value"
      :label="opt.label"
      :value="opt.value"
    />
  </el-select>
</template>
