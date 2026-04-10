<template>
  <el-tabs v-model="activeTab" type="border-card">
    <el-tab-pane v-for="tab in tabs" :key="tab.code" :label="tab.label" :name="tab.code">
      <template v-if="!tab.type || tab.type === 'fields'">
        <SchemaFormRenderer
          :module-code="moduleCode"
          :mode="mode"
          :initial-data="initialData"
          :factory-id="factoryId"
          :record-id="recordId"
          @submit="$emit('submit', $event)"
          @cancel="$emit('cancel')"
        />
      </template>
      <template v-else-if="tab.type === 'sub_table'">
        <SubTableEditor
          :factory-id="factoryId"
          :module-code="moduleCode"
          :record-id="recordId || ''"
          :field-code="tab.fieldCode || tab.code"
          :label="tab.label"
          :columns="tab.columns || []"
          :readonly="mode === 'view'"
        />
      </template>
      <template v-else-if="tab.type === 'ref_table'">
        <div class="ref-table-placeholder">
          <el-empty description="关联记录加载中..." />
        </div>
      </template>
    </el-tab-pane>
  </el-tabs>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SchemaFormRenderer from './SchemaFormRenderer.vue'
import SubTableEditor from './SubTableEditor.vue'

interface TabConfig {
  code: string
  label: string
  type?: 'fields' | 'sub_table' | 'ref_table'
  fieldCodes?: string[]
  fieldCode?: string
  columns?: Array<{ code: string; label: string; type: string }>
  refModule?: string
}

const props = defineProps<{
  tabs: TabConfig[]
  moduleCode: string
  mode: 'create' | 'edit' | 'view'
  initialData?: Record<string, unknown>
  factoryId: string
  recordId?: string
  defaultTab?: string
}>()

defineEmits<{ submit: [data: Record<string, unknown>]; cancel: [] }>()

const activeTab = ref(props.defaultTab || props.tabs[0]?.code || '')
</script>
