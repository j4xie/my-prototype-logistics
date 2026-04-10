<script setup lang="ts">
/**
 * SchemaFormRenderer — Schema 驱动动态表单
 * 根据 EffectiveModuleConfig 自动渲染表单字段
 */
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/store/modules/auth'
import { useConfigStore } from '@/store/modules/config'
import type { EffectiveModuleConfig, EffectiveField, FieldGroup } from '@/types/config'
import { evaluateSpelBoolean, evaluateSpelValue } from '@/utils/spelEvaluator'
import ReferenceSelector from './ReferenceSelector.vue'
import DynamicArrayEditor from './DynamicArrayEditor.vue'
import LineItemsEditor from './LineItemsEditor.vue'
import SubTableEditor from './SubTableEditor.vue'
import AttachmentUploader from './AttachmentUploader.vue'

const props = defineProps<{
  moduleCode: string
  mode: 'create' | 'edit' | 'view'
  initialData?: Record<string, unknown>
  factoryId?: string
  recordId?: string
}>()

const emit = defineEmits<{
  submit: [data: Record<string, unknown>]
  cancel: []
}>()

const authStore = useAuthStore()
const configStore = useConfigStore()
const config = ref<EffectiveModuleConfig | null>(null)
const formData = ref<Record<string, unknown>>({})
const loading = ref(false)

// 加载配置
onMounted(async () => {
  const factoryId = authStore.factoryId
  if (!factoryId) return
  config.value = await configStore.loadEffectiveConfig(factoryId, props.moduleCode)
  if (config.value) {
    initFormData()
  }
})

function initFormData() {
  if (!config.value) return
  const data: Record<string, unknown> = {}

  config.value.fields.forEach((field) => {
    if (props.mode === 'edit' && props.initialData) {
      data[field.code] = props.initialData[field.code] ?? field.defaultValue ?? null
    } else if (props.mode === 'create') {
      data[field.code] = field.defaultValue ?? null
    } else {
      data[field.code] = props.initialData?.[field.code] ?? null
    }
  })

  formData.value = data
}

// 按 group 分组的可见字段
const groupedFields = computed(() => {
  if (!config.value) return []
  const groups = config.value.groups
    .filter((g) => g.visible)
    .sort((a, b) => a.order - b.order)

  return groups.map((group) => ({
    ...group,
    fields: config.value!.fields
      .filter((f) => f.group === group.code && f.visible && isFieldShown(f))
      .sort((a, b) => a.order - b.order),
  }))
})

// dependsOn 条件显示 + visibleWhen SpEL
function isFieldShown(field: EffectiveField): boolean {
  const dep = field.extra?.dependsOn as { field: string; value: unknown } | undefined
  if (dep) {
    if (formData.value[dep.field] !== dep.value) return false
  }
  if (field.visibleWhen) {
    return evaluateSpelBoolean(field.visibleWhen, formData.value)
  }
  return true
}

// 是否只读
function isReadonly(field: EffectiveField): boolean {
  return props.mode === 'view' || field.readonly || !!field.extra?.computed
}

// computedWhen 动态计算值
const computedValues = computed(() => {
  const result: Record<string, unknown> = {}
  if (!config.value) return result
  for (const field of config.value.fields) {
    if (field.computedWhen) {
      result[field.code] = evaluateSpelValue(field.computedWhen, formData.value)
    }
  }
  return result
})

// 自定义标签
function getLabel(field: EffectiveField): string {
  return config.value?.customLabels?.[field.code] || field.label
}

// 提交
function handleSubmit() {
  if (!config.value) return

  // 校验必填
  for (const field of config.value.fields) {
    if (!field.visible || !isFieldShown(field)) continue
    if (field.required && !isReadonly(field)) {
      const val = formData.value[field.code]
      if (val === null || val === undefined || val === '') {
        ElMessage.warning(`${getLabel(field)} 不能为空`)
        return
      }
    }
  }

  // Canvas V3: Apply computedWhen values into payload (write-back)
  // computedValues are calculated by SpEL at render time; persist them on submit.
  const payload: Record<string, unknown> = { ...formData.value }
  for (const field of config.value.fields) {
    if (field.computedWhen && computedValues.value[field.code] != null) {
      payload[field.code] = computedValues.value[field.code]
    }
  }

  // Canvas V3: Split JPA vs dynamic fields so backend can route them
  // Dynamic fields go into customFields Map (dual-track architecture)
  const customFields: Record<string, unknown> = {}
  const jpaPayload: Record<string, unknown> = {}
  for (const field of config.value.fields) {
    const val = payload[field.code]
    if (val === undefined) continue
    if (field.source === 'dynamic') {
      customFields[field.code] = val
    } else {
      jpaPayload[field.code] = val
    }
  }
  if (Object.keys(customFields).length > 0) {
    jpaPayload.customFields = customFields
  }

  emit('submit', jpaPayload)
}

// 活动的 collapse 面板
const activeGroups = ref<string[]>([])
watch(
  () => config.value,
  (c) => {
    if (c) activeGroups.value = c.groups.filter((g) => g.visible).map((g) => g.code)
  },
  { immediate: true },
)
</script>

<template>
  <div class="schema-form-renderer" v-if="config">
    <el-form label-width="130px" label-position="right">
      <el-collapse v-model="activeGroups">
        <el-collapse-item
          v-for="group in groupedFields"
          :key="group.code"
          :title="group.label"
          :name="group.code"
        >
          <template v-for="field in group.fields" :key="field.code">
            <el-form-item
              :label="getLabel(field)"
              :required="field.required && !isReadonly(field)"
            >
              <!-- string -->
              <el-input
                v-if="field.type === 'string' || field.type === 'text'"
                v-model="formData[field.code]"
                :disabled="isReadonly(field)"
                :placeholder="`请输入${getLabel(field)}`"
              />

              <!-- textarea -->
              <el-input
                v-else-if="field.type === 'textarea'"
                v-model="formData[field.code]"
                type="textarea"
                :rows="3"
                :disabled="isReadonly(field)"
                :placeholder="`请输入${getLabel(field)}`"
              />

              <!-- decimal -->
              <el-input-number
                v-else-if="field.type === 'decimal'"
                v-model="formData[field.code]"
                :precision="(field.extra?.precision as number) ?? 2"
                :min="(field.extra?.min as number) ?? undefined"
                :max="(field.extra?.max as number) ?? undefined"
                :disabled="isReadonly(field)"
                controls-position="right"
                style="width: 220px"
              />

              <!-- integer -->
              <el-input-number
                v-else-if="field.type === 'integer'"
                v-model="formData[field.code]"
                :precision="0"
                :min="(field.extra?.min as number) ?? undefined"
                :max="(field.extra?.max as number) ?? undefined"
                :disabled="isReadonly(field)"
                controls-position="right"
                style="width: 220px"
              />

              <!-- boolean -->
              <el-switch
                v-else-if="field.type === 'boolean'"
                v-model="formData[field.code]"
                :disabled="isReadonly(field)"
              />

              <!-- date -->
              <el-date-picker
                v-else-if="field.type === 'date'"
                v-model="formData[field.code]"
                type="date"
                value-format="YYYY-MM-DD"
                :disabled="isReadonly(field)"
                :placeholder="`请选择${getLabel(field)}`"
                style="width: 220px"
              />

              <!-- select -->
              <el-select
                v-else-if="field.type === 'select'"
                v-model="formData[field.code]"
                :disabled="isReadonly(field)"
                :placeholder="`请选择${getLabel(field)}`"
                clearable
                style="width: 220px"
              >
                <el-option
                  v-for="opt in field.options"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>

              <!-- reference -->
              <ReferenceSelector
                v-else-if="field.type === 'reference'"
                v-model="formData[field.code]"
                :config="(field.extra?.referenceConfig as any)"
                :disabled="isReadonly(field)"
                :placeholder="`请选择${getLabel(field)}`"
              />

              <!-- json_array -->
              <DynamicArrayEditor
                v-else-if="field.type === 'json_array'"
                v-model="(formData[field.code] as Record<string, unknown>[])"
                :item-schema="(field.extra?.itemSchema as any)"
                :disabled="isReadonly(field)"
              />

              <!-- line_items -->
              <LineItemsEditor
                v-else-if="field.type === 'line_items'"
                v-model="(formData[field.code] as Record<string, unknown>[])"
                :item-schema="(field.extra?.itemSchema as any)"
                :disabled="isReadonly(field)"
              />

              <!-- attachment -->
              <AttachmentUploader
                v-else-if="field.type === 'attachment'"
                v-model="formData[field.code]"
                :factory-id="factoryId || ''"
                :accept="(field.extra?.accept as string)"
                :max-size="(field.extra?.maxSize as number)"
                :max-count="(field.extra?.maxCount as number)"
                :readonly="isReadonly(field)"
              />

              <!-- sub_table -->
              <SubTableEditor
                v-else-if="field.type === 'sub_table'"
                :factory-id="factoryId || ''"
                :module-code="moduleCode"
                :record-id="recordId || ''"
                :field-code="field.code"
                :label="field.label"
                :columns="(field.extra?.columns as any[]) || []"
                :readonly="mode === 'view'"
              />

              <!-- fallback -->
              <el-input v-else v-model="formData[field.code]" :disabled="isReadonly(field)" />

              <!-- computedWhen 动态计算显示 -->
              <span
                v-if="field.computedWhen && computedValues[field.code] != null"
                class="computed-display"
              >
                {{ computedValues[field.code] }}
              </span>
            </el-form-item>
          </template>
        </el-collapse-item>
      </el-collapse>

      <!-- 底部按钮 -->
      <el-form-item v-if="mode !== 'view'" style="margin-top: 24px">
        <el-button type="primary" @click="handleSubmit">
          {{ mode === 'create' ? '创建' : '保存' }}
        </el-button>
        <el-button @click="emit('cancel')">取消</el-button>
      </el-form-item>
    </el-form>
  </div>

  <div v-else style="text-align: center; padding: 60px 0; color: #909399">
    <el-icon :size="32" style="margin-bottom: 12px"><Loading /></el-icon>
    <div>加载配置中...</div>
  </div>
</template>

<style scoped>
.schema-form-renderer {
  max-width: 900px;
}
.schema-form-renderer :deep(.el-collapse-item__header) {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.computed-display {
  margin-left: 8px;
  color: #909399;
  font-size: 13px;
}
</style>
