<template>
  <div class="field-palette">
    <div class="palette-section" v-for="cat in categories" :key="cat.key">
      <div class="section-title">{{ cat.label }}</div>
      <draggable
        :list="cat.items"
        :group="{ name: 'fields', pull: 'clone', put: false }"
        :clone="cloneItem"
        item-key="type"
        class="palette-list"
      >
        <template #item="{ element }">
          <div class="palette-item">
            <el-icon><component :is="element.icon" /></el-icon>
            <span>{{ element.label }}</span>
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import draggable from 'vuedraggable'
import { FIELD_PALETTE, type PaletteItem } from '../composables/usePageEditor'
import type { DynamicField } from '@/types/canvas'

const emit = defineEmits<{ 'field-added': [field: Partial<DynamicField>] }>()

const categories = computed(() => [
  { key: 'basic', label: '基础字段', items: FIELD_PALETTE.filter(p => p.category === 'basic') },
  { key: 'extended', label: '扩展字段', items: FIELD_PALETTE.filter(p => p.category === 'extended') },
])

function cloneItem(item: PaletteItem): Partial<DynamicField> {
  const field: Partial<DynamicField> = {
    fieldType: item.type,
    label: item.label,
    fieldCode: `field_${Date.now()}`,
    status: 'PENDING_DDL',
    sortOrder: 999,
    config: {},
  }
  emit('field-added', field)
  return field
}
</script>

<style scoped>
.field-palette { padding: 12px; }
.section-title { font-size: 12px; color: #909399; margin: 12px 0 6px; font-weight: 600; }
.palette-list { display: flex; flex-wrap: wrap; gap: 6px; }
.palette-item {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 10px; border: 1px solid #dcdfe6; border-radius: 4px;
  font-size: 13px; cursor: grab; background: #fff;
  transition: border-color 0.2s;
}
.palette-item:hover { border-color: #409eff; color: #409eff; }
</style>
