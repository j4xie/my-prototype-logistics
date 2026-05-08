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
  /**
   * C-6 reactive default: 选中 entity 后, 把 schema-configured projectFields 映射的
   * entity 字段 emit 给父组件 (LineItemsEditor.onReferenceProject 或
   * SchemaFormRenderer.onTopLevelProject 接收, 写到 row/formData shadow 字段).
   * fields key 已经过 SHADOW_KEY_RE 校验, 防止 prototype pollution.
   */
  'project': [fields: Record<string, unknown>]
}>()

const authStore = useAuthStore()
const options = ref<Array<{ label: string; value: string | number }>>([])
const loading = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * C-6 cache: value → 完整 entity. 用于 handleChange / watch / fetchById 各路径
 * 写 shadow 字段时同步从 cache 读 entity 的额外字段 (level1PerLevel2 等).
 *
 * 取舍: parallel Map 比 augment options[i]._entity 更清晰 (el-option v-for diff
 * 不被 entity 大对象拖慢). search 时整体 rebuild, 但保留当前 modelValue 对应
 * entity 防止 watch 触发不必要的 fetchById round-trip.
 */
const optionEntities = ref<Map<string, Record<string, unknown>>>(new Map())

/**
 * C-6 C3 reviewer fix: shadowKey 校验, 防止 admin 配 __proto__/constructor 等
 * 危险 key 通过 spread 污染 row/formData prototype.
 *
 * 强制 `_` 前缀 + alphanumeric/underscore — 与 Task 6 (SchemaFormRenderer
 * submit filter) 的 `payload[k].startsWith('_')` 约定一致.
 */
const SHADOW_KEY_RE = /^_[a-zA-Z][a-zA-Z0-9_]*$/

/**
 * C-6 C2 reviewer fix: 并发 fetchById token. 用户连续切 modelValue 时,
 * 旧响应不能覆盖新选择的 options/cache.
 */
let fetchToken = 0

/**
 * C-6 helper: 按 projectFields 映射构造 emit payload.
 * - val=null (clear) → 所有 shadow key 写 null (I2 reviewer fix)
 * - shadowKey 不合规 → console.error 跳过 (C3)
 * - cache miss → shadow 写 null (避免发 stale)
 */
function emitProjectFields(val: string | number | null) {
  if (!props.config.projectFields) return
  const projected: Record<string, unknown> = {}
  for (const [entityKey, shadowKey] of Object.entries(props.config.projectFields)) {
    if (!SHADOW_KEY_RE.test(shadowKey)) {
      console.error(
        `[ReferenceSelector] invalid shadowKey "${shadowKey}" — must match ${SHADOW_KEY_RE}. ` +
        `Skipping. Fix module_schemas.field_schema.referenceConfig.projectFields.`
      )
      continue
    }
    if (!val) {
      projected[shadowKey] = null
      continue
    }
    const entity = optionEntities.value.get(String(val))
    projected[shadowKey] = entity ? (entity[entityKey] ?? null) : null
  }
  emit('project', projected)
}

function resolveEndpoint(): string {
  // R12 audit S2 fix: defensively detect missing apiEndpoint (legacy referenceModule-only
  // schemas seeded by V20260410_08/09/10). Without this, the next .replace() throws
  // "Cannot read properties of undefined (reading 'replace')" which the catch block
  // swallows → silent empty dropdown. Now log loudly so devs can find the schema gap.
  if (!props.config?.apiEndpoint) {
    const refModule = (props.config as { referenceModule?: string })?.referenceModule
    console.error(
      `[ReferenceSelector] schema misconfigured for entity=${props.config?.entity || '(unknown)'}, ` +
      `referenceModule=${refModule || '(none)'} — missing apiEndpoint. ` +
      `Fix module_schemas.field_schema to include referenceConfig.apiEndpoint.`
    )
    return ''  // empty → request.get('') returns 404, dropdown empty + error in console
  }
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
      // R4 audit fix (updated R8): coerce option.value to String for el-select strict-eq.
      // Some entity FKs are BIGINT (SalesOrder.salespersonId post-V20260425_09) → JSON
      // number; others may be VARCHAR/UUID. Reference endpoints return Long User.id as
      // JSON number. Coercing to String here means SchemaFormRenderer.readInitialForField
      // (which also String() the formData side) gives consistent String===String matches.
      options.value = list.map((item: Record<string, unknown>) => ({
        label: String(item[props.config.displayField] || ''),
        value: String(item[props.config.valueField]),
      }))
      // C-6 I1 reviewer fix: rebuild optionEntities map每次 search,避免无界增长.
      // 保留当前 modelValue 对应的 entity (若不在新结果中), 让 watch 后续 cache-hit
      // 路径不需要重新 fetchById.
      const newEntities = new Map<string, Record<string, unknown>>()
      for (const item of list) {
        newEntities.set(String(item[props.config.valueField]), item as Record<string, unknown>)
      }
      if (props.modelValue) {
        const curKey = String(props.modelValue)
        const cur = optionEntities.value.get(curKey)
        if (cur && !newEntities.has(curKey)) newEntities.set(curKey, cur)
      }
      optionEntities.value = newEntities
      // R17 audit MIN-5: catch displayField/response-key mismatches (the V11→V13 class bug
      // that 8 reviewers missed because labels resolved to '' silently). Warn ONCE per
      // fetch when >50% labels are blank — clear signal that schema.displayField doesn't
      // match any key in the API response.
      if (options.value.length > 0) {
        const blankCount = options.value.filter((o) => !o.label).length
        if (blankCount * 2 > options.value.length) {
          console.warn(
            `[ReferenceSelector] entity=${props.config.entity} returned ${blankCount}/${options.value.length} ` +
            `items with blank label. Schema displayField='${props.config.displayField}' likely doesn't match ` +
            `any key in API response. Fix: align module_schemas.referenceConfig.displayField with controller projection.`
          )
        }
      }
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
  // C-6: 同步 emit project (cache 已在 search 时填好). null (clearable) 走 I2 path.
  emitProjectFields(val)
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

// :key on the el-select forces re-mount when bumped — needed because element-plus
// caches its internal currentLabel from the first option-match at render time,
// and async fetchById updates to options.value don't trigger label re-evaluation.
// Bumped exactly once per fetch when the real displayField label arrives.
const selectKey = ref(0)

async function fetchById(id: string | number) {
  // C-6 C2 reviewer fix: token 并发竞争, 旧响应不覆盖新选择.
  const myToken = ++fetchToken

  // Synchronous placeholder so el-select has options[0].value === modelValue immediately.
  // Without this, first paint sees empty options + raw modelValue → renders raw id as label,
  // and Element Plus caches that "currentLabel" — async option updates don't refresh it.
  options.value = [{ label: String(id), value: id }]

  // Skip lookup for non-ID-shaped values (legacy display-name strings, e.g., "张三")
  // C-6 M1 reviewer fix: legacy ID 仍尝试从 cache emit project (search() 已填) — 避免
  // legacy entity 在 watch 路径下 shadow 字段永空.
  if (!looksLikeId(id)) {
    if (optionEntities.value.has(String(id))) emitProjectFields(id)
    return
  }

  loading.value = true
  try {
    // Strip /search or /active suffix — those are LIST endpoints, not single-item GET.
    // Convention: /entities → /entities/{id} for single fetch.
    // R20 audit Q3 fix: split URL into path + query string before appending /id.
    // Schemas now include ?usage=invoiceable etc. (V20260425_14). Naively appending
    // /146 to /sales-orders?usage=invoiceable produces /sales-orders?usage=invoiceable/146
    // which is an invalid URL — query param ends up inside the path segment.
    const fullEndpoint = resolveEndpoint().replace(/\/(search|active)$/, '')
    const queryIdx = fullEndpoint.indexOf('?')
    const pathPart = queryIdx >= 0 ? fullEndpoint.slice(0, queryIdx) : fullEndpoint
    const queryPart = queryIdx >= 0 ? fullEndpoint.slice(queryIdx) : ''
    const idUrl = `${pathPart}/${encodeURIComponent(String(id))}${queryPart}`
    const res = await request.get(idUrl, {
      _silent: true  // suppress global error toast for 404 lookups
    } as never)
    // C-6 C2: stale token check — 用户在 fetch 期间又切了 modelValue, 这次响应作废.
    if (myToken !== fetchToken) return
    const item = res.data?.data || res.data
    if (item && typeof item === 'object' && item[props.config.valueField] != null) {
      const realLabel = String(item[props.config.displayField] || id)
      // R4 audit fix (updated R8): coerce to String. Reference endpoints return Long
      // User.id → JSON number 146; SchemaFormRenderer.readInitialForField also String()s
      // the formData side. Strict-eq match needs both sides String.
      const realValue = String(item[props.config.valueField])
      options.value = [{ label: realLabel, value: realValue }]
      // C-6 M2 reviewer fix: cache the fetched entity for project emit + watch cache-hit path.
      optionEntities.value.set(realValue, item as Record<string, unknown>)
      // C-6 Task 7: edit 模式 init — fetch 完成后 emit project 给父组件填 shadow 字段.
      emitProjectFields(realValue)
      // Force el-select to re-mount so its cached currentLabel picks up the real label
      // instead of the raw-id placeholder. Safe because dropdown isn't open during fetch.
      if (realLabel !== String(id)) selectKey.value++
    }
    // else: keep the synchronous placeholder (raw id as label) — backend returned null
    // for stale/deleted reference. Better than showing "undefined".
  } catch {
    // 404 → endpoint pattern not supported; keep raw-id placeholder set above
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // Spec §4.A.8 — Skip empty-keyword initial fetch (some backends reject @NotBlank).
  // Bug E fix: if existing value present, fetch by ID for proper display name lookup.
  if (props.modelValue) {
    fetchById(props.modelValue)
  }
})

watch(() => props.modelValue, (val) => {
  // C-6 I2 reviewer fix: clear path emits null shadow fields, computed 看到 null-guard.
  if (!val) {
    emitProjectFields(null)
    return
  }
  // C-6 C1 reviewer fix: cache-hit path 也要 emit project (edit 模式 reset 后 options
  // 仍含 value, 旧逻辑 fetchById 被跳过 → shadow 字段永远 null).
  if (options.value.find(o => o.value === val)) {
    emitProjectFields(val)
  } else {
    // Bug E: re-fetch display when value changes externally (form re-init etc.)
    fetchById(val)  // fetchById 完成后内部会调 emitProjectFields
  }
})
</script>

<template>
  <el-select
    :key="selectKey"
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
