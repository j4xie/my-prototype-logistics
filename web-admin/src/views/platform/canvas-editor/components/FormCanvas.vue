<template>
  <div class="form-canvas">
    <div class="canvas-toolbar">
      <span class="toolbar-title">{{ props.moduleCode }} — 字段布局</span>
      <el-tag size="small" type="info">{{ fields.length }} 个字段</el-tag>
    </div>

    <draggable
      v-model="fields"
      group="fields"
      item-key="fieldCode"
      class="canvas-field-list"
      ghost-class="ghost"
      @change="onReorder"
    >
      <template #item="{ element, index }">
        <div
          class="canvas-field-item"
          :class="{ selected: selectedField?.fieldCode === element.fieldCode, dynamic: element.source === 'dynamic' }"
          @click="selectField(element)"
        >
          <el-icon class="drag-handle"><Rank /></el-icon>
          <div class="field-info">
            <span class="field-label">{{ element.label }}</span>
            <el-tag size="small" :type="element.source === 'dynamic' ? 'warning' : 'info'">
              {{ element.fieldType || element.type }}
            </el-tag>
            <el-tag v-if="element.status === 'PENDING_DDL'" size="small" type="danger">待发布</el-tag>
          </div>
          <div class="field-code">{{ element.fieldCode || element.code }}</div>
          <el-button
            v-if="element.source === 'dynamic'"
            type="danger" text size="small"
            @click.stop="$emit('remove-field', index)"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </template>
    </draggable>

    <div v-if="fields.length === 0" class="canvas-empty">
      <el-empty description="从左侧拖入字段" :image-size="80" />
    </div>
  </div>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'
import { Rank, Delete } from '@element-plus/icons-vue'
import { usePageEditor } from '../composables/usePageEditor'

const props = defineProps<{
  moduleCode?: string
}>()

defineEmits<{ 'remove-field': [index: number] }>()

const fields = defineModel<any[]>('fields', { required: true })

const { selectedField, selectField, setDirty } = usePageEditor()

function onReorder() {
  setDirty()
  fields.value.forEach((f: any, i: number) => {
    f.sortOrder = i
  })
}
</script>

<style scoped>
.form-canvas { flex: 1; padding: 16px; overflow-y: auto; }
.canvas-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.toolbar-title { font-weight: 600; font-size: 15px; }
.canvas-field-list { display: flex; flex-direction: column; gap: 4px; min-height: 200px; }
.canvas-field-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border: 1px solid #ebeef5; border-radius: 4px; cursor: pointer; background: #fff;
  transition: all 0.2s;
}
.canvas-field-item:hover { border-color: #c0c4cc; }
.canvas-field-item.selected { border-color: #409eff; background: #ecf5ff; }
.canvas-field-item.dynamic { border-left: 3px solid #e6a23c; }
.drag-handle { cursor: grab; color: #c0c4cc; }
.field-info { flex: 1; display: flex; align-items: center; gap: 6px; }
.field-label { font-size: 13px; }
.field-code { font-size: 11px; color: #909399; font-family: monospace; }
.ghost { opacity: 0.5; background: #ecf5ff; }
.canvas-empty { padding: 40px 0; }
</style>
