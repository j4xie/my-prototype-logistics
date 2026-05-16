<template>
  <div class="toolbar">
    <div class="left">
      <el-select
        :model-value="editor.entityType.value"
        placeholder="选择单据类型"
        style="width: 200px"
        @update:model-value="onEntityChange"
      >
        <el-option
          v-for="et in ENTITY_TYPES"
          :key="et.code"
          :label="et.label"
          :value="et.code"
        />
      </el-select>
      <el-input
        :model-value="editor.templateName.value"
        placeholder="模板名称"
        style="width: 260px"
        @update:model-value="(v: string) => editor.templateName.value = v"
      />
      <span class="dirty-tag" v-if="editor.dirty.value">未保存</span>
    </div>
    <div class="right">
      <el-button size="default" @click="$emit('preview')" :disabled="!canPreview">
        <el-icon><View /></el-icon>
        <span style="margin-left: 4px">预览 PDF</span>
      </el-button>
      <el-button type="primary" size="default" @click="$emit('save')" :loading="saving" :disabled="!canSave">
        <el-icon><DocumentChecked /></el-icon>
        <span style="margin-left: 4px">保存</span>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { View, DocumentChecked } from '@element-plus/icons-vue'
import type { PrintEntityType } from '../utils/printSchemaTypes'
import { ENTITY_TYPES } from '../utils/printSchemaTypes'
import type { PrintEditorState } from '../composables/usePrintEditor'

const props = defineProps<{
  editor: PrintEditorState
  saving: boolean
}>()

const emit = defineEmits<{
  preview: []
  save: []
  'change-entity': [PrintEntityType]
}>()

const canPreview = computed(() => {
  return !!props.editor.entityType.value && props.editor.schema.value.elements.length > 0
})

const canSave = computed(() => {
  return !!props.editor.entityType.value && !!props.editor.templateName.value.trim() && props.editor.dirty.value
})

function onEntityChange(v: PrintEntityType) {
  emit('change-entity', v)
}
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}
.left, .right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dirty-tag {
  font-size: 11px;
  color: #d97706;
  background: #fef3c7;
  padding: 2px 8px;
  border-radius: 3px;
  margin-left: 4px;
}
</style>
