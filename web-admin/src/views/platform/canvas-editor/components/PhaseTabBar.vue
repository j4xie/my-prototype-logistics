<!-- PhaseTabBar.vue — grouped horizontal tabs with separator -->
<template>
  <div class="phase-tab-bar">
    <!-- Phase A: flow & structure -->
    <div
      v-for="tab in phaseA" :key="tab.key"
      class="phase-tab" :class="{ active: activeTab === tab.key }"
      @click="activeTab = tab.key"
    >
      <span>{{ tab.icon }}</span> {{ tab.label }}
    </div>
    <div class="phase-separator" />
    <!-- Phase B: details & permissions -->
    <div
      v-for="tab in phaseB" :key="tab.key"
      class="phase-tab" :class="{ active: activeTab === tab.key }"
      @click="activeTab = tab.key"
    >
      <span>{{ tab.icon }}</span> {{ tab.label }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditor } from '../composables/useCanvasEditor'

const { activeTab } = useCanvasEditor()

const phaseA = [
  { key: 'workflow', icon: '🔄', label: '流程设计' },
  { key: 'triggers', icon: '🔗', label: '触发链' },
  { key: 'validation', icon: '📐', label: '校验规则' },
]

const phaseB = [
  { key: 'fields', icon: '📋', label: '字段配置' },
  { key: 'permissions', icon: '🛡️', label: '权限矩阵' },
  { key: 'tools', icon: '🔧', label: '工具/技能' },
]
</script>

<style scoped>
.phase-tab-bar {
  display: flex; align-items: center; height: 40px; border-bottom: 1px solid var(--el-border-color);
  padding: 0 8px; flex-shrink: 0;
}
.phase-tab {
  padding: 8px 14px; font-size: 13px; color: var(--el-text-color-secondary);
  cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s;
  display: flex; align-items: center; gap: 4px; white-space: nowrap;
}
.phase-tab:hover { color: var(--el-text-color-primary); }
.phase-tab.active { color: var(--el-color-primary); border-bottom-color: var(--el-color-primary); }
.phase-separator { width: 1px; height: 20px; background: var(--el-border-color); margin: 0 8px; }
</style>
