<template>
  <div class="tab-layout-editor">
    <div class="tab-header">
      <span class="title">Tab 布局配置</span>
      <el-button size="small" @click="addTab">添加 Tab</el-button>
    </div>

    <draggable v-model="tabs" item-key="code" handle=".tab-drag" ghost-class="ghost">
      <template #item="{ element, index }">
        <div class="tab-item">
          <el-icon class="tab-drag"><Rank /></el-icon>
          <el-input v-model="element.label" size="small" style="width: 120px" />
          <el-select v-model="element.type" size="small" style="width: 110px" @change="onTypeChange(element)">
            <el-option label="字段分组" value="fields" />
            <el-option label="子表" value="sub_table" />
            <el-option label="关联表" value="ref_table" />
          </el-select>
          <el-tag size="small" type="info">{{ element.code }}</el-tag>
          <el-button type="danger" text size="small" @click="removeTab(index)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </template>
    </draggable>
  </div>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'
import { Rank, Delete } from '@element-plus/icons-vue'

interface TabItem {
  code: string
  label: string
  type: 'fields' | 'sub_table' | 'ref_table'
  fieldCodes?: string[]
  fieldCode?: string
  refModule?: string
}

const tabs = defineModel<TabItem[]>({ required: true })

function addTab() {
  tabs.value.push({
    code: `tab_${Date.now()}`,
    label: '新 Tab',
    type: 'fields',
  })
}

function removeTab(index: number) {
  tabs.value.splice(index, 1)
}

function onTypeChange(tab: TabItem) {
  if (tab.type === 'fields') { tab.fieldCodes = []; delete tab.fieldCode; delete tab.refModule }
  else if (tab.type === 'sub_table') { delete tab.fieldCodes; tab.fieldCode = ''; delete tab.refModule }
  else if (tab.type === 'ref_table') { delete tab.fieldCodes; delete tab.fieldCode; tab.refModule = '' }
}
</script>

<style scoped>
.tab-layout-editor { padding: 12px; }
.tab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.title { font-weight: 600; font-size: 14px; }
.tab-item { display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid #ebeef5; border-radius: 4px; margin-bottom: 6px; }
.tab-drag { cursor: grab; color: #c0c4cc; }
.ghost { opacity: 0.5; }
</style>
