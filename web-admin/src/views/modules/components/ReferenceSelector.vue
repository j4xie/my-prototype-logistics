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
  // axios baseURL 已是 /api/mobile, 若 config.apiEndpoint 已带该前缀则 strip 掉,
  // 避免 /api/mobile/api/mobile/... 双前缀 (老配置可能写了完整路径).
  return props.config.apiEndpoint
    .replace('{factoryId}', authStore.factoryId || '')
    .replace(/^\/api\/mobile(?=\/)/, '')
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

/**
 * Bug E fix: when modelValue exists (edit/view mode), fetch the SPECIFIC
 * record by ID so its display name populates instead of showing raw ID.
 * Try GET /endpoint/{id} first; fall back to keyword search if 404/no match.
 */
/**
 * ID-shape detection — broad allow-list to support legacy prefix-style IDs.
 *
 * Apr 25 2026 audit caught: prod has 177 product_type IDs like "PT-F001-003" that the
 * original UUID/numeric-only regex rejected. fetchById was being skipped, so edit-mode
 * line items displayed raw "PT-F001-003" as the option label instead of looking up the
 * product name.
 *
 * Accepted: alnum + underscore/hyphen/dot (covers numeric IDs, UUIDs, PT-F001-003,
 *   R001-PT-001, CUS-1767..., RMT_1774414299841, etc).
 * Rejected (treated as legacy display-name string, ReferenceSelector falls back to
 *   render-as-label): anything containing Chinese / spaces / parens / slashes /
 *   apostrophes / & / non-ASCII letters (Müller, O'Brien, "Apple M2 Pro", "B-2/3", etc).
 *   For these the raw value IS already the human-readable name, so the fallback display
 *   is correct UX even though we skipped the fetchById lookup.
 */
function looksLikeId(v: string | number): boolean {
  const s = String(v)
  if (s.length === 0) return false
  return /^[A-Za-z0-9_\-.]+$/.test(s)
}

async function fetchById(id: string | number) {
  // Skip lookup for non-ID-shaped values (legacy display-name strings, e.g., "张三")
  if (!looksLikeId(id)) {
    options.value = [{ label: String(id), value: id }]
    return
  }
  loading.value = true
  try {
    // Strip /search or /active suffix — those are LIST endpoints, not single-item GET.
    // Convention: /entities → /entities/{id} for single fetch.
    const endpoint = resolveEndpoint().replace(/\/(search|active)$/, '')
    const res = await request.get(`${endpoint}/${encodeURIComponent(String(id))}`, {
      _silent: true  // suppress global error toast for 404 lookups
    } as never)
    const item = res.data?.data || res.data
    if (item && typeof item === 'object' && item[props.config.valueField] != null) {
      options.value = [{
        label: String(item[props.config.displayField] || id),
        value: item[props.config.valueField] as string | number,
      }]
      return
    }
  } catch (e: any) {
    // 404 → endpoint pattern not supported; silently fall back to keyword search
    // (no console.warn — this is expected for some entities)
  } finally {
    loading.value = false
  }
  // fallback: render raw id as label (no API call to avoid 404 noise)
  // user typing keyword still triggers search() via :remote-method
  options.value = [{ label: String(id), value: id }]
}

onMounted(() => {
  // Spec §4.A.8 — Skip empty-keyword initial fetch (some backends reject @NotBlank).
  // Bug E fix: if existing value present, fetch by ID for proper display name lookup.
  if (props.modelValue) {
    fetchById(props.modelValue)
  }
})

watch(() => props.modelValue, (val) => {
  // Bug E: re-fetch display when value changes externally (form re-init etc.)
  if (val && !options.value.find(o => o.value === val)) {
    fetchById(val)
  }
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
