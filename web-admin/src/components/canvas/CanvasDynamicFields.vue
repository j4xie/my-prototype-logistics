<script setup lang="ts">
/**
 * CanvasDynamicFields — 可嵌入任何表单的 Canvas 动态字段渲染器
 *
 * 从 canvas_dynamic_field 加载工厂配置的动态字段定义,
 * 渲染为 el-form-item 列表, 双向绑定到 modelValue (customFields map).
 *
 * Usage:
 *   <CanvasDynamicFields v-model="form.customFields" module-code="sales_order" />
 */
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useAuthStore } from '@/store/modules/auth'
import { getDynamicFields } from '@/api/canvasApi'
import { get } from '@/api/request'
import { evaluateSpelBoolean, evaluateSpelValue } from '@/utils/spelEvaluator'
import type { TableRow } from '@/types/api';

interface DynField {
  fieldCode: string
  fieldType: string
  label: string
  config?: TableRow
  sortOrder?: number
  visibleWhen?: string
  computedWhen?: string
}

const props = defineProps<{
  moduleCode: string
  modelValue?: TableRow
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [val: TableRow]
}>()

const authStore = useAuthStore()
const fields = ref<DynField[]>([])
const localValues = ref<TableRow>({})

onMounted(async () => {
  if (!authStore.factoryId) return
  try {
    const res = await getDynamicFields(authStore.factoryId, props.moduleCode) as unknown as { success: boolean; data: unknown }
    if (res.success && Array.isArray(res.data)) {
      fields.value = (res.data as DynField[])
        .filter(f => f.fieldType !== 'SUB_TABLE')
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    }
  } catch { /* module may not have dynamic fields configured */ }

  // Load factory defaults for create mode (pre-populate empty fields)
  if (!props.modelValue || Object.keys(props.modelValue).length === 0) {
    try {
      const defRes = await get(`/${authStore.factoryId}/config/modules/${props.moduleCode}/defaults`)
      if (defRes.success && defRes.data && typeof defRes.data === 'object') {
        localValues.value = { ...defRes.data as TableRow }
        emit('update:modelValue', { ...localValues.value })
      }
    } catch { /* defaults not configured */ }
  } else {
    localValues.value = { ...props.modelValue }
  }
})

watch(() => props.modelValue, (nv) => {
  if (nv) localValues.value = { ...nv }
}, { deep: true })

function updateField(fieldCode: string, value: unknown) {
  localValues.value[fieldCode] = value
  emit('update:modelValue', { ...localValues.value })
}

function isFieldVisible(field: DynField): boolean {
  if (!field.visibleWhen) return true
  try { return evaluateSpelBoolean(field.visibleWhen, localValues.value) }
  catch { return true }
}

const visibleFields = computed(() => fields.value.filter(isFieldVisible))

// R18: computedWhen — auto-compute field values from SpEL expressions
// R22 B1 fix: guard against infinite loop. The deep watcher mutates localValues
// which re-triggers itself. isComputing prevents re-entry; nextTick releases
// the guard after Vue's synchronous flush so the next user-initiated change works.
const computedFields = computed(() => fields.value.filter(f => f.computedWhen))
let isComputing = false
watch(localValues, () => {
  if (isComputing || computedFields.value.length === 0) return
  isComputing = true
  try {
    let changed = false
    for (const field of computedFields.value) {
      if (!field.computedWhen) continue
      try {
        const result = evaluateSpelValue(field.computedWhen, localValues.value)
        if (result !== undefined && result !== localValues.value[field.fieldCode]) {
          localValues.value[field.fieldCode] = result
          changed = true
        }
      } catch { /* expression may reference fields not yet filled */ }
    }
    if (changed) emit('update:modelValue', { ...localValues.value })
  } finally {
    nextTick(() => { isComputing = false })
  }
}, { deep: true })
</script>

<template>
  <template v-if="fields.length > 0">
    <el-divider>工厂自定义字段</el-divider>
    <el-form-item v-for="field in visibleFields" :key="field.fieldCode" :label="field.label">
      <!-- NUMBER -->
      <el-input-number
        v-if="field.fieldType === 'NUMBER' || field.fieldType === 'DECIMAL'"
        :model-value="(localValues[field.fieldCode] as number) ?? undefined"
        :disabled="disabled"
        :precision="field.fieldType === 'DECIMAL' ? 2 : 0"
        style="width: 100%"
        @update:model-value="(v: number) => updateField(field.fieldCode, v)"
      />
      <!-- DATE -->
      <el-date-picker
        v-else-if="field.fieldType === 'DATE'"
        :model-value="(localValues[field.fieldCode] as string) ?? ''"
        :disabled="disabled"
        type="date"
        value-format="YYYY-MM-DD"
        style="width: 100%"
        @update:model-value="(v: string) => updateField(field.fieldCode, v)"
      />
      <!-- BOOLEAN -->
      <el-switch
        v-else-if="field.fieldType === 'BOOLEAN'"
        :model-value="!!localValues[field.fieldCode]"
        :disabled="disabled"
        @update:model-value="(v: boolean) => updateField(field.fieldCode, v)"
      />
      <!-- SELECT (if config.options exists) -->
      <el-select
        v-else-if="field.config?.options"
        :model-value="(localValues[field.fieldCode] as string) ?? ''"
        :disabled="disabled"
        filterable
        style="width: 100%"
        @update:model-value="(v: string) => updateField(field.fieldCode, v)"
      >
        <el-option
          v-for="opt in (field.config.options as { value: string; label: string }[])"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <!-- TEXT (textarea for long text) -->
      <el-input
        v-else-if="field.fieldType === 'TEXT'"
        :model-value="(localValues[field.fieldCode] as string) ?? ''"
        :disabled="disabled"
        type="textarea"
        :rows="2"
        @update:model-value="(v: string) => updateField(field.fieldCode, v)"
      />
      <!-- STRING (default) -->
      <el-input
        v-else
        :model-value="(localValues[field.fieldCode] as string) ?? ''"
        :disabled="disabled"
        @update:model-value="(v: string) => updateField(field.fieldCode, v)"
      />
    </el-form-item>
  </template>
</template>
