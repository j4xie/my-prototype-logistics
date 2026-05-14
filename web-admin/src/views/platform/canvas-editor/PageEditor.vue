<template>
  <div class="page-editor">
    <div class="editor-palette">
      <FieldPalette @field-added="onFieldAdded" />
      <el-divider />
      <TabLayoutEditor v-model="tabLayout" />
    </div>

    <div class="editor-canvas">
      <FormCanvas
        v-model:fields="allFields"
        :module-code="moduleCode"
        @remove-field="onRemoveField"
      />
    </div>

    <div class="editor-right">
      <el-tabs v-model="rightTab" class="right-tabs">
        <el-tab-pane label="属性" name="properties">
          <FieldPropertyDrawer
            v-if="selectedField"
            :field="(selectedField as unknown as EffectiveField)"
            @update="onFieldPropertyUpdate"
          />
          <el-empty v-else description="点击字段编辑属性" :image-size="60" />
        </el-tab-pane>
        <el-tab-pane label="预览" name="preview">
          <PreviewPanel
            :module-code="moduleCode"
            :factory-id="factoryId"
            :config="previewConfig"
          />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import FieldPalette from './components/FieldPalette.vue'
import FormCanvas from './components/FormCanvas.vue'
import TabLayoutEditor from './components/TabLayoutEditor.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import FieldPropertyDrawer from './components/FieldPropertyDrawer.vue'
import { usePageEditor } from './composables/usePageEditor'
import { getDynamicFields, createDynamicField, deleteDynamicField } from '@/api/canvasApi'
import type { DynamicField } from '@/types/canvas'
import type { EffectiveField } from '@/types/config'

const props = defineProps<{
  moduleCode: string
  factoryId: string
}>()

const { selectedField, setDirty } = usePageEditor()

const rightTab = ref('properties')
const jpaFields = ref<any[]>([])
const dynamicFields = ref<DynamicField[]>([])
const tabLayout = ref<any[]>([])

const allFields = computed({
  get: () => [
    ...jpaFields.value.map(f => ({ ...f, source: 'jpa' })),
    ...dynamicFields.value.map(f => ({
      fieldCode: f.fieldCode, label: f.label, fieldType: f.fieldType,
      type: f.fieldType.toLowerCase(), source: 'dynamic', status: f.status,
      sortOrder: f.sortOrder, visibleWhen: f.visibleWhen, computedWhen: f.computedWhen,
      config: f.config,
    })),
  ].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
  set: (val) => {
    jpaFields.value = val.filter((f: any) => f.source === 'jpa')
    dynamicFields.value = val.filter((f: any) => f.source === 'dynamic').map((f: any) => ({
      ...f, fieldCode: f.fieldCode, fieldType: f.fieldType || f.type?.toUpperCase(),
    }))
  },
})

const previewConfig = computed(() => jpaFields.value.length > 0 ? {} : null)

onMounted(async () => {
  try {
    const { data } = await getDynamicFields(props.factoryId, props.moduleCode)
    dynamicFields.value = data || []
  } catch (e) {
    console.warn('Failed to load dynamic fields', e)
  }
})

async function onFieldAdded(field: Partial<DynamicField>) {
  field.moduleCode = props.moduleCode
  try {
    const { data } = await createDynamicField(props.factoryId, field)
    dynamicFields.value.push(data)
    setDirty()
    ElMessage.success(`已添加字段: ${field.label}`)
  } catch (e) {
    ElMessage.error('添加字段失败')
  }
}

async function onRemoveField(index: number) {
  const field = allFields.value[index]
  if (field.source === 'dynamic') {
    try {
      await deleteDynamicField(props.factoryId, field.fieldCode, props.moduleCode)
      dynamicFields.value = dynamicFields.value.filter(f => f.fieldCode !== field.fieldCode)
      setDirty()
      ElMessage.success('已移除字段')
    } catch (e) {
      ElMessage.error('移除字段失败')
    }
  }
}

function onFieldPropertyUpdate(_updated: any) {
  setDirty()
}
</script>

<style scoped>
.page-editor { display: flex; height: 100%; gap: 1px; background: #ebeef5; }
.editor-palette { width: 240px; background: #fff; overflow-y: auto; flex-shrink: 0; }
.editor-canvas { flex: 1; background: #fafafa; overflow-y: auto; }
.editor-right { width: 320px; background: #fff; overflow-y: auto; flex-shrink: 0; }
.right-tabs { height: 100%; }
</style>
